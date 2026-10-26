import {createHash} from 'crypto';

export const INTERNAL_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type InternalSessionSnapshot = {
  state?: unknown;
  authTime?: unknown;
  expiresAtMillis?: unknown;
  ipHash?: unknown;
  userAgentHash?: unknown;
};

export type InternalSessionRequest = {
  authTime: number;
  nowMillis: number;
  ip: string;
  userAgent: string;
};

export type InternalSessionDecision =
  | 'VALID'
  | 'MISSING'
  | 'INACTIVE'
  | 'AUTH_TIME_MISMATCH'
  | 'EXPIRED'
  | 'IP_MISMATCH'
  | 'USER_AGENT_MISMATCH';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeInternalUserAgent(value: unknown): string {
  return String(value || 'Unknown browser')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) || 'Unknown browser';
}

export function internalSessionFingerprint(input: {
  ip: string;
  userAgent: unknown;
}): {
  ipHash: string;
  userAgent: string;
  userAgentHash: string;
} {
  const userAgent = normalizeInternalUserAgent(input.userAgent);
  return {
    ipHash: sha256(input.ip),
    userAgent,
    userAgentHash: sha256(userAgent),
  };
}

export function evaluateInternalSession(
  stored: InternalSessionSnapshot | null,
  request: InternalSessionRequest
): InternalSessionDecision {
  if (!stored) return 'MISSING';
  if (stored.state !== 'ACTIVE') return 'INACTIVE';
  if (stored.authTime !== request.authTime) return 'AUTH_TIME_MISMATCH';

  const expiresAtMillis = Number(stored.expiresAtMillis);
  if (!Number.isFinite(expiresAtMillis) || request.nowMillis >= expiresAtMillis) {
    return 'EXPIRED';
  }

  const fingerprint = internalSessionFingerprint(request);
  if (stored.ipHash !== fingerprint.ipHash) return 'IP_MISMATCH';
  if (stored.userAgentHash !== fingerprint.userAgentHash) {
    return 'USER_AGENT_MISMATCH';
  }
  return 'VALID';
}

export function isInternalSessionCompromise(
  decision: InternalSessionDecision
): boolean {
  return decision === 'IP_MISMATCH' || decision === 'USER_AGENT_MISMATCH';
}
