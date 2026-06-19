# KidsGuard Web Dashboard - App Check Plan

## 1. Overview
The Parent Web Dashboard must be protected from unauthorized automated access. We will use reCAPTCHA Enterprise as the App Check provider for the web platform.

## 2. Implementation Steps
### 2.1 Firebase Console Setup
1. Enable App Check in the Firebase Console.
2. Register the Web App for reCAPTCHA Enterprise.
3. Obtain the Site Key.

### 2.2 Client-Side Integration (Next.js)
1. Initialize Firebase App Check in the root layout or a specialized hook.
2. Provide the `ReCaptchaEnterpriseProvider` with the site key.
3. Ensure `isTokenAutoRefreshEnabled` is set to `true`.

### 2.3 Hosting Considerations
- **Firebase Hosting:** Simplest integration, provides automatic verification headers for some services.
- **Vercel:** Requires manual header handling or standard SDK flow. Use environment variables for the Site Key.

## 3. Token Enforcement
Once enforcement is enabled in the Firebase Console:
- All requests to Firestore from the web dashboard must include a valid App Check token.
- All Cloud Functions (Next.js API routes or Callable functions) will reject requests missing a valid token.

## 4. Local Development
- Use the `DebugAppCheckProvider` for local Next.js development.
- Use a `.env.local` variable `NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` to store the token generated in the Firebase Console.
