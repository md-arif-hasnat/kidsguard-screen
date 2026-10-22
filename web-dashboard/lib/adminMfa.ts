import QRCode from "qrcode";
import {
  AuthError,
  MultiFactorError,
  MultiFactorResolver,
  TotpMultiFactorGenerator,
  TotpSecret,
  User,
  getMultiFactorResolver,
  multiFactor,
} from "firebase/auth";

import { auth } from "./firebase";

const TOTP_FACTOR_ID = TotpMultiFactorGenerator.FACTOR_ID;

type FirebaseTokenClaims = {
  sign_in_second_factor?: unknown;
};

export type AdminTotpEnrollment = {
  secret: TotpSecret;
  secretKey: string;
  qrCodeDataUrl: string;
  expiresAt: string;
};

export function hasEnrolledAdminTotp(user: User): boolean {
  return multiFactor(user).enrolledFactors.some(
    factor => factor.factorId === TOTP_FACTOR_ID
  );
}

export async function hasCurrentAdminTotpSignIn(
  user: User,
  forceRefresh = false
): Promise<boolean> {
  const token = await user.getIdTokenResult(forceRefresh);
  const firebaseClaims = token.claims.firebase;

  if (!firebaseClaims || typeof firebaseClaims !== "object") {
    return false;
  }

  return (firebaseClaims as FirebaseTokenClaims).sign_in_second_factor ===
    TOTP_FACTOR_ID;
}

export function isAdminMfaChallenge(
  error: unknown
): error is MultiFactorError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as AuthError).code === "auth/multi-factor-auth-required"
  );
}

export function getAdminMfaResolver(
  error: MultiFactorError
): MultiFactorResolver {
  if (!auth) {
    throw new Error("Authentication is not configured.");
  }

  const resolver = getMultiFactorResolver(auth, error);
  const hasTotp = resolver.hints.some(hint => hint.factorId === TOTP_FACTOR_ID);
  if (!hasTotp) {
    throw new Error("This administrator has no supported authenticator factor.");
  }

  return resolver;
}

export async function resolveAdminTotpChallenge(
  resolver: MultiFactorResolver,
  code: string
): Promise<User> {
  const hint = resolver.hints.find(
    candidate => candidate.factorId === TOTP_FACTOR_ID
  );
  if (!hint) {
    throw new Error("Authenticator verification is unavailable.");
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    hint.uid,
    normalizeTotpCode(code)
  );
  const credential = await resolver.resolveSignIn(assertion);
  return credential.user;
}

export async function createAdminTotpEnrollment(
  user: User
): Promise<AdminTotpEnrollment> {
  if (!user.emailVerified) {
    throw new Error("Verify your work email before enabling 2FA.");
  }

  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrCodeUrl = secret.generateQrCodeUrl(
    user.email || user.uid,
    "KidsGuard Internal"
  );
  const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, {
    width: 224,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return {
    secret,
    secretKey: secret.secretKey,
    qrCodeDataUrl,
    expiresAt: secret.enrollmentCompletionDeadline,
  };
}

export async function completeAdminTotpEnrollment(
  user: User,
  enrollment: AdminTotpEnrollment,
  code: string
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    enrollment.secret,
    normalizeTotpCode(code)
  );
  await multiFactor(user).enroll(assertion, "KidsGuard Internal Authenticator");
}

function normalizeTotpCode(code: string): string {
  const normalized = code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error("Enter the current 6-digit authenticator code.");
  }
  return normalized;
}
