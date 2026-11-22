const test = require('node:test');
const assert = require('node:assert/strict');
const {evaluateRateLimit} = require('../lib/callableRateLimit.js');

test('allows the configured number of requests then rejects', () => {
  const now = 1_000_000;
  assert.deepEqual(evaluateRateLimit({}, now, 2, 60_000), {
    allowed: true, count: 1, windowStartedAtMillis: now, retryAfterMs: 0
  });
  assert.equal(evaluateRateLimit({count: 1, windowStartedAtMillis: now}, now + 100, 2, 60_000).allowed, true);
  const blocked = evaluateRateLimit({count: 2, windowStartedAtMillis: now}, now + 500, 2, 60_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 59_500);
});

test('resets after window and on corrupt count', () => {
  assert.equal(evaluateRateLimit({count: 9, windowStartedAtMillis: 100}, 60_100, 2, 60_000).count, 1);
  assert.equal(evaluateRateLimit({count: 'oops', windowStartedAtMillis: 100}, 200, 2, 60_000).count, 1);
});
