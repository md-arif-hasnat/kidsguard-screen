# GitHub Release & Distribution Workflow

This document outlines the step-by-step process for releasing a new version of the KidsGuard Android app and updating the distribution points (Firestore and the Download page).

## 1. Release Principles

- **versionCode**: Must ALWAYS increase with every build.
- **versionName**: User-visible version (e.g., `1.0.1`).
- **Git Tag**: Should match `v` + `versionName` (e.g., `v1.0.1`).
- **One Source of Truth**: Firestore `appConfig/update` controls both the in-app update prompt and the web download page.

## 2. Step-by-Step Release Workflow

### Step 1: Prepare the Build
1. Update `versionCode` and `versionName` in `app/build.gradle.kts`.
2. Commit and push changes.
3. Build the signed Release APK (`./gradlew assembleRelease`).

### Step 2: Create GitHub Release
1. Go to your GitHub repository -> **Releases** -> **Draft a new release**.
2. **Tag**: Create a new tag matching the version (e.g., `v1.0.1`).
3. **Title**: `KidsGuard v1.0.1`.
4. **Description**: Summarize changes for the release notes.
5. **Assets**: Upload the signed APK (e.g., `KidsGuard-v1.0.1.apk`).
6. **Publish** the release.

### Step 3: Get Download URL
1. Once published, right-click the uploaded APK in the release assets.
2. Select **Copy Link Address**. It should look like:
   `https://github.com/USER/REPO/releases/download/v1.0.1/KidsGuard-v1.0.1.apk`

### Step 4: Update Firestore
Update the document at `appConfig/update` in the Firebase Console:

| Field | Example Value |
| :--- | :--- |
| `latestVersionCode` | `101` |
| `latestVersionName` | `"1.0.1"` |
| `apkDownloadUrl` | `"https://github.com/.../KidsGuard-v1.0.1.apk"` |
| `mandatoryUpdate` | `false` (set to `true` if users MUST update to continue) |
| `updateMessage` | `"New version with critical security fixes."` |
| `releaseNotes` | `["Improved tracking", "Bug fixes"]` (Array of strings) |
| `releasedAt` | Current Server Timestamp |

### Step 5: Verification
1. Open the [Download Page](https://kidsguard-screen.vercel.app/download) and verify the version and download link are updated.
2. Open an older version of the app and verify the update prompt appears.

---

## 3. Customer Flows

### Existing Customers
1. Open the app.
2. App checks Firestore `appConfig/update`.
3. If `latestVersionCode > installedVersionCode`, an **Update Dialog** appears.
4. User taps **Update Now**.
5. Browser opens the GitHub APK link.
6. User downloads and confirms the installation.

### New Customers
1. Visit the [Download Page](https://kidsguard-screen.vercel.app/download).
2. Taps **Download Latest APK**.
3. Browser downloads the latest APK from GitHub.
4. User installs the APK directly.

## 4. Android Limitations & Behavior
- **No Silent Updates**: Android security prevents background installation of APKs from unknown sources.
- **User Confirmation**: The user MUST manually confirm the installation when the APK is opened.
- **Install from Unknown Sources**: First-time users may need to enable "Install from unknown sources" in Android settings. The app/browser will prompt for this.

## 5. Release Checklist
- [ ] `versionCode` increased.
- [ ] `versionName` updated.
- [ ] APK signed successfully.
- [ ] GitHub Release created and tag pushed.
- [ ] APK uploaded to GitHub Assets.
- [ ] Firestore `appConfig/update` updated with new URL and version info.
- [ ] Web download page verified.
- [ ] In-app update prompt verified on older version.
