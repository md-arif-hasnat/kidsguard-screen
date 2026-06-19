# KidsGuard - Production Deployment Checklist

## 1. Firebase Backend
- [ ] Deploy `firestore.rules.draft` to production Firestore (remove `.draft`).
- [ ] Deploy composite indexes from `FIRESTORE_INDEXES.md`.
- [ ] Configure FCM HTTP v1 credentials.
- [ ] Set database location to nearest user cluster.

## 2. App Security
- [ ] Verify SHA-1 and SHA-256 for release keys are in Firebase Console.
- [ ] Configure Firebase App Check (Play Integrity).
- [ ] Disable "QA Mode" logic for Production builds.

## 3. Functional Verification (Internal Alpha)
- [ ] Test real device pairing (LTE to LTE).
- [ ] Verify SOS push delivery to parent.
- [ ] Verify Remote Lock execution speed.
- [ ] Test geofence entry/exit on actual safe zone boundaries.

## 4. Monitoring & Backup
- [ ] Enable Cloud Firestore backups (daily).
- [ ] Configure Crashlytics for error monitoring.
- [ ] Set up threshold alerts for Firebase usage quotas.

## 5. Store Readiness
- [ ] Update `VERSION.md`.
- [ ] Generate Signed Release APK/App Bundle.
- [ ] Prepare store screenshots and privacy policy.
