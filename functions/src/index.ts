Warning: truncated output (original token count: 88551)
Total output lines: 11398

// Keep the existing Gen 1 API contract explicit while using the current SDK.
import * as functions from 'firebase-functions/v1';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  FieldValue,
  GeoPoint,
  getFirestore,
  Timestamp,
  WriteResult,
} from 'firebase-admin/firestore';
import {
  BatchResponse,
  getMessaging,
  MulticastMessage,
} from 'firebase-admin/messaging';
import {getStorage} from 'firebase-admin/storage';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall as onCallV2 } from 'firebase-functions/v2/https';
import {onMessagePublished} from 'firebase-functions/v2/pubsub';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from 'crypto';
import {isIP} from 'net';
import { defineSecret, defineString } from 'firebase-functions/params';
import {
  localizeNotificationCopy,
  resolveNotificationLocale,
} from './notificationI18n';
import {
  evaluateInternalLoginFailure,
  INTERNAL_LOGIN_FAILURE_LIMIT,
} from './internalLoginDefense';
import {
  evaluateInternalSession,
  INTERNAL_SESSION_ABSOLUTE_MS,
  internalSessionFingerprint,
  isInternalSessionCompromise,
} from './internalSessionDefense';
import {
  GooglePlayPublisherClient,
  resolveGooglePlayEntitlement,
} from './googlePlayBilling';

initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();
const storageBucket = getStorage().bucket();
const paddleWebhookSecret = defineSecret('PADDLE_WEBHOOK_SECRET');
const paddleApiKey = defineSecret('PADDLE_API_KEY');
const paddleRecurringAddOnsJson = defineString(
  'PADDLE_RECURRING_ADDONS_JSON',
  {default: '[]'}
);
const platformOwnerEmail = defineString(
  'PLATFORM_OWNER_EMAIL',
  {default: 'freshmartbd123@gmail.com'}
);
const internalDashboardUrl = defineString(
  'INTERNAL_DASHBOARD_URL',
  {default: 'https://kidsguard-screen.vercel.app'}
);
const googlePlayPackageName = defineString(
  'GOOGLE_PLAY_PACKAGE_NAME',
  {default: 'secure.kidsguard.app'}
);
const googlePlaySubscriptionProductId = defineString(
  'GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID',
  {default: 'kidsguard_family'}
);
const googlePlayRtdnTopic = defineString(
  'GOOGLE_PLAY_RTDN_TOPIC',
  {default: 'google-play-rtdn'}
);
const platformEmailFrom = process.env.RESEND_FROM_EMAIL ||
  'KidsGuard <noreply@kidsguard-screen.purevelofood.com>';

const PLATFORM_ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'DEV_ADMIN'
]);
const PLATFORM_STAFF_ROLES = new Set([
  ...PLATFORM_ADMIN_ROLES,
  'EMPLOYEE',
  'ACCOUNTING'
]);
const PLATFORM_ADMIN_MAX_SESSION_SECONDS = INTERNAL_SESSION_ABSOLUTE_MS / 1000;
const ASSIGNABLE_PLATFORM_STAFF_ROLES = new Set([
  'PLATFORM_ADMIN',
  'EMPLOYEE',
  'ACCOUNTING'
]);

type AssignablePlatformStaffRole =
  | 'PLATFORM_ADMIN'
  | 'EMPLOYEE'
  | 'ACCOUNTING';

type PlatformStaffApprovalKind =
  | 'CREATE_ACCOUNT'
  | 'ROLE_CHANGE'
  | 'REACTIVATE';

type PromoCodeType = 'FREE_LIMITED' | 'FREE_FOREVER' | 'PERCENTAGE';

type PromoCodeDocument = {
  code?: string;
  type?: PromoCodeType;
  status?: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  description?: string;
  percentage?: number;
  accessDays?: number;
  expiresAt?: unknown;
  usageLimit?: number | null;
  redemptionCount?: number;
  paddleDiscountId?: string;
  recurringIntervals?: number | null;
};

async function requirePlatformAdmin(
  context: functions.https.CallableContext
): Promise<{uid: string; email: string | null}> {
  const operator = await requireActiveInternalStaff(context);
  if (!PLATFORM_ADMIN_ROLES.has(operator.role)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Active platform administrator access required.'
    );
  }
  return {uid: operator.uid, email: operator.email};
}

async function requireActiveInternalStaff(
  context: functions.https.CallableContext,
  options: {requireSession?: boolean} = {}
): Promise<{uid: string; email: string | null; role: string}> {
  if (!context.auth || context.auth.token.email_verified !== true) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Verified administrator sign-in required.'
    );
  }

  const authTime = Number(context.auth.token.auth_time);
  const sessionAgeSeconds = Math.floor(Date.now() / 1000) - authTime;
  if (
    !Number.isFinite(authTime) ||
    sessionAgeSeconds < 0 ||
    sessionAgeSeconds >= PLATFORM_ADMIN_MAX_SESSION_SECONDS
  ) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Your internal session has expired. Sign in again to continue.'
    );
  }

  const adminSnapshot = await db
    .collection('platformAdmins')
    .doc(context.auth.uid)
    .get();
  const adminData = adminSnapshot.data();
  const role = String(adminData?.role || '');
  if (
    !adminSnapshot.exists ||
    adminData?.active !== true ||
    !PLATFORM_STAFF_ROLES.has(role)
  ) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Active platform administrator access required.'
    );
  }

  const firebaseClaims = context.auth.token.firebase as
    | {sign_in_second_factor?: unknown}
    | undefined;
  if (
    PLATFORM_ADMIN_ROLES.has(role) &&
    firebaseClaims?.sign_in_second_factor !== 'totp'
  ) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Authenticator verification is required for administrator actions.'
    );
  }

  await assertInternalLoginIpAllowed(context.rawRequest);

  if (options.requireSession !== false) {
    await assertActiveInternalAdminSession(context, {
      uid: context.auth.uid,
      email: typeof context.auth.token.email === 'string'
        ? context.auth.token.email
        : null,
      role,
    });
  }

  return {
    uid: context.auth.uid,
    email: typeof context.auth.token.email === 'string'
      ? context.auth.token.email
      : null,
    role
  };
}

function internalLoginClientIp(request: functions.https.Request): string {
  const normalize = (value: unknown): string => {
    let candidate = String(value || '').trim();
    if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7);
    const bracketedIpv6 = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketedIpv6) candidate = bracketedIpv6[1];
    return isIP(candidate) ? candidate : '';
  };
  // Google Cloud Functions adds X-Forwarded-For and documents the first
  // address as the originating client in the normal direct-call path.
  const forwardedIp = normalize(
    String(request.get('x-forwarded-for') || '').split(',')[0]
  );
  const directIp = normalize(request.ip || request.socket.remoteAddress);
  const ip = forwardedIp || directIp;
  if (!ip) {
    throw new functions.https.HttpsError(
      'internal',
      'Client network identity is unavailable.'
    );
  }
  return ip;
}

function internalLoginIpHash(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

function internalLoginIpRef(request: functions.https.Request) {
  const ip = internalLoginClientIp(request);
  return {
    ip,
    ref: db.collection('internalLoginIpBlocks').doc(internalLoginIpHash(ip))
  };
}

type InternalStaffIdentity = {
  uid: string;
  email: string | null;
  role: string;
};

function internalSessionRef(uid: string): DocumentReference {
  return db.collection('internalAdminSessions').doc(uid);
}

function internalSessionAuthTime(
  context: functions.https.CallableContext
): number {
  const authTime = Number(context.auth?.token.auth_time);
  if (!Number.isFinite(authTime) || authTime <= 0) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Secure internal session identity is unavailable. Sign in again.'
    );
  }
  return authTime;
}

function internalSessionRequestContext(
  context: functions.https.CallableContext
): {
  ip: string;
  ipHash: string;
  userAgent: string;
  userAgentHash: string;
} {
  const ip = internalLoginClientIp(context.rawRequest);
  const fingerprint = internalSessionFingerprint({
    ip,
    userAgent: context.rawRequest.get('user-agent'),
  });
  return {ip, ...fingerprint};
}

function internalSessionExpiresAtMillis(authTime: number): number {
  return authTime * 1000 + INTERNAL_SESSION_ABSOLUTE_MS;
}

function internalSessionEvaluationData(value: DocumentData | undefined) {
  const expiresAt = value?.expiresAt;
  return value ? {
    state: value.state,
    authTime: value.authTime,
    expiresAtMillis: expiresAt instanceof Timestamp ? expiresAt.toMillis() : 0,
    ipHash: value.ipHash,
    userAgentHash: value.userAgentHash,
  } : null;
}

async function compromiseInternalAdminSession(
  context: functions.https.CallableContext,
  operator: InternalStaffIdentity
): Promise<never> {
  const authTime = internalSessionAuthTime(context);
  const requestContext = internalSessionRequestContext(context);
  const sessionRef = internalSessionRef(operator.uid);
  const now = Date.now();

  const result = await db.runTransaction(async transaction => {
    const sessionSnapshot = await transaction.get(sessionRef);
    const session = sessionSnapshot.data();
    const decision = evaluateInternalSession(
      internalSessionEvaluationData(session),
      {
        authTime,
        nowMillis: now,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
      }
    );

    if (!isInternalSessionCompromise(decision)) {
      return {compromised: false, decision};
    }

    const sessionId = String(session?.sessionId || randomUUID());
    const eventId = `session-compromise-${sessionId}`;
    const nowTimestamp = Timestamp.fromMillis(now);
    const event = {
      eventId,
      type: 'INTERNAL_SESSION_COMPROMISED',
      uid: operator.uid,
      email: operator.email,
      role: operator.role,
      sessionId,
      reason: decision,
      originalIp: String(session?.ip || 'Unavailable'),
      observedIp: requestContext.ip,
      originalUserAgent: String(session?.userAgent || 'Unknown browser'),
      observedUserAgent: requestContext.userAgent,
      createdAt: nowTimestamp,
    };

    transaction.update(sessionRef, {
      state: 'COMPROMISED',
      compromiseReason: decision,
      compromisedAt: nowTimestamp,
      observedIpHash: requestContext.ipHash,
      observedUserAgentHash: requestContext.userAgentHash,
      updatedAt: nowTimestamp,
    });
    transaction.set(
      db.collection('internalSessionSecurityEvents').doc(eventId),
      event,
      {merge: true}
    );
    transaction.set(
      db.collection('internalSessionSecurityAlerts').doc(eventId),
      {...event, deliveryStatus: 'PENDING'},
      {merge: true}
    );
    return {compromised: true, decision};
  });

  if (result.compromised) {
    try {
      await getAuth().revokeRefreshTokens(operator.uid);
    } catch (error) {
      console.error('Failed to revoke compromised internal refresh tokens', {
        uid: operator.uid,
        error,
      });
    }
    throw new functions.https.HttpsError(
      'permission-denied',
      'Secure internal session mismatch detected. All sessions were revoked.'
    );
  }

  throw new functions.https.HttpsError(
    'unauthenticated',
    result.decision === 'EXPIRED'
      ? 'Your internal session has expired. Sign in again to continue.'
      : 'Secure internal session is unavailable. Sign in again.'
  );
}

async function assertActiveInternalAdminSession(
  context: functions.https.CallableContext,
  operator: InternalStaffIdentity
): Promise<void> {
  const authTime = internalSessionAuthTime(context);
  const requestContext = internalSessionRequestContext(context);
  const sessionRef = internalSessionRef(operator.uid);
  const sessionSnapshot = await sessionRef.get();
  const session = sessionSnapshot.data();
  const now = Date.now();
  const decision = evaluateInternalSession(
    internalSessionEvaluationData(session),
    {
      authTime,
      nowMillis: now,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    }
  );

  if (decision === 'VALID') {
    const lastSeenAt = session?.lastSeenAt;
    const lastSeenMillis = lastSeenAt instanceof Timestamp
      ? lastSeenAt.toMillis()
      : 0;
    if (now - lastSeenMillis >= 5 * 60 * 1000) {
      await sessionRef.update({
        lastSeenAt: Timestamp.fromMillis(now),
        updatedAt: Timestamp.fromMillis(now),
      });
    }
    return;
  }

  if (isInternalSessionCompromise(decision)) {
    await compromiseInternalAdminSession(context, operator);
  }

  throw new functions.https.HttpsError(
    'unauthenticated',
    decision === 'EXPIRED'
      ? 'Your internal session has expired. Sign in again to continue.'
      : 'Secure internal session is unavailable. Sign in again.'
  );
}

async function beginInternalAdminSession(
  context: functions.https.CallableContext,
  operator: InternalStaffIdentity
): Promise<{sessionId: string; expiresAt: string}> {
  const authTime = internalSessionAuthTime(context);
  const requestContext = internalSessionRequestContext(context);
  const sessionRef = internalSessionRef(operator.uid);
  const existingSnapshot = await sessionRef.get();
  const existing = existingSnapshot.data();
  const existingAuthTime = Number(existing?.authTime || 0);

  if (existingSnapshot.exists && existingAuthTime === authTime) {
    await assertActiveInternalAdminSession(context, operator);
    const existingExpiry = existing?.expiresAt;
    return {
      sessionId: String(existing?.sessionId || ''),
      expiresAt: existingExpiry instanceof Timestamp
        ? existingExpiry.toDate().toISOString()
        : new Date(internalSessionExpiresAtMillis(authTime)).toISOString(),
    };
  }

  if (existingSnapshot.exists && existingAuthTime > authTime) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'A newer internal session is already active. Sign in again.'
    );
  }

  const sessionId = randomUUID();
  const nowTimestamp = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(internalSessionExpiresAtMillis(authTime));
  await sessionRef.set({
    sessionId,
    uid: operator.uid,
    email: operator.email,
    role: operator.role,
    state: 'ACTIVE',
    authTime,
    ip: requestContext.ip,
    ipHash: requestContext.ipHash,
    userAgent: requestContext.userAgent,
    userAgentHash: requestContext.userAgentHash,
    createdAt: nowTimestamp,
    lastSeenAt: nowTimestamp,
    expiresAt,
    updatedAt: nowTimestamp,
  });
  await db.collection('internalSessionSecurityEvents').add({
    type: existingSnapshot.exists
      ? 'INTERNAL_SESSION_REPLACED'
      : 'INTERNAL_SESSION_STARTED',
    uid: operator.uid,
    email: operator.email,
    role: operator.role,
    sessionId,
    createdAt: nowTimestamp,
  });
  return {sessionId, expiresAt: expiresAt.toDate().toISOString()};
}

async function assertInternalLoginIpAllowed(
  request: functions.https.Request
): Promise<void> {
  const {ref} = internalLoginIpRef(request);
  const snapshot = await ref.get();
  if (snapshot.data()?.status === 'BLOCKED') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Access blocked. Contact your God Father!'
    );
  }
}

async function requirePlatformOwner(
  context: functions.https.CallableContext
): Promise<{uid: string; email: string}> {
  const operator = await requirePlatformAdmin(context);
  const ownerEmail = normalizePlatformEmail(platformOwnerEmail.value());
  const operatorEmail = normalizePlatformEmail(operator.email);
  const ownerSnapshot = await db
    .collection('platformAdmins')
    .doc(operator.uid)
    .get();

  if (
    ownerSnapshot.data()?.role !== 'SUPER_ADMIN' ||
    !ownerEmail ||
    operatorEmail !== ownerEmail
  ) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the verified Super Admin owner can review this request.'
    );
  }

  return {uid: operator.uid, email: operatorEmail};
}

function normalizePlatformEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePlatformStaffRole(
  value: unknown
): AssignablePlatformStaffRole {
  const role = String(value || '').trim().toUpperCase();
  if (!ASSIGNABLE_PLATFORM_STAFF_ROLES.has(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Select Admin, Employee, or Accounting.'
    );
  }
  return role as AssignablePlatformStaffRole;
}

function platformStaffRoleLabel(role: string): string {
  if (role === 'PLATFORM_ADMIN') return 'Admin';
  if (role === 'ACCOUNTING') return 'Accounting';
  return 'Employee';
}

function platformApprovalTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function platformApprovalTokenMatches(
  suppliedToken: string,
  expectedHash: unknown
): boolean {
  const supplied = Buffer.from(platformApprovalTokenHash(suppliedToken), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function platformApprovalUrls(
  requestId: string,
  token: string
): {approve: string; reject: string} {
  const base = internalDashboardUrl.value().replace(/\/$/, '');
  const buildUrl = (decision: 'approve' | 'reject') => {
    const url = new URL('/internal/team', base);
    url.searchParams.set('requestId', requestId);
    url.searchParams.set('token', token);
    url.searchParams.set('decision', decision);
    return url.toString();
  };
  return {approve: buildUrl('approve'), reject: buildUrl('reject')};
}

async function sendPlatformOwnerApprovalEmail(input: {
  requestId: string;
  token: string;
  kind: PlatformStaffApprovalKind;
  targetEmail: string;
  displayName: string;
  requestedRole: AssignablePlatformStaffRole;
  requestedByEmail: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const {Resend} = await import('resend');
  const resend = new Resend(apiKey);
  const urls = platformApprovalUrls(input.requestId, input.token);
  const action = input.kind === 'CREATE_ACCOUNT'
    ? 'New internal account'
    : input.kind === 'REACTIVATE'
      ? 'Internal account reactivation'
      : 'Internal role change';
  const result = await resend.emails.send({
    from: platformEmailFrom,
    to: platformOwnerEmail.value(),
    subject: `[Approval required] ${action}: ${input.targetEmail}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">KidsGuard owner approval required</h2>
        <p style="line-height:1.6">No access has been granted. Sign in with your Super Admin account and authenticator before approving.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>Action</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(action)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>Name</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.displayName)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.targetEmail)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>Requested role</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(platformStaffRoleLabel(input.requestedRole))}</td></tr>
          <tr><td style="padding:8px"><strong>Requested by</strong></td><td style="padding:8px">${escapeEmailHtml(input.requestedByEmail || 'Unknown')}</td></tr>
        </table>
        <p style="margin:24px 0">
          <a href="${escapeEmailHtml(urls.approve)}" style="display:inline-block;background:#059669;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;margin-right:8px">Review &amp; approve</a>
          <a href="${escapeEmailHtml(urls.reject)}" style="display:inline-block;background:#be123c;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Review &amp; reject</a>
        </p>
        <p style="font-size:12px;color:#64748b;line-height:1.6">This one-time link expires after 48 hours. The link alone cannot approve access; owner password and TOTP verification are also required.</p>
      </div>`
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function sendPlatformOwnerApprovalPush(input: {
  requestId: string;
  token: string;
  kind: PlatformStaffApprovalKind;
  targetEmail: string;
  displayName: string;
  requestedRole: AssignablePlatformStaffRole;
}): Promise<boolean> {
  const ownerEmail = normalizePlatformEmail(platformOwnerEmail.value());
  if (!ownerEmail) return false;

  const ownerUser = await getAuth().getUserByEmail(ownerEmail);
  const ownerProfile = await db.collection('platformAdmins').doc(ownerUser.uid).get();
  if (
    !ownerProfile.exists ||
    ownerProfile.data()?.active !== true ||
    ownerProfile.data()?.role !== 'SUPER_ADMIN'
  ) {
    console.warn('Platform owner push skipped: active Super Admin profile not found.');
    return false;
  }

  const tokenSnapshot = await db
    .collection('users')
    .doc(ownerUser.uid)
    .collection('notificationTokens')
    .get();
  const tokenDocuments = tokenSnapshot.docs.filter(document => {
    const data = document.data();
    return data.enabled !== false && typeof data.token === 'string' && data.token;
  });
  if (tokenDocuments.length === 0) {
    console.info('Platform owner push skipped: no enabled notification token.');
    return false;
  }

  const action = input.kind === 'CREATE_ACCOUNT'
    ? 'New internal account'
    : input.kind === 'REACTIVATE'
      ? 'Internal account reactivation'
      : 'Internal role change';
  const approveUrl = platformApprovalUrls(input.requestId, input.token).approve;
  const title = 'Team access approval required';
  const body = `${action}: ${input.displayName} (${platformStaffRoleLabel(input.requestedRole)}). Tap to review and approve.`;
  const tokenBatches: typeof tokenDocuments[] = [];
  for (let start = 0; start < tokenDocuments.length; start += 500) {
    tokenBatches.push(tokenDocuments.slice(start, start + 500));
  }

  let successCount = 0;
  for (const documents of tokenBatches) {
    const response = await getMessaging().sendEachForMulticast({
      tokens: documents.map(document => String(document.data().token)),
      notification: {title, body},
      data: {
        type: 'PLATFORM_STAFF_APPROVAL',
        eventId: input.requestId,
        requestId: input.requestId,
        targetEmail: input.targetEmail,
        title,
        body,
        clickAction: approveUrl,
        url: approveUrl
      },
      webpush: {
        notification: {
          icon: `${internalDashboardUrl.value().replace(/\/$/, '')}/app-icon.png`,
          badge: `${internalDashboardUrl.value().replace(/\/$/, '')}/symbol.png`
        },
        fcmOptions: {link: approveUrl}
      }
    });
    successCount += response.successCount;

    const invalidDeletes: Promise<WriteResult>[] = [];
    response.responses.forEach((result, index) => {
      const code = result.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidDeletes.push(documents[index].ref.delete());
      }
    });
    await Promise.all(invalidDeletes);
  }

  return successCount > 0;
}

async function sendPlatformStaffInviteEmail(input: {
  email: string;
  displayName: string;
  role: AssignablePlatformStaffRole;
  resetUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  const {Resend} = await import('resend');
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: platformEmailFrom,
    to: input.email,
    subject: `Your KidsGuard ${platformStaffRoleLabel(input.role)} account is approved`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to KidsGuard Internal</h2>
        <p style="line-height:1.6">Hello ${escapeEmailHtml(input.displayName)}, your ${escapeEmailHtml(platformStaffRoleLabel(input.role))} access was approved by the Super Admin.</p>
        <p style="line-height:1.6">Set your password using the secure link below. Your first sign-in will also require authenticator setup.</p>
        <p style="margin:24px 0"><a href="${escapeEmailHtml(input.resetUrl)}" style="display:inline-block;background:#e11d48;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Set password</a></p>
        <p style="font-size:12px;color:#64748b">If you did not expect this invitation, do not use the link and contact the Super Admin.</p>
      </div>`
  });
  if (result.error) throw new Error(result.error.message);
}

function platformApprovalExpiry(): Timestamp {
  return Timestamp.fromMillis(
    Date.now() + 48 * 60 * 60 * 1000
  );
}

async function createPlatformApprovalRequest(input: {
  kind: PlatformStaffApprovalKind;
  targetUid: string;
  targetEmail: string;
  displayName: string;
  currentRole: string | null;
  requestedRole: AssignablePlatformStaffRole;
  requestedActive: boolean;
  operator: {uid: string; email: string | null};
}): Promise<{requestId: string; token: string}> {
  const requestRef = db.collection('platformStaffApprovalRequests').doc();
  const secretRef = db.collection('platformStaffApprovalSecrets').doc(requestRef.id);
  const token = randomBytes(32).toString('base64url');
  const batch = db.batch();
  batch.set(requestRef, {
    requestId: requestRef.id,
    kind: input.kind,
    status: 'PENDING',
    targetUid: input.targetUid,
    targetEmail: input.targetEmail,
    displayName: input.displayName,
    currentRole: input.currentRole,
    requestedRole: input.requestedRole,
    requestedActive: input.requestedActive,
    requestedBy: input.operator.uid,
    requestedByEmail: input.operator.email,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: platformApprovalExpiry(),
    notificationStatus: 'PENDING'
  });
  batch.set(secretRef, {
    requestId: requestRef.id,
    tokenHash: platformApprovalTokenHash(token),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: platformApprovalExpiry()
  });
  batch.update(db.collection('platformAdmins').doc(input.targetUid), {
    pendingApprovalRequestId: requestRef.id,
    approvalStatus: 'PENDING',
    updatedAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
  return {requestId: requestRef.id, token};
}

async function deliverPlatformApprovalRequest(
  requestId: string,
  token: string
): Promise<boolean> {
  const requestRef = db.collection('platformStaffApprovalRequests').doc(requestId);
  const requestSnapshot = await requestRef.get();
  const data = requestSnapshot.data();
  if (!requestSnapshot.exists || data?.status !== 'PENDING') return false;

  const notificationInput = {
    requestId,
    token,
    kind: data.kind as PlatformStaffApprovalKind,
    targetEmail: String(data.targetEmail || ''),
    displayName: String(data.displayName || ''),
    requestedRole: data.requestedRole as AssignablePlatformStaffRole,
    requestedByEmail: typeof data.requestedByEmail === 'string'
      ? data.requestedByEmail
      : null
  };
  const [emailResult, pushResult] = await Promise.allSettled([
    sendPlatformOwnerApprovalEmail(notificationInput),
    sendPlatformOwnerApprovalPush(notificationInput)
  ]);
  const emailSent = emailResult.status === 'fulfilled';
  const pushSent = pushResult.status === 'fulfilled' && pushResult.value;

  if (emailResult.status === 'rejected') {
    console.error('Platform owner approval email failed:', emailResult.reason);
  }
  if (pushResult.status === 'rejected') {
    console.error('Platform owner approval push failed:', pushResult.reason);
  }

  await requestRef.update({
    notificationStatus: emailSent ? 'SENT' : 'FAILED',
    ...(emailSent
      ? {notificationSentAt: FieldValue.serverTimestamp()}
      : {notificationFailedAt: FieldValue.serverTimestamp()}),
    pushNotificationStatus: pushSent
      ? 'SENT'
      : pushResult.status === 'rejected'
        ? 'FAILED'
        : 'UNAVAILABLE',
    ...(pushSent
      ? {pushNotificationSentAt: FieldValue.serverTimestamp()}
      : {})
  });
  return emailSent;
}

function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as {code?: unknown}).code || '')
    : '';
}

async function consumePlatformApprovalRateLimit(actorUid: string): Promise<void> {
  const limitRef = db.collection('platformStaffRateLimits').doc(actorUid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(limitRef);
    const data = snapshot.data();
    const now = Date.now();
    const windowStartedAt = data?.windowStartedAt?.toMillis?.() || 0;
    const withinWindow = now - windowStartedAt < 60 * 60 * 1000;
    const requestCount = withinWindow ? Number(data?.requestCount || 0) : 0;
    if (requestCount >= 20) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many team access requests. Try again after one hour.'
      );
    }
    transaction.set(limitRef, {
      actorUid,
      requestCount: requestCount + 1,
      windowStartedAt: withinWindow
        ? data?.windowStartedAt
        : Timestamp.fromMillis(now),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  });
}

export const requestPlatformStaffAccount = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    const operator = await requirePlatformAdmin(context);
    const displayName = String(data?.displayName || '').trim();
    const email = normalizePlatformEmail(data?.email);
    const requestedRole = normalizePlatformStaffRole(data?.role);

    if (displayName.length < 2 || displayName.length > 100) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Employee name must contain 2-100 characters.'
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Enter a valid work email address.'
      );
    }
    if (email === normalizePlatformEmail(platformOwnerEmail.value())) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The Super Admin owner account cannot be recreated.'
      );
    }
    await consumePlatformApprovalRateLimit(operator.uid);

    try {
      await getAuth().getUserByEmail(email);
      throw new functions.https.HttpsError(
        'already-exists',
        'This email already has a Firebase account. Use a separate work email.'
      );
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      if (authErrorCode(error) !== 'auth/user-not-found') throw error;
    }

    const authUser = await getAuth().createUser({
      email,
      displayName,
      password: randomBytes(48).toString('base64url'),
      emailVerified: false,
      disabled: true
    });
    const profileRef = db.collection('platformAdmins').doc(authUser.uid);

    try {
      await profileRef.set({
        uid: authUser.uid,
        email,
        displayName,
        role: requestedRole,
        active: false,
        approvalStatus: 'PENDING',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: operator.uid,
        createdByEmail: operator.email
      });
      const approval = await createPlatformApprovalRequest({
        kind: 'CREATE_ACCOUNT',
        targetUid: authUser.uid,
        targetEmail: email,
        displayName,
        currentRole: null,
        requestedRole,
        requestedActive: true,
        operator
      });
      const notificationSent = await deliverPlatformApprovalRequest(
        approval.requestId,
        approval.token
      );
      return {success: true, requestId: approval.requestId, notificationSent};
    } catch (error) {
      await Promise.allSettled([
        getAuth().deleteUser(authUser.uid),
        profileRef.delete()
      ]);
      throw error;
    }
  });

export const requestPlatformStaffChange = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    const operator = await requirePlatformAdmin(context);
    const targetUid = String(data?.uid || '').trim();
    const requestedRole = normalizePlatformStaffRole(data?.role);
    const requestedActive = data?.active === true;
    if (!targetUid) {
      throw new functions.https.HttpsError('invalid-argument', 'User is required.');
    }

    const profileRef = db.collection('platformAdmins').doc(targetUid);
    const profileSnapshot = await profileRef.get();
    const profile = profileSnapshot.data();
    if (!profileSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Internal profile not found.');
    }
    if (
      profile?.role === 'SUPER_ADMIN' ||
      normalizePlatformEmail(profile?.email) ===
        normalizePlatformEmail(platformOwnerEmail.value())
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'The Super Admin owner profile cannot be changed.'
      );
    }
    const pendingId = String(profile?.pendingApprovalRequestId || '');
    if (pendingId) {
      const pending = await db
        .collection('platformStaffApprovalRequests')
        .doc(pendingId)
        .get();
      if (pending.data()?.status === 'PENDING') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This profile already has a pending owner approval.'
        );
      }
    }
    if (profile?.role === requestedRole && profile?.active === requestedActive) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The requested access is already active.'
      );
    }
    if (!requestedActive) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Use the immediate deactivate action to remove access.'
      );
    }
    await consumePlatformApprovalRateLimit(operator.uid);

    const kind: PlatformStaffApprovalKind = profile?.active === true
      ? 'ROLE_CHANGE'
      : 'REACTIVATE';
    const approval = await createPlatformApprovalRequest({
      kind,
      targetUid,
      targetEmail: normalizePlatformEmail(profile?.email),
      displayName: String(profile?.displayName || profile?.email || 'Employee'),
      currentRole: String(profile?.role || ''),
      requestedRole,
      requestedActive: true,
      operator
    });
    const notificationSent = await deliverPlatformApprovalRequest(
      approval.requestId,
      approval.token
    );
    return {success: true, requestId: approval.requestId, notificationSent};
  });

export const resendPlatformStaffApproval = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    const operator = await requirePlatformAdmin(context);
    const requestId = String(data?.requestId || '').trim();
    const requestRef = db.collection('platformStaffApprovalRequests').doc(requestId);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists || requestSnapshot.data()?.status !== 'PENDING') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Only pending requests can be resent.'
      );
    }
    await consumePlatformApprovalRateLimit(operator.uid);

    const token = randomBytes(32).toString('base64url');
    await db.collection('platformStaffApprovalSecrets').doc(requestId).set({
      requestId,
      tokenHash: platformApprovalTokenHash(token),
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: platformApprovalExpiry()
    });
    await requestRef.update({
      expiresAt: platformApprovalExpiry(),
      notificationStatus: 'PENDING'
    });
    const notificationSent = await deliverPlatformApprovalRequest(requestId, token);
    if (!notificationSent) {
      throw new functions.https.HttpsError(
        'unavailable',
        'The approval email could not be delivered.'
      );
    }
    return {success: true};
  });

export const deactivatePlatformStaff = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    const operator = await requirePlatformAdmin(context);
    const targetUid = String(data?.uid || '').trim();
    const profileRef = db.collection('platformAdmins').doc(targetUid);
    const profileSnapshot = await profileRef.get();
    const profile = profileSnapshot.data();
    if (!profileSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Internal profile not found.');
    }
    if (
      profile?.role === 'SUPER_ADMIN' ||
      normalizePlatformEmail(profile?.email) ===
        normalizePlatformEmail(platformOwnerEmail.value())
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'The Super Admin owner cannot be deactivated.'
      );
    }

    await getAuth().updateUser(targetUid, {disabled: true});
    const pendingId = String(profile?.pendingApprovalRequestId || '');
    const batch = db.batch();
    batch.update(profileRef, {
      active: false,
      pendingApprovalRequestId: FieldValue.delete(),
      lastApprovalRequestId: FieldValue.delete(),
      deactivatedAt: FieldValue.serverTimestamp(),
      deactivatedBy: operator.uid,
      updatedAt: FieldValue.serverTimestamp()
    });
    if (pendingId) {
      batch.set(
        db.collection('platformStaffApprovalRequests').doc(pendingId),
        {
          status: 'CANCELED',
          canceledAt: FieldValue.serverTimestamp(),
          canceledBy: operator.uid
        },
        {merge: true}
      );
      batch.delete(db.collection('platformStaffApprovalSecrets').doc(pendingId));
    }
    await batch.commit();

    try {
      const {Resend} = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: platformEmailFrom,
        to: platformOwnerEmail.value(),
        subject: `[Security notice] Internal access deactivated: ${profile?.email || targetUid}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h2>Internal access removed</h2><p>${escapeEmailHtml(profile?.email || targetUid)} was deactivated immediately by ${escapeEmailHtml(operator.email || operator.uid)}.</p><p>No owner approval was required because this action only removes access.</p></div>`
      });
    } catch (error) {
      console.error('Platform deactivation notice failed:', error);
    }
    return {success: true};
  });

export const reviewPlatformStaffRequest = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    const owner = await requirePlatformOwner(context);
    const requestId = String(data?.requestId || '').trim();
    const token = String(data?.token || '').trim();
    const decision = String(data?.decision || '').trim().toUpperCase();
    if (!requestId || token.length < 32 || !['APPROVE', 'REJECT'].includes(decision)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid approval request, token, and decision are required.'
      );
    }

    const requestRef = db.collection('platformStaffApprovalRequests').doc(requestId);
    const secretRef = db.collection('platformStaffApprovalSecrets').doc(requestId);
    const [requestSnapshot, secretSnapshot] = await Promise.all([
      requestRef.get(),
      secretRef.get()
    ]);
    const request = requestSnapshot.data();
    const secret = secretSnapshot.data();
    if (
      !requestSnapshot.exists ||
      !secretSnapshot.exists ||
      request?.status !== 'PENDING'
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This request is no longer pending.'
      );
    }
    const expiresAt = request?.expiresAt?.toMillis?.() || 0;
    if (expiresAt <= Date.now()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'This approval link has expired. Resend it from Team Access.'
      );
    }
    if (!platformApprovalTokenMatches(token, secret?.tokenHash)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'The approval token is invalid.'
      );
    }

    const targetUid = String(request?.targetUid || '');
    const targetEmail = normalizePlatformEmail(request?.targetEmail);
    const requestedRole = normalizePlatformStaffRole(request?.requestedRole);
    const requestedActive = request?.requestedActive === true;
    const profileRef = db.collection('platformAdmins').doc(targetUid);
    const profileSnapshot = await profileRef.get();
    if (!targetUid || !profileSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Target profile not found.');
    }
    const profile = profileSnapshot.data();
    const targetAuthUser = await getAuth().getUser(targetUid);
    if (
      profile?.pendingApprovalRequestId !== requestId ||
      normalizePlatformEmail(targetAuthUser.email) !== targetEmail ||
      requestedActive !== true
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The target account no longer matches this approval request.'
      );
    }
    if (
      (request?.kind === 'CREATE_ACCOUNT' && profile?.active === true) ||
      (
        request?.kind === 'ROLE_CHANGE' &&
        (
          profile?.active !== true ||
          String(profile?.role || '') !== String(request?.currentRole || '')
        )
      ) ||
      (request?.kind === 'REACTIVATE' && profile?.active === true)
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The target account changed after this request was created.'
      );
    }

    if (decision === 'REJECT') {
      const keepExistingAccess = request?.kind === 'ROLE_CHANGE' &&
        profile?.active === true;
      await getAuth().updateUser(targetUid, {
        disabled: !keepExistingAccess
      });
      const batch = db.batch();
      batch.update(requestRef, {
        status: 'REJECTED',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: owner.uid,
        reviewedByEmail: owner.email
      });
      batch.update(profileRef, {
        active: keepExistingAccess,
        approvalStatus: keepExistingAccess ? 'APPROVED' : 'REJECTED',
        lastRequestStatus: 'REJECTED',
        pendingApprovalRequestId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.delete(secretRef);
      await batch.commit();
      return {success: true, decision: 'REJECTED'};
    }

    await getAuth().updateUser(targetUid, {
      disabled: !requestedActive,
      emailVerified: requestedActive
    });
    const batch = db.batch();
    batch.update(requestRef, {
      status: 'APPROVED',
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: owner.uid,
      reviewedByEmail: owner.email,
      appliedRole: requestedRole,
      appliedActive: requestedActive
    });
    batch.update(profileRef, {
      role: requestedRole,
      active: requestedActive,
      approvalStatus: 'APPROVED',
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: owner.uid,
      approvedByEmail: owner.email,
      lastApprovalRequestId: requestId,
      pendingApprovalRequestId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    batch.delete(secretRef);
    await batch.commit();

    let invitationSent = true;
    if (request?.kind === 'CREATE_ACCOUNT') {
      try {
        const resetUrl = await getAuth().generatePasswordResetLink(
          targetEmail,
          {
            url: `${internalDashboardUrl.value().replace(/\/$/, '')}/internal/login`,
            handleCodeInApp: false
          }
        );
        await sendPlatformStaffInviteEmail({
          email: targetEmail,
          displayName: String(request?.displayName || targetEmail),
          role: requestedRole,
          resetUrl
        });
      } catch (error) {
        invitationSent = false;
        console.error('Approved staff invitation email failed:', error);
        await profileRef.update({invitationStatus: 'FAILED'});
      }
    }

    return {
      success: true,
      decision: 'APPROVED',
      invitationSent
    };
  });

export const resendPlatformStaffInvite = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    await requirePlatformAdmin(context);
    const targetUid = String(data?.uid || '').trim();
    const profileSnapshot = await db
      .collection('platformAdmins')
      .doc(targetUid)
      .get();
    const profile = profileSnapshot.data();
    if (
      !profileSnapshot.exists ||
      profile?.active !== true ||
      !ASSIGNABLE_PLATFORM_STAFF_ROLES.has(String(profile?.role || ''))
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Only an approved active profile can receive an invitation.'
      );
    }
    const email = normalizePlatformEmail(profile?.email);
    const resetUrl = await getAuth().generatePasswordResetLink(email, {
      url: `${internalDashboardUrl.value().replace(/\/$/, '')}/internal/login`,
      handleCodeInApp: false
    });
    await sendPlatformStaffInviteEmail({
      email,
      displayName: String(profile?.displayName || email),
      role: profile?.role as AssignablePlatformStaffRole,
      resetUrl
    });
    await profileSnapshot.ref.update({
      invitationStatus: 'SENT',
      invitationSentAt: FieldValue.serverTimestamp()
    });
    return {success: true};
  });

export const enforcePlatformStaffApproval = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .firestore.document('platformAdmins/{uid}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.data();
    if (after?.active !== true) return;

    const changed = !before ||
      before.active !== after.active ||
      before.role !== after.role ||
      normalizePlatformEmail(before.email) !== normalizePlatformEmail(after.email);
    if (!changed) return;

    const authUser = await getAuth().getUser(context.params.uid);
    const actualEmail = normalizePlatformEmail(authUser.email);
    const ownerEmail = normalizePlatformEmail(platformOwnerEmail.value());
    if (actualEmail === ownerEmail && after.role === 'SUPER_ADMIN') return;

    const approvalId = String(after.lastApprovalRequestId || '');
    const approval = approvalId
      ? await db.collection('platformStaffApprovalRequests').doc(approvalId).get()
      : null;
    const approvalData = approval?.data();
    const authorized = approval?.exists === true &&
      approvalData?.status === 'APPROVED' &&
      approvalData?.targetUid === context.params.uid &&
      approvalData?.appliedRole === after.role &&
      approvalData?.appliedActive === true &&
      normalizePlatformEmail(approvalData?.reviewedByEmail) === ownerEmail;
    if (authorized) return;

    await getAuth().updateUser(context.params.uid, {disabled: true});
    await change.after.ref.update({
      active: false,
      approvalStatus: 'SECURITY_HOLD',
      securityHoldAt: FieldValue.serverTimestamp(),
      securityHoldReason: 'UNAPPROVED_PRIVILEGE_CHANGE'
    });

    try {
      const {Resend} = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: platformEmailFrom,
        to: platformOwnerEmail.value(),
        subject: `[Security hold] Unapproved internal access blocked: ${actualEmail || context.params.uid}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h2>Unapproved privilege change blocked</h2><p>KidsGuard automatically disabled ${escapeEmailHtml(actualEmail || context.params.uid)} because an active internal role change had no valid Super Admin approval record.</p><p>Review Team Access and Firebase audit logs before restoring access.</p></div>`
      });
    } catch (error) {
      console.error('Security hold email failed:', error);
    }
  });

function normalizePromoCode(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function promoTimestampMillis(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function promoCodeError(
  code: functions.https.FunctionsErrorCode,
  message: string
): never {
  throw new functions.https.HttpsError(code, message);
}

async function callPaddleDiscountApi(
  method: 'POST' | 'PATCH',
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, any>> {
  const apiKey = paddleApiKey.value().trim();
  if (!apiKey) {
    return promoCodeError(
      'failed-precondition',
      'Paddle billing is not configured.'
    );
  }

  const response = await fetch(`${paddleApiBaseUrl(apiKey)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null) as
    | {data?: Record<string, any>; error?: {detail?: string; code?: string}}
    | null;

  if (!response.ok || !payload?.data) {
    const detail = payload?.error?.detail ||
      `Paddle returned HTTP ${response.status}.`;
    console.error('Paddle discount request failed:', detail);
    return promoCodeError(
      response.status === 409 ? 'already-exists' : 'unavailable',
      `Paddle could not save this percentage coupon: ${detail}`
    );
  }

  return payload.data;
}

type PaddleSubscriptionResponse = {
  id?: string;
  status?: string;
  next_billed_at?: string | null;
  current_billing_period?: {ends_at?: string} | null;
  trial_dates?: {starts_at?: string; ends_at?: string} | null;
  scheduled_change?: {
    action?: string;
    effective_at?: string;
  } | null;
};

function paddleApiBaseUrl(apiKey: string): string {
  return apiKey.includes('_sdbx_')
    ? 'https://sandbox-api.paddle.com'
    : 'https://api.paddle.com';
}

async function callPaddleSubscriptionApi(
  subscriptionId: string,
  action: 'cancel' | 'resume'
): Promise<PaddleSubscriptionResponse> {
  const apiKey = paddleApiKey.value().trim();
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Paddle billing is not configured.'
    );
  }

  const isCancel = action === 'cancel';
  const endpoint = isCancel
    ? `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`
    : `/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const response = await fetch(
    `${paddleApiBaseUrl(apiKey)}${endpoint}`,
    {
      method: isCancel ? 'POST' : 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        isCancel
          ? {effective_from: 'next_billing_period'}
          : {scheduled_change: null}
      )
    }
  );

  const payload = await response.json().catch(() => null) as
    | {data?: PaddleSubscriptionResponse; error?: {detail?: string}}
    | null;

  if (!response.ok) {
    const detail = payload?.error?.detail ||
      `Paddle returned HTTP ${response.status}.`;
    console.error(
      `Paddle subscription ${action} failed for ${subscriptionId}:`,
      detail
    );
    throw new functions.https.HttpsError(
      'unavailable',
      'Paddle could not update the subscription. Please try again.'
    );
  }

  return payload?.data || {};
}

type PaddleSubscriptionItem = {
  price?: {id?: string};
  price_id?: string;
  quantity?: number;
};

type PaddleSubscriptionWithItems = PaddleSubscriptionResponse & {
  items?: PaddleSubscriptionItem[];
};

function getPaddleExtraChildPriceId(billingInterval: unknown): string {
  const interval = String(billingInterval || 'MONTHLY').toUpperCase();
  const monthlyPriceId =
    process.env.PADDLE_EXTRA_CHILD_MONTHLY_PRICE_ID ||
    process.env.PADDLE_EXTRA_CHILD_PRICE_ID ||
    '';
  const yearlyPriceId =
    process.env.PADDLE_EXTRA_CHILD_YEARLY_PRICE_ID ||
    '';

  // Paddle requires every recurring item on a subscription to use the same
  // billing interval. Never fall back to the monthly add-on for a yearly plan.
  return interval === 'YEARLY' ? yearlyPriceId : monthlyPriceId;
}

function getPaddleExtraChildPriceIds(): Set<string> {
  return new Set([
    process.env.PADDLE_EXTRA_CHILD_MONTHLY_PRICE_ID,
    process.env.PADDLE_EXTRA_CHILD_YEARLY_PRICE_ID,
    process.env.PADDLE_EXTRA_CHILD_PRICE_ID
  ].filter((priceId): priceId is string => Boolean(priceId)));
}

type PaddleRecurringAddOnDefinition = {
  key: string;
  name: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
};

function getPaddleRecurringAddOnDefinitions(): PaddleRecurringAddOnDefinition[] {
  const definitions: PaddleRecurringAddOnDefinition[] = [{
    key: 'extra_child_slot',
    name: 'Extra child slot',
    monthlyPriceId:
      process.env.PADDLE_EXTRA_CHILD_MONTHLY_PRICE_ID ||
      process.env.PADDLE_EXTRA_CHILD_PRICE_ID ||
      '',
    yearlyPriceId:
      process.env.PADDLE_EXTRA_CHILD_YEARLY_PRICE_ID || ''
  }];

  const raw = paddleRecurringAddOnsJson.value().trim();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (!value || typeof value !== 'object') continue;
          const item = value as Record<string, unknown>;
          const key = typeof item.key === 'string' &&
            /^[a-z0-9_]{2,50}$/.test(item.key)
            ? item.key
            : '';
          const name = typeof item.name === 'string'
            ? item.name.trim().slice(0, 80)
            : '';
          const monthlyPriceId = typeof item.monthlyPriceId === 'string'
            ? item.monthlyPriceId.trim()
            : '';
          const yearlyPriceId = typeof item.yearlyPriceId === 'string'
            ? item.yearlyPriceId.trim()
            : '';

          if (
            !key ||
            key === 'extra_child_slot' ||
            !name ||
            (!monthlyPriceId && !yearlyPriceId)
          ) {
            continue;
          }
          definitions.push({
            key,
            name,
            monthlyPriceId,
            yearlyPriceId
          });
        }
      }
    } catch (error) {
      console.error('Invalid PADDLE_RECURRING_ADDONS_JSON:', error);
    }
  }

  return definitions.filter((definition, index, all) =>
    all.findIndex((candidate) => candidate.key === definition.key) === index
  );
}

function getPaddleRecurringAddOnByPriceId(): Map<
  string,
  PaddleRecurringAddOnDefinition
> {
  const byPriceId = new Map<string, PaddleRecurringAddOnDefinition>();
  for (const definition of getPaddleRecurringAddOnDefinitions()) {
    for (const priceId of [
      definition.monthlyPriceId,
      definition.yearlyPriceId
    ]) {
      if (priceId) byPriceId.set(priceId, definition);
    }
  }
  return byPriceId;
}

async function getPaddleSubscription(
  subscriptionId: string
): Promise<PaddleSubscriptionWithItems> {
  const apiKey = paddleApiKey.value().trim();
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Paddle billing is not configured.'
    );
  }

  const response = await fetch(
    `${paddleApiBaseUrl(apiKey)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {headers: {Authorization: `Bearer ${apiKey}`}}
  );
  const payload = await response.json().catch(() => null) as
    | {data?: PaddleSubscriptionWithItems; error?: {detail?: string}}
    | null;

  if (!response.ok || !payload?.data) {
    console.error(
      `Paddle subscription lookup failed for ${subscriptionId}:`,
      payload?.error?.detail || response.status
    );
    throw new functions.https.HttpsError(
      'unavailable',
      'Paddle could not read the subscription. Please try again.'
    );
  }
  return payload.data;
}

async function changePaddleExtraChildSlots(
  subscriptionId: string,
  extraChildPriceId: string,
  delta: 1 | -1
): Promise<number> {
  const apiKey = paddleApiKey.value().trim();
  const subscription = await getPaddleSubscription(subscriptionId);
  const existingItems = Array.isArray(subscription.items)
    ? subscription.items
    : [];
  let nextExtraQuantity = delta > 0 ? 1 : 0;
  let foundExtraPrice = false;
  const items: Array<{price_id: string; quantity: number}> = [];

  for (const item of existingItems) {
    const priceId = item.price?.id || item.price_id;
    if (!priceId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Paddle returned an incomplete subscription item.'
      );
    }
    const quantity = Number.isInteger(item.quantity) && Number(item.quantity) > 0
      ? Number(item.quantity)
      : 1;
    if (priceId === extraChildPriceId) {
      foundExtraPrice = true;
      nextExtraQuantity = Math.max(0, quantity + delta);
      if (nextExtraQuantity > 0) {
        items.push({price_id: priceId, quantity: nextExtraQuantity});
      }
      continue;
    }
    items.push({price_id: priceId, quantity});
  }

  if (!foundExtraPrice && delta > 0) {
    items.push({price_id: extraChildPriceId, quantity: 1});
  }
  if (!foundExtraPrice && delta < 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No paid extra child slot is available to remove.'
    );
  }

  const response = await fetch(
    `${paddleApiBaseUrl(apiKey)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items,
        proration_billing_mode: 'prorated_immediately',
        on_payment_failure: 'prevent_change'
      })
    }
  );
  const payload = await response.json().catch(() => null) as
    | {error?: {detail?: string}}
    | null;
  if (!response.ok) {
    console.error(
      `Paddle extra-child update failed for ${subscriptionId}:`,
      payload?.error?.detail || response.status
    );
    throw new functions.https.HttpsError(
      'unavailable',
      'Paddle could not update the extra child slots. No billing change was made.'
    );
  }
  return nextExtraQuantity;
}

type PaddleTransaction = {
  id?: string;
  status?: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  invoice_number?: string | null;
  origin?: string;
  currency_code?: string;
  billed_at?: string | null;
  created_at?: string;
  address?: {country_code?: string} | null;
  custom_data?: Record<string, unknown> | null;
  details?: {
    tax_rates_used?: Array<{tax_rate?: string}>;
    totals?: {
      subtotal?: string;
      discount?: string;
      tax?: string;
      total?: string;
      grand_total?: string;
      grand_total_tax?: string;
      fee?: string | null;
      earnings?: string | null;
      currency_code?: string;
    };
    payout_totals?: {
      subtotal?: string;
      tax?: string;
      total?: string;
      grand_total?: string;
      grand_total_tax?: string;
      fee?: string;
      earnings?: string;
      currency_code?: string;
    } | null;
  };
};

type PaddleListResponse = {
  data?: PaddleTransaction[];
  meta?: {pagination?: {next?: string | null}};
  error?: {code?: string; detail?: string};
};

function paddleMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : 0;
}

function paddleTransactionTotals(transaction: PaddleTransaction) {
  const totals = transaction.details?.totals || {};
  const gross = paddleMoney(totals.grand_total ?? totals.total);
  const tax = paddleMoney(totals.grand_total_tax ?? totals.tax);
  return {
    subtotal: paddleMoney(totals.subtotal),
    discount: paddleMoney(totals.discount),
    tax,
    total: gross,
    fee: paddleMoney(totals.fee),
    earnings: paddleMoney(totals.earnings),
    currencyCode: String(
      totals.currency_code || transaction.currency_code || 'EUR'
    ).toUpperCase()
  };
}

function paddleApiKeyValue(): string {
  // Gen 1 exposes bound secrets through process.env at invocation time. Prefer
  // that value because it is the same runtime path used by our verified Paddle
  // diagnostics, while keeping the SecretParam fallback for local emulators.
  return String(process.env.PADDLE_API_KEY || paddleApiKey.value() || '').trim();
}

const paddleResponseCache = new Map<string, {
  expiresAt: number;
  payload: unknown;
}>();
const paddleRequestsInFlight = new Map<string, Promise<unknown>>();

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function paddleFetch(url: URL, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url.toString(), {
      headers: {Authorization: `Bearer ${apiKey}`},
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function paddleGetUncached<T>(url: URL): Promise<T> {
  const apiKey = paddleApiKeyValue();
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Paddle billing is not configured.'
    );
  }

  const expectedOrigin = new URL(paddleApiBaseUrl(apiKey)).origin;
  if (url.origin !== expectedOrigin) {
    throw new functions.https.HttpsError(
      'internal',
      'Paddle returned an invalid pagination URL.'
    );
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await paddleFetch(url, apiKey);
    } catch (error) {
      if (attempt < 2) {
        const backoff = (2 ** attempt) * 500 + Math.floor(Math.random() * 250);
        await wait(backoff);
        continue;
      }
      console.error(`Paddle GET ${url.pathname} network failure:`, error);
      throw new functions.https.HttpsError(
        'unavailable',
        'Paddle billing records are temporarily unavailable.',
        {providerStatus: null, providerCode: 'network_error'}
      );
    }
    const payload = await response.json().catch(() => null) as
      | (T & {error?: {code?: string; detail?: string}})
      | null;
    if (response.ok && payload) return payload;

    const providerCode = payload?.error?.code || null;
    if (
      response.status === 429 &&
      providerCode === 'too_many_requests' &&
      attempt === 0
    ) {
      const retryAfter = Number(response.headers.get('retry-after') || '60');
      if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 65) {
        const jitter = Math.floor(Math.random() * 750) + 250;
        console.warn(`Paddle rate limit reached; retrying after ${retryAfter}s.`);
        await wait(Math.ceil(retryAfter * 1000) + jitter);
        continue;
      }
    }
    if (response.status >= 500 && attempt < 2) {
      const backoff = (2 ** attempt) * 500 + Math.floor(Math.random() * 250);
      await wait(backoff);
      continue;
    }

    console.error(
      `Paddle GET ${url.pathname} failed:`,
      payload?.error?.detail || response.status
    );
    throw new functions.https.HttpsError(
      'unavailable',
      'Paddle billing records are temporarily unavailable.',
      {
        providerStatus: response.status,
        providerCode
      }
    );
  }

  throw new functions.https.HttpsError(
    'unavailable',
    'Paddle billing records are temporarily unavailable.'
  );
}

async function paddleGet<T>(url: URL, cacheTtlMs = 0): Promise<T> {
  const cacheKey = url.toString();
  const cached = paddleResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload as T;
  }
  if (cached) paddleResponseCache.delete(cacheKey);

  const activeRequest = paddleRequestsInFlight.get(cacheKey);
  if (activeRequest) return activeRequest as Promise<T>;

  const request = paddleGetUncached<T>(url).then((payload) => {
    if (cacheTtlMs > 0) {
      if (paddleResponseCache.size >= 100) {
        const oldestKey = paddleResponseCache.keys().next().value;
        if (typeof oldestKey === 'string') paddleResponseCache.delete(oldestKey);
      }
      paddleResponseCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        payload
      });
    }
    return payload;
  });
  paddleRequestsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    paddleRequestsInFlight.delete(cacheKey);
  }
}

async function listPaddleTransactions(
  query: Record<string, string>,
  maximum: number
): Promise<{transactions: PaddleTransaction[]; truncated: boolean}> {
  const apiKey = paddleApiKeyValue();
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Paddle billing is not configured.'
    );
  }

  let nextUrl: URL | null = new URL(
    `${paddleApiBaseUrl(apiKey)}/transactions`
  );
  for (const [key, value] of Object.entries(query)) {
    nextUrl.searchParams.set(key, value);
  }
  nextUrl.searchParams.set('per_page', '30');
  nextUrl.searchParams.set('include', 'address');

  const transactions: PaddleTransaction[] = [];
  while (nextUrl && transactions.length < maximum) {
    const payload: PaddleListResponse =
      await paddleGet<PaddleListResponse>(nextUrl, 5 * 60 * 1000);
    transactions.push(...(Array.isArray(payload.data) ? payload.data : []));

    const next = payload.meta?.pagination?.next;
    nextUrl = typeof next === 'string' && next
      ? new URL(next, paddleApiBaseUrl(apiKey))
      : null;
  }

  return {
    transactions: transactions.slice(0, maximum),
    truncated: nextUrl !== null || transactions.length > maximum
  };
}

async function getPaddleTransaction(
  transactionId: string
): Promise<PaddleTransaction> {
  const apiKey = paddleApiKeyValue();
  const url = new URL(
    `${paddleApiBaseUrl(apiKey)}/transactions/` +
      `${encodeURIComponent(transactionId)}`
  );
  url.searchParams.set('include', 'address');
  const payload = await paddleGet<{
    data?: PaddleTransaction;
  }>(url);
  if (!payload.data) {
    throw new functions.https.HttpsError(
      'not-found',
      'Invoice transaction not found.'
    );
  }
  return payload.data;
}

async function requireParentBillingOwner(
  context: functions.https.CallableContext
): Promise<{
  uid: string;
  email: string | null;
  familyId: string;
  paddleCustomerId: string | null;
}> {
  if (!context.auth || context.auth.token.email_verified !== true) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Verified parent sign-in required.'
    );
  }

  const parentSnapshot = await db
    .collection('parents')
    .doc(context.auth.uid)
    .get();
  const familyId = parentSnapshot.data()?.familyId;
  if (typeof familyId !== 'string' || !familyId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No family is connected to this account.'
    );
  }

  const familySnapshot = await db.collection('families').doc(familyId).get();
  const family = familySnapshot.data() || {};
  if (!familySnapshot.exists || family.ownerId !== context.auth.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the family owner can view subscription invoices.'
    );
  }

  const paddleCustomerId = family.subscription?.paddleCustomerId;
  return {
    uid: context.auth.uid,
    email: typeof context.auth.token.email === 'string'
      ? context.auth.token.email
      : null,
    familyId,
    paddleCustomerId: typeof paddleCustomerId === 'string' && paddleCustomerId
      ? paddleCustomerId
      : null
  };
}

const ACTIVE_BILLING_STATUSES = new Set([
  'ACTIVE',
  'TRIALING',
  'PAST_DUE'
]);

function googlePlayTokenHash(purchaseToken: string): string {
  return createHash('sha256').update(purchaseToken).digest('hex');
}

function googlePlayAccountId(uid: string): string {
  return createHash('sha256').update(uid).digest('hex');
}

function currentBillingProvider(subscription: Record<string, any>):
  string | null {
  if (typeof subscription.provider === 'string' && subscription.provider) {
    return subscription.provider.toUpperCase();
  }
  if (typeof subscription.paddleSubscriptionId === 'string' &&
      subscription.paddleSubscriptionId) {
    return 'PADDLE';
  }
  return null;
}

function assertGooglePlayCanManageSubscription(
  subscription: Record<string, any>
): void {
  const provider = currentBillingProvider(subscription);
  const status = String(subscription.status || 'NONE').toUpperCase();
  if (provider && provider !== 'GOOGLE_PLAY' &&
      ACTIVE_BILLING_STATUSES.has(status)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'This family already has an active subscription managed by another billing provider.'
    );
  }
}

function googlePlayFamilyPatch(
  entitlement: ReturnType<typeof resolveGooglePlayEntitlement>,
  tokenHash: string,
  verifiedAt: Timestamp
): Record<string, unknown> {
  return {
    'subscription.provider': 'GOOGLE_PLAY',
    'subscription.status': entitlement.status,
    'subscription.entitlementActive': entitlement.entitlementActive,
    'subscription.googlePlayProductId': entitlement.productId,
    'subscription.googlePlayBasePlanId': entitlement.basePlanId,
    'subscription.googlePlayOfferId': entitlement.offerId,
    'subscription.googlePlayPurchaseTokenHash': tokenHash,
    'subscription.googlePlayLatestOrderId': entitlement.latestOrderId,
    'subscription.googlePlayProviderStatus': entitlement.providerStatus,
    'subscription.billingInterval': entitlement.billingInterval,
    'subscription.currentPeriodEndsAt':
      Timestamp.fromMillis(entitlement.currentPeriodEndsAtMillis),
    'subscription.nextBilledAt':
      Timestamp.fromMillis(entitlement.currentPeriodEndsAtMillis),
    'subscription.cancelAtPeriodEnd': entitlement.cancelAtPeriodEnd,
    'subscription.cancellationStatus': entitlement.cancelAtPeriodEnd
      ? 'CONFIRMED'
      : FieldValue.delete(),
    'subscription.verifiedAt': verifiedAt,
    'subscription.updatedAt': verifiedAt
  };
}

export const verifyGooglePlaySubscription = onCallV2(
  {
    region: 'us-central1',
    enforceAppCheck: true,
    timeoutSeconds: 60,
    serviceAccount: 'kidsguard-0626@appspot.gserviceaccount.com'
  },
  async (request) => {
    const owner = await requireParentBillingOwner(
      request as unknown as functions.https.CallableContext
    );
    const purchaseToken = typeof request.data?.purchaseToken === 'string'
      ? request.data.purchaseToken.trim()
      : '';
    const productId = typeof request.data?.productId === 'string'
      ? request.data.productId.trim()
      : '';
    const expectedProductId = googlePlaySubscriptionProductId.value();
    if (!purchaseToken || purchaseToken.length > 4096) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid Google Play purchase token is required.'
      );
    }
    if (productId !== expectedProductId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'The Google Play subscription product is not supported.'
      );
    }

    const familyRef = db.collection('families').doc(owner.familyId);
    const initialFamily = await familyRef.get();
    if (!initialFamily.exists) {
      throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    assertGooglePlayCanManageSubscription(
      initialFamily.data()?.subscription || {}
    );

    try {
      const publisher = new GooglePlayPublisherClient(
        googlePlayPackageName.value()
      );
      const purchase = await publisher.getSubscription(purchaseToken);
      const obfuscatedAccountId =
        purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
      if (obfuscatedAccountId &&
          obfuscatedAccountId !== googlePlayAccountId(owner.uid)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'This Google Play purchase belongs to another parent account.'
        );
      }

      const entitlement = resolveGooglePlayEntitlement(
        purchase,
        expectedProductId
      );
      if (!entitlement.entitlementActive) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'The Google Play subscription is not active.'
        );
      }

      const tokenHash = googlePlayTokenHash(purchaseToken);
      const purchaseRef = db
        .collection('googlePlayPurchases')
        .doc(tokenHash);
      const verifiedAt = Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const [familySnapshot, purchaseSnapshot] = await Promise.all([
          transaction.get(familyRef),
          transaction.get(purchaseRef)
        ]);
        if (!familySnapshot.exists ||
            familySnapshot.data()?.ownerId !== owner.uid) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'Only the family owner can activate a subscription.'
          );
        }
        const existingPurchase = purchaseSnapshot.data() || {};
        if (purchaseSnapshot.exists &&
            existingPurchase.familyId !== owner.familyId) {
          throw new functions.https.HttpsError(
            'already-exists',
            'This Google Play purchase is already linked to another family.'
          );
        }
        assertGooglePlayCanManageSubscription(
          familySnapshot.data()?.subscription || {}
        );

        transaction.set(purchaseRef, {
          purchaseToken,
          purchaseTokenHash: tokenHash,
          packageName: googlePlayPackageName.value(),
          productId: entitlement.productId,
          basePlanId: entitlement.basePlanId,
          offerId: entitlement.offerId,
          familyId: owner.familyId,
          ownerUid: owner.uid,
          ownerEmail: owner.email,
          providerStatus: entitlement.providerStatus,
          status: entitlement.status,
          entitlementActive: entitlement.entitlementActive,
          currentPeriodEndsAt:
            Timestamp.fromMillis(entitlement.currentPeriodEndsAtMillis),
          latestOrderId: entitlement.latestOrderId,
          regionCode: entitlement.regionCode,
          testPurchase: entitlement.testPurchase,
          linkedPurchaseTokenHash: purchase.linkedPurchaseToken
            ? googlePlayTokenHash(purchase.linkedPurchaseToken)
            : null,
          verifiedAt,
          updatedAt: verifiedAt,
          createdAt: existingPurchase.createdAt || verifiedAt
        }, {merge: true});
        transaction.update(
          familyRef,
          googlePlayFamilyPatch(entitlement, tokenHash, verifiedAt)
        );
      });

      if (entitlement.acknowledgementPending) {
        await publisher.acknowledgeSubscription(
          expectedProductId,
          purchaseToken
        );
        await purchaseRef.set({
          acknowledgedAt: FieldValue.serverTimestamp()
        }, {merge: true});
      }

      await db.collection('auditLogs').add({
        actorUid: owner.uid,
        actorEmail: owner.email,
        familyId: owner.familyId,
        action: 'GOOGLE_PLAY_SUBSCRIPTION_VERIFIED',
        targetType: 'SUBSCRIPTION',
        targetId: tokenHash,
        severity: 'NOTICE',
        metadata: {
          productId: entitlement.productId,
          basePlanId: entitlement.basePlanId,
          providerStatus: entitlement.providerStatus,
          testPurchase: entitlement.testPurchase
        },
        createdAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        provider: 'GOOGLE_PLAY',
        status: entitlement.status,
        entitlementActive: entitlement.entitlementActive,
        billingInterval: entitlement.billingInterval,
        currentPeriodEndsAtMillis: entitlement.currentPeriodEndsAtMillis
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      console.error('Google Play subscription verification failed:', error);
      throw new functions.https.HttpsError(
        'unavailable',
        'Google Play could not verify the subscription. Please try again.'
      );
    }
  }
);

type GooglePlayRtdnPayload = {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
};

function googlePlayRtdnPayload(message: {
  data?: string;
  json?: unknown;
}): GooglePlayRtdnPayload {
  if (message.json && typeof message.json === 'object') {
    return message.json as GooglePlayRtdnPayload;
  }
  if (!message.data) return {};
  return JSON.parse(
    Buffer.from(message.data, 'base64').toString('utf8')
  ) as GooglePlayRtdnPayload;
}

export const handleGooglePlaySubscriptionNotification = onMessagePublished(
  {
    topic: googlePlayRtdnTopic,
    region: 'us-central1',
    timeoutSeconds: 60,
    serviceAccount: 'kidsguard-0626@appspot.gserviceaccount.com'
  },
  async (event) => {
    const payload = googlePlayRtdnPayload(event.data.message);
    if (payload.packageName !== googlePlayPackageName.value()) {
      console.warn('Ignoring Google Play RTDN for another package.');
      return;
    }
    const notification = payload.subscriptionNotification;
    const purchaseToken = notification?.purchaseToken?.trim() || '';
    if (!purchaseToken) {
      console.info('Ignoring non-subscription Google Play RTDN.');
      return;
    }

    const tokenHash = googlePlayTokenHash(purchaseToken);
    const purchaseRef = db.collection('googlePlayPurchases').doc(tokenHash);
    const purchaseSnapshot = await purchaseRef.get();
    const mapping = purchaseSnapshot.data() || {};
    const familyId = typeof mapping.familyId === 'string'
      ? mapping.familyId
      : '';
    if (!purchaseSnapshot.exists || !familyId) {
      console.warn(
        `Google Play RTDN ${event.id} arrived before purchase registration.`
      );
      return;
    }

    const publisher = new GooglePlayPublisherClient(
      googlePlayPackageName.value()
    );
    const purchase = await publisher.getSubscription(purchaseToken);
    const entitlement = resolveGooglePlayEntitlement(
      purchase,
      googlePlaySubscriptionProductId.value()
    );
    const verifiedAt = Timestamp.now();
    const familyRef = db.collection('families').doc(familyId);

    await db.runTransaction(async (transaction) => {
      const familySnapshot = await transaction.get(familyRef);
      const familySubscription = familySnapshot.data()?.subscription || {};
      if (!familySnapshot.exists ||
          currentBillingProvider(familySubscription) !== 'GOOGLE_PLAY' ||
          familySubscription.googlePlayPurchaseTokenHash !== tokenHash) {
        transaction.set(purchaseRef, {
          providerStatus: entitlement.providerStatus,
          status: entitlement.status,
          entitlementActive: entitlement.entitlementActive,
          currentPeriodEndsAt:
            Timestamp.fromMillis(entitlement.currentPeriodEndsAtMillis),
          lastRtdnEventId: event.id,
          lastRtdnNotificationType: notification?.notificationType || null,
          updatedAt: verifiedAt
        }, {merge: true});
        return;
      }

      transaction.set(purchaseRef, {
        providerStatus: entitlement.providerStatus,
        status: entitlement.status,
        entitlementActive: entitlement.entitlementActive,
        currentPeriodEndsAt:
          Timestamp.fromMillis(entitlement.currentPeriodEndsAtMillis),
        latestOrderId: entitlement.latestOrderId,
        lastRtdnEventId: event.id,
        lastRtdnNotificationType: notification?.notificationType || null,
        updatedAt: verifiedAt
      }, {merge: true});
      transaction.update(
        familyRef,
        googlePlayFamilyPatch(entitlement, tokenHash, verifiedAt)
      );
    });

    if (entitlement.acknowledgementPending && entitlement.entitlementActive) {
      await publisher.acknowledgeSubscription(
        googlePlaySubscriptionProductId.value(),
        purchaseToken
      );
      await purchaseRef.set({
        acknowledgedAt: FieldValue.serverTimestamp()
      }, {merge: true});
    }
  }
);

function normalizeParentInvoice(transaction: PaddleTransaction) {
  const totals = paddleTransactionTotals(transaction);
  return {
    transactionId: String(transaction.id || ''),
    invoiceNumber: transaction.invoice_number || null,
    billedAt: transaction.billed_at || transaction.created_at || null,
    countryCode: transaction.address?.country_code || null,
    origin: transaction.origin || null,
    ...totals
  };
}

type StoredBillingInvoice = {
  familyId?: string;
  transactionId?: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string;
  invoiceNumber?: string | null;
  origin?: string | null;
  billedAt?: string | null;
  createdAt?: string | null;
  billingMonth?: string | null;
  countryCode?: string | null;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  fee?: number;
  earnings?: number;
  currencyCode?: string;
  taxRates?: number[];
  payoutTotals?: {
    subtotal?: number;
    tax?: number;
    total?: number;
    fee?: number;
    earnings?: number;
    currencyCode?: string;
  } | null;
};

function billingMonth(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1)
    .padStart(2, '0')}`;
}

function storedBillingInvoice(
  familyId: string,
  transaction: PaddleTransaction
): StoredBillingInvoice & {
  provider: 'PADDLE';
  updatedAt: FieldValue;
} {
  const totals = paddleTransactionTotals(transaction);
  const billedAt = transaction.billed_at || transaction.created_at || null;
  const payout = transaction.details?.payout_totals;
  const payoutCurrency = String(payout?.currency_code || '').toUpperCase();
  return {
    familyId,
    transactionId: String(transaction.id || ''),
    customerId: transaction.customer_id || null,
    subscriptionId: transaction.subscription_id || null,
    status: String(transaction.status || ''),
    invoiceNumber: transaction.invoice_number || null,
    origin: transaction.origin || null,
    billedAt,
    createdAt: transaction.created_at || null,
    billingMonth: billingMonth(billedAt),
    countryCode: transaction.address?.country_code || null,
    ...totals,
    taxRates: (transaction.details?.tax_rates_used || [])
      .map((rate) => Number(rate.tax_rate))
      .filter((rate) => Number.isFinite(rate) && rate >= 0),
    payoutTotals: payout && payoutCurrency
      ? {
          subtotal: paddleMoney(payout.subtotal),
          tax: paddleMoney(payout.grand_total_tax ?? payout.tax),
          total: paddleMoney(payout.grand_total ?? payout.total),
          fee: paddleMoney(payout.fee),
          earnings: paddleMoney(payout.earnings),
          currencyCode: payoutCurrency
        }
      : null,
    provider: 'PADDLE',
    updatedAt: FieldValue.serverTimestamp()
  };
}

function storedInvoiceToPaddleTransaction(
  invoice: StoredBillingInvoice
): PaddleTransaction {
  const payout = invoice.payoutTotals;
  return {
    id: invoice.transactionId,
    customer_id: invoice.customerId || null,
    subscription_id: invoice.subscriptionId || null,
    status: invoice.status,
    invoice_number: invoice.invoiceNumber || null,
    origin: invoice.origin || undefined,
    billed_at: invoice.billedAt || null,
    created_at: invoice.createdAt || undefined,
    currency_code: invoice.currencyCode,
    address: invoice.countryCode
      ? {country_code: invoice.countryCode}
      : null,
    details: {
      totals: {
        subtotal: String(invoice.subtotal || 0),
        discount: String(invoice.discount || 0),
        tax: String(invoice.tax || 0),
        total: String(invoice.total || 0),
        grand_total: String(invoice.total || 0),
        grand_total_tax: String(invoice.tax || 0),
        fee: String(invoice.fee || 0),
        earnings: String(invoice.earnings || 0),
        currency_code: invoice.currencyCode || 'EUR'
      },
      tax_rates_used: (invoice.taxRates || [])
        .map((rate) => ({tax_rate: String(rate)})),
      payout_totals: payout
        ? {
            subtotal: String(payout.subtotal || 0),
            tax: String(payout.tax || 0),
            total: String(payout.total || 0),
            grand_total: String(payout.total || 0),
            grand_total_tax: String(payout.tax || 0),
            fee: String(payout.fee || 0),
            earnings: String(payout.earnings || 0),
            currency_code: payout.currencyCode || ''
          }
        : null
    }
  };
}

async function storedTransactionsForFamily(
  familyId: string,
  maximum: number
): Promise<{transactions: PaddleTransaction[]; truncated: boolean}> {
  const snapshot = await db.collection('billingInvoices')
    .where('familyId', '==', familyId)
    .get();
  const transactions = snapshot.docs
    .map((document) => storedInvoiceToPaddleTransaction(
      document.data() as StoredBillingInvoice
    ))
    .filter((transaction) => transaction.status === 'completed')
    .sort((first, second) => String(
      second.billed_at || second.created_at || ''
    ).localeCompare(String(first.billed_at || first.created_at || '')));
  return {
    transactions: transactions.slice(0, maximum),
    truncated: transactions.length > maximum
  };
}

async function storedTransactionsForMonth(
  month: string,
  maximum: number
): Promise<{transactions: PaddleTransaction[]; truncated: boolean}> {
  const snapshot = await db.collection('billingInvoices')
    .where('billingMonth', '==', month)
    .get();
  const transactions = snapshot.docs
    .map((document) => storedInvoiceToPaddleTransaction(
      document.data() as StoredBillingInvoice
    ))
    .filter((transaction) => transaction.status === 'completed')
    .sort((first, second) => String(
      first.billed_at || first.created_at || ''
    ).localeCompare(String(second.billed_at || second.created_at || '')));
  return {
    transactions: transactions.slice(0, maximum),
    truncated: transactions.length > maximum
  };
}

function validReportMonth(value: unknown): string {
  const month = String(value || '').trim();
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Select a valid billing month.'
    );
  }
  return month;
}

function reportMonthRange(month: string): {start: string; end: string} {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, monthNumber, 1)).toISOString()
  };
}

