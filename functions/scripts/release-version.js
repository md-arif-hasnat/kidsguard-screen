const STABLE_VERSION_PATTERN = /^1\.0\.\d+$/;

function isValidStableVersionName(value) {
  return STABLE_VERSION_PATTERN.test(String(value || "").trim());
}

module.exports = { isValidStableVersionName };
