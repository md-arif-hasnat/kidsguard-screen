const admin = require("firebase-admin");

const versionCode = Number(process.env.VERSION_CODE);
const versionName = String(process.env.VERSION_NAME || "").trim();
const apkDownloadUrl = String(process.env.APK_DOWNLOAD_URL || "").trim();
const apkSize = String(process.env.APK_SIZE || "").trim();
const releaseNotes = String(process.env.RELEASE_NOTES || "")
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);

if (!Number.isInteger(versionCode) || versionCode <= 0) throw new Error("Invalid VERSION_CODE");
if (!/^1\\.0\\.\\d+$/.test(versionName)) throw new Error("Invalid VERSION_NAME; expected 1.0.x");
if (!apkDownloadUrl.startsWith("https://")) throw new Error("Invalid APK_DOWNLOAD_URL");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const releaseData = {
  latestVersionCode: versionCode,
  latestVersionName: versionName,
  apkDownloadUrl,
  mandatoryUpdate: false,
  releaseChannel: "stable",
  updateMessage: "A new KidsGuard version is available. Please update for the latest improvements.",
  releaseNotes,
  fileSize: apkSize,
  minimumAndroidVersion: "7.0",
  releasedAt: admin.firestore.FieldValue.serverTimestamp(),
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  createdByUid: "github-actions",
  createdByEmail: "github-actions@github.com",
};
const releaseId = "v" + versionName.replace(/[^a-zA-Z0-9._-]/g, "_");

(async () => {
  await db.collection("appReleases").doc(releaseId).set(releaseData, { merge: true });
  await db.collection("appConfig").doc("update").set(releaseData, { merge: true });
  console.log("Published Firestore update config for KidsGuard v" + versionName + " (code " + versionCode + ").");
})().catch((error) => { console.error(error); process.exit(1); });