type CanonicalFamilyRole = 'OWNER' | 'MANAGER' | 'VIEWER';

function normalizeFamilyRole(role: unknown): CanonicalFamilyRole | null {
  if (role === 'OWNER') return 'OWNER';
  if (role === 'MANAGER' || role === 'PARENT') return 'MANAGER';
  if (role === 'VIEWER' || role === 'GUARDIAN') return 'VIEWER';
  return null;
}

function isManagerRole(role: unknown): boolean {
  const normalized = normalizeFamilyRole(role);
  return normalized === 'OWNER' || normalized === 'MANAGER';
}

const RETENTION_BATCH_SIZE = 400;
const RETENTION_MAX_BATCHES = 5;
const RETENTION_MAX_DATED_TREES = 100;
const ALLOWED_RETENTION_DAYS = new Set([30, 90, 365]);

async function deleteExpiredByField(
  collectionRef: CollectionReference,
  field: string,
  cutoff: number | Timestamp,
  preserveIds: string[] = []
): Promise<number> {
  let deletedCount = 0;
  const preserved = new Set(preserveIds);

  for (
    let batchNumber = 0;
    batchNumber < RETENTION_MAX_BATCHES;
    batchNumber += 1
  ) {
    const snapshot = await collectionRef
      .where(field, '<', cutoff)
      .limit(RETENTION_BATCH_SIZE)
      .get();

    if (snapshot.empty) break;

    const deletable = snapshot.docs.filter(
      document => !preserved.has(document.id)
    );

    if (deletable.length === 0) break;

    const batch = db.batch();
    deletable.forEach(document => batch.delete(document.ref));
    await batch.commit();
    deletedCount += deletable.length;

    if (snapshot.size < RETENTION_BATCH_SIZE) break;
  }

  return deletedCount;
}

