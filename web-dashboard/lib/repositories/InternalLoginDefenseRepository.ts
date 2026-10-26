import { getFunctions, httpsCallable } from "firebase/functions";

import { app, auth } from "@/lib/firebase";

const BLOCKED_MESSAGE = "Access blocked. Contact your God Father!";

export type InternalLoginGuardStatus = {blocked: boolean};
export type InternalLoginFailureResult = {blocked: boolean; remainingAttempts: number};
export type InternalLoginBlock = {
  requestId: string;
  ip: string;
  attemptedEmail: string;
  userAgent: string;
  failureCount: number;
  blockedAt: string | null;
  lastFailedAt: string | null;
  emailAlertSent: boolean;
  pushAlertSent: boolean;
};
export type InternalAdminSession = {
  uid: string;
  sessionId: string;
  email: string;
  role: string;
  state: string;
  ip: string;
  userAgent: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  compromisedAt: string | null;
  compromiseReason: string | null;
};
export type InternalSessionSecurityEvent = {
  eventId: string;
  type: string;
  uid: string;
  email: string;
  sessionId: string;
  reason: string | null;
  originalIp: string | null;
  observedIp: string | null;
  createdAt: string | null;
};

export class InternalLoginBlockedError extends Error {
  constructor() {
    super(BLOCKED_MESSAGE);
    this.name = "InternalLoginBlockedError";
  }
}

export class InternalSessionSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InternalSessionSecurityError";
  }
}

async function callInternalLoginFunction<T>(
  functionName: string,
  data: Record<string, unknown> = {},
  authenticated = false,
  limitedUseAppCheckToken = false
): Promise<T> {
  if (!app) throw new Error("Firebase security service is not configured.");
  if (authenticated && !auth?.currentUser) {
    throw new Error("Authenticated internal account required.");
  }

  try {
    const callable = httpsCallable<Record<string, unknown>, T>(
      getFunctions(app, "us-central1"),
      functionName,
      limitedUseAppCheckToken ? {limitedUseAppCheckTokens: true} : undefined
    );
    const result = await callable(data);
    return result.data;
  } catch (caught) {
    const message = caught instanceof Error
      ? caught.message
      : "The internal login security service is temporarily unavailable.";
    if (message.includes("Contact your God Father")) {
      throw new InternalLoginBlockedError();
    }
    if (
      message.includes("Secure internal session") ||
      message.includes("newer internal session") ||
      message.includes("internal session has expired")
    ) {
      throw new InternalSessionSecurityError(message);
    }
    throw new Error(message);
  }
}

export class InternalLoginDefenseRepository {
  static getStatus(): Promise<InternalLoginGuardStatus> {
    return callInternalLoginFunction("getInternalLoginGuardStatus");
  }
  static recordFailure(email: string): Promise<InternalLoginFailureResult> {
    return callInternalLoginFunction("recordInternalLoginFailure", {email});
  }
  static async finalizeLogin(): Promise<void> {
    await callInternalLoginFunction<{
      ok: true;
      sessionId: string;
      expiresAt: string;
    }>("finalizeInternalLogin", {}, true, true);
  }
  static async assertAccess(): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "assertInternalLoginAccess", {}, true
    );
  }
  static async listBlocks(): Promise<InternalLoginBlock[]> {
    const result = await callInternalLoginFunction<{blocks: InternalLoginBlock[]}>(
      "listInternalLoginBlocks", {}, true
    );
    return result.blocks;
  }
  static async approveBlock(requestId: string): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "approveInternalLoginBlock", {requestId}, true, true
    );
  }
  static async endSession(reason: string): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "endInternalAdminSession", {reason}, true, true
    );
  }
  static listSessions(): Promise<{
    sessions: InternalAdminSession[];
    events: InternalSessionSecurityEvent[];
  }> {
    return callInternalLoginFunction(
      "listInternalAdminSessions", {}, true, true
    );
  }
  static async revokeSession(uid: string): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "revokeInternalAdminSession", {uid}, true, true
    );
  }
}

export function isInternalLoginBlockedError(error: unknown): boolean {
  return error instanceof InternalLoginBlockedError ||
    (error instanceof Error && error.message.includes("Contact your God Father"));
}

export function isInternalSessionSecurityError(error: unknown): boolean {
  return error instanceof InternalSessionSecurityError ||
    (error instanceof Error && (
      error.message.includes("Secure internal session") ||
      error.message.includes("newer internal session") ||
      error.message.includes("internal session has expired")
    ));
}
