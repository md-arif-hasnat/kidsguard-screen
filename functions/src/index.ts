// Keep the existing Gen 1 API contract explicit while using the current SDK.
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { defineSecret } from 'firebase-functions/params';

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();
const storageBucket = admin.storage().bucket();
const paddleWebhookSecret = defineSecret('PADDLE_WEBHOOK_SECRET');
const paddleApiKey = defineSecret('PADDLE_API_KEY');

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
      body: JSON.stringify(
        String(subscription.status || '').toLowerCase() === 'trialing'
          ? {
              items,
              // Paddle does not prorate item changes while a subscription is
              // trialing. The add-on joins the first combined renewal charge.
              proration_billing_mode: 'do_not_bill'
            }
          : {
              items,
              proration_billing_mode: 'prorated_immediately',
              on_payment_failure: 'prevent_change'
            }
      )
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
  collectionRef: admin.firestore.CollectionReference,
  field: string,
  cutoff: number | admin.firestore.Timestamp,
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
  childRef: admin.firestore.DocumentReference,
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
    admin.firestore.Timestamp
  ) {
    return value.toDate().toISOString();
  }

  if (
    value instanceof
    admin.firestore.GeoPoint
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
    admin.firestore.DocumentReference
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
    admin.firestore.DocumentReference;
  familySnapshot:
    admin.firestore.DocumentSnapshot;
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
        admin.firestore.FieldValue.serverTimestamp()
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
type: "PERMISSION_CHANGE_REQUEST",
childId,
eventId: requestId,
clickAction:
`/dashboard/${encodeURIComponent(childId)}` +
`?tab=overview&permissionRequest=${encodeURIComponent(requestId)}` +
"#permission-approvals",
});
});

/**
 * Sends a parent push notification when the child asks for additional
 * screen time. Resolution is handled from the child's Overview page.
 */
export const onAppAccessRequestCreated = functions.firestore
.document("children/{childId}/appAccessRequests/{requestId}")
.onCreate(async (snapshot, context) => {
const request = snapshot.data();
const childId = String(context.params.childId || "");
const requestId = String(context.params.requestId || "");

if (!childId || !requestId || request?.status !== "PENDING") {
return;
}

const childName = String(request?.childName || "Your child");
const appName = String(
request?.appName || request?.packageName || "an app"
);

await broadcastToParents(childId, {
title: "More screen time requested",
body: `${childName} requested more time for ${appName}.`,
type: "APP_ACCESS_REQUEST",
childId,
packageName: String(request?.packageName || ""),
eventId: requestId,
clickAction:
`/dashboard/${encodeURIComponent(childId)}` +
`?tab=overview&screenTimeRequest=${encodeURIComponent(requestId)}` +
"#screen-time-requests",
});
});

/**
 * Sends a parent push notification when the child requests a blocked website.
 * The notification opens the exact request in Internet Protection.
 */
export const onWebAccessRequestCreated = functions.firestore
.document("children/{childId}/accessRequests/{requestId}")
.onCreate(async (snapshot, context) => {
const request = snapshot.data();
const childId = String(context.params.childId || "");
const requestId = String(context.params.requestId || "");

if (!childId || !requestId || request?.status !== "PENDING") {
return;
}

const childName = String(request?.childName || "Your child");
const domain = String(request?.domain || request?.url || "a blocked website");

await broadcastToParents(childId, {
title: "Website access requested",
body: `${childName} requested access to ${domain}.`,
type: "WEB_ACCESS_REQUEST",
childId,
eventId: requestId,
clickAction:
`/dashboard/${encodeURIComponent(childId)}` +
`?tab=internet&webRequest=${encodeURIComponent(requestId)}` +
"#website-access-requests",
});
});

/**
 * Confirms to parents that an applied Remote Control lock/unlock command took
 * priority over scheduled lock state on the child device.
 */
export const onRemoteControlOverrideCreated = functions.firestore
.document("children/{childId}/remoteControlOverrides/{eventId}")
.onCreate(async (snapshot, context) => {
const event = snapshot.data();
const childId = String(context.params.childId || "");
const eventId = String(context.params.eventId || "");

if (!childId || !eventId || event?.status !== "APPLIED") {
return;
}

await broadcastToParents(childId, {
title: String(event?.title || "Remote control priority applied"),
body: String(
event?.message ||
"The Remote Control command took priority over scheduled settings."
),
type: "REMOTE_CONTROL_OVERRIDE",
childId,
eventId,
clickAction:
`/dashboard/${encodeURIComponent(childId)}` +
"?tab=overview#remote-control-override",
});
});

/**
 * A blocked-app window can emit many Accessibility events. Android writes a
 * deterministic per-day document, and this onCreate trigger therefore sends
 * at most one parent alert for the same child/app/reason/day.
 */
export const onAppRestrictionEventCreated = functions.firestore
.document("children/{childId}/appRestrictionEvents/{eventId}")
.onCreate(async (snapshot, context) => {
const event = snapshot.data();
const childId = String(context.params.childId || "");
const eventId = String(context.params.eventId || "");

if (!childId || !eventId || event?.notifyParent !== true) {
console.log("Skipping invalid app restriction event", { childId, eventId });
return;
}

const reason = String(event?.reason || "STATIC_BLOCK");
const appName = String(event?.appName || event?.packageName || "an app");
const packageName = String(event?.packageName || "");

const isTotalLimit = reason === "TOTAL_LIMIT_REACHED";
const isLimit = reason === "LIMIT_REACHED" || isTotalLimit;
const title = isTotalLimit
? "Daily screen time finished"
: isLimit
? "App time limit reached"
: "Blocked app attempt";
const body = isTotalLimit
? "The daily total screen-time limit was reached. Non-essential apps are now blocked."
: isLimit
? `${appName} reached today's time limit and was blocked.`
: `${appName} was opened on the child device and KidsGuard blocked it.`;

await broadcastToParents(childId, {
title,
body,
type: isLimit ? "APP_LIMIT_REACHED" : "BLOCKED_APP_ATTEMPT",
childId,
packageName,
eventId,
clickAction: isTotalLimit
? `/dashboard/${encodeURIComponent(childId)}?tab=wellbeing`
: `/dashboard/${encodeURIComponent(childId)}` +
  `?tab=installed-apps&pkg=${encodeURIComponent(packageName)}`,
});
});

/**
 * Triggered when an SOS event is created.
 */
