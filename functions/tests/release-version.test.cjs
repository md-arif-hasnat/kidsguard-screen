const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidStableVersionName,
} = require("../scripts/release-version");

test("accepts KidsGuard stable release versions", () => {
  assert.equal(isValidStableVersionName("1.0.81"), true);
  assert.equal(isValidStableVersionName(" 1.0.81 "), true);
});

test("rejects malformed or unsupported release versions", () => {
  assert.equal(isValidStableVersionName("1\\.0\\.81"), false);
  assert.equal(isValidStableVersionName("1.1.0"), false);
  assert.equal(isValidStableVersionName("v1.0.81"), false);
  assert.equal(isValidStableVersionName(""), false);
});
