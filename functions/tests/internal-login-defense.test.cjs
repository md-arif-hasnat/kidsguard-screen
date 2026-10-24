const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INTERNAL_LOGIN_FAILURE_WINDOW_MS,
  evaluateInternalLoginFailure,
} = require('../lib/internalLoginDefense.js');

test('blocks exactly on the fifth failure inside the window', () => {
  const now = Date.now();
  const decision = evaluateInternalLoginFailure({
    status: 'TRACKING',
    failureCount: 4,
    windowStartedAtMillis: now - 60_000,
  }, now);

  assert.equal(decision.failureCount, 5);
  assert.equal(decision.blocked, true);
});

test('resets the count when the failure window expires', () => {
  const now = Date.now();
  const decision = evaluateInternalLoginFailure({
    status: 'TRACKING',
    failureCount: 4,
    windowStartedAtMillis: now - INTERNAL_LOGIN_FAILURE_WINDOW_MS,
  }, now);

  assert.equal(decision.failureCount, 1);
  assert.equal(decision.blocked, false);
  assert.equal(decision.windowStartedAtMillis, now);
});

test('starts a new count after owner approval', () => {
  const now = Date.now();
  const decision = evaluateInternalLoginFailure({
    status: 'APPROVED',
    failureCount: 5,
    windowStartedAtMillis: now - 1_000,
  }, now);

  assert.deepEqual(decision, {
    failureCount: 1,
    blocked: false,
    windowStartedAtMillis: now,
  });
});

