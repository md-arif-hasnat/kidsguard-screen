export type RateLimitState = { count?: unknown; windowStartedAtMillis?: unknown };
export type RateLimitDecision = { allowed: boolean; count: number; windowStartedAtMillis: number; retryAfterMs: number };

/** Fixed-window limiter. The Firestore transaction is responsible for atomic updates. */
export function evaluateRateLimit(
  state: RateLimitState,
  now: number,
  maxRequests: number,
  windowMs: number
): RateLimitDecision {
  if (!Number.isFinite(now) || maxRequests < 1 || windowMs < 1) {
    throw new Error('Invalid rate-limit configuration');
  }
  const start = Number(state.windowStartedAtMillis);
  const withinWindow = Number.isFinite(start) && start > 0 && now >= start && now - start < windowMs;
  const previous = Number(state.count);
  const count = withinWindow && Number.isFinite(previous)
    ? Math.max(0, Math.floor(previous)) : 0;
  if (withinWindow && count >= maxRequests) {
    return {allowed: false, count, windowStartedAtMillis: start, retryAfterMs: start + windowMs - now};
  }
  return {allowed: true, count: count + 1, windowStartedAtMillis: withinWindow ? start : now, retryAfterMs: 0};
}