export const onSosCreated = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onCreate(async (snapshot, context) => {
        const { childId, eventId } = context.params;
        const data = snapshot.data();

        if (!data) return;

        // Resolve child name
        const childSnap = await db.collection('children').doc(childId).get();
        const childName = childSnap.data()?.name || 'Your child';

        // 1. Create exactly one activity/history record for the SOS trigger
        await db.collection('children').doc(childId).collection('activities').doc(eventId).set({
            id: eventId,
            childId: childId,
            type: 'SOS',
            title: 'Emergency SOS Triggered',
            description: data.message || 'Manual trigger from device',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            accuracy: data.locationAccuracy || data.accuracy || null,
            timestamp: data.createdAt || data.timestamp || Date.now(),
            severity: 'critical'
        }, { merge: true });

        // 2. Broadcast high-priority notification to parents
        const notificationBody = data.message && data.message !== 'Emergency SOS Triggered'
            ? `${data.message}. Current location received.`
            : `${childName} may need help. Current location received.`;

        await broadcastToParents(childId, {
            title: `Emergency SOS from ${childName}`,
            body: notificationBody,
            type: 'SOS',
            childId: childId,
            eventId: eventId,
            clickAction: `/sos?childId=${childId}&eventId=${eventId}`
        });

        // 3. Reverse Geocoding (Asynchronous/Background)
        if (data.latitude && data.longitude) {
            try {
                const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAjBIvgF7Bbq92FeO68QsB3xkeEDieTbXU';
                const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${data.latitude},${data.longitude}&key=${apiKey}`;

                const response = await fetch(url);
                const result = await response.json();

                if (result.status === 'OK' && result.results.length > 0) {
                    const addressObj = result.results[0];
                    const components = addressObj.address_components;

                    let street = '';
                    let houseNumber = '';
                    let city = '';
                    let postalCode = '';
                    let country = '';

                    components.forEach((c: any) => {
                        if (c.types.includes('route')) street = c.long_name;
                        if (c.types.includes('street_number')) houseNumber = c.long_name;
                        if (c.types.includes('locality')) city = c.long_name;
                        if (c.types.includes('postal_code')) postalCode = c.long_name;
                        if (c.types.includes('country')) country = c.long_name;
                    });

                    const displayAddress = street
                        ? `${street}${houseNumber ? ' ' + houseNumber : ''}\n${postalCode}${city ? ' ' + city : ''}`
                        : addressObj.formatted_address;

                    await snapshot.ref.update({
                        address: displayAddress,
                        street,
                        houseNumber,
                        postalCode,
                        city,
                        country,
                        geocodedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (error) {
                console.error("Reverse geocoding failed", error);
            }
        }
    });

/**
 * Optional: Triggered when an SOS event is resolved.
 */
export const onSosResolved = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const { childId, eventId } = context.params;

        if (before.status !== 'RESOLVED' && after.status === 'RESOLVED') {
            const now = Date.now();

            // 1. Create SOS_RESOLVED activity record
            const resolutionId = `${eventId}_resolved`;
            await db.collection('children').doc(childId).collection('activities').doc(resolutionId).set({
                id: resolutionId,
                childId: childId,
                type: 'SOS_RESOLVED',
                title: 'SOS Resolved',
                description: 'The emergency signal was marked as resolved.',
                timestamp: now,
                severity: 'info'
            }, { merge: true });

            // 2. Broadcast resolution notification (optional)
            await broadcastToParents(childId, {
                title: 'SOS Resolved',
                body: 'Emergency situation has been marked as resolved.',
                type: 'SOS_RESOLVED',
                childId: childId,
                eventId: eventId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

/**
 * Triggered when child status (battery, online) changes.
 */
export const onStatusChanged = functions.firestore
    .document('children/{childId}/status/current')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const { childId } = context.params;

        if (!before || !after) return;

        const childName = after.childName || 'Child';

        // 1. Battery Alerts
        if (after.batteryPercent <= 10 && before.batteryPercent > 10) {
            await broadcastToParents(childId, {
                title: `🪫 Critical Battery: ${childName}`,
                body: `${childName}'s device is at ${after.batteryPercent}%. Charge immediately.`,
                type: 'BATTERY',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        } else if (after.batteryPercent <= 20 && before.batteryPercent > 20) {
            await broadcastToParents(childId, {
                title: `🔋 Low Battery: ${childName}`,
                body: `${childName}'s device is at ${after.batteryPercent}%.`,
                type: 'BATTERY',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }

        // 2. Online/Offline Alerts
        if (after.online === false && before.online === true) {
            await broadcastToParents(childId, {
                title: `☁️ ${childName} is Offline`,
                body: 'Connection to the child device was lost.',
                type: 'DEVICE',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        } else if (after.online === true && before.online === false) {
            await broadcastToParents(childId, {
                title: `🌐 ${childName} is Online`,
                body: 'Device has reconnected to the network.',
                type: 'DEVICE',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

/**
 * Alerts parents when a child data source reaches the critical sync-failure
 * threshold. The threshold transition makes this one notification per
 * incident; a successful sync resets the child-side counter to zero.
 */
export const onCriticalSyncFailure = functions.firestore
    .document('children/{childId}/status/current')
    .onWrite(async (change, context) => {
        const after = change.after.data();
        if (!after) return;

        const before = change.before.exists ? change.before.data() : undefined;
        const { childId } = context.params;
        const failureCount = Number(after.syncFailureCount || 0);
        const previousFailureCount = Number(before?.syncFailureCount || 0);
        const isCritical = after.syncHealthy === false && failureCount >= 3;
        const wasCritical = before?.syncHealthy === false && previousFailureCount >= 3;

        if (!isCritical || wasCritical) return;

        const childName = String(after.childName || 'Child');
        const rawSource = String(after.syncFailureSource || 'DATA');
        const sourceNames: Record<string, string> = {
            APP_USAGE: 'app usage',
            YOUTUBE: 'YouTube history',
            BROWSER: 'browser history'
        };
        const sourceName = sourceNames[rawSource] || 'data';
        const failureAt = Number(after.lastSyncFailureAt || Date.now());

        await broadcastToParents(childId, {
            title: `Sync problem on ${childName}'s device`,
            body: `${sourceName} failed to sync ${failureCount} times. Open Device Health for details.`,
            type: 'SYNC_ERROR',
            childId,
            eventId: `sync-error-${childId}-${failureAt}`,
            clickAction: `/dashboard/${childId}?tab=overview#device-health`
        });
    });

/**
 * Notifies every parent when a newer release becomes the active published
 * configuration. Draft/testing releases never update this document, and the
 * version transition prevents duplicate alerts when metadata is edited.
 */
export const onAppUpdatePublished = functions.firestore
    .document('appConfig/update')
    .onWrite(async (change) => {
        const after = change.after.data();
        if (!after) return;

        const before = change.before.exists ? change.before.data() : undefined;
        const versionCode = Number(after.latestVersionCode || 0);
        const previousVersionCode = Number(before?.latestVersionCode || 0);

        if (!Number.isFinite(versionCode) || versionCode <= previousVersionCode) {
            return;
        }

        const versionName = String(after.latestVersionName || versionCode);
        const mandatory = after.mandatoryUpdate === true || after.forceUpdate === true;
        const parentsSnapshot = await db.collection('parents').get();

        await Promise.all(parentsSnapshot.docs.map(parentDocument =>
            notifyParent(parentDocument.id, {
                title: mandatory
                    ? `KidsGuard v${versionName} update required`
                    : `KidsGuard v${versionName} is available`,
                body: mandatory
                    ? 'A mandatory child-app update has been published. Open Downloads to install it.'
                    : 'A new child-app version is ready. Open Downloads to view the release notes.',
                type: 'APP_UPDATE',
                childId: '',
                eventId: `app-update-${versionCode}`,
                clickAction: '/download'
            })
        ));
    });

const RELEASE_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com'
]);

/**
 * Downloads an APK from an approved release host and independently verifies
 * its SHA-256 before an administrator publishes it to child devices.
 */
export const verifyReleaseArtifact = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Verified administrator sign-in required.'
      );
    }

    const adminSnapshot = await db
      .collection('platformAdmins')
      .doc(context.auth.uid)
      .get();
    const adminData = adminSnapshot.data();
    const allowedRoles = new Set([
      'SUPER_ADMIN',
      'PLATFORM_ADMIN',
      'DEV_ADMIN'
    ]);
    if (
      !adminSnapshot.exists ||
      adminData?.active !== true ||
      !allowedRoles.has(String(adminData?.role || ''))
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Active platform administrator access required.'
      );
    }

    const downloadUrl = String(data?.apkDownloadUrl || '').trim();
    const expectedSha256 = String(data?.apkSha256 || '')
      .trim()
      .toLowerCase();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(downloadUrl);
    } catch {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid APK download URL is required.'
      );
    }
    if (
      parsedUrl.protocol !== 'https:' ||
      !RELEASE_DOWNLOAD_HOSTS.has(parsedUrl.hostname)
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'APK must be hosted on an approved HTTPS release host.'
      );
    }
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid APK SHA-256 is required.'
      );
    }

    const response = await fetch(downloadUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `APK download failed with HTTP ${response.status}.`
      );
    }
    const finalUrl = new URL(response.url);
    if (
      finalUrl.protocol !== 'https:' ||
      !RELEASE_DOWNLOAD_HOSTS.has(finalUrl.hostname)
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'APK download redirected to an unapproved host.'
      );
    }

    const maximumBytes = 250 * 1024 * 1024;
    const declaredBytes = Number(response.headers.get('content-length') || 0);
    if (declaredBytes > maximumBytes) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'APK is larger than the 250 MB verification limit.'
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maximumBytes) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Downloaded APK is empty or exceeds the verification limit.'
      );
    }
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Downloaded file is not a valid APK/ZIP artifact.'
      );
    }

    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    return {
      verified: actualSha256 === expectedSha256,
      expectedSha256,
      actualSha256,
      fileSizeBytes: bytes.length,
      finalUrl: response.url
    };
  });

