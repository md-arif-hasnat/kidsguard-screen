# KidsGuard Beta Launch Checklist

## 1. Distribution
- [ ] Build signed Release APK for Android Child/Parent app.
- [ ] Upload APK to official Download point (Vercel/S3).
- [ ] Update `appConfig/update` doc in Firestore with latest version.
- [ ] Verify `/download` page works on mobile.

## 2. PWA Readiness
- [ ] Verify `manifest.json` exists and is valid.
- [ ] Check `apple-touch-icon.png` is present in `/public`.
- [ ] Test "Add to Home Screen" on iOS Safari.
- [ ] Test "Add to Home Screen" on Android Chrome.
- [ ] Confirm install banner dismisses and stays hidden for 7 days.

## 3. Onboarding Flow
- [ ] Test New Parent Signup -> Family Creation.
- [ ] Test Child Pairing via KDG Code.
- [ ] Complete full Setup Checklist on a real Android device.
- [ ] Verify all 6 critical permissions are detectible.

## 4. Feature QA (Smoke Test)
- [ ] **Live Map**: Check if purple marker follows the real device.
- [ ] **App Blocking**: Block YouTube, confirm it overlays within 2 seconds.
- [ ] **Web Protection**: Block `gambling.com`, confirm Chrome block page shows.
- [ ] **Remote Commands**: Test Siren and Lock from Parent Mobile App.
- [ ] **SOS**: Trigger SOS on child, confirm Push Notification reaches Parent.

## 5. Security & Isolation
- [ ] Attempt to access a childId from a different family via URL (must fail).
- [ ] Verify "Guardian" role cannot delete Safe Zones.
- [ ] Check Audit Logs for every action above.

## 6. Feedback & Support
- [ ] Verify "Report Bug" link in dashboard leads to support page.
- [ ] Test support form submission and Firestore audit entry.

## 7. Legal
- [ ] Finalize Privacy Policy for data collection disclosure.
- [ ] Finalize Terms of Service for monitoring consent.
