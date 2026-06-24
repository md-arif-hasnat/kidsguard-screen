# KidsGuard Download Center Management

This document explains how to manage the permanent download page for KidsGuard.

## Permanent URL
- **Current:** [https://kidsguard-screen.vercel.app/download](https://kidsguard-screen.vercel.app/download)
- **Planned:** `https://download.kidsguard.app`

## Release Workflow

### 1. Upload APK to any public hosting provider
1. Generate the signed production APK in Android Studio (`Build > Generate Signed Bundle / APK`).
2. Upload the APK to any public hosting provider.
   
   **Supported examples:**
   - **GitHub Releases** (Recommended for Beta/Open Source)
   - **Google Cloud Storage**
   - **Firebase Hosting**
   - **Cloudflare R2**
   - **Amazon S3**

3. **Important:** It is recommended to keep the same filename (e.g., `kidsguard-latest.apk`) and overwrite the existing file if your storage provider supports it. This avoids updating the URL in Firestore for minor hotfixes.

### 2. Update Firestore Configuration
The download page reads its information from the following Firestore document:
- **Path:** `appConfig/update`

#### Fields to Update:
| Field | Type | Description |
| :--- | :--- | :--- |
| `latestVersionCode` | Number | The current `versionCode` (e.g., `45`). |
| `latestVersionName` | String | User-facing version (e.g., `1.0.2`). |
| `apkDownloadUrl` | String | The direct link to the APK file. |
| `releasedAt` | Timestamp | Date of the release. |
| `fileSize` | String | Human-readable size (e.g., `12.4 MB`). |
| `minimumAndroidVersion`| String | (e.g., `Android 8.0+`). |
| `releaseNotes` | String | List of changes (supports newlines). |
| `forceUpdate` | Boolean | If `true`, the Android app will block usage until updated. |

### 3. Verification
Once the Firestore document is saved, the changes will reflect instantly at `/download`. No redeployment of the web dashboard is required.

## Technical Architecture
- **Framework:** Next.js (App Router).
- **Styling:** Tailwind CSS.
- **Data Fetching:** Client-side via Firebase JS SDK.
- **QR Generation:** Powered by `api.qrserver.com`.

## Future Custom Domain
When moving to `download.kidsguard.app`, configure a redirect in Vercel or point the A/CNAME records to the Vercel deployment. The route `/download` should remain the canonical source for the landing page.
