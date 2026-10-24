import {
  browserSessionPersistence,
  setPersistence,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";

import { auth } from "./firebase";

export const INTERNAL_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const INTERNAL_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export type InternalSessionEndReason = "idle" | "expired" | "blocked";

const ACTIVITY_KEY_PREFIX = "kidsguard:internal:v1:last-activity:";

export function internalActivityStorageKey(uid: string): string {
  return `${ACTIVITY_KEY_PREFIX}${uid}`;
}

export async function prepareInternalAuthSession(): Promise<void> {
  if (!auth) return;
  await setPersistence(auth, browserSessionPersistence);
}

export async function getInternalSessionStartedAt(user: User): Promise<number> {
  const token = await user.getIdTokenResult();
  const startedAt = Date.parse(token.authTime);
  if (!Number.isFinite(startedAt)) {
    throw new Error("The internal session start time is unavailable.");
  }
  return startedAt;
}

export function isInternalSessionExpired(
  startedAt: number,
  now = Date.now()
): boolean {
  return now - startedAt >= INTERNAL_ABSOLUTE_TIMEOUT_MS;
}

export function readInternalSessionActivity(uid: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = Number(window.localStorage.getItem(internalActivityStorageKey(uid)));
    if (!Number.isFinite(value) || value <= 0 || value > Date.now() + 60_000) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function writeInternalSessionActivity(uid: string, occurredAt: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      internalActivityStorageKey(uid),
      String(occurredAt)
    );
  } catch {
    // A hard session timeout still applies when browser storage is unavailable.
  }
}

export function clearInternalSessionActivity(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(internalActivityStorageKey(uid));
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export async function signOutInternalSession(
  reason?: InternalSessionEndReason
): Promise<void> {
  const uid = auth?.currentUser?.uid;
  if (uid) clearInternalSessionActivity(uid);

  try {
    if (auth) await firebaseSignOut(auth);
  } finally {
    if (typeof window !== "undefined") {
      const suffix = reason ? `?reason=${reason}` : "";
      window.location.replace(`/internal/login${suffix}`);
    }
  }
}
