import {readFileSync} from 'node:fs';

const files = new Map();

function read(path) {
  if (!files.has(path)) files.set(path, readFileSync(path, 'utf8'));
  return files.get(path);
}

function requireMatch(path, pattern, message) {
  if (!pattern.test(read(path))) {
    throw new Error(`${message} (${path})`);
  }
}

function requireText(path, expected, message) {
  if (!read(path).includes(expected)) {
    throw new Error(`${message} (${path})`);
  }
}

const gradlePath = 'app/build.gradle.kts';
const manifestPath = 'app/src/main/AndroidManifest.xml';
const releaseManifestPath = 'app/src/release/AndroidManifest.xml';
const billingPath =
  'app/src/main/java/com/example/kidsguard/billing/GooglePlayBillingRepository.kt';
const functionsPath = 'functions/src/index.ts';
const deployWorkflowPath =
  '.github/workflows/deploy-admin-login-defense.yml';
const releaseWorkflowPath = '.github/workflows/build-apk.yml';
const setupPath = 'GOOGLE_PLAY_BILLING_SETUP.md';

requireText(
  gradlePath,
  'applicationId = "secure.kidsguard.app"',
  'Google Play application ID changed'
);
requireMatch(
  gradlePath,
  /targetSdk\s*=\s*(?:release\()?\s*(3[5-9]|[4-9]\d)/,
  'Google Play release must target Android API 35 or newer'
);
requireMatch(
  gradlePath,
  /release\s*\{[\s\S]*?buildConfigField\("boolean",\s*"ALLOW_SIDELOAD_UPDATES",\s*"false"\)/,
  'Release builds must disable sideload updates'
);
requireMatch(
  manifestPath,
  /android:name="isMonitoringTool"[\s\S]*?android:value="child_monitoring"/,
  'Child-monitoring declaration is missing'
);
requireMatch(
  releaseManifestPath,
  /android:name="android\.permission\.REQUEST_INSTALL_PACKAGES"[\s\S]*?tools:node="remove"/,
  'Play release manifest must remove REQUEST_INSTALL_PACKAGES'
);

for (const expected of [
  'const val SUBSCRIPTION_PRODUCT_ID = "kidsguard_family"',
  'const val MONTHLY_BASE_PLAN_ID = "monthly"',
  'const val ANNUAL_BASE_PLAN_ID = "annual"'
]) {
  requireText(billingPath, expected, 'Android billing catalogue changed');
}

for (const expected of [
  "{default: 'secure.kidsguard.app'}",
  "{default: 'kidsguard_family'}",
  "{default: 'google-play-rtdn'}",
  'export const verifyGooglePlaySubscription =',
  'export const handleGooglePlaySubscriptionNotification =',
  'export const reconcileGooglePlaySubscriptions ='
]) {
  requireText(functionsPath, expected, 'Firebase Google Play contract changed');
}

for (const expected of [
  'GOOGLE_PLAY_PACKAGE_NAME=secure.kidsguard.app',
  'GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID=kidsguard_family',
  'GOOGLE_PLAY_RTDN_TOPIC=google-play-rtdn',
  'functions:verifyGooglePlaySubscription',
  'functions:handleGooglePlaySubscriptionNotification',
  'functions:reconcileGooglePlaySubscriptions'
]) {
  requireText(
    deployWorkflowPath,
    expected,
    'Production deploy workflow does not match the Google Play contract'
  );
}

for (const expected of [
  '`secure.kidsguard.app`',
  '`kidsguard_family`',
  '`monthly`',
  '`annual`',
  '`google-play-rtdn`'
]) {
  requireText(setupPath, expected, 'Google Play setup guide is out of sync');
}

for (const expected of [
  'bundleRelease',
  'app/build/outputs/bundle/release/app-release.aab',
  'KidsGuard-play-aab-v'
]) {
  requireText(
    releaseWorkflowPath,
    expected,
    'Release workflow is not producing the expected Play artifact'
  );
}

const versionName = read(gradlePath)
  .match(/versionName\s*=\s*"([^"]+)"/)?.[1];
const versionCode = read(gradlePath)
  .match(/versionCode\s*=\s*(\d+)/)?.[1];
if (!versionName || !versionCode) {
  throw new Error('Android release version metadata could not be read');
}

console.log(
  `Google Play release contract verified for v${versionName} (${versionCode}).`
);