function isIsoDayDocumentId(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function deleteExpiredDatedTrees(
  childRef: DocumentReference,
  collectionName: 'appUsage' | 'webActivity',
  cutoffDay: string
): Promise<number> {
  const documentRefs = await childRef
    .collection(collectionName)
    .listDocuments();
  const expiredRefs = documentRefs
    .filter(
      documentRef =>
        isIsoDayDocumentId(documentRef.id) &&
        documentRef.id < cutoffDay
    )
    .sort((first, second) =>
      first.id.localeCompare(second.id)
    )
    .slice(0, RETENTION_MAX_DATED_TREES);

  for (const documentRef of expiredRefs) {
    await db.recursiveDelete(documentRef);
  }

  return expiredRefs.length;
}

function serializeExportValue(
  value: unknown
): unknown {
  if (
    value instanceof
    Timestamp
  ) {
    return value.toDate().toISOString();
  }

  if (
    value instanceof
    GeoPoint
  ) {
    return {
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeExportValue);
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>
      ).map(([key, nestedValue]) => [
        key,
        serializeExportValue(nestedValue),
      ])
    );
  }

  return value;
}

async function exportDocumentTree(
  documentRef:
    DocumentReference
): Promise<Record<string, unknown> | null> {
  const documentSnapshot =
    await documentRef.get();

  if (!documentSnapshot.exists) {
    return null;
  }

  const exportedDocument:
    Record<string, unknown> = {
      id: documentSnapshot.id,
      path: documentSnapshot.ref.path,
      data: serializeExportValue(
        documentSnapshot.data() || {}
      ),
    };

  const subcollections =
    await documentRef.listCollections();

  if (subcollections.length > 0) {
    const exportedSubcollections:
      Record<string, unknown[]> = {};

    for (const subcollection of subcollections) {
      const subcollectionSnapshot =
        await subcollection.get();

      const exportedDocuments =
        await Promise.all(
          subcollectionSnapshot.docs.map(
            (nestedDocument) =>
              exportDocumentTree(
                nestedDocument.ref
              )
          )
        );

      exportedSubcollections[
        subcollection.id
      ] = exportedDocuments.filter(
        (
          value
        ): value is Record<string, unknown> =>
          value !== null
      );
    }

    exportedDocument.subcollections =
      exportedSubcollections;
  }

  return exportedDocument;
}

async function exportLinkedDocuments(
  collectionName: string,
  fieldName: string,
  fieldValue: string
): Promise<Record<string, unknown>[]> {
  const snapshot = await db
    .collection(collectionName)
    .where(fieldName, "==", fieldValue)
    .get();

  const exportedDocuments =
    await Promise.all(
      snapshot.docs.map((document) =>
        exportDocumentTree(document.ref)
      )
    );

  return exportedDocuments.filter(
    (
      value
    ): value is Record<string, unknown> =>
      value !== null
  );
}

async function getExportFamilyOwner(
  context: functions.https.CallableContext
): Promise<{
  uid: string;
  familyId: string;
  familyRef:
    DocumentReference;
  familySnapshot:
    DocumentSnapshot;
}> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  if (
    context.auth.token.email_verified !==
    true
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Your email must be verified."
    );
  }

  const uid = context.auth.uid;
  const parentSnapshot = await db
    .collection("parents")
    .doc(uid)
    .get();

  if (!parentSnapshot.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Parent profile not found."
    );
  }

  const familyId =
    parentSnapshot.data()?.familyId;

  if (
    typeof familyId !== "string" ||
    !familyId
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No family is connected to this account."
    );
  }

  const familyRef = db
    .collection("families")
    .doc(familyId);

  const familySnapshot =
    await familyRef.get();

  if (!familySnapshot.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Family not found."
    );
  }

  if (
    familySnapshot.data()?.ownerId !== uid
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the Family Owner can export family data."
    );
  }

  return {
    uid,
    familyId,
    familyRef,
    familySnapshot,
  };
}
function escapeEmailHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mergeExportDocuments(
  ...documentGroups:
    Record<string, unknown>[][]
): Record<string, unknown>[] {
  const uniqueDocuments = new Map<
    string,
    Record<string, unknown>
  >();

  for (const group of documentGroups) {
    for (const document of group) {
      const path =
        typeof document.path === "string"
          ? document.path
          : JSON.stringify(document);

      uniqueDocuments.set(path, document);
    }
  }

  return Array.from(
    uniqueDocuments.values()
  );
}


// --- Notification Triggers ---

/**
 * Triggered when a new activity event is created for a child.
 * Handles Safe Zone Entry/Exit.
 */
