export const INTERNAL_LOGIN_FAILURE_LIMIT = 5;
export const INTERNAL_LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

export type InternalLoginFailureState = {
  status?: unknown;
  failureCount?: unknown;
  windowStartedAtMillis?: number | null;
};

export type InternalLoginFailureDecision = {
  failureCount: number;
  blocked: boolean;
  windowStartedAtMillis: number;
};

export function evaluateInternalLoginFailure(
  current: InternalLoginFailureState,
  now: number
): InternalLoginFailureDecision {
  const startedAt = Number(current.windowStartedAtMillis || 0);
  const withinWindow =
    current.status === 'TRACKING' &&
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    now >= startedAt &&
    now - startedAt < INTERNAL_LOGIN_FAILURE_WINDOW_MS;
  const parsedCount = Number(current.failureCount || 0);
  const previousCount = withinWindow && Number.isFinite(parsedCount)
    ? Math.max(0, Math.floor(parsedCount))
    : 0;
  const failureCount = previousCount + 1;
  return {
    failureCount,
    blocked: failureCount >= INTERNAL_LOGIN_FAILURE_LIMIT,
    windowStartedAtMillis: withinWindow ? startedAt : now
  };
}

