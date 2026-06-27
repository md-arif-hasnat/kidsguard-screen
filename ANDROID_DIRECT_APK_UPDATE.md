# KidsGuard Direct APK Update System

## Overview
Since KidsGuard is currently distributed as a direct APK download and not via the Google Play Store, we have implemented a custom update system using Firebase Firestore.

## Why APK cannot silently auto-update
Android's security model prevents non-system apps (or apps not installed via a verified store like Play Store) from silently installing or updating themselves.
- To update, the app must download the new APK.
- The user must manually trigger the installation by opening the APK.
- KidsGuard facilitates this by opening the direct download URL in the external browser.

## How it works

### 1. Versioning
We use standard Android versioning:
- **`versionCode`**: An integer that increases with every release. This is what the app compares to determine if an update is available.
- **`versionName`**: A user-facing string (e.g., "1.2.0").

### 2. Firestore Configuration
The app checks for updates by reading a document at `appConfig/update`.

**Schema:**
- `latestVersionCode`: (number) The latest available version code.
- `latestVersionName`: (string) Human-readable version name.
- `apkDownloadUrl`: (string) Direct link to the latest APK.
- `mandatoryUpdate`: (boolean) If true, the app blocks usage until updated.
- `updateMessage`: (string) Message to show the user.
- `releaseNotes`: (string array) List of new features or fixes.
- `releasedAt`: (timestamp) When the version was released.

### 3. Update Check Logic
On every app launch, `UpdateRepository` fetches this Firestore document.
- If `latestVersionCode > currentInstalledVersionCode`, an update is triggered.
- If `mandatoryUpdate` is true, a non-dismissible dialog is shown.
- Otherwise, a standard "Update Available" dialog with a "Later" option is shown.

### 4. Installation Process
When the user clicks **Update Now**:
1. The app opens the `apkDownloadUrl` in the system's external browser.
2. The user downloads the APK.
3. The user opens the downloaded file to install the update.

## Developer Testing
In the **Developer Menu** (accessible from Role Selection or Home in DEBUG builds):
- View current `versionCode` and `versionName`.
- View fetched Firestore version data.
- **Simulate Optional Update**: Triggers a non-mandatory update UI.
- **Simulate Mandatory Update**: Triggers a mandatory update UI that blocks app usage.