export const onActivityCreated = functions.firestore
    .document('children/{childId}/activities/{activityId}')
    .onCreate(async (snapshot, context) => {
        const activity = snapshot.data();
        const { childId } = context.params;

        if (activity.type === 'ENTER_ZONE' || activity.type === 'EXIT_ZONE') {
            await broadcastToParents(childId, {
                title: activity.title,
                body: activity.description,
                type: 'SAFE_ZONE',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

/**
 * Writes an immutable audit record for platform-admin support actions.
 * Firestore rules authorize the original update; this trigger persists the
 * attribution independently from the mutable support ticket.
 */
export const onSupportAdminAction = functions.firestore
  .document('supportTickets/{ticketId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const action = after.lastAdminAction;

    if (!action || typeof action !== 'object') {
      return;
    }

    const beforeAction = before.lastAdminAction;
    const sameAction =
      beforeAction?.actorUid === action.actorUid &&
      beforeAction?.type === action.type &&
      beforeAction?.occurredAt?.toMillis?.() ===
        action.occurredAt?.toMillis?.();

    if (sameAction) {
      return;
    }

    const actorUid =
      typeof action.actorUid === 'string'
        ? action.actorUid
        : '';
    const actionType =
      action.type === 'REPLY' ||
      action.type === 'STATUS_CHANGE'
        ? action.type
        : '';

    if (!actorUid || !actionType) {
      console.warn(
        'Skipping malformed support admin audit action',
        context.params.ticketId
      );
      return;
    }

    await db.collection('auditLogs').add({
      actorUid,
      actorEmail:
        typeof action.actorEmail === 'string'
          ? action.actorEmail
          : null,
      familyId:
        typeof after.familyId === 'string'
          ? after.familyId
          : null,
      action: actionType === 'REPLY'
        ? 'SUPPORT_ADMIN_REPLIED'
        : 'SUPPORT_STATUS_CHANGED',
      targetType: 'SUPPORT_TICKET',
      targetId: context.params.ticketId,
      severity: 'NOTICE',
      metadata: {
        previousStatus: before.status || null,
        currentStatus: after.status || null
      },
      createdAt:
        FieldValue.serverTimestamp()
    });
  });

/**
* Triggered only when a genuinely new installed-app document is created.
* This avoids recursive notifications.
*/
export const onInstalledAppCreated = functions.firestore
.document("children/{childId}/installedApps/{packageName}")
.onCreate(async (snapshot, context) => {
const app = snapshot.data();
const childId = String(context.params.childId || "");
const packageName = String(context.params.packageName || "");

if (!childId || !packageName) {
console.warn("Missing childId or packageName");
return;
}

if (app?.notifyParent !== true) {
  console.log("Skipping baseline app notification:", {
    childId,
    packageName
  });
  return;
}

const appName = String(
app?.appName ||
app?.name ||
app?.applicationName ||
packageName
);

// Child document থেকে আসল child name নেওয়া
const childSnapshot = await db
.collection("children")
.doc(childId)
.get();

const childData = childSnapshot.data();

const childName = String(
childData?.childName ||
childData?.name ||
"Your child"
);

console.log("New app notification:", {
childId,
childName,
appName,
packageName,
});

await broadcastToParents(childId, {
title: "New app installed",
body: `${childName} installed ${appName}`,
type: "APP_INSTALLED",
childId,
packageName,
clickAction:
`/dashboard/${encodeURIComponent(childId)}` +
`?tab=installed-apps&pkg=${encodeURIComponent(packageName)}`,
});
});

/**
 * Notifies family parents when a child asks to change an active protection
 * permission. The parent reviews the request from Device Health.
 */
export const onPermissionChangeRequestCreated = functions.firestore
.document("children/{childId}/permissionChangeRequests/{requestId}")
.onCreate(async (snapshot, context) => {
const request = snapshot.data();
const childId = String(context.params.childId || "");
const requestId = String(context.params.requestId || "");

if (!childId || !requestId || request?.status !== "PENDING") {
return;
}

const childName = String(request?.childName || "Your child");
const permissionName = String(
request?.permissionName || "a protection permission"
);

await broadcastToParents(childId, {
title: "Permission change requested",
body: `${childName} wants to change ${permissionName}. Approve or deny it from Device Health.`,
type: "PERMISS…38551 tokens truncated…                    font-weight:bold;
                  "
                >
                  View Invitation
                </a>

                <p style="
                  color:#64748b;
                  font-size:13px;
                ">
                  This invitation expires in 7 days.
                  Please sign in using the email address
                  that received this invitation.
                </p>
              </div>
            `
          });

        if (error) {
          console.error(
            'Invitation email failed:',
            error
          );

          throw new Error(
            `Resend failed: ${error.message}`
          );
        }

        console.log(
          'Invitation email sent:',
          {
            inviteId:
              context.params.inviteId,
            email,
            resendId: data?.id
          }
        );
      }
    );

export const removeChildFromFamily =
  functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in.'
      );
    }

    if (context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Your email must be verified.'
      );
    }

    const uid = context.auth.uid;
    const childId =
      typeof data?.childId === 'string'
        ? data.childId.trim()
        : '';

    if (!childId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid child ID is required.'
      );
    }

    const parentRef = db
      .collection('parents')
      .doc(uid);

    const childRef = db
      .collection('children')
      .doc(childId);

    const auditRef = db
      .collection('auditLogs')
      .doc();

    await db.runTransaction(async (transaction) => {
      const parentSnapshot =
        await transaction.get(parentRef);

      if (!parentSnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Parent profile not found.'
        );
      }

      const parentData =
        parentSnapshot.data() || {};

      const familyId =
        parentData.familyId ||
        parentData.activeFamilyId;

      if (
        typeof familyId !== 'string' ||
        !familyId
      ) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No family is connected to this account.'
        );
      }

      const familyRef = db
        .collection('families')
        .doc(familyId);

      const familySnapshot =
        await transaction.get(familyRef);

      const childSnapshot =
        await transaction.get(childRef);

      if (!familySnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Family not found.'
        );
      }

      if (!childSnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Child not found.'
        );
      }

      const familyData =
        familySnapshot.data() || {};

      const childData =
        childSnapshot.data() || {};

      if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only the family owner can remove a child.'
        );
      }

      if (childData.familyId !== familyId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This child is not connected to your family.'
        );
      }

      const childIds = Array.isArray(
        familyData.childDeviceIds
      )
        ? familyData.childDeviceIds
        : [];

      transaction.update(familyRef, {
        childDeviceIds:
          childIds.filter(
            (id: unknown) => id !== childId
          ),
        updatedAt:
          FieldValue.serverTimestamp()
      });

      transaction.update(childRef, {
        familyId: null,
        removedAt:
          FieldValue.serverTimestamp(),
        removedBy: uid,
        updatedAt:
          FieldValue.serverTimestamp()
      });

      transaction.set(auditRef, {
        actorUid: uid,
        actorEmail:
          context.auth?.token.email || null,
        familyId,
        action: 'CHILD_REMOVED',
        targetType: 'CHILD',
        targetId: childId,
        severity: 'WARNING',
        createdAt:
          FieldValue.serverTimestamp()
      });
    });

    return {
      success: true,
      childId
    };
  });

export const removeFamilyMember =
  functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in.'
      );
    }

    if (context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Your email must be verified.'
      );
    }

    const uid = context.auth.uid;
    const memberUid =
      typeof data?.memberUid === 'string'
        ? data.memberUid.trim()
        : '';

    if (!memberUid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid member UID is required.'
      );
    }

    if (memberUid === uid) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The family owner cannot remove themselves.'
      );
    }

    const ownerParentRef = db
      .collection('parents')
      .doc(uid);

    const memberParentRef = db
      .collection('parents')
      .doc(memberUid);

    const auditRef = db
      .collection('auditLogs')
      .doc();

    await db.runTransaction(async (transaction) => {
      const ownerParentSnapshot =
        await transaction.get(ownerParentRef);

      if (!ownerParentSnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Owner profile not found.'
        );
      }

      const ownerParentData =
        ownerParentSnapshot.data() || {};

      const familyId =
        ownerParentData.familyId ||
        ownerParentData.activeFamilyId;

      if (
        typeof familyId !== 'string' ||
        !familyId
      ) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No family is connected to this account.'
        );
      }

      const familyRef = db
        .collection('families')
        .doc(familyId);

      const familySnapshot =
        await transaction.get(familyRef);

      const memberParentSnapshot =
        await transaction.get(memberParentRef);

      if (!familySnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Family not found.'
        );
      }

      const familyData =
        familySnapshot.data() || {};

      if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only the family owner can remove a member.'
        );
      }

      const members = Array.isArray(
        familyData.members
      )
        ? familyData.members
        : [];

      const memberUids = Array.isArray(
        familyData.memberUids
      )
        ? familyData.memberUids
        : [];

      const managerUids = Array.isArray(
        familyData.managerUids
      )
        ? familyData.managerUids
        : [];

      if (
        !members.some(
          (member: any) =>
            member?.uid === memberUid
        ) &&
        !memberUids.includes(memberUid)
      ) {
        throw new functions.https.HttpsError(
          'not-found',
          'Family member not found.'
        );
      }

      transaction.update(familyRef, {
        members: members.filter(
          (member: any) =>
            member?.uid !== memberUid
        ),
        memberUids: memberUids.filter(
          (id: unknown) =>
            id !== memberUid
        ),
        managerUids: managerUids.filter(
          (id: unknown) =>
            id !== memberUid
        ),
        updatedAt:
          FieldValue.serverTimestamp()
      });

      if (memberParentSnapshot.exists) {
        transaction.set(
          memberParentRef,
          {
            familyId:
              FieldValue.delete(),
            activeFamilyId:
              FieldValue.delete(),
            familyIds:
              FieldValue.arrayRemove(
                familyId
              ),
            role: 'VIEWER',
            updatedAt:
              FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      transaction.set(auditRef, {
        actorUid: uid,
        actorEmail:
          context.auth?.token.email || null,
        familyId,
        action: 'MEMBER_REMOVED',
        targetType: 'MEMBER',
        targetId: memberUid,
        severity: 'WARNING',
        createdAt:
          FieldValue.serverTimestamp()
      });
    });

    return {
      success: true,
      memberUid
    };
  });

//Future mismatch বন্ধ করতে automatic backend reconciliation trigger

export const onFamilyMembershipSync =
  functions.firestore
    .document('families/{familyId}')
    .onUpdate(async (change, context) => {
      const familyId = context.params.familyId;
      const after = change.after.data() || {};

      const rawMembers = Array.isArray(
        after.members
      )
        ? after.members
        : [];

      const memberMap = new Map<string, any>();

      for (const member of rawMembers) {
        if (
          member &&
          typeof member.uid === 'string' &&
          member.uid
        ) {
          memberMap.set(member.uid, member);
        }
      }

      const members =
        Array.from(memberMap.values());

      const expectedMemberUids =
        Array.from(memberMap.keys());

      const expectedManagerUids =
        Array.from(new Set([
          after.ownerId,
          ...members
          .filter(
            (member: any) =>
              isManagerRole(member.role)
          )
          .map(
            (member: any) => member.uid
          )
        ].filter(
          (uid): uid is string =>
            typeof uid === 'string' && uid.length > 0
        )));

      const currentMemberUids =
        Array.isArray(after.memberUids)
          ? after.memberUids
          : [];

      const currentManagerUids =
        Array.isArray(after.managerUids)
          ? after.managerUids
          : [];

      const sameUidSet = (
        first: unknown[],
        second: unknown[]
      ): boolean => {
        if (first.length !== second.length) {
          return false;
        }

        const secondSet = new Set(second);

        return first.every(
          value => secondSet.has(value)
        );
      };

      const familyNeedsUpdate =
        !sameUidSet(
          currentMemberUids,
          expectedMemberUids
        ) ||
        !sameUidSet(
          currentManagerUids,
          expectedManagerUids
        );

      const allKnownUids =
        Array.from(
          new Set<string>([
            ...currentMemberUids.filter(
              (uid: unknown): uid is string =>
                typeof uid === 'string'
            ),
            ...expectedMemberUids
          ])
        );

      const parentSnapshots =
        await Promise.all(
          allKnownUids.map(uid =>
            db
              .collection('parents')
              .doc(uid)
              .get()
          )
        );

      const batch = db.batch();
      let operationCount = 0;

      if (familyNeedsUpdate) {
        batch.update(change.after.ref, {
          members,
          memberUids: expectedMemberUids,
          managerUids: expectedManagerUids,
          updatedAt:
            FieldValue
              .serverTimestamp()
        });

        operationCount += 1;
      }

      for (
        let index = 0;
        index < allKnownUids.length;
        index += 1
      ) {
        const memberUid = allKnownUids[index];
        const parentSnapshot =
          parentSnapshots[index];

        if (!parentSnapshot.exists) {
          continue;
        }

        const parentRef =
          parentSnapshot.ref;

        const parentData =
          parentSnapshot.data() || {};

        const validMember =
          memberMap.get(memberUid);

        if (validMember) {
          const familyIds =
            Array.isArray(parentData.familyIds)
              ? parentData.familyIds
              : [];

          const needsParentUpdate =
            parentData.familyId !== familyId ||
            parentData.activeFamilyId !==
              familyId ||
            parentData.role !==
              validMember.role ||
            !familyIds.includes(familyId);

          if (needsParentUpdate) {
            batch.set(
              parentRef,
              {
                familyId,
                activeFamilyId: familyId,
                familyIds:
                  FieldValue
                    .arrayUnion(familyId),
                role: validMember.role,
                updatedAt:
                  FieldValue
                    .serverTimestamp()
              },
              { merge: true }
            );

            operationCount += 1;
          }
        } else {
          const familyIds =
            Array.isArray(parentData.familyIds)
              ? parentData.familyIds
              : [];

          const isStillLinked =
            parentData.familyId === familyId ||
            parentData.activeFamilyId ===
              familyId ||
            familyIds.includes(familyId);

          if (isStillLinked) {
            batch.set(
              parentRef,
              {
                familyId:
                  FieldValue
                    .delete(),
                activeFamilyId:
                  FieldValue
                    .delete(),
                familyIds:
                  FieldValue
                    .arrayRemove(familyId),
                role: 'VIEWER',
                updatedAt:
                  FieldValue
                    .serverTimestamp()
              },
              { merge: true }
            );

            operationCount += 1;
          }
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }
    });


// Admin notification reminder: sends one email when an actionable item remains
// open for at least one hour. Reminder documents provide idempotency and are
// removed after the item is resolved, so a later recurrence can notify again.
type AdminReminderItem = {
  key: string;
  type: "Issue" | "Support" | "Device";
  title: string;
  detail: string;
  href: string;
  activeSince: number;
};

function adminNotificationMillis(value: any): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function adminNotificationEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminReminderDocumentId(key: string): string {
  return Buffer.from(key)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export const sendAdminOpenNotificationReminder = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 120 })
  .pubsub.schedule("every 5 minutes")
  .timeZone("Europe/Berlin")
  .onRun(async () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const dashboardBase = "https://kidsguard-screen.vercel.app";
    const items: AdminReminderItem[] = [];

    const [reportSnapshot, triageSnapshot, ticketSnapshot, childrenSnapshot] =
      await Promise.all([
        db.collectionGroup("errorReports").limit(500).get(),
        db.collection("issueTriage").get(),
        db.collection("supportTickets").get(),
        db.collection("children").limit(500).get()
      ]);

    const triage = new Map<string, DocumentData>();
    triageSnapshot.docs.forEach(document => triage.set(document.id, document.data()));

    const issueReports = new Map<string, DocumentData[]>();
    reportSnapshot.docs.forEach(document => {
      const report = document.data();
      const fingerprint = report.fingerprint || document.id;
      const existing = issueReports.get(fingerprint) || [];
      existing.push(report);
      issueReports.set(fingerprint, existing);
    });

    issueReports.forEach((reports, fingerprint) => {
      const state = triage.get(fingerprint);
      const stateUpdatedAt = adminNotificationMillis(state?.updatedAt);
      const reportsAfterResolution = state?.status === "RESOLVED"
        ? reports.filter(report =>
            adminNotificationMillis(report.capturedAt) > stateUpdatedAt
          )
        : reports;

      if (state?.status === "ACKNOWLEDGED" || reportsAfterResolution.length === 0) {
        return;
      }

      const ordered = [...reportsAfterResolution].sort(
        (a, b) =>
          adminNotificationMillis(a.capturedAt) -
          adminNotificationMillis(b.capturedAt)
      );
      const firstSeen = adminNotificationMillis(ordered[0]?.capturedAt);
      if (!firstSeen || firstSeen > oneHourAgo) return;
      const latest = ordered[ordered.length - 1];

      items.push({
        key: `issue:${fingerprint}:${firstSeen}`,
        type: "Issue",
        title: latest.tag || "Open application issue",
        detail: latest.message || "An application error needs review.",
        href: `/internal/issues?fingerprint=${encodeURIComponent(fingerprint)}`,
        activeSince: firstSeen
      });
    });

    ticketSnapshot.docs.forEach(document => {
      const ticket = document.data();
      if (!["OPEN", "IN_PROGRESS"].includes(ticket.status)) return;

      const parentReplies = Array.isArray(ticket.replies)
        ? ticket.replies.filter((reply: any) => reply.authorRole === "PARENT")
        : [];
      const latestParentReply = parentReplies.sort(
        (a: any, b: any) =>
          adminNotificationMillis(b.createdAt) -
          adminNotificationMillis(a.createdAt)
      )[0];
      const activeSince = adminNotificationMillis(
        latestParentReply?.createdAt || ticket.updatedAt || ticket.createdAt
      );
      if (!activeSince || activeSince > oneHourAgo) return;

      const ticketId = ticket.ticketId || document.id;
      items.push({
        key: `support:${ticketId}:${activeSince}`,
        type: "Support",
        title: ticket.subject || "Open support ticket",
        detail:
          latestParentReply?.message ||
          ticket.message ||
          "A support conversation needs a response.",
        href: `/internal/support?ticket=${encodeURIComponent(ticketId)}`,
        activeSince
      });
    });

    const deviceStatuses = await Promise.all(
      childrenSnapshot.docs.map(async childDocument => {
        const status = await db
          .collection("children")
          .doc(childDocument.id)
          .collection("status")
          .doc("current")
          .get();
        return {
          childId: childDocument.id,
          child: childDocument.data(),
          status: status.exists ? status.data() || {} : {}
        };
      })
    );

    deviceStatuses.forEach(({ childId, child, status }) => {
      const lastSeen = adminNotificationMillis(status.lastSeen);
      const syncFailureAt = adminNotificationMillis(status.lastSyncFailureAt);
      const syncFailure = status.syncHealthy === false;
      const stale = !lastSeen || lastSeen <= oneHourAgo;
      const offline = status.online === false;
      const activeSince = syncFailure
        ? (syncFailureAt || lastSeen)
        : lastSeen;

      if (!syncFailure && !stale && !offline) return;
      if (activeSince && activeSince > oneHourAgo) return;

      const childName =
        status.childName || child.name || child.childName || "Unknown child";
      const reason = syncFailure
        ? status.syncErrorMessage || "Device sync is unhealthy."
        : stale
          ? "Device has not reported for at least one hour."
          : "Device remains offline.";

      items.push({
        key: `device:${childId}:${activeSince || "never"}:${syncFailure ? "sync" : "offline"}`,
        type: "Device",
        title: `${childName} device warning`,
        detail: reason,
        href: `/internal/devices?child=${encodeURIComponent(childId)}`,
        activeSince: activeSince || 0
      });
    });

    const reminders = db.collection("adminNotificationReminders");
    const reminderSnapshot = await reminders.get();
    const activeKeys = new Set(items.map(item => item.key));
    const cleanupBatch = db.batch();

    reminderSnapshot.docs.forEach(document => {
      const key = document.data().key;
      if (!activeKeys.has(key)) cleanupBatch.delete(document.ref);
    });
    await cleanupBatch.commit();

    const existingKeys = new Set(
      reminderSnapshot.docs.map(document => document.data().key as string)
    );
    const unsent = items.filter(item => !existingKeys.has(item.key));
    if (unsent.length === 0) {
      console.log("Admin reminder: no newly eligible notifications.");
      return null;
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows = unsent.map(item => {
      const url = `${dashboardBase}${item.href}`;
      return `
        <div style="padding:16px 0;border-bottom:1px solid #e2e8f0">
          <div style="font-size:12px;font-weight:700;color:#e11d48;text-transform:uppercase">
            ${adminNotificationEscape(item.type)}
          </div>
          <h3 style="margin:6px 0;color:#0f172a">
            ${adminNotificationEscape(item.title)}
          </h3>
          <p style="margin:0 0 10px;color:#475569">
            ${adminNotificationEscape(item.detail)}
          </p>
          <a href="${adminNotificationEscape(url)}" style="color:#e11d48;font-weight:700">
            Open exact item
          </a>
        </div>`;
    }).join("");

    const result = await resend.emails.send({
      from: "KidsGuard <onboarding@resend.dev>",
      to: ["freshmartbd123@gmail.com"],
      subject: `[KidsGuard Admin] ${unsent.length} item${unsent.length === 1 ? "" : "s"} open for 1 hour`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">
          <h2 style="color:#0f172a">KidsGuard admin attention required</h2>
          <p style="color:#475569">
            The following notification${unsent.length === 1 ? " has" : "s have"} remained open for at least one hour.
          </p>
          ${rows}
          <p style="margin-top:20px;color:#94a3b8;font-size:12px">
            This reminder is sent once per unresolved occurrence.
          </p>
        </div>`
    });

    if (result.error) {
      throw new Error(`Admin reminder email failed: ${result.error.message}`);
    }

    const sentBatch = db.batch();
    unsent.forEach(item => {
      sentBatch.set(reminders.doc(adminReminderDocumentId(item.key)), {
        key: item.key,
        type: item.type,
        title: item.title,
        sentAt: FieldValue.serverTimestamp(),
        recipient: "freshmartbd123@gmail.com"
      });
    });
    await sentBatch.commit();

    console.log(`Admin reminder sent for ${unsent.length} item(s).`);
    return null;
  });


type PlatformAdminPush = {
  title: string;
  body: string;
  clickAction: string;
  type: "ADMIN_ISSUE" | "ADMIN_SUPPORT" | "ADMIN_DEVICE" | "ADMIN_SUBSCRIPTION" | "ADMIN_RELEASE" | "ADMIN_SECURITY";
  eventId: string;
};

async function notifyPlatformAdmins(payload: PlatformAdminPush): Promise<void> {
  await db.collection("adminNotifications").doc(payload.eventId).set({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    clickAction: payload.clickAction,
    eventId: payload.eventId,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const adminSnapshot = await db
    .collection("platformAdmins")
    .where("active", "==", true)
    .get();

  const fullAdminRoles = new Set([
    "SUPER_ADMIN",
    "PLATFORM_ADMIN",
    "DEV_ADMIN"
  ]);
  const employeeNotificationTypes = new Set([
    "ADMIN_ISSUE",
    "ADMIN_SUPPORT",
    "ADMIN_DEVICE"
  ]);
  const dashboardBase = "https://kidsguard-screen.vercel.app";
  const targetUrl = new URL(payload.clickAction, dashboardBase).href;

  for (const adminDocument of adminSnapshot.docs) {
    const role = String(adminDocument.data().role || "");
    const canReceive = fullAdminRoles.has(role) ||
      (
        role === "EMPLOYEE" &&
        employeeNotificationTypes.has(payload.type)
      );
    if (!canReceive) continue;

    const tokenSnapshot = await db
      .collection("users")
      .doc(adminDocument.id)
      .collection("notificationTokens")
      .get();

    const tokenDocuments = tokenSnapshot.docs.filter(document => {
      const data = document.data();
      return data.enabled !== false && typeof data.token === "string" && data.token;
    });
    const tokens = tokenDocuments.map(document => String(document.data().token));
    if (tokens.length === 0) continue;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: {
        type: payload.type,
        eventId: payload.eventId,
        title: payload.title,
        body: payload.body,
        clickAction: targetUrl,
        url: targetUrl
      },
      webpush: {
        notification: {
          icon: `${dashboardBase}/app-icon.png`,
          badge: `${dashboardBase}/symbol.png`
        },
        fcmOptions: {
          link: targetUrl
        }
      }
    });

    const invalidDeletes: Promise<WriteResult>[] = [];
    response.responses.forEach((item, index) => {
      const code = item.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidDeletes.push(tokenDocuments[index].ref.delete());
      }
    });
    await Promise.all(invalidDeletes);
  }
}

async function notifyPlatformAdminsOnce(payload: PlatformAdminPush): Promise<void> {
  const existing = await db.collection("adminNotifications").doc(payload.eventId).get();
  if (existing.exists) return;
  await notifyPlatformAdmins(payload);
}

function internalLoginReviewUrl(requestId: string): string {
  const url = new URL(
    '/internal/security/login-blocks',
    internalDashboardUrl.value().replace(/\/$/, '')
  );
  url.searchParams.set('requestId', requestId);
  return url.toString();
}

function internalLoginTimestampIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return null;
}

async function sendInternalLoginBlockEmail(input: {
  requestId: string;
  ip: string;
  attemptedEmail: string;
  userAgent: string;
  blockedAt: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const reviewUrl = internalLoginReviewUrl(input.requestId);
  const {Resend} = await import('resend');
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: platformEmailFrom,
    to: platformOwnerEmail.value(),
    subject: '[KidsGuard Security] Admin login IP blocked',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px;color:#be123c">Admin login protection triggered</h2>
        <p style="line-height:1.6">Five failed password attempts were detected within 15 minutes. This IP is blocked from the internal portal until the Super Admin approves it.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">IP address</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.ip)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Attempted email</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.attemptedEmail)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Blocked at</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.blockedAt)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Browser</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;word-break:break-word">${escapeEmailHtml(input.userAgent)}</td></tr>
        </table>
        <p style="margin:24px 0"><a href="${escapeEmailHtml(reviewUrl)}" style="display:inline-block;background:#e11d48;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Review blocked login</a></p>
        <p style="font-size:12px;line-height:1.6;color:#64748b">Opening the review page does not approve the IP. Sign in with the Super Admin account and approve only when you recognize the activity. Use a different trusted connection, such as mobile data, because the blocked IP cannot approve itself.</p>
      </div>`
  });
  if (result.error) throw new Error(result.error.message);
}

async function sendInternalSessionCompromiseEmail(input: {
  eventId: string;
  email: string;
  reason: string;
  originalIp: string;
  observedIp: string;
  originalUserAgent: string;
  observedUserAgent: string;
  createdAt: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const reviewUrl = new URL(
    '/internal/security/sessions',
    internalDashboardUrl.value().replace(/\/$/, '')
  );
  reviewUrl.searchParams.set('eventId', input.eventId);
  const {Resend} = await import('resend');
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: platformEmailFrom,
    to: platformOwnerEmail.value(),
    subject: '[KidsGuard Security] Possible admin session theft blocked',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px;color:#be123c">Possible session theft blocked</h2>
        <p style="line-height:1.6">KidsGuard detected an internal admin session being used from a different network or browser. The session was disabled immediately and all refresh tokens for that account were revoked.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Account</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.email || 'Unknown')}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Reason</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.reason)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Original IP</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.originalIp)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Observed IP</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.observedIp)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Original browser</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;word-break:break-word">${escapeEmailHtml(input.originalUserAgent)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Observed browser</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;word-break:break-word">${escapeEmailHtml(input.observedUserAgent)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold">Detected at</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.createdAt)}</td></tr>
        </table>
        <p style="margin:24px 0"><a href="${escapeEmailHtml(reviewUrl.toString())}" style="display:inline-block;background:#e11d48;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Review admin sessions</a></p>
        <p style="font-size:12px;line-height:1.6;color:#64748b">If this was your own network or browser change, sign in again. If it was not you, reset the account password before restoring access.</p>
      </div>`
  });
  if (result.error) throw new Error(result.error.message);
}

export const getInternalLoginGuardStatus = functions.https.onCall(
  async (_data, context) => {
    const {ref} = internalLoginIpRef(context.rawRequest);
    const snapshot = await ref.get();
    return {blocked: snapshot.data()?.status === 'BLOCKED'};
  }
);

export const recordInternalLoginFailure = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .https.onCall(async (data, context) => {
    const attemptedEmail = normalizePlatformEmail(data?.email).slice(0, 254);
    const userAgent = String(
      context.rawRequest.get('user-agent') || 'Unknown browser'
    ).slice(0, 500);
    const {ip, ref} = internalLoginIpRef(context.rawRequest);
    const now = Date.now();
    const nowTimestamp = Timestamp.fromMillis(now);
    const requestId = randomUUID();

    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() || {};
      if (current.status === 'BLOCKED') {
        return {
          blocked: true,
          newlyBlocked: false,
          requestId: String(current.requestId || '')
        };
      }

      const windowStartedAtMillis = current.windowStartedAt instanceof Timestamp
        ? current.windowStartedAt.toMillis()
        : 0;
      const decision = evaluateInternalLoginFailure({
        status: current.status,
        failureCount: current.failureCount,
        windowStartedAtMillis
      }, now);
      const {failureCount, blocked} = decision;

      transaction.set(ref, {
        ipHash: ref.id,
        ip,
        status: blocked ? 'BLOCKED' : 'TRACKING',
        failureCount,
        windowStartedAt: decision.windowStartedAtMillis === windowStartedAtMillis
          ? current.windowStartedAt
          : nowTimestamp,
        lastFailedAt: nowTimestamp,
        attemptedEmail: attemptedEmail || '(empty)',
        userAgent,
        requestId: blocked ? requestId : null,
        blockedAt: blocked ? nowTimestamp : null,
        approvedAt: null,
        approvedBy: null,
        updatedAt: nowTimestamp
      }, {merge: true});

      return {
        blocked,
        newlyBlocked: blocked,
        requestId: blocked ? requestId : '',
        failureCount
      };
    });

    if (result.newlyBlocked) {
      const reviewPath = `/internal/security/login-blocks?requestId=${encodeURIComponent(result.requestId)}`;
      const emailAlert = sendInternalLoginBlockEmail({
        requestId: result.requestId,
        ip,
        attemptedEmail: attemptedEmail || '(empty)',
        userAgent,
        blockedAt: new Date(now).toISOString()
      });
      const pushAlert = notifyPlatformAdminsOnce({
        type: 'ADMIN_SECURITY',
        eventId: `login-block-${result.requestId}`,
        title: 'Admin login IP blocked',
        body: `Five failed password attempts from ${ip}. Super Admin approval is required.`,
        clickAction: reviewPath
      });
      const alertResults = await Promise.allSettled([emailAlert, pushAlert]);
      const alertErrors = alertResults
        .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
        .map(item => String(item.reason instanceof Error ? item.reason.message : item.reason));
      await ref.set({
        emailAlertSent: alertResults[0].status === 'fulfilled',
        pushAlertSent: alertResults[1].status === 'fulfilled',
        alertErrors,
        alertAttemptedAt: FieldValue.serverTimestamp()
      }, {merge: true});
      if (alertErrors.length > 0) {
        console.error('Internal login block alert failure', {requestId: result.requestId, alertErrors});
      }
    }

    return {
      blocked: result.blocked,
      remainingAttempts: result.blocked
        ? 0
        : Math.max(0, INTERNAL_LOGIN_FAILURE_LIMIT - Number(result.failureCount || 0))
    };
  });

