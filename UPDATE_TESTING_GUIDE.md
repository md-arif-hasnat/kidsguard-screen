# KidsGuard Update System Testing Guide

This guide provides a structured approach to verifying the Android Direct APK Update system.

## 1. Optional Update Validation (Part 1)
**Scenario**: A new version is available but not required for app operation.
- [ ] Go to Developer Menu -> **Simulate Optional Update**.
- [ ] Verify title is "Update Available".
- [ ] Verify "Update Now" and "Later" buttons are both visible.
- [ ] Verify `releaseNotes` are displayed correctly.
- [ ] Click **Later**: Dialog should close and app should remain usable.
- [ ] Re-open Developer Menu -> **Simulate Optional Update** -> Click **Update Now**.
- [ ] Verify it opens the external browser with the mock URL.

## 2. Mandatory Update Validation (Part 2)
**Scenario**: A critical security update is required.
- [ ] Go to Developer Menu -> **Simulate Mandatory Update**.
- [ ] Verify title is "Update Required".
- [ ] Verify the "Later" button is **hidden**.
- [ ] Try to dismiss the dialog by clicking outside or pressing the Back button (it should not close).
- [ ] Verify a red "Mandatory update" warning message is visible.
- [ ] Click **Update Now**: Verify it opens the external browser.

## 3. Version Comparison Testing (Part 4)
- [ ] **100 vs 100**: Set current version code to match Firestore. No popup should appear.
- [ ] **100 vs 101**: Set Firestore version higher. Popup must appear on launch.
- [ ] **101 vs 101**: Update app to match Firestore. Popup must disappear.
- [ ] **102 vs 101**: App version higher than Firestore (e.g. dev build). No popup should appear.

## 4. Download & Browser Integration (Part 3)
- [ ] Click **Update Now** in any update dialog.
- [ ] Browser should open the specific GitHub Release URL (e.g., `https://github.com/.../KidsGuard-v1.0.1.apk`).
- [ ] Verify the APK download starts (no silent install attempt).
- [ ] Verify the app does not crash during this transition.

## 5. Network & Firestore Failure (Part 5)
- [ ] Disable Wi-Fi/Mobile Data on the device.
- [ ] Launch the app.
- [ ] Verify the app loads without crashing.
- [ ] Check Logcat for: `UpdateRepository: Failed to check for updates`.
- [ ] Verify the app continues to function with the locally installed version.

## 6. Release History & Admin Verification (Part 6)
- [ ] Use the **Admin Release Manager** to publish a new version.
- [ ] Verify the new release appears at the top of the **History** list on the admin page.
- [ ] Verify the `appReleases` collection in Firestore contains the new document with all metadata (`createdByUid`, `releasedAt`, etc.).

## 7. Regression Checklist
- [ ] Check if the update dialog interferes with Firebase Cloud Messaging (FCM) notifications.
- [ ] Verify that background tracking continues even if an optional update dialog is shown.
- [ ] Ensure the "What's New" dialog appears correctly only once after a successful manual update.

## 8. GitHub Release Checklist
- [ ] Tag matches `vX.Y.Z`.
- [ ] APK is attached as a release asset.
- [ ] Release is set to "Latest" if it's the stable branch.
- [ ] Download link copied from the asset, not the release page.
