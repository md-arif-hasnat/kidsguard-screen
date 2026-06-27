# Release Automation

To simplify the release process and reduce manual errors, we use a PowerShell script to handle the build and archival process.

## Prerequisites
- PowerShell 5.1 or 7+
- Android Signing Configuration (must be set up in `app/build.gradle.kts` for `assembleRelease` to work)
- Git installed and in PATH

## How to Run the Script

The script is located at `scripts/release-android-apk.ps1`.

### Usage:
```powershell
.\scripts\release-android-apk.ps1 -versionName "1.0.2" -mandatoryUpdate $false -updateMessage "New update available with stability fixes."
```

### Parameters:
- `-versionName`: The user-visible version string (e.g., "1.0.2").
- `-mandatoryUpdate`: `$true` if users must update to continue, `$false` otherwise.
- `-updateMessage`: The message that will be displayed in the app's update dialog.

## What the Script Does
1. **Checks Git Status**: Warns you if you have uncommitted changes.
2. **Version Verification**: Reminds you to manually update `versionCode` and `versionName` in `app/build.gradle.kts`.
3. **Builds APK**: Runs `./gradlew assembleRelease` to generate the signed APK.
4. **Archives Release**: Copies the generated APK to the `releases/` folder with a version-specific name (e.g., `releases/KidsGuard-v1.0.2.apk`).
5. **Generates Instructions**: Prints the exact manual steps needed to finish the deployment via GitHub and Firestore.

## Manual Completion Steps (Post-Script)
After the script finishes successfully, you must:

1. **Create GitHub Release**:
   - Go to GitHub -> Releases -> Draft a new release.
   - Use tag `v1.0.2`.
2. **Upload Asset**:
   - Drag and drop the APK from `releases/KidsGuard-v1.0.2.apk`.
3. **Copy Download URL**:
   - Once published, right-click the APK asset in the release and copy the link.
4. **Update Firestore**:
   - Go to Firebase Console -> Firestore -> `appConfig/update`.
   - Paste the new URL and update version codes/names.

## Troubleshooting
- **Build Fails**: Ensure your `local.properties` is correct and you have the necessary Android SDKs.
- **Signing Error**: Ensure you have configured the `signingConfigs` in your `app/build.gradle.kts`.
- **APK Not Found**: Standard build path is `app/build/outputs/apk/release/app-release.apk`. If your project uses a custom output path, update the script.