export const finalizeInternalLogin = functions.https.onCall(
  async (_data, context) => {
    const operator = await requireActiveInternalStaff(context, {
      requireSession: false,
    });
    const {ref} = internalLoginIpRef(context.rawRequest);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.data()?.status === 'BLOCKED') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Access blocked. Contact your God Father!'
        );
      }
      transaction.set(ref, {
        status: 'CLEARED',
        failureCount: 0,
        clearedAt: FieldValue.serverTimestamp(),
        clearedBy: operator.uid,
        updatedAt: FieldValue.serverTimestamp()
      }, {merge: true});
    });
    const session = await beginInternalAdminSession(context, operator);
    return {ok: true, ...session};
  }
);

export const assertInternalLoginAccess = functions.https.onCall(
  async (_data, context) => {
    await requireActiveInternalStaff(context);
    return {ok: true};
  }
);

export const listInternalLoginBlocks = functions.https.onCall(
  async (_data, context) => {
    await requirePlatformOwner(context);
    const snapshot = await db
      .collection('internalLoginIpBlocks')
      .where('status', '==', 'BLOCKED')
      .limit(100)
      .get();
    const blocks = snapshot.docs.map(document => {
      const value = document.data();
      return {
        requestId: String(value.requestId || ''),
        ip: String(value.ip || 'Unknown'),
        attemptedEmail: String(value.attemptedEmail || ''),
        userAgent: String(value.userAgent || 'Unknown browser'),
        failureCount: Number(value.failureCount || 0),
        blockedAt: internalLoginTimestampIso(value.blockedAt),
        lastFailedAt: internalLoginTimestampIso(value.lastFailedAt),
        emailAlertSent: value.emailAlertSent === true,
        pushAlertSent: value.pushAlertSent === true
      };
    });
    blocks.sort((left, right) =>
      String(right.blockedAt || '').localeCompare(String(left.blockedAt || ''))
    );
    return {blocks};
  }
);

export const approveInternalLoginBlock = functions.https.onCall(
  async (data, context) => {
    const operator = await requirePlatformOwner(context);
    const requestId = String(data?.requestId || '').trim();
    if (!requestId || requestId.length > 100) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid blocked-login request is required.'
      );
    }

    const matches = await db
      .collection('internalLoginIpBlocks')
      .where('requestId', '==', requestId)
      .limit(1)
      .get();
    if (matches.empty) {
      throw new functions.https.HttpsError(
        'not-found',
        'This blocked-login request was not found.'
      );
    }

    const blockRef = matches.docs[0].ref;
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(blockRef);
      if (snapshot.data()?.status !== 'BLOCKED') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This IP has already been approved.'
        );
      }
      transaction.update(blockRef, {
        status: 'APPROVED',
        failureCount: 0,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: operator.uid,
        approvedByEmail: operator.email,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(
        db.collection('internalLoginSecurityEvents').doc(randomUUID()),
        {
          type: 'LOGIN_IP_APPROVED',
          requestId,
          ipHash: blockRef.id,
          approvedBy: operator.uid,
          approvedByEmail: operator.email,
          createdAt: FieldValue.serverTimestamp()
        }
      );
    });
    return {ok: true};
  }
);

export const endInternalAdminSession = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authenticated internal account required.'
      );
    }

    const reasonValue = String(data?.reason || 'logout').toUpperCase();
    const reason = new Set([
      'LOGOUT', 'IDLE', 'EXPIRED', 'BLOCKED', 'SECURITY',
    ]).has(reasonValue) ? reasonValue : 'LOGOUT';
    const authTime = internalSessionAuthTime(context);
    const sessionRef = internalSessionRef(context.auth.uid);
    const sessionSnapshot = await sessionRef.get();
    const session = sessionSnapshot.data();
    const nowTimestamp = Timestamp.now();

    if (
      sessionSnapshot.exists &&
      Number(session?.authTime || 0) === authTime &&
      session?.state === 'ACTIVE'
    ) {
      await sessionRef.update({
        state: 'ENDED',
        endedReason: reason,
        endedAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });
      await db.collection('internalSessionSecurityEvents').add({
        type: 'INTERNAL_SESSION_ENDED',
        uid: context.auth.uid,
        email: typeof context.auth.token.email === 'string'
          ? context.auth.token.email
          : null,
        sessionId: String(session?.sessionId || ''),
        reason,
        createdAt: nowTimestamp,
      });
    }

    await getAuth().revokeRefreshTokens(context.auth.uid);
    return {ok: true};
  }
);

export const listInternalAdminSessions = functions.https.onCall(
  async (_data, context) => {
    await requirePlatformOwner(context);
    const [sessionSnapshot, eventSnapshot] = await Promise.all([
      db.collection('internalAdminSessions').limit(100).get(),
      db.collection('internalSessionSecurityEvents')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get(),
    ]);

    const sessions = sessionSnapshot.docs.map(document => {
      const value = document.data();
      return {
        uid: document.id,
        sessionId: String(value.sessionId || ''),
        email: String(value.email || ''),
        role: String(value.role || ''),
        state: String(value.state || 'UNKNOWN'),
        ip: String(value.ip || 'Unavailable'),
        userAgent: String(value.userAgent || 'Unknown browser'),
        createdAt: internalLoginTimestampIso(value.createdAt),
        lastSeenAt: internalLoginTimestampIso(value.lastSeenAt),
        expiresAt: internalLoginTimestampIso(value.expiresAt),
        endedAt: internalLoginTimestampIso(value.endedAt),
        compromisedAt: internalLoginTimestampIso(value.compromisedAt),
        compromiseReason: value.compromiseReason
          ? String(value.compromiseReason)
          : null,
      };
    });
    const events = eventSnapshot.docs.map(document => {
      const value = document.data();
      return {
        eventId: document.id,
        type: String(value.type || 'UNKNOWN'),
        uid: String(value.uid || ''),
        email: String(value.email || ''),
        sessionId: String(value.sessionId || ''),
        reason: value.reason ? String(value.reason) : null,
        originalIp: value.originalIp ? String(value.originalIp) : null,
        observedIp: value.observedIp ? String(value.observedIp) : null,
        createdAt: internalLoginTimestampIso(value.createdAt),
      };
    });
    return {sessions, events};
  }
);

export const revokeInternalAdminSession = functions.https.onCall(
  async (data, context) => {
    const operator = await requirePlatformOwner(context);
    const uid = String(data?.uid || '').trim();
    if (!uid || uid.length > 128 || !/^[A-Za-z0-9:_-]+$/.test(uid)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid internal account is required.'
      );
    }

    const sessionRef = internalSessionRef(uid);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'No internal session was found for this account.'
      );
    }

    const nowTimestamp = Timestamp.now();
    const session = sessionSnapshot.data() || {};
    await sessionRef.update({
      state: 'REVOKED',
      revokedAt: nowTimestamp,
      revokedBy: operator.uid,
      revokedByEmail: operator.email,
      updatedAt: nowTimestamp,
    });
    await db.collection('internalSessionSecurityEvents').add({
      type: 'INTERNAL_SESSION_REVOKED',
      uid,
      email: session.email || null,
      sessionId: session.sessionId || null,
      revokedBy: operator.uid,
      revokedByEmail: operator.email,
      createdAt: nowTimestamp,
    });
    await getAuth().revokeRefreshTokens(uid);
    return {ok: true};
  }
);

export const onInternalSessionSecurityAlertCreated = functions
  .runWith({secrets: ['RESEND_API_KEY']})
  .firestore.document('internalSessionSecurityAlerts/{eventId}')
  .onCreate(async snapshot => {
    const value = snapshot.data();
    const eventId = String(value.eventId || snapshot.id);
    const reviewPath = `/internal/security/sessions?eventId=${encodeURIComponent(eventId)}`;
    const emailAlert = sendInternalSessionCompromiseEmail({
      eventId,
      email: String(value.email || ''),
      reason: String(value.reason || 'SESSION_MISMATCH'),
      originalIp: String(value.originalIp || 'Unavailable'),
      observedIp: String(value.observedIp || 'Unavailable'),
      originalUserAgent: String(value.originalUserAgent || 'Unknown browser'),
      observedUserAgent: String(value.observedUserAgent || 'Unknown browser'),
      createdAt: internalLoginTimestampIso(value.createdAt) || new Date().toISOString(),
    });
    const pushAlert = notifyPlatformAdminsOnce({
      type: 'ADMIN_SECURITY',
      eventId,
      title: 'Possible admin session theft blocked',
      body: `${String(value.email || 'An internal account')} was used from a different network or browser. All sessions were revoked.`,
      clickAction: reviewPath,
    });
    const results = await Promise.allSettled([emailAlert, pushAlert]);
    const errors = results
      .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
      .map(item => String(item.reason instanceof Error ? item.reason.message : item.reason));
    await snapshot.ref.set({
      deliveryStatus: errors.length === 0 ? 'SENT' : 'PARTIAL_FAILURE',
      emailAlertSent: results[0].status === 'fulfilled',
      pushAlertSent: results[1].status === 'fulfilled',
      deliveryErrors: errors,
      deliveryAttemptedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  });

const RELEASE_ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASE_PENDING_ALERT_MS = 6 * 60 * 60 * 1000;
const RELEASE_LOW_ADOPTION_ALERT_MS = 24 * 60 * 60 * 1000;

/**
 * Checks rollout adoption hourly. Each rollout milestone has a deterministic
 * notification ID, so administrators receive it only once per release.
 */
export const monitorReleaseRollout = functions.pubsub
  .schedule("every 60 minutes")
  .timeZone("Europe/Berlin")
  .onRun(async () => {
    const configSnapshot = await db.doc("appConfig/update").get();
    if (!configSnapshot.exists) return null;

    const config = configSnapshot.data() || {};
    const versionCode = Number(config.latestVersionCode || 0);
    const versionName = String(config.latestVersionName || versionCode);
    const releasedAt = adminNotificationMillis(config.releasedAt);
    if (!versionCode || !releasedAt || config.rolloutPaused === true) return null;

    const childrenSnapshot = await db.collection("children").limit(500).get();
    const statuses = await Promise.all(childrenSnapshot.docs.map(async child => {
      const statusSnapshot = await child.ref.collection("status").doc("current").get();
      return statusSnapshot.exists ? statusSnapshot.data() || {} : {};
    }));
    const activeCutoff = Date.now() - RELEASE_ACTIVE_WINDOW_MS;
    const activeStatuses = statuses.filter(status =>
      adminNotificationMillis(status.lastSeen) >= activeCutoff
    );
    const reporting = activeStatuses.filter(status =>
      String(status.appVersion || "").trim().length > 0
    );
    const normalize = (value: unknown) =>
      String(value || "").trim().replace(/^v/i, "");
    const updated = reporting.filter(status =>
      normalize(status.appVersion) === normalize(versionName)
    ).length;
    const pending = reporting.length - updated;
    const unknown = activeStatuses.length - reporting.length;
    const age = Date.now() - releasedAt;
    const adoption = reporting.length > 0
      ? Math.round((updated / reporting.length) * 100)
      : 0;

    if (activeStatuses.length > 0 && updated === activeStatuses.length) {
      await notifyPlatformAdminsOnce({
        type: "ADMIN_RELEASE",
        eventId: `release-rollout-complete-${versionCode}`,
        title: `v${versionName} rollout complete`,
        body: `All ${activeStatuses.length} active devices are updated.`,
        clickAction: "/internal/releases"
      });
      return null;
    }

    if (age >= RELEASE_LOW_ADOPTION_ALERT_MS && adoption < 90) {
      await notifyPlatformAdminsOnce({
        type: "ADMIN_RELEASE",
        eventId: `release-low-adoption-${versionCode}`,
        title: `v${versionName} rollout needs attention`,
        body: `${adoption}% adoption after 24 hours: ${pending} pending and ${unknown} version unknown.`,
        clickAction: "/internal/releases"
      });
    } else if (age >= RELEASE_PENDING_ALERT_MS && (pending > 0 || unknown > 0)) {
      await notifyPlatformAdminsOnce({
        type: "ADMIN_RELEASE",
        eventId: `release-pending-${versionCode}`,
        title: `v${versionName} rollout is still pending`,
        body: `${pending} active devices need the update; ${unknown} have not reported a version.`,
        clickAction: "/internal/releases"
      });
    }

    return null;
  });

export const onAdminIssueCreatedPush = functions.firestore
  .document("children/{childId}/errorReports/{reportId}")
  .onCreate(async (snapshot, context) => {
    const report = snapshot.data();
    const fingerprint = String(report.fingerprint || context.params.reportId);
    await notifyPlatformAdmins({
      type: "ADMIN_ISSUE",
      eventId: `issue-${context.params.reportId}`,
      title: String(report.tag || "New KidsGuard issue"),
      body: String(report.message || "A new application issue needs review."),
      clickAction: `/internal/issues?fingerprint=${encodeURIComponent(fingerprint)}`
    });
    return null;
  });

export const onAdminSupportActivityPush = functions.firestore
  .document("supportTickets/{ticketId}")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const after = change.after.data() || {};
    const before = change.before.exists ? change.before.data() || {} : null;
    const afterReplies = Array.isArray(after.replies) ? after.replies : [];
    const beforeReplies = Array.isArray(before?.replies) ? before?.replies : [];

    const created = !change.before.exists;
    const newReply = afterReplies.length > beforeReplies.length
      ? afterReplies[afterReplies.length - 1]
      : null;
    const newParentMessage = newReply?.authorRole === "PARENT";
    const newAdminReply =
      newReply?.authorRole === "ADMIN" ||
      newReply?.authorRole === "SUPPORT";

    if (created || newParentMessage) {
      await notifyPlatformAdmins({
        type: "ADMIN_SUPPORT",
        eventId: `support-${context.params.ticketId}-${afterReplies.length}`,
        title: String(after.subject || "New support message"),
        body: String(
          newParentMessage
            ? newReply.message
            : after.message || "A new support ticket needs a response."
        ),
        clickAction: `/internal/support?ticket=${encodeURIComponent(context.params.ticketId)}`
      });
    }

    if (newAdminReply && typeof after.parentUid === "string" && after.parentUid) {
      await notifyParent(after.parentUid, {
        type: "SUPPORT_REPLY",
        title: "New support reply",
        body: String(newReply.message || "KidsGuard Support replied to your ticket."),
        childId: "",
        eventId: `support-reply-${context.params.ticketId}-${newReply.replyId || afterReplies.length}`,
        clickAction: `/support/${encodeURIComponent(context.params.ticketId)}`,
        familyId: String(after.familyId || "")
      });
    }

    return null;
  });