/**
 * Triggered when a new family invitation is created.
 */
export const onInviteCreated = functions.firestore
    .document('familyInvitations/{inviteId}')
    .onCreate(async (snapshot, context) => {
        const invite = snapshot.data();
        const { inviteId } = context.params;

        const inviteLink = `https://kidsguard-screen.vercel.app/invite/${inviteId}?token=${invite.tokenHash}`;

        console.log(`Sending invite email to ${invite.invitedEmail}`);

        await EmailService.sendInviteEmail({
            to: invite.invitedEmail,
            familyName: invite.familyName,
            invitedByName: invite.invitedByName || "A member",
            role: invite.invitedRole,
            link: inviteLink,
            expiresAt: invite.expiresAt.toDate().toLocaleDateString()
        });
    });

/**
 * Triggered when an invitation is accepted.
 */
export const onInviteAccepted = functions.firestore
    .document('familyInvitations/{inviteId}')
    .onUpdate(async (change, context) => {
        const after = change.after.data();
        const before = change.before.data();

        if (after.status === 'ACCEPTED' && before.status === 'PENDING') {
            // Notify owner
            await notifyParent(after.invitedByUid, {
                title: '🤝 Invitation Accepted',
                body: `${after.invitedEmail} has joined the family vault as a ${after.invitedRole}.`,
                type: 'PAIRING',
                childId: '',
                clickAction: '/settings/family'
            });
        }
    });


/**
 * Triggered when a new child is paired to a family.
 */
export const onFamilyUpdated = functions.firestore
    .document('families/{familyId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        if (!before || !after) return;

        // 1. Detect new children
        const newChildren = after.childDeviceIds.filter((id: string) => !before.childDeviceIds.includes(id));
        for (const childId of newChildren) {
            const childSnap = await db.collection('children').doc(childId).get();
            const childName = childSnap.data()?.name || 'New Device';

            const memberUids = (after.members as any[]).map(m => m.uid);
            for (const uid of memberUids) {
                await notifyParent(uid, {
                    title: '📱 New Child Paired',
                    body: `${childName} has been successfully linked to your family vault.`,
                    type: 'PAIRING',
                    childId: childId,
                    clickAction: '/'
                });
            }
        }
    });

/**
 * Triggered when a protection mode is created or updated.
 */
