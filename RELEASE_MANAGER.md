# KidsGuard Release & Update Manager

This system manages the deployment of new versions and ensures all family devices are running secure, up-to-date software.

## Release Workflow

1.  **Build Signed APK**: Generate the release build in Android Studio.
2.  **Host APK**: Upload the file to a public provider (GitHub, Firebase, etc.) and get the direct download URL.
3.  **Publish Release**:
    -   Navigate to `/admin/releases` in the web dashboard.
    -   Enter the new version name and incremented version code.
    -   Select the target **Release Channel** (Stable/Beta/Alpha).
    -   Toggle **Mandatory Update** if this is a critical security patch.
    -   Click **Publish Release**.

## Versioning Strategy

### VersionCode (Internal)
-   Integer, always increasing.
-   Used by the system to detect if an update is available.
-   Example: `45` -> `46`.

### VersionName (User-facing)
-   Semantic format: `MAJOR.MINOR.PATCH`.
-   Example: `1.0.9`.

## Release Channels

| Channel | Purpose | Audience |
| :--- | :--- | :--- |
| **Stable** | Production-ready, verified builds. | All Users |
| **Beta** | Feature-complete, pending final stress tests. | Opt-in Testers |
| **Alpha** | Bleeding-edge features and experimental code. | Internal Team |

## Update Types

### Optional Update
-   `mandatoryUpdate = false`
-   Users see an "Update Available" prompt.
-   Provides "Update Now" and "Later" options.

### Mandatory Update
-   `mandatoryUpdate = true`
-   Users see an **"Update Required"** prompt.
-   Blocks app usage until the update is installed.
-   Only provides the "Update Now" option.

## Distribution & Hosting
The system is hosting-agnostic. Any direct HTTPS link to an APK will work.
-   **GitHub Releases**: Recommended for public beta distribution.
-   **Firebase Hosting**: Recommended for private distribution.
-   **Cloudflare R2 / AWS S3**: Recommended for high-scale production usage.

## Future: Play Store Migration
When migrating to the Google Play Store, the `apkDownloadUrl` can be pointed to the Play Store listing, and the internal `versionCode` logic will still function as a secondary check for legacy sideloaded builds.
