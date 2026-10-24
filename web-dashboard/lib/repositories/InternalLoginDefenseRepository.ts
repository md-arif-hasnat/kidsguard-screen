import { auth } from "@/lib/firebase";

const BLOCKED_MESSAGE = "Access blocked. Contact your God Father!";

export type InternalLoginGuardStatus = {
  blocked: boolean;
};

export type InternalLoginFailureResult = {
  blocked: boolean;
  remainingAttempts: number;
};

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

export class InternalLoginBlockedError extends Error {
  constructor() {
    super(BLOCKED_MESSAGE);
    this.name = "InternalLoginBlockedError";
  }
}

function callableErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error
  ) {
    return String(payload.error.message || fallback);
  }
  return fallback;
}

async function callInternalLoginFunction<T>(
  functionName: string,
  data: Record<string, unknown> = {},
  authenticated = false
): Promise<T> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Firebase security service is not configured.");

  const headers: Record<string, string> = {"Content-Type": "application/json"};
  if (authenticated) {
    const user = auth?.currentUser;
    if (!user) throw new Error("Authenticated internal account required.");
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch(
    `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({data}),
      cache: "no-store"
    }
  );
  const payload = await response.json().catch(() => null) as
    | {result?: T; data?: T; error?: {message?: string}}
    | null;
  const message = callableErrorMessage(
    payload,
    "The internal login security service is temporarily unavailable."
  );
  if (!response.ok || payload?.error || (!payload?.result && !payload?.data)) {
    if (message.includes("Contact your God Father")) {
      throw new InternalLoginBlockedError();
    }
    throw new Error(message);
  }
  return (payload.result || payload.data) as T;
}

export class InternalLoginDefenseRepository {
  static getStatus(): Promise<InternalLoginGuardStatus> {
    return callInternalLoginFunction("getInternalLoginGuardStatus");
  }

  static recordFailure(email: string): Promise<InternalLoginFailureResult> {
    return callInternalLoginFunction("recordInternalLoginFailure", {email});
  }

  static async finalizeLogin(): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "finalizeInternalLogin",
      {},
      true
    );
  }

  static async assertAccess(): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "assertInternalLoginAccess",
      {},
      true
    );
  }

  static async listBlocks(): Promise<InternalLoginBlock[]> {
    const result = await callInternalLoginFunction<{
      blocks: InternalLoginBlock[];
    }>("listInternalLoginBlocks", {}, true);
    return result.blocks;
  }

  static async approveBlock(requestId: string): Promise<void> {
    await callInternalLoginFunction<{ok: true}>(
      "approveInternalLoginBlock",
      {requestId},
      true
    );
  }
}

export function isInternalLoginBlockedError(error: unknown): boolean {
  return error instanceof InternalLoginBlockedError ||
    (error instanceof Error && error.message.includes("Contact your God Father"));
}