export const onProtectionModeChanged = functions.firestore
    .document('children/{childId}/protectionModes/{modeId}')
    .onWrite(async (change, context) => {
        const { childId } = context.params;
        const after = change.after.data();
        const before = change.before.data();

        if (!after) return; // Deleted

        if (after.enabled && (!before || !before.enabled)) {
            await broadcastToParents(childId, {
                title: `🛡️ Mode Activated: ${after.name}`,
                body: `Protection rules for ${after.type} are now active.`,
                type: 'SAFE_ZONE', // Reusing type or add new
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

// --- Helper Functions ---

class EmailService {
    static async sendInviteEmail(params: { to: string, familyName: string, invitedByName: string, role: string, link: string, expiresAt: string }) {
        // In production, integrate with SendGrid, Resend, etc.
        console.log(`
            --- MOCK EMAIL ---
            To: ${params.to}
            Subject: Invitation to join the ${params.familyName} Family on KidsGuard
            Body:
            Hello,
            ${params.invitedByName} has invited you to join their family vault as a ${params.role}.
            Click here to accept: ${params.link}
            This invitation expires on ${params.expiresAt}.
            ------------------
        `);
        return Promise.resolve();
    }
}

interface NotificationPayload {
    title: string;
    body: string;
    //type: 'SAFE_ZONE' | 'SOS' | 'SOS_RESOLVED' | 'BATTERY' | 'DEVICE' | 'DEVICE_BACK_ONLINE' | 'PAIRING' | 'APP_INSTALLED' | 'TAMPER_ALERT';
    type: 'SAFE_ZONE' | 'SOS' | 'SOS_RESOLVED' | 'BATTERY' | 'DEVICE' | 'DEVICE_OFFLINE' | 'DEVICE_BACK_ONLINE' | 'PAIRING' | 'APP_INSTALLED' | 'APP_ACCESS_REQUEST' | 'WEB_ACCESS_REQUEST' | 'APP_LIMIT_REACHED' | 'BLOCKED_APP_ATTEMPT' | 'TAMPER_ALERT' | 'PERMISSION_CHANGE_REQUEST' | 'REMOTE_CONTROL_OVERRIDE' | 'SYNC_ERROR' | 'APP_UPDATE' | 'SUPPORT_REPLY' | 'WEEKLY_REPORT';
    childId: string;
    clickAction: string;
    packageName?: string;
    eventId?: string;
    familyId?: string;
    message?: string; // For explicit required field mapping
    route?: string;   // For explicit required field mapping
    skipHistory?: boolean;
}


function formatOfflineDuration(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${hours}h ${minutes}m`;
}

function formatBerlinTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString("en-GB", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Checks every child device every 5 minutes.
 *
 * Offline alerts follow each child's custom setting:
 * children/{childId}/settings/offlineAlert
 *
 * Runtime state is stored separately:
 * children/{childId}/system/offlineState
 */
export const checkOfflineChildren = functions.pubsub
  .schedule("every 5 minutes")
  .timeZone("Europe/Berlin")
  .onRun(async () => {
    const now = Date.now();
    const childrenSnapshot = await db.collection("children").get();

    for (const childDocument of childrenSnapshot.docs) {
      const childId = childDocument.id;

      try {
        const statusRef = db
          .collection("children")
          .doc(childId)
          .collection("status")
          .doc("current");

        const settingsRef = db
          .collection("children")
          .doc(childId)
          .collection("settings")
          .doc("offlineAlert");

        const offlineStateRef = db
          .collection("children")
          .doc(childId)
          .collection("system")
          .doc("offlineState");

        const [statusSnapshot, settingsSnapshot, stateSnapshot] =
          await Promise.all([
            statusRef.get(),
            settingsRef.get(),
            offlineStateRef.get(),
          ]);

        if (!statusSnapshot.exists) {
          console.warn(
            `Offline check skipped: no status found for child ${childId}`
          );
          continue;
        }

        const status = statusSnapshot.data() || {};
        const settings = settingsSnapshot.data() || {};
        const state = stateSnapshot.data() || {};

        // Missing settings default to Never. Parents must explicitly enable
        // offline alerts and choose a delay from the child overview.
        const enabled =
          settings.configuredByParent === true &&
          settings.enabled === true;

        const requestedThreshold = Number(
          settings.thresholdMinutes
        );

        const thresholdMinutes =
          Number.isFinite(requestedThreshold) &&
          requestedThreshold >= 5
            ? requestedThreshold
            : 30;

        const lastSeen = Number(status.lastSeen || 0);
        const childName =
          status.childName ||
          childDocument.data().name ||
          "Child";

        if (!enabled || lastSeen <= 0) {
          continue;
        }

        const elapsedMs = now - lastSeen;
        const elapsedMinutes = Math.floor(
          elapsedMs / (60 * 1000)
        );

        const isPastOfflineThreshold =
          elapsedMinutes >= thresholdMinutes;

        const offlineAlertSent =
          state.offlineAlertSent === true;

        /*
         * Device has been offline longer than the configured threshold.
         * Send only one alert for this offline period.
         */
        if (
          isPastOfflineThreshold &&
          !offlineAlertSent
        ) {
          await offlineStateRef.set(
            {
              offlineAlertSent: true,
              offlineSince: lastSeen,
              offlineAlertSentAt:
                admin.firestore.FieldValue.serverTimestamp(),
              lastCheckedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          try {
            await broadcastToParents(childId, {
              title: `${childName} is offline`,
              body:
                `${childName}'s device has been offline since ` +
                `${formatBerlinTime(lastSeen)} ` +
                `(${formatOfflineDuration(elapsedMinutes)}).`,
              type: "DEVICE_OFFLINE",
              childId,
              eventId: `offline-${childId}-${lastSeen}`,
              clickAction: `/dashboard/${childId}`,
            });

            console.log(
              `Offline alert sent for ${childName} (${childId})`
            );
          } catch (error) {
            await offlineStateRef.set(
              {
                offlineAlertSent: false,
                offlineAlertErrorAt:
                  admin.firestore.FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            throw error;
          }

          continue;
        }

        /*
         * Send Back Online only when a real offline alert
         * had previously been sent.
         */
        if (
          !isPastOfflineThreshold &&
          offlineAlertSent
        ) {
          const offlineSince = Number(
            state.offlineSince || lastSeen
          );

          const offlineDurationMinutes = Math.max(
            1,
            Math.floor(
              (lastSeen - offlineSince) / (60 * 1000)
            )
          );

          await offlineStateRef.set(
            {
              offlineAlertSent: false,
              offlineSince:
                admin.firestore.FieldValue.delete(),
              backOnlineAt:
                admin.firestore.FieldValue.serverTimestamp(),
              lastCheckedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          try {
            await broadcastToParents(childId, {
              title: `${childName} is back online`,
              body:
                `${childName}'s device reconnected at ` +
                `${formatBerlinTime(lastSeen)} after being offline for ` +
                `${formatOfflineDuration(offlineDurationMinutes)}.`,
              type: "DEVICE_BACK_ONLINE",
              childId,
              eventId: `online-${childId}-${lastSeen}`,
              clickAction: `/dashboard/${childId}`,
            });

            console.log(
              `Back-online alert sent for ${childName} (${childId})`
            );
          } catch (error) {
            await offlineStateRef.set(
              {
                offlineAlertSent: true,
                offlineSince,
                backOnlineErrorAt:
                  admin.firestore.FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            throw error;
          }

          continue;
        }

        await offlineStateRef.set(
          {
            lastCheckedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      } catch (error) {
        console.error(
          `Offline check failed for child ${childId}:`,
          error
        );
      }
    }

    return null;
  });

/**
 * Sends a notification to all parents linked to a child.
 */
async function broadcastToParents(childId: string, payload: NotificationPayload) {
    // Resolve the canonical family from the child document first. This avoids
    // dropping alerts when an older family document has a stale childDeviceIds
    // array. Keep the indexed query as a compatibility fallback.
    const childSnapshot = await db.collection('children').doc(childId).get();
    const childFamilyId = String(
      payload.familyId || childSnapshot.data()?.familyId || ""
    ).trim();

    let familyDoc: admin.firestore.DocumentSnapshot | null = null;
    if (childFamilyId) {
      const directFamily = await db.collection('families').doc(childFamilyId).get();
      if (directFamily.exists) familyDoc = directFamily;
    }

    if (!familyDoc) {
      const familyQuery = await db.collection('families')
          .where('childDeviceIds', 'array-contains', childId)
          .limit(1)
          .get();
      familyDoc = familyQuery.empty ? null : familyQuery.docs[0];
    }

    if (!familyDoc) {
      console.warn(`No family found for child ${childId}`);
      return;
    }

    const familyId = familyDoc.id;
    const family = familyDoc.data();
    const members = (family?.members as any[] | undefined) || [];
    const parentUids = Array.from(new Set(members
        .filter(m => normalizeFamilyRole(m.role) !== null)
        .map(m => String(m.uid || "").trim())
        .filter(Boolean)));

    // 2. Notify each parent
    const promises = parentUids.map(uid => notifyParent(uid, { ...payload, familyId }));
    await Promise.all(promises);
}

export const onTamperAlertCreated = functions.firestore
  .document("children/{childId}/tamperEvents/{eventId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();

    if (data.type !== "TAMPER_ALERT") {
      return null;
    }

    const childId = String(context.params.childId || data.childId || "");
    const eventId = String(context.params.eventId || "");

    if (!childId) {
      console.warn("Tamper alert missing childId", {
        eventId,
        childId,
      });
      return null;
    }

    const payload: NotificationPayload = {
      type: "TAMPER_ALERT",
      title: data.title || "Security Alert",
      body:
        data.body ||
        "Someone tried to disable or remove KidsGuard protection.",
      childId,
      eventId,
      clickAction: data.clickAction || `/dashboard/${childId}`,
      familyId: data.familyId || "",
    };

    const parentUid = data.userId;
    if (parentUid) {
      await notifyParent(parentUid, payload);
    } else {
      console.warn("Tamper alert missing parentUid; using family fallback", {
        eventId,
        childId,
      });
      await broadcastToParents(childId, payload);
    }

    return null;
  });

/**
 * Sends a notification to a specific parent if child changes checklisfrom child phone app home or phone settings.
 */
 export const onPermissionAlertCreated = functions.firestore
   .document("notifications/{notificationId}")
   .onCreate(async (snapshot, context) => {
     const data = snapshot.data();

     if(data.generatedBy === "cloud_function"){
         return null;
         }

     const allowedTypes = [
       "LOCATION_PERMISSION_DISABLED",
       "BACKGROUND_LOCATION_DISABLED",
     ];

     if (!allowedTypes.includes(String(data.type || ""))) {
       return null;
     }

     const parentUid = String(data.userId || "");
     const childId = String(data.childId || "");

     if (!parentUid || !childId) {
       console.warn("Permission alert missing userId or childId", {
         notificationId: context.params.notificationId,
       });
       return null;
     }

     await notifyParent(parentUid, {
       type: String(data.type) as any,
       title: String(data.title || "Permission Alert"),
       body: String(data.body || "A required permission was disabled."),
       childId,
       eventId: context.params.notificationId,
       clickAction: String(
         data.clickAction || `/dashboard/${childId}`
       ),
       familyId: String(data.familyId || ""),
       skipHistory: true,
     });

     return null;
   });


/**
 * Sends a notification to a specific parent if their settings allow it.
 */
async function notifyParent(uid: string, payload: NotificationPayload) {
    // 1. Check settings
    const settingsSnap = await db.collection('parents').doc(uid).collection('notificationSettings').doc('current').get();
    const settings = settingsSnap.data();

    const requestTypes = new Set([
      'APP_ACCESS_REQUEST',
      'WEB_ACCESS_REQUEST',
      'PERMISSION_CHANGE_REQUEST'
    ]);
    if (settings?.requestAlerts === false && requestTypes.has(payload.type)) {
      console.log(`Parent ${uid} has disabled child request notifications.`);
      return;
    }

    const typeMap: Record<string, string> = {

        'SAFE_ZONE': 'safeZone',
        'SOS': 'sos',
        'SOS_RESOLVED': 'sos',
        'BATTERY': 'battery',
        'DEVICE': 'deviceStatus',
        'DEVICE_OFFLINE': 'deviceStatus',
        'DEVICE_BACK_ONLINE': 'deviceStatus',
        'SYNC_ERROR': 'syncErrors',
        'APP_UPDATE': 'appUpdates',
        'PERMISSION_CHANGE_REQUEST': 'permissionChanges',
        'TAMPER_ALERT': 'securityAlerts',
        'PAIRING': 'pairing',
        'APP_INSTALLED': 'appUsage',
        // Access requests have their own opt-out. Missing settings remain
        // enabled, so existing parents receive request alerts by default.
        'APP_ACCESS_REQUEST': 'requestAlerts',
        'WEB_ACCESS_REQUEST': 'requestAlerts',
        'APP_LIMIT_REACHED': 'appUsage',
        'BLOCKED_APP_ATTEMPT': 'appUsage',
        'REMOTE_CONTROL_OVERRIDE': 'deviceStatus',
        'WEEKLY_REPORT': 'appUsage'
    };

    const settingKey = typeMap[payload.type];
    if (settings && settings[settingKey] === false) {
        console.log(`Parent ${uid} has disabled ${payload.type} notifications.`);
        return;
    }

    // 2. Record notification in history
    // Use a deterministic notification ID based on eventId and parent user ID to prevent duplicates.
    // New Path: notifications/{deterministicId}
    const notificationId = payload.eventId ? `${payload.eventId}_${uid}` : db.collection('notifications').doc().id;

    const notificationDoc = {
        id: notificationId,
        generatedBy: "cloud_function",
        userId: uid,
        familyId: payload.familyId || '',
        childId: payload.childId,
        eventId: payload.eventId || '',
        type: payload.type,
        title: payload.title,
        body: payload.body,
        message: payload.body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        clickAction: payload.clickAction,
        route: payload.clickAction
    };

    if (!payload.skipHistory) {
      await db
        .collection("notifications")
        .doc(notificationId)
        .set(notificationDoc, { merge: true });
    }

    // 3. Send FCM to all registered devices
    // New Path: users/{uid}/notificationTokens
    const devicesSnap = await db.collection('users').doc(uid).collection('notificationTokens').get();
    if (devicesSnap.empty) return;

    // Filter for enabled tokens
    // Filter enabled token documents
    const enabledDevices = devicesSnap.docs.filter(
      doc => doc.data().enabled !== false && !!doc.data().token
    );

    // iPhone / Web PWA tokens
    const webTokens = enabledDevices
      .filter(doc => {
        const platform = String(doc.data().platform || "").toLowerCase();
        return platform === "ios-pwa" || platform === "web";
      })
      .map(doc => String(doc.data().token));

    // Native Android/other tokens
    const nativeTokens = enabledDevices
      .filter(doc => {
        const platform = String(doc.data().platform || "").toLowerCase();
        return platform !== "ios-pwa" && platform !== "web";
      })
      .map(doc => String(doc.data().token));

    if (webTokens.length === 0 && nativeTokens.length === 0) return;

    console.log("Notification token groups", {
      webCount: webTokens.length,
      nativeCount: nativeTokens.length
    });


    console.log("sending FCM");
    console.log("webTokens:", webTokens.length);
    console.log("nativeTokens:", nativeTokens.length);

    const allTokens = [...webTokens, ...nativeTokens];

    const webPayload: admin.messaging.MulticastMessage = {
      tokens: webTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        childId: payload.childId,
        eventId: payload.eventId || "",
        clickAction: payload.clickAction,
        packageName: payload.packageName || "",
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: payload.clickAction,
        },
      },
    };

    const messagingPayload: admin.messaging.MulticastMessage = {
      tokens: nativeTokens,
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: {
        type: payload.type,
        childId: payload.childId,
        eventId: payload.eventId || "",
        clickAction: payload.clickAction,
        packageName: payload.packageName || "",
        title: payload.title,
        body: payload.body,
        },
        webpush: {
            fcmOptions: {
                link: payload.clickAction
            }
        },
        android: {
            priority: (
              payload.type === 'SOS' ||
              payload.type === 'APP_ACCESS_REQUEST' ||
              payload.type === 'WEB_ACCESS_REQUEST' ||
              payload.type === 'PERMISSION_CHANGE_REQUEST'
            ) ? 'high' : 'normal',
            notification: {
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }

        }
    };

    try {
        let webResponse: admin.messaging.BatchResponse | null = null;
        let nativeResponse: admin.messaging.BatchResponse | null = null;

        if (webTokens.length > 0) {
          webResponse = await admin.messaging().sendEachForMulticast(webPayload);
        }

        if (nativeTokens.length > 0) {
          nativeResponse = await admin.messaging().sendEachForMulticast(messagingPayload);
        }
        const successCount =
          (webResponse?.successCount || 0) +
          (nativeResponse?.successCount || 0);

        console.log(
          `Successfully sent ${successCount} notifications for parent ${uid}`
        );
        console.log("FCM sent once")

        // Clean up invalid tokens if any
        // Clean up invalid tokens if any
        const tokensToRemove: Promise<any>[] = [];

        const removeInvalidTokens = (
          response: admin.messaging.BatchResponse | null,
          tokenList: string[]
        ) => {
          if (!response || response.failureCount === 0) return;

          response.responses.forEach((resp, idx) => {
            if (resp.success) return;

            const error = resp.error;

            if (
              error?.code === "messaging/invalid-registration-token" ||
              error?.code === "messaging/registration-token-not-registered"
            ) {
              const invalidToken = tokenList[idx];

              const matchingDoc = devicesSnap.docs.find(
                doc => String(doc.data().token) === invalidToken
              );

              if (matchingDoc) {
                tokensToRemove.push(matchingDoc.ref.delete());
              }
            }
          });
        };

        removeInvalidTokens(webResponse, webTokens);
        removeInvalidTokens(nativeResponse, nativeTokens);

        await Promise.all(tokensToRemove);
    } catch (error) {
        console.error(`Error sending FCM to parent ${uid}:`, error);
    }
}

function getAllowedChildSlots(
  familyData: any
): number {
  const subscription =
    familyData?.subscription;

  const baseChildSlots =
    Number.isInteger(
      subscription?.baseChildSlots
    ) &&
    subscription.baseChildSlots >= 2
      ? subscription.baseChildSlots
      : 2;

  const extraChildSlots =
    Number.isInteger(
      subscription?.extraChildSlots
    ) &&
    subscription.extraChildSlots >= 0
      ? subscription.extraChildSlots
      : 0;

  const maxChildSlots =
    Number.isInteger(
      subscription?.maxChildSlots
    ) &&
    subscription.maxChildSlots >= 2
      ? subscription.maxChildSlots
      : 10;

  const totalAllowedSlots =
    baseChildSlots + extraChildSlots;

  return Math.min(
    maxChildSlots,
    Math.max(2, totalAllowedSlots)
  );
}
export const acceptPairingCode = functions.https.onCall(
  async (data, context) => {
    const parentalConsentVersion = '2026-09-27';
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to pair a child.'
      );
    }
    if (context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Your email must be verified before pairing a child device.'
      );
    }
    const pairingCode =
      typeof data?.pairingCode === 'string'
        ? data.pairingCode.trim()
        : '';

    const familyId =
      typeof data?.familyId === 'string'
        ? data.familyId.trim()
        : '';

    const parentalConsentAccepted =
      data?.parentalConsentAccepted === true;
    const submittedConsentVersion =
      typeof data?.parentalConsentVersion === 'string'
        ? data.parentalConsentVersion.trim()
        : '';

    if (
      !parentalConsentAccepted ||
      submittedConsentVersion !== parentalConsentVersion
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Current parental consent is required before pairing a child device.'
      );
    }

    if (!/^\d{6}$/.test(pairingCode) || !familyId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid 6-digit pairing code and familyId are required.'
      );
    }