export const onAdminDeviceWarningPush = functions.firestore
  .document("children/{childId}/status/current")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;
    const after = change.after.data() || {};
    const before = change.before.exists ? change.before.data() || {} : {};

    const syncBecameUnhealthy =
      after.syncHealthy === false && before.syncHealthy !== false;
    const deviceWentOffline =
      after.online === false && before.online !== false;

    if (!syncBecameUnhealthy && !deviceWentOffline) return null;

    const childSnapshot = await db
      .collection("children")
      .doc(context.params.childId)
      .get();
    const child = childSnapshot.data() || {};
    const childName = String(
      after.childName || child.name || child.childName || "Child"
    );
    const body = syncBecameUnhealthy
      ? String(after.syncErrorMessage || "Device sync is unhealthy.")
      : `${childName}'s device went offline.`;

    await notifyPlatformAdmins({
      type: "ADMIN_DEVICE",
      eventId: `device-${context.params.childId}-${Date.now()}`,
      title: `${childName} device warning`,
      body,
      clickAction: `/internal/devices?child=${encodeURIComponent(context.params.childId)}`
    });
    return null;
  });


function normalizedSubscriptionStatus(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function isActiveSubscriptionStatus(value: unknown): boolean {
  return ["ACTIVE", "TRIAL", "TRIALING", "SUBSCRIBED"].includes(
    normalizedSubscriptionStatus(value)
  );
}

function isCancelledSubscriptionStatus(value: unknown): boolean {
  return ["CANCELLED", "CANCELED"].includes(
    normalizedSubscriptionStatus(value)
  );
}

async function subscriptionCustomerLabel(
  family: DocumentData
): Promise<string> {
  const ownerId = typeof family.ownerId === "string" ? family.ownerId : "";
  if (ownerId) {
    const ownerSnapshot = await db.collection("parents").doc(ownerId).get();
    const owner = ownerSnapshot.data() || {};
    return String(
      owner.displayName ||
      owner.email ||
      family.settings?.name ||
      family.name ||
      "New customer"
    );
  }
  return String(family.settings?.name || family.name || "New customer");
}

export const onAdminSubscriptionChangedPush = functions.firestore
  .document("families/{familyId}")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;

    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};
    const beforeStatus = normalizedSubscriptionStatus(
      before.subscription?.status
    );
    const afterStatus = normalizedSubscriptionStatus(
      after.subscription?.status
    );

    if (beforeStatus === afterStatus) return null;

    const becameActive =
      isActiveSubscriptionStatus(afterStatus) &&
      !isActiveSubscriptionStatus(beforeStatus);
    const becameCancelled =
      isCancelledSubscriptionStatus(afterStatus) &&
      !isCancelledSubscriptionStatus(beforeStatus);

    if (!becameActive && !becameCancelled) return null;

    const familyId = context.params.familyId;
    const customer = await subscriptionCustomerLabel(after);
    const trackingRef = db
      .collection("adminSubscriptionNotifications")
      .doc(familyId);

    if (becameActive) {
      await trackingRef.set({
        familyId,
        customer,
        subscribedAt: FieldValue.serverTimestamp(),
        retentionNotified: false,
        cancelledAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      await notifyPlatformAdmins({
        type: "ADMIN_SUBSCRIPTION",
        eventId: `subscription-started-${familyId}-${context.eventId}`,
        title: "New customer subscribed",
        body: `${customer} started a subscription.`,
        clickAction: `/internal/customers?family=${encodeURIComponent(familyId)}`
      });
    }

    if (becameCancelled) {
      await trackingRef.set({
        familyId,
        customer,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      await notifyPlatformAdmins({
        type: "ADMIN_SUBSCRIPTION",
        eventId: `subscription-cancelled-${familyId}-${context.eventId}`,
        title: "Customer cancelled subscription",
        body: `${customer} cancelled their subscription.`,
        clickAction: `/internal/customers?family=${encodeURIComponent(familyId)}`
      });
    }

    return null;
  });

export const sendAdminSevenDaySubscriptionPush = functions.pubsub
  .schedule("every 60 minutes")
  .timeZone("Europe/Berlin")
  .onRun(async () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const trackingSnapshot = await db
      .collection("adminSubscriptionNotifications")
      .limit(500)
      .get();

    for (const trackingDocument of trackingSnapshot.docs) {
      const tracking = trackingDocument.data();
      if (tracking.retentionNotified === true) continue;

      const subscribedAt = adminNotificationMillis(tracking.subscribedAt);
      if (!subscribedAt || subscribedAt > sevenDaysAgo) continue;

      const familySnapshot = await db
        .collection("families")
        .doc(trackingDocument.id)
        .get();
      if (!familySnapshot.exists) continue;

      const family = familySnapshot.data() || {};
      if (!isActiveSubscriptionStatus(family.subscription?.status)) continue;

      const customer =
        tracking.customer || await subscriptionCustomerLabel(family);

      await notifyPlatformAdmins({
        type: "ADMIN_SUBSCRIPTION",
        eventId: `subscription-seven-days-${trackingDocument.id}-${subscribedAt}`,
        title: "Customer active after 7 days",
        body: `${customer} kept their subscription active for 7 days.`,
        clickAction: `/internal/customers?family=${encodeURIComponent(trackingDocument.id)}`
      });

      await trackingDocument.ref.set({
        retentionNotified: true,
        retentionNotifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return null;
  });

type WeeklyAppTotal = {
  appName: string;
  packageName: string;
  totalTimeMs: number;
};

function weeklyDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function weeklyDateKeys(startMs: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startMs + index * 24 * 60 * 60 * 1000);
    return weeklyDateKey(date);
  });
}

async function weeklyAppUsage(
  childId: string,
  dateKeys: string[]
): Promise<{ total: number; apps: WeeklyAppTotal[] }> {
  const snapshots = await Promise.all(dateKeys.map(dateKey =>
    db.collection("children")
      .doc(childId)
      .collection("appUsage")
      .doc(dateKey)
      .collection("apps")
      .get()
  ));
  const appTotals = new Map<string, WeeklyAppTotal>();
  let total = 0;

  snapshots.forEach(snapshot => snapshot.docs.forEach(document => {
    const data = document.data();
    const totalTimeMs = Number(data.totalTimeMs || 0);
    if (totalTimeMs <= 0) return;
    total += totalTimeMs;
    const packageName = String(data.packageName || document.id);
    const current = appTotals.get(packageName) || {
      appName: String(data.appName || "Unknown app"),
      packageName,
      totalTimeMs: 0
    };
    current.totalTimeMs += totalTimeMs;
    appTotals.set(packageName, current);
  }));

  return {
    total,
    apps: [...appTotals.values()]
      .sort((first, second) => second.totalTimeMs - first.totalTimeMs)
      .slice(0, 5)
  };
}

async function buildWeeklySafetyReport(
  familyId: string,
  periodStart: number,
  periodEnd: number
): Promise<{ reportId: string; report: DocumentData }> {
  const familyRef = db.collection("families").doc(familyId);
  const familySnapshot = await familyRef.get();
  if (!familySnapshot.exists) throw new Error(`Family ${familyId} not found`);

  const currentKeys = weeklyDateKeys(periodStart, 7);
  const previousStart = periodStart - 7 * 24 * 60 * 60 * 1000;
  const previousKeys = weeklyDateKeys(previousStart, 7);
  const childSnapshot = await db.collection("children")
    .where("familyId", "==", familyId)
    .get();

  const childReports = await Promise.all(childSnapshot.docs.map(async childDocument => {
    const childId = childDocument.id;
    const child = childDocument.data();
    const childRef = db.collection("children").doc(childId);
    const familyChildRef = familyRef.collection("children").doc(childId);

    const [
      currentUsage,
      previousUsage,
      youtubeSnapshot,
      browserSnapshot,
      installedSnapshot,
      restrictionSnapshot,
      statusSnapshot
    ] = await Promise.all([
      weeklyAppUsage(childId, currentKeys),
      weeklyAppUsage(childId, previousKeys),
      familyChildRef.collection("youtubeHistory")
        .where("capturedAt", ">=", periodStart)
        .where("capturedAt", "<=", periodEnd)
        .get(),
      familyChildRef.collection("browserHistory")
        .where("capturedAt", ">=", periodStart)
        .where("capturedAt", "<=", periodEnd)
        .get(),
      childRef.collection("installedApps").get(),
      childRef.collection("appRestrictionEvents")
        .where("occurredAt", ">=", periodStart)
        .where("occurredAt", "<=", periodEnd)
        .get(),
      childRef.collection("status").doc("current").get()
    ]);

    const installedApps = installedSnapshot.docs.filter(document => {
      const data = document.data();
      const installedAt = adminNotificationMillis(
        data.installedAt || data.firstInstallTime || data.createdAt
      );
      return installedAt >= periodStart && installedAt <= periodEnd;
    }).length;
    const status = statusSnapshot.data() || {};

    return {
      childId,
      childName: String(status.childName || child.name || child.childName || "Child"),
      screenTimeMs: currentUsage.total,
      previousScreenTimeMs: previousUsage.total,
      youtubeViews: youtubeSnapshot.size,
      browserVisits: browserSnapshot.size,
      installedApps,
      blockedAttempts: restrictionSnapshot.size,
      deviceOnline: status.online === true,
      topApps: currentUsage.apps
    };
  }));

  const notificationSnapshot = await db.collection("notifications")
    .where("familyId", "==", familyId)
    .limit(1000)
    .get();
  const safetyTypes = new Set([
    "SOS",
    "TAMPER_ALERT",
    "PERMISSION_CHANGE_REQUEST",
    "SYNC_ERROR",
    "BATTERY",
    "DEVICE_OFFLINE"
  ]);
  const safetyAlerts = notificationSnapshot.docs.filter(document => {
    const data = document.data();
    const createdAt = adminNotificationMillis(data.createdAt);
    return createdAt >= periodStart && createdAt <= periodEnd &&
      safetyTypes.has(String(data.type || ""));
  }).length;

  const screenTimeMs = childReports.reduce((sum, child) => sum + child.screenTimeMs, 0);
  const previousScreenTimeMs = childReports.reduce(
    (sum, child) => sum + child.previousScreenTimeMs,
    0
  );
  const changePercent = previousScreenTimeMs > 0
    ? Math.round(((screenTimeMs - previousScreenTimeMs) / previousScreenTimeMs) * 100)
    : screenTimeMs > 0 ? 100 : 0;
  const totals = {
    screenTimeMs,
    previousScreenTimeMs,
    screenTimeChangePercent: changePercent,
    youtubeViews: childReports.reduce((sum, child) => sum + child.youtubeViews, 0),
    browserVisits: childReports.reduce((sum, child) => sum + child.browserVisits, 0),
    installedApps: childReports.reduce((sum, child) => sum + child.installedApps, 0),
    blockedAttempts: childReports.reduce((sum, child) => sum + child.blockedAttempts, 0),
    safetyAlerts,
    offlineDevices: childReports.filter(child => !child.deviceOnline).length
  };
  const highlights: string[] = [];
  if (totals.blockedAttempts > 0) {
    highlights.push(`${totals.blockedAttempts} blocked-app attempt${totals.blockedAttempts === 1 ? "" : "s"} need review.`);
  }
  if (totals.safetyAlerts > 0) {
    highlights.push(`${totals.safetyAlerts} safety alert${totals.safetyAlerts === 1 ? "" : "s"} were recorded.`);
  }
  if (totals.offlineDevices > 0) {
    highlights.push(`${totals.offlineDevices} child device${totals.offlineDevices === 1 ? " is" : "s are"} currently offline.`);
  }
  highlights.push(
    changePercent === 0
      ? "Screen time is unchanged from the previous seven days."
      : `Screen time is ${Math.abs(changePercent)}% ${changePercent > 0 ? "higher" : "lower"} than the previous seven days.`
  );
  if (totals.installedApps > 0) {
    highlights.push(`${totals.installedApps} new app${totals.installedApps === 1 ? " was" : "s were"} installed.`);
  }
  if (highlights.length === 1) {
    highlights.unshift("No urgent safety event was recorded this week.");
  }

  const reportId = weeklyDateKey(new Date(periodEnd));
  const report = {
    familyId,
    periodStart,
    periodEnd,
    generatedAt: FieldValue.serverTimestamp(),
    childReports,
    totals,
    highlights,
    version: 1
  };
  await familyRef.collection("weeklyReports").doc(reportId).set(report, { merge: true });
  return { reportId, report };
}

export const generateWeeklySafetyReportNow = functions.https.onCall(
  async (data, context) => {
    if (!context.auth || context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError("unauthenticated", "Verified sign-in required.");
    }
    const familyId = typeof data?.familyId === "string" ? data.familyId : "";
    if (!familyId) {
      throw new functions.https.HttpsError("invalid-argument", "familyId is required.");
    }
    const familySnapshot = await db.collection("families").doc(familyId).get();
    const family = familySnapshot.data() || {};
    const members = new Set<string>([
      family.ownerId,
      ...(Array.isArray(family.memberUids) ? family.memberUids : []),
      ...(Array.isArray(family.managerUids) ? family.managerUids : [])
    ].filter((value): value is string => typeof value === "string" && value.length > 0));
    if (!familySnapshot.exists || !members.has(context.auth.uid)) {
      throw new functions.https.HttpsError("permission-denied", "Family access denied.");
    }

    const periodEnd = Date.now();
    const periodStart = periodEnd - 7 * 24 * 60 * 60 * 1000;
    const result = await buildWeeklySafetyReport(familyId, periodStart, periodEnd);
    return { reportId: result.reportId };
  }
);

export const generateWeeklySafetyReports = functions
  .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 540, memory: "1GB" })
  .pubsub.schedule("0 8 * * 1")
  .timeZone("Europe/Berlin")
  .onRun(async () => {
    const now = new Date();
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const periodEnd = todayStart - 1;
    const periodStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const familiesSnapshot = await db.collection("families").limit(500).get();
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    for (const familyDocument of familiesSnapshot.docs) {
      try {
        const family = familyDocument.data();
        const result = await buildWeeklySafetyReport(
          familyDocument.id,
          periodStart,
          periodEnd
        );
        const memberIds = [...new Set<string>([
          family.ownerId,
          ...(Array.isArray(family.memberUids) ? family.memberUids : []),
          ...(Array.isArray(family.managerUids) ? family.managerUids : [])
        ].filter((value): value is string => typeof value === "string" && value.length > 0))];

        for (const parentId of memberIds) {
          const parentSnapshot = await db.collection("parents").doc(parentId).get();
          if (!parentSnapshot.exists) continue;
          const parent = parentSnapshot.data() || {};
          await notifyParent(parentId, {
            type: "WEEKLY_REPORT",
            title: "Your weekly safety report is ready",
            body: `${result.report.totals.screenTimeChangePercent > 0 ? "+" : ""}${result.report.totals.screenTimeChangePercent}% screen-time change · ${result.report.totals.safetyAlerts} safety alerts`,
            childId: "",
            familyId: familyDocument.id,
            eventId: `weekly-report-${familyDocument.id}-${result.reportId}`,
            clickAction: `/reports?week=${encodeURIComponent(result.reportId)}`
          });

          if (typeof parent.email === "string" && parent.email) {
            await resend.emails.send({
              from: "KidsGuard <onboarding@resend.dev>",
              to: [parent.email],
              subject: "Your KidsGuard weekly safety report",
              html: `
                <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a">
                  <h2>Your weekly safety report is ready</h2>
                  <p>Screen time: <strong>${Math.round(result.report.totals.screenTimeMs / 60000)} minutes</strong></p>
                  <p>YouTube: <strong>${result.report.totals.youtubeViews}</strong> · Web visits: <strong>${result.report.totals.browserVisits}</strong></p>
                  <p>Blocked attempts: <strong>${result.report.totals.blockedAttempts}</strong> · Safety alerts: <strong>${result.report.totals.safetyAlerts}</strong></p>
                  <p><a href="https://kidsguard-screen.vercel.app/reports?week=${encodeURIComponent(result.reportId)}" style="color:#2563eb;font-weight:700">Open full weekly report</a></p>
                </div>`
            });
          }
        }
      } catch (error) {
        console.error(`Weekly report failed for family ${familyDocument.id}:`, error);
      }
    }
    return null;
  });


async function listParentBillingInvoicesHandler(
  _data: any,
  context: functions.https.CallableContext
) {
    const owner = await requireParentBillingOwner(context);
    if (!owner.paddleCustomerId) {
      return {invoices: [], hasMore: false, source: 'PADDLE'};
    }
    const result = await storedTransactionsForFamily(owner.familyId, 360);

    const invoices = result.transactions
      .filter((transaction) =>
        transaction.status === 'completed' &&
        typeof transaction.subscription_id === 'string' &&
        Boolean(transaction.subscription_id) &&
        paddleTransactionTotals(transaction).total !== 0
      )
      .map(normalizeParentInvoice);

    return {
      invoices,
      hasMore: result.truncated,
      source: 'PADDLE'
    };
}

export const listParentBillingInvoices = functions
  .runWith({secrets: [paddleApiKey], timeoutSeconds: 120})
  .https.onCall(listParentBillingInvoicesHandler);

async function getParentInvoiceDownloadUrlHandler(
  data: any,
  context: functions.https.CallableContext
) {
    const owner = await requireParentBillingOwner(context);
    if (!owner.paddleCustomerId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No Paddle billing history is connected to this family yet.'
      );
    }
    const transactionId = String(data?.transactionId || '').trim();
    if (!/^txn_[a-z\d]{26}$/.test(transactionId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Select a valid invoice.'
      );
    }

    const transaction = await getPaddleTransaction(transactionId);
    if (
      transaction.customer_id !== owner.paddleCustomerId ||
      transaction.status !== 'completed' ||
      typeof transaction.subscription_id !== 'string' ||
      !transaction.subscription_id ||
      paddleTransactionTotals(transaction).total === 0
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This invoice is not available for your family.'
      );
    }

    const apiKey = paddleApiKeyValue();
    const invoiceUrl = new URL(
      `${paddleApiBaseUrl(apiKey)}/transactions/` +
        `${encodeURIComponent(transactionId)}/invoice`
    );
    invoiceUrl.searchParams.set('disposition', 'attachment');
    const payload = await paddleGet<{data?: {url?: string}}>(invoiceUrl);
    const downloadUrl = payload.data?.url;
    if (typeof downloadUrl !== 'string' || !downloadUrl.startsWith('https://')) {
      throw new functions.https.HttpsError(
        'unavailable',
        'Paddle could not prepare this invoice PDF.'
      );
    }

    await db.collection('auditLogs').add({
      actorUid: owner.uid,
      actorEmail: owner.email,
      familyId: owner.familyId,
      action: 'SUBSCRIPTION_INVOICE_DOWNLOADED',
      targetType: 'PADDLE_TRANSACTION',
      targetId: transactionId,
      severity: 'INFO',
      metadata: {invoiceNumber: transaction.invoice_number || null},
      createdAt: FieldValue.serverTimestamp()
    });

    return {
      transactionId,
      invoiceNumber: transaction.invoice_number || null,
      downloadUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
}

export const getParentInvoiceDownloadUrl = functions
  .runWith({secrets: [paddleApiKey], timeoutSeconds: 120})
  .https.onCall(getParentInvoiceDownloadUrlHandler);

