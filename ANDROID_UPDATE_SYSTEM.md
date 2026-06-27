# KidsGuard Android & Web Update System (OTA)

This document describes the Over-The-Air (OTA) update system for the KidsGuard Android app and the Web/PWA dashboard.

## 1. System Overview
KidsGuard uses Firebase Firestore as the "Source of Truth" for app versions. Both the Android app and the Web dashboard poll/read from a global configuration document to determine if an update is required.

## 2. Firestore Configuration
**Path**: `appConfig/update`

### Fields:
- `latestVersionCode`: (number) The latest integer version for Android.
- `latestVersionName`: (string) The human-readable version string for Android (e.g., "1.0.1").
- `apkDownloadUrl`: (string) Direct link to the latest signed APK file (hosted on GitHub Releases).
- `mandatoryUpdate`: (boolean) If true, the Android app blocks usage until updated.
- `updateMessage`: (string) Message displayed in the update dialog.
- `releaseNotes`: (string array) List of improvements in the latest release.
- `releasedAt`: (timestamp) Date/time of the release.
- `webVersion`: (string) Latest version string for the web dashboard.
- `webUpdateMessage`: (string) Message for the web update banner.
- `webReleaseNotes`: (string array) Improvements for the web dashboard.

## 3. Android OTA Behavior
On app launch, the `UpdateRepository` fetches the config:
- **Comparison**: If `latestVersionCode > installedVersionCode`, an update is triggered.
- **Optional Update**: If `mandatoryUpdate` is `false`, a dialog shows "Update Now" and "Later".
- **Mandatory Update**: If `mandatoryUpdate` is `true`, a non-dismissible screen appears, requiring an update to proceed.
- **Silent Update**: Android security prevents silent background installation of APKs from unknown sources. The app opens the browser to download the APK, and the user must confirm the installation.

## 4. Web / PWA Update Behavior
The Web Dashboard checks the `webVersion` on load:
- **Tracking**: The last seen version is stored in `localStorage`.
- **Banner**: If a newer version is detected, a banner/modal appears at the bottom.
- **Update Process**: Clicking "Update Now" clears the cache (where possible) and reloads the page to fetch the latest assets.
- **iPhone Users**: Since iPhone users "Add to Home Screen" as a PWA, they receive this update banner instead of an APK download prompt.

## 5. Admin Release Manager
**Path**: `/admin/releases` (OWNER only)
Administrators use this page to:
1. View the current active release.
2. Publish a new release by providing version codes, URLs, and notes.
3. Automatically archive releases into the `appReleases` collection for historical tracking.

## 6. GitHub Release Workflow
1. Build a signed Release APK in Android Studio.
2. Go to GitHub -> Releases -> Draft a new release.
3. Upload the APK as an asset.
4. Copy the direct download link for the APK asset.
5. Use the **Admin Release Manager** in KidsGuard to publish the update to Firestore.

## 7. Release Checklist
- [ ] Increment `versionCode` and `versionName` in `app/build.gradle.kts`.
- [ ] Create signed Release APK.
- [ ] Upload APK to GitHub Release.
- [ ] Verify APK download link is public.
- [ ] Update Firestore via Admin Release Manager.
- [ ] Verify `/download` page reflects the new version.
- [ ] Verify older Android installations see the update prompt.