// authenticated user ওই family-এর Parent/Owner কি না, সেটা backend-এ যাচাই করব।
    const uid = context.auth.uid;
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();

    if (!familySnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Family not found.'
      );
    }

    const familyData = familySnapshot.data() || {};
    const members = Array.isArray(familyData.members)
      ? familyData.members
      : [];

    const canPairChild =
      familyData.ownerId === uid ||
      members.some(
        (member: any) =>
          member?.uid === uid &&
          isManagerRole(member?.role)
      );

    if (!canPairChild) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to add a child to this family.'
      );
    }

// pairing code Firestore-এ আছে, ব্যবহৃত হয়নি এবং expire করেনি—এগুলো যাচাই করব।

    const pairingRef = db.collection('pairingCodes').doc(pairingCode);
    const pairingSnapshot = await pairingRef.get();

    if (!pairingSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Pairing code not found.'
      );
    }

    const pairingData = pairingSnapshot.data() || {};

    if (pairingData.used === true) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This pairing code has already been used.'
      );
    }

    const expiresAtMillis =
      typeof pairingData.expiresAt?.toMillis === 'function'
        ? pairingData.expiresAt.toMillis()
        : 0;

    if (expiresAtMillis <= Date.now()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'This pairing code has expired.'
      );
    }

    if (
      typeof pairingData.childId !== 'string' ||
      !pairingData.childId ||
      typeof pairingData.firebaseUid !== 'string' ||
      !pairingData.firebaseUid
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Pairing code data is incomplete.'
      );
    }


