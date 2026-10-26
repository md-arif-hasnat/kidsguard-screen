const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateInternalSession,
  internalSessionFingerprint,
  isInternalSessionCompromise,
} = require('../lib/internalSessionDefense.js');

const NOW = Date.UTC(2026, 9, 25, 9, 0, 0);
const AUTH_TIME = Math.floor(NOW / 1000) - 60;
const IP = '203.0.113.10';
const USER_AGENT = 'KidsGuard Admin Browser/1.0';

function activeSession(overrides = {}) {
  const fingerprint = internalSessionFingerprint({ip: IP, userAgent: USER_AGENT});
  return {
    state: 'ACTIVE',
    authTime: AUTH_TIME,
    expiresAtMillis: NOW + 60 * 60 * 1000,
    ipHash: fingerprint.ipHash,
    userAgentHash: fingerprint.userAgentHash,
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    authTime: AUTH_TIME,
    nowMillis: NOW,
    ip: IP,
    userAgent: USER_AGENT,
    ...overrides,
  };
}

test('accepts the active session only for its original login context', () => {
  assert.equal(evaluateInternalSession(activeSession(), request()), 'VALID');
});

test('rejects missing, ended, stale-auth, and expired sessions', () => {
  assert.equal(evaluateInternalSession(null, request()), 'MISSING');
  assert.equal(
    evaluateInternalSession(activeSession({state: 'ENDED'}), request()),
    'INACTIVE'
  );
  assert.equal(
    evaluateInternalSession(activeSession(), request({authTime: AUTH_TIME + 1})),
    'AUTH_TIME_MISMATCH'
  );
  assert.equal(
    evaluateInternalSession(activeSession({expiresAtMillis: NOW}), request()),
    'EXPIRED'
  );
});

test('detects network and browser changes as compromise signals', () => {
  const ipDecision = evaluateInternalSession(
    activeSession(),
    request({ip: '198.51.100.44'})
  );
  const browserDecision = evaluateInternalSession(
    activeSession(),
    request({userAgent: 'Different Browser/9.0'})
  );

  assert.equal(ipDecision, 'IP_MISMATCH');
  assert.equal(browserDecision, 'USER_AGENT_MISMATCH');
  assert.equal(isInternalSessionCompromise(ipDecision), true);
  assert.equal(isInternalSessionCompromise(browserDecision), true);
  assert.equal(isInternalSessionCompromise('EXPIRED'), false);
});