async function getAdminMonthlyBillingReportHandler(
  data: any,
  context: functions.https.CallableContext
) {
    const owner = await requirePlatformOwner(context);
    const month = validReportMonth(data?.month);
    const range = reportMonthRange(month);
    const result = await storedTransactionsForMonth(month, 3000);

    if (result.truncated) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'This month has too many transactions for an on-demand statement. Export it from Paddle.'
      );
    }

    const transactions = result.transactions.filter((transaction) =>
      transaction.status === 'completed' &&
      typeof transaction.subscription_id === 'string' &&
      Boolean(transaction.subscription_id)
    );
    const countries = new Map<string, {
      countryCode: string;
      currencyCode: string;
      transactionCount: number;
      net: number;
      tax: number;
      gross: number;
      taxRates: Set<string>;
    }>();
    const currencies = new Map<string, {
      currencyCode: string;
      transactionCount: number;
      net: number;
      tax: number;
      gross: number;
    }>();
    const payouts = new Map<string, {
      currencyCode: string;
      gross: number;
      tax: number;
      fees: number;
      earnings: number;
    }>();

    for (const transaction of transactions) {
      const totals = paddleTransactionTotals(transaction);
      const countryCode = String(
        transaction.address?.country_code || 'UNKNOWN'
      ).toUpperCase();
      const countryKey = `${countryCode}:${totals.currencyCode}`;
      const country = countries.get(countryKey) || {
        countryCode,
        currencyCode: totals.currencyCode,
        transactionCount: 0,
        net: 0,
        tax: 0,
        gross: 0,
        taxRates: new Set<string>()
      };
      country.transactionCount += 1;
      country.net += totals.total - totals.tax;
      country.tax += totals.tax;
      country.gross += totals.total;
      for (const rate of transaction.details?.tax_rates_used || []) {
        const parsedRate = Number(rate.tax_rate);
        if (Number.isFinite(parsedRate) && parsedRate >= 0) {
          country.taxRates.add(String(parsedRate));
        }
      }
      countries.set(countryKey, country);

      const currency = currencies.get(totals.currencyCode) || {
        currencyCode: totals.currencyCode,
        transactionCount: 0,
        net: 0,
        tax: 0,
        gross: 0
      };
      currency.transactionCount += 1;
      currency.net += totals.total - totals.tax;
      currency.tax += totals.tax;
      currency.gross += totals.total;
      currencies.set(totals.currencyCode, currency);

      const payoutTotals = transaction.details?.payout_totals;
      const payoutCurrency = String(
        payoutTotals?.currency_code || ''
      ).toUpperCase();
      if (payoutTotals && payoutCurrency) {
        const payout = payouts.get(payoutCurrency) || {
          currencyCode: payoutCurrency,
          gross: 0,
          tax: 0,
          fees: 0,
          earnings: 0
        };
        payout.gross += paddleMoney(
          payoutTotals.grand_total ?? payoutTotals.total
        );
        payout.tax += paddleMoney(
          payoutTotals.grand_total_tax ?? payoutTotals.tax
        );
        payout.fees += paddleMoney(payoutTotals.fee);
        payout.earnings += paddleMoney(payoutTotals.earnings);
        payouts.set(payoutCurrency, payout);
      }
    }

    const countryBreakdown = Array.from(countries.values())
      .map((country) => ({
        ...country,
        taxRates: Array.from(country.taxRates)
          .map(Number)
          .sort((a, b) => a - b)
      }))
      .sort((a, b) =>
        a.countryCode.localeCompare(b.countryCode) ||
        a.currencyCode.localeCompare(b.currencyCode)
      );

    await db.collection('auditLogs').add({
      actorUid: owner.uid,
      actorEmail: owner.email,
      familyId: 'PLATFORM',
      action: 'MONTHLY_BILLING_REPORT_VIEWED',
      targetType: 'BILLING_MONTH',
      targetId: month,
      severity: 'NOTICE',
      metadata: {transactionCount: transactions.length},
      createdAt: FieldValue.serverTimestamp()
    });

    return {
      month,
      periodStart: range.start,
      periodEnd: range.end,
      generatedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      countryBreakdown,
      currencyTotals: Array.from(currencies.values())
        .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
      payoutTotals: Array.from(payouts.values())
        .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
      source: 'PADDLE_COMPLETED_TRANSACTIONS',
      note: 'Tax and totals use the webhook-backed Paddle transaction ledger. Currency amounts are not converted or combined.'
    };
}

export const getAdminMonthlyBillingReport = functions
  .runWith({secrets: [paddleApiKey], timeoutSeconds: 120, memory: '512MB'})
  .https.onCall(getAdminMonthlyBillingReportHandler);

// Keep the first fresh identities for clients that loaded the earlier release.
export const listParentBillingInvoicesV2 = listParentBillingInvoices;
export const getParentInvoiceDownloadUrlV2 = getParentInvoiceDownloadUrl;
export const getAdminMonthlyBillingReportV2 = getAdminMonthlyBillingReport;

// These identities run in a separate regional egress pool to avoid persistent
// IP-based Paddle throttling seen from us-central1.
export const listParentBillingInvoicesV3 = functions
  .region('europe-west1')
  .runWith({secrets: [paddleApiKey], timeoutSeconds: 120})
  .https.onCall(listParentBillingInvoicesHandler);
export const getParentInvoiceDownloadUrlV3 = functions
  .region('europe-west1')
  .runWith({secrets: [paddleApiKey], timeoutSeconds: 120})
  .https.onCall(getParentInvoiceDownloadUrlHandler);
export const getAdminMonthlyBillingReportV3 = functions
  .region('europe-west1')
  .runWith({secrets: [paddleApiKey], timeoutSeconds: 120, memory: '512MB'})
  .https.onCall(getAdminMonthlyBillingReportHandler);

// Gen 2 uses a Cloud Run based network path, independent from the throttled
// Gen 1 egress pool. The handler request contains the same auth context fields.
export const listParentBillingInvoicesV4 = onCallV2(
  {region: 'europe-west1', secrets: [paddleApiKey], timeoutSeconds: 120,
    serviceAccount: 'kidsguard-0626@appspot.gserviceaccount.com'},
  (request) => listParentBillingInvoicesHandler(
    request.data,
    request as unknown as functions.https.CallableContext
  )
);
export const getParentInvoiceDownloadUrlV4 = onCallV2(
  {region: 'europe-west1', secrets: [paddleApiKey], timeoutSeconds: 120,
    serviceAccount: 'kidsguard-0626@appspot.gserviceaccount.com'},
  (request) => getParentInvoiceDownloadUrlHandler(
    request.data,
    request as unknown as functions.https.CallableContext
  )
);
export const getAdminMonthlyBillingReportV4 = onCallV2(
  {
    region: 'europe-west1',
    secrets: [paddleApiKey],
    timeoutSeconds: 120,
    memory: '512MiB',
    serviceAccount: 'kidsguard-0626@appspot.gserviceaccount.com'
  },
  (request) => getAdminMonthlyBillingReportHandler(
    request.data,
    request as unknown as functions.https.CallableContext
  )
);

type PaddleWebhookPayload = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: Record<string, any>;
};

function verifyPaddleWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  const parts = signatureHeader.split(';');
  const timestamp = parts
    .find((part) => part.startsWith('ts='))
    ?.slice(3);
  const signatures = parts
    .filter((part) => part.startsWith('h1='))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 300
  ) {
    return false;
  }

  const signedPayload =
    `${timestamp}:${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secret)
    .update(signedPayload)
    .digest();

  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return false;
    }
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length &&
      timingSafeEqual(supplied, expected);
  });
}

function paddleStatus(value: unknown): string {
  switch (String(value || '').toLowerCase()) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'paused':
      return 'PAUSED';
    case 'canceled':
      return 'CANCELED';
    default:
      return 'NONE';
  }
}

function paddleDateMillis(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const paddleBillingWebhook = functions
  .runWith({
    secrets: [paddleWebhookSecret],
    timeoutSeconds: 60,
    memory: '256MB'
  })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST').status(405).send('Method Not Allowed');
      return;
    }

    const signatureHeader = req.get('paddle-signature') || '';
    const secret = paddleWebhookSecret.value();
    if (
      !secret ||
      !verifyPaddleWebhookSignature(
        req.rawBody,
        signatureHeader,
        secret
      )
    ) {
      console.warn('Rejected Paddle webhook with invalid signature.');
      res.status(401).send('Invalid signature');
      return;
    }

    let payload: PaddleWebhookPayload;
    try {
      payload = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      res.status(400).send('Invalid JSON');
      return;
    }

    const eventId =
      typeof payload.event_id === 'string'
        ? payload.event_id.trim()
        : '';
    const eventType =
      typeof payload.event_type === 'string'
        ? payload.event_type.trim()
        : '';
    const data = payload.data || {};
    const customData =
      data.custom_data &&
      typeof data.custom_data === 'object'
        ? data.custom_data
        : {};
    const familyId =
      typeof customData.familyId === 'string'
        ? customData.familyId.trim()
        : '';
    const parentUid =
      typeof customData.parentUid === 'string'
        ? customData.parentUid.trim()
        : '';
    const promoCode = normalizePromoCode(customData.promoCode);

    if (!eventId || !eventType) {
      res.status(400).send('Missing event identity');
      return;
    }

    if (!familyId) {
      console.error(
        `Paddle event ${eventId} is missing custom_data.familyId.`
      );
      res.status(422).send('Missing family mapping');
      return;
    }

    const eventRef = db
      .collection('paddleWebhookEvents')
      .doc(eventId);
    const familyRef = db
      .collection('families')
      .doc(familyId);
    const promoRef = promoCode
      ? db.collection('promoCodes').doc(promoCode)
      : null;
    const promoRedemptionRef = promoCode && parentUid
      ? db.collection('promoRedemptions').doc(`${promoCode}_${parentUid}`)
      : null;
    const billingInvoiceRef =
      eventType.startsWith('transaction.') &&
      data.status === 'completed' &&
      typeof data.id === 'string' &&
      /^txn_[a-z\d]{26}$/.test(data.id)
        ? db.collection('billingInvoices').doc(data.id)
        : null;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const [
          eventSnapshot,
          familySnapshot,
          promoSnapshot,
          promoRedemptionSnapshot
        ] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(familyRef),
          promoRef ? transaction.get(promoRef) : Promise.resolve(null),
          promoRedemptionRef
            ? transaction.get(promoRedemptionRef)
            : Promise.resolve(null)
        ]);

        if (eventSnapshot.exists) {
          return 'duplicate';
        }
        if (!familySnapshot.exists) {
          throw new Error('FAMILY_NOT_FOUND');
        }

        const familyData = familySnapshot.data() || {};
        if (
          parentUid &&
          familyData.ownerId &&
          familyData.ownerId !== parentUid
        ) {
          throw new Error('OWNER_MISMATCH');
        }

        const subscription =
          familyData.subscription || {};
        if (
          currentBillingProvider(subscription) === 'GOOGLE_PLAY' &&
          ACTIVE_BILLING_STATUSES.has(
            String(subscription.status || 'NONE').toUpperCase()
          )
        ) {
          transaction.create(eventRef, {
            eventId,
            eventType,
            familyId,
            parentUid: parentUid || null,
            occurredAt:
              paddleDateMillis(payload.occurred_at) || Date.now(),
            processedAt: FieldValue.serverTimestamp(),
            status: 'REJECTED_PROVIDER_CONFLICT'
          });
          transaction.set(
            db.collection('billingConflicts').doc(eventId),
            {
              eventId,
              eventType,
              familyId,
              parentUid: parentUid || null,
              existingProvider: 'GOOGLE_PLAY',
              incomingProvider: 'PADDLE',
              providerTransactionId:
                typeof data.id === 'string' ? data.id : null,
              providerSubscriptionId:
                typeof data.subscription_id === 'string'
                  ? data.subscription_id
                  : eventType.startsWith('subscription.') &&
                    typeof data.id === 'string'
                    ? data.id
                    : null,
              status: 'NEEDS_REFUND_REVIEW',
              createdAt: FieldValue.serverTimestamp()
            }
          );
          return 'provider-conflict';
        }
        const patch: Record<string, any> = {
          'subscription.provider': 'PADDLE',
          'subscription.promoAccessEndsAt':
            FieldValue.delete(),
          'subscription.promoAccessStartsAt':
            FieldValue.delete(),
          'subscription.promoRevokedAt':
            FieldValue.delete(),
          'subscription.lastPaddleEventId': eventId,
          'subscription.lastPaddleEventType': eventType,
          'subscription.lastProviderSyncAt':
            FieldValue.serverTimestamp()
        };

        if (typeof data.customer_id === 'string') {
          patch['subscription.paddleCustomerId'] =
            data.customer_id;
        }
        if (
          typeof data.id === 'string' &&
          eventType.startsWith('subscription.')
        ) {
          patch['subscription.paddleSubscriptionId'] =
            data.id;
        }
        if (typeof data.subscription_id === 'string') {
          patch['subscription.paddleSubscriptionId'] =
            data.subscription_id;
        }

        if (eventType.startsWith('subscription.')) {
          patch['subscription.status'] =
            paddleStatus(data.status);

          const recurringAddOnByPriceId =
            getPaddleRecurringAddOnByPriceId();
          const extraPriceIds = getPaddleExtraChildPriceIds();
          const subscriptionItems = Array.isArray(data.items)
            ? data.items
            : [];
          const basePlanItem = subscriptionItems.find((item: any) => {
            const itemPriceId = item?.price?.id || item?.price_id;
            return typeof itemPriceId !== 'string' ||
              !recurringAddOnByPriceId.has(itemPriceId);
          });
          const providerInterval =
            data.billing_cycle?.interval ||
            basePlanItem?.price?.billing_cycle?.interval;
          const requestedInterval = customData.billingInterval;
          const normalizedInterval =
            String(providerInterval || requestedInterval || '')
              .toLowerCase();
          if (normalizedInterval === 'year' || normalizedInterval === 'yearly') {
            patch['subscription.billingInterval'] = 'YEARLY';
          } else if (
            normalizedInterval === 'month' ||
            normalizedInterval === 'monthly'
          ) {
            patch['subscription.billingInterval'] = 'MONTHLY';
          }

          const providerAmount = Number(
            basePlanItem?.price?.unit_price?.amount
          );
          if (Number.isInteger(providerAmount) && providerAmount > 0) {
            patch['subscription.basePriceCents'] = providerAmount;
          }
          const providerCurrency =
            basePlanItem?.price?.unit_price?.currency_code ||
            data.currency_code;
          if (typeof providerCurrency === 'string' && providerCurrency) {
            patch['subscription.currency'] =
              providerCurrency.toUpperCase();
          }

          if (!subscription.subscribedAt) {
            const subscribedAt =
              paddleDateMillis(data.started_at) ||
              paddleDateMillis(data.created_at) ||
              paddleDateMillis(payload.occurred_at);
            if (subscribedAt !== null) {
              patch['subscription.subscribedAt'] =
                subscribedAt;
            }
          }

          const periodEnd = paddleDateMillis(
            data.current_billing_period?.ends_at
          );
          if (periodEnd !== null) {
            patch['subscription.currentPeriodEndsAt'] =
              periodEnd;
          }

          const trialStart = paddleDateMillis(
            data.trial_dates?.starts_at
          );
          if (trialStart !== null) {
            patch['subscription.trialStartsAt'] = trialStart;
          }
          const trialEnd = paddleDateMillis(
            data.trial_dates?.ends_at
          );
          if (trialEnd !== null) {
            patch['subscription.trialEndsAt'] = trialEnd;
          }
          const nextBilledAt = paddleDateMillis(data.next_billed_at);
          if (nextBilledAt !== null) {
            patch['subscription.nextBilledAt'] = nextBilledAt;
          }

          const scheduledChange =
            data.scheduled_change;
          const cancellationScheduled =
            scheduledChange?.action === 'cancel';
          patch['subscription.cancelAtPeriodEnd'] =
            cancellationScheduled;

          const effectiveAt = paddleDateMillis(
            scheduledChange?.effective_at
          );
          if (effectiveAt !== null) {
            patch['subscription.cancellationEffectiveAt'] =
              effectiveAt;
          } else if (!cancellationScheduled) {
            patch['subscription.cancellationEffectiveAt'] =
              FieldValue.delete();
          }

          // A newly-created/resumed subscription must not inherit an old
          // cancellation request from the family's previous subscription.
          // Those stale fields made the dashboard show "Keep Subscription"
          // immediately after a successful checkout.
          if (!cancellationScheduled) {
            patch['subscription.cancellationRequestedAt'] =
              FieldValue.delete();
            patch['subscription.cancellationRequestedBy'] =
              FieldValue.delete();
            patch['subscription.cancellationRequestId'] =
              FieldValue.delete();
            patch['subscription.cancellationStatus'] =
              FieldValue.delete();
          }

          if (Array.isArray(data.items)) {
            const recurringAddOns = data.items.flatMap((item: any) => {
              const itemPriceId = item?.price?.id || item?.price_id;
              if (typeof itemPriceId !== 'string') return [];
              const definition = recurringAddOnByPriceId.get(itemPriceId);
              if (!definition) return [];

              const quantity = Number(item?.quantity || 0);
              const unitPriceCents = Number(
                item?.price?.unit_price?.amount || 0
              );
              if (
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                !Number.isInteger(unitPriceCents) ||
                unitPriceCents <= 0
              ) {
                return [];
              }

              const itemInterval = String(
                item?.price?.billing_cycle?.interval ||
                providerInterval ||
                ''
              ).toLowerCase();
              return [{
                key: definition.key,
                name: definition.name,
                priceId: itemPriceId,
                quantity,
                unitPriceCents,
                currency: String(
                  item?.price?.unit_price?.currency_code ||
                  data.currency_code ||
                  'EUR'
                ).toUpperCase(),
                billingInterval:
                  itemInterval === 'year' || itemInterval === 'yearly'
                    ? 'YEARLY'
                    : 'MONTHLY'
              }];
            });
            patch['subscription.recurringAddOns'] = recurringAddOns;

            const paidExtraSlots = data.items.reduce(
              (total: number, item: any) => {
                const itemPriceId =
                  item?.price?.id ||
                  item?.price_id;
                if (
                  typeof itemPriceId !== 'string' ||
                  !extraPriceIds.has(itemPriceId)
                ) {
                  return total;
                }
                const quantity = Number(item?.quantity || 0);
                return total +
                  (Number.isInteger(quantity) && quantity > 0
                    ? quantity
                    : 0);
              },
              0
            );
            patch['subscription.extraChildSlots'] =
              paidExtraSlots;
            patch['subscription.extraChildPurchasePendingAt'] =
              FieldValue.delete();
            patch['subscription.extraChildPurchasePendingBy'] =
              FieldValue.delete();
            patch['subscription.extraChildPurchaseExpectedQuantity'] =
              FieldValue.delete();
            patch['subscription.extraChildPurchaseStatus'] =
              'CONFIRMED';

            const extraChildItem = recurringAddOns.find(
              (item: any) => item.key === 'extra_child_slot'
            );
            if (extraChildItem) {
              patch['subscription.extraChildPriceCents'] =
                extraChildItem.unitPriceCents;
            }
          }

          const promoData = promoSnapshot?.data() as
            | PromoCodeDocument
            | undefined;
          if (
            eventType === 'subscription.created' &&
            promoCode &&
            parentUid &&
            promoRef &&
            promoRedemptionRef &&
            promoData?.type === 'PERCENTAGE'
          ) {
            patch['subscription.promoCode'] = promoCode;
            patch['subscription.promoCodeType'] = 'PERCENTAGE';
            patch['subscription.promoCodeStatus'] = 'REDEEMED';
            patch['subscription.promoDiscountPercentage'] =
              Number(promoData.percentage || 0);

            if (!promoRedemptionSnapshot?.exists) {
              transaction.set(promoRedemptionRef, {
                redemptionId: promoRedemptionRef.id,
                code: promoCode,
                type: 'PERCENTAGE',
                status: 'REDEEMED',
                parentUid,
                familyId,
                paddleSubscriptionId:
                  typeof data.id === 'string' ? data.id : null,
                redeemedAt:
                  FieldValue.serverTimestamp()
              });
              transaction.update(promoRef, {
                redemptionCount:
                  FieldValue.increment(1),
                lastRedeemedAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp()
              });
            }
          } else if (!promoCode) {
            patch['subscription.promoCode'] =
              FieldValue.delete();
            patch['subscription.promoCodeType'] =
              FieldValue.delete();
            patch['subscription.promoCodeStatus'] =
              FieldValue.delete();
            patch['subscription.promoDiscountPercentage'] =
              FieldValue.delete();
          }
        }

        transaction.update(familyRef, patch);
        if (billingInvoiceRef) {
          transaction.set(
            billingInvoiceRef,
            storedBillingInvoice(familyId, data as PaddleTransaction),
            {merge: true}
          );
        }
        transaction.create(eventRef, {
          eventId,
          eventType,
          familyId,
          parentUid: parentUid || null,
          occurredAt:
            paddleDateMillis(payload.occurred_at) ||
            Date.now(),
          processedAt:
            FieldValue.serverTimestamp(),
          status: 'PROCESSED'
        });

        return 'processed';
      });

      if (result === 'provider-conflict') {
        console.error(
          `Paddle event ${eventId} was quarantined because family ${familyId} is billed by Google Play.`
        );
      }

      res.status(200).json({
        received: true,
        duplicate: result === 'duplicate',
        providerConflict: result === 'provider-conflict'
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'UNKNOWN_ERROR';
      console.error(
        `Paddle webhook ${eventId} failed:`,
        error
      );

      if (
        message === 'FAMILY_NOT_FOUND' ||
        message === 'OWNER_MISMATCH'
      ) {
        res.status(422).send(message);
        return;
      }

      res.status(500).send('Webhook processing failed');
    }
  });