//subscription slot check
    const childId = pairingData.childId;
        const deviceId =
          typeof pairingData.deviceId === 'string' &&
          pairingData.deviceId
            ? pairingData.deviceId
            : pairingData.childDeviceId;

        if (typeof deviceId !== 'string' || !deviceId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Pairing code does not contain a valid deviceId.'
          );
        }

        const parentName =
          typeof data?.parentName === 'string' &&
          data.parentName.trim()
            ? data.parentName.trim()
            : 'Parent';

    const currentChildIds = Array.isArray(familyData.childDeviceIds)
      ? familyData.childDeviceIds.filter(
          (id: unknown): id is string => typeof id === 'string'
        )
      : [];

    const childAlreadyPaired = currentChildIds.includes(childId);
    const allowedChildSlots = getAllowedChildSlots(familyData);

    if (
      !childAlreadyPaired &&
      currentChildIds.length >= allowedChildSlots
    ) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Your current plan allows up to ${allowedChildSlots} child devices. Remove an existing child or add an extra child slot to continue.`
      );
    }
    const pairingResult = await db.runTransaction(async (transaction) => {
      const latestFamilySnapshot = await transaction.get(familyRef);
      const latestPairingSnapshot = await transaction.get(pairingRef);

      if (!latestFamilySnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Family not found during pairing.'
        );
      }

      if (!latestPairingSnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Pairing code not found during pairing.'
        );
      }
          const latestFamilyData = latestFamilySnapshot.data() || {};
          const latestPairingData = latestPairingSnapshot.data() || {};

          const latestMembers = Array.isArray(latestFamilyData.members)
            ? latestFamilyData.members
            : [];

          const stillAllowedToPair =
            latestFamilyData.ownerId === uid ||
            latestMembers.some(
              (member: any) =>
                member?.uid === uid &&
                isManagerRole(member?.role)
            );

          if (!stillAllowedToPair) {
            throw new functions.https.HttpsError(
              'permission-denied',
              'You no longer have permission to add a child.'
            );
          }

          if (latestPairingData.used === true) {
            throw new functions.https.HttpsError(
              'already-exists',
              'This pairing code has already been used.'
            );
          }

          const latestExpiry =
            typeof latestPairingData.expiresAt?.toMillis === 'function'
              ? latestPairingData.expiresAt.toMillis()
              : 0;

          if (latestExpiry <= Date.now()) {
            throw new functions.https.HttpsError(
              'deadline-exceeded',
              'This pairing code has expired.'
            );
          }

          const latestChildId = latestPairingData.childId;
          const latestDeviceId =
            latestPairingData.deviceId ||
            latestPairingData.childDeviceId;

          if (
            typeof latestChildId !== 'string' ||
            !latestChildId ||
            typeof latestDeviceId !== 'string' ||
            !latestDeviceId ||
            latestPairingData.firebaseUid !== pairingData.firebaseUid
          ) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Pairing data changed or is incomplete.'
            );
          }

          const latestChildIds = Array.isArray(
            latestFamilyData.childDeviceIds
          )
            ? latestFamilyData.childDeviceIds.filter(
                (id: unknown): id is string => typeof id === 'string'
              )
            : [];

            const latestAllowedSlots =
              getAllowedChildSlots(latestFamilyData);

          if (
            !latestChildIds.includes(latestChildId) &&
            latestChildIds.length >= latestAllowedSlots
          ) {
            throw new functions.https.HttpsError(
              'resource-exhausted',
              `Your current plan allows up to ${latestAllowedSlots} child devices. Remove an existing child or add an extra child slot to continue.`
            );
          }
            const childRef = db
              .collection('children')
              .doc(latestChildId);
            const consentRef = db
              .collection('parentalConsents')
              .doc(`${familyId}_${uid}_${latestChildId}`);

                    const existingChildSnapshot =
                      await transaction.get(childRef);

                    if (existingChildSnapshot.exists) {
                      const existingChildData =
                        existingChildSnapshot.data() || {};

                      if (
                        typeof existingChildData.familyId === 'string' &&
                        existingChildData.familyId &&
                        existingChildData.familyId !== familyId
                      ) {
                        throw new functions.https.HttpsError(
                          'already-exists',
                          'This child is already paired with another family.'
                        );
                      }
                    }

            transaction.update(familyRef, {
              childDeviceIds:
                admin.firestore.FieldValue.arrayUnion(latestChildId)
            });

            transaction.set(
              childRef,
              {
                childId: latestChildId,
                deviceId: latestDeviceId,
                firebaseUid: latestPairingData.firebaseUid,
                name: latestPairingData.childName || 'Unnamed Child',
                avatarId: latestPairingData.avatarId || 'avatar_1',
                familyId,
                pairedAt:
                  admin.firestore.FieldValue.serverTimestamp(),
                lastSeen:
                  admin.firestore.FieldValue.serverTimestamp(),
                parentalConsentVersion,
                parentalConsentAt:
                  admin.firestore.FieldValue.serverTimestamp(),
                parentalConsentBy: uid
              },
              { merge: true }
            );

            transaction.set(consentRef, {
              consentVersion: parentalConsentVersion,
              accepted: true,
              consentedAt:
                admin.firestore.FieldValue.serverTimestamp(),
              parentUid: uid,
              parentEmail:
                typeof context.auth?.token.email === 'string'
                  ? context.auth.token.email
                  : '',
              parentName,
              familyId,
              childId: latestChildId,
              deviceId: latestDeviceId,
              source: 'web_pairing',
              scope: [
                'device_monitoring',
                'location',
                'app_usage',
                'web_and_youtube_activity',
                'safety_alerts',
                'parental_controls'
              ]
            });

            transaction.update(pairingRef, {
              used: true,
              familyId,
              parentUid: uid,
              parentName,
              parentalConsentAccepted: true,
              parentalConsentVersion,
              pairedAt:
                admin.firestore.FieldValue.serverTimestamp()
            });

            return {
              childId: latestChildId,
              deviceId: latestDeviceId,
              childName:
                latestPairingData.childName || 'Unnamed Child'
            };
    });

        return {
          success: true,
          ...pairingResult
        };
  }
);

//email দিয়ে Firebase Auth account আগে থেকেই থাকলেই invitation block হবে
export const checkInvitationEmail =
  functions.https.onCall(
    async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "You must be signed in."
        );
      }
      if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Your email must be verified."
        );
      }

      const email =
        typeof data?.email === "string"
          ? data.email.trim().toLowerCase()
          : "";

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Please enter a valid email address."
        );
      }

      try {
        await admin.auth().getUserByEmail(email);

        return {
          available: false,
          message:
            "This email is already linked to another family. Please use a different email address."
        };
      } catch (error: any) {
        if (error?.code === "auth/user-not-found") {
          return {
            available: true
          };
        }

        console.error(
          "Invitation email check failed:",
          error
        );

        throw new functions.https.HttpsError(
          "internal",
          "Could not verify this email address."
        );
      }
    }
  );

export const acceptFamilyInvitation =
  functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to accept an invitation.'
      );
    }
    if (context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Your email must be verified before accepting an invitation.'
      );
    }

    const inviteId =
      typeof data?.inviteId === 'string'
        ? data.inviteId.trim()
        : '';
    const token =
      typeof data?.token === 'string'
        ? data.token.trim()
        : '';

    const displayName =
      typeof data?.displayName === 'string'
        ? data.displayName.trim()
        : '';

    const dateOfBirth =
      typeof data?.dateOfBirth === 'string'
        ? data.dateOfBirth.trim()
        : '';

    const email =
      typeof context.auth?.token.email ===
        'string'
        ? context.auth.token.email
            .trim()
            .toLowerCase()
        : '';

    const parsedBirthDate =
      new Date(
        `${dateOfBirth}T00:00:00.000Z`
      );

    const isValidBirthDate =
      /^\d{4}-\d{2}-\d{2}$/.test(
        dateOfBirth
      ) &&
      !Number.isNaN(
        parsedBirthDate.getTime()
      ) &&
      parsedBirthDate
        .toISOString()
        .slice(0, 10) === dateOfBirth &&
      parsedBirthDate.getTime() <=
        Date.now();

    if (
      displayName.length < 2 ||
      displayName.length > 80 ||
      !isValidBirthDate
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid full name and date of birth are required.'
      );
    }

    const uid = context.auth.uid;
    const inviteRef = db
      .collection('familyInvitations')
      .doc(inviteId);

    const inviteSnapshot = await inviteRef.get();

    if (!inviteSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Invitation not found.'
      );
    }

    const inviteData = inviteSnapshot.data() || {};
    if (
      typeof inviteData.tokenHash !== 'string' ||
      inviteData.tokenHash !== token
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Invitation token is invalid.'
      );
    }

    if (inviteData.status !== 'PENDING') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Invitation is ${inviteData.status || 'invalid'}.`
      );
    }

    if (
      typeof inviteData.email !== 'string' ||
      inviteData.email.toLowerCase() !== email
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This invitation was sent to another email address.'
      );
    }

    const expiresAtMillis =
      typeof inviteData.expiresAt?.toMillis === 'function'
        ? inviteData.expiresAt.toMillis()
        : 0;

    if (expiresAtMillis <= Date.now()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'This invitation has expired.'
      );
    }

    const familyId = inviteData.familyId;
    const role = normalizeFamilyRole(inviteData.role);

    if (
      typeof familyId !== 'string' ||
      !familyId ||
      role === null ||
      role === 'OWNER'
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Invitation data is incomplete or invalid.'
      );
    }

        const acceptedFamilyId = await db.runTransaction(
          async (transaction) => {
            const latestInviteSnapshot =
              await transaction.get(inviteRef);

            const familyRef = db
              .collection('families')
              .doc(familyId);

            const parentRef = db
              .collection('parents')
              .doc(uid);

            const familySnapshot =
              await transaction.get(familyRef);

            const parentSnapshot =
              await transaction.get(parentRef);

            if (!latestInviteSnapshot.exists) {
              throw new functions.https.HttpsError(
                'not-found',
                'Invitation no longer exists.'
              );
            }

            if (!familySnapshot.exists) {
              throw new functions.https.HttpsError(
                'not-found',
                'Family not found.'
              );
            }
            const existingParentData =
              parentSnapshot.exists
                ? parentSnapshot.data() || {}
                : {};

            const existingFamilyId =
              existingParentData.familyId ||
            