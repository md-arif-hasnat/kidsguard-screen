# Firebase App Check production rollout

KidsGuard Android release builds already use the Play Integrity App Check provider. Debug Android builds intentionally use the Firebase Debug provider.

The web dashboard now supports reCAPTCHA Enterprise App Check when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is configured. Without that variable, App Check is not initialized and existing production behavior remains unchanged.

## Web setup

1. In Firebase Console, open **App Check** and register the web app with **reCAPTCHA Enterprise**.
2. Add the production domain:
   - `kidsguard-screen.vercel.app`
   - any approved custom production domain
3. In Vercel, create:
   - `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=<reCAPTCHA Enterprise site key>`
4. Redeploy the web dashboard.
5. Verify valid App Check requests in Firebase metrics.

## Android setup

1. Register the release app in Firebase App Check with Play Integrity.
2. Add the SHA-256 certificate fingerprint of the production signing certificate to the Firebase Android app.
3. Verify release-device traffic in App Check metrics.
4. Keep debug tokens restricted to development devices and remove unused tokens.

## Enforcement order

Do not enable enforcement before both production clients show valid traffic.

1. Enable App Check for the web dashboard and Android release app.
2. Observe metrics and fix invalid traffic.
3. Enable enforcement for Firestore and Storage.
4. Add `enforceAppCheck: true` to callable Functions in small groups and test every parent/child flow.
5. Monitor authentication, pairing, sync, support, update and notification flows after enforcement.

App Check complements Firebase Authentication and Security Rules; it does not replace either.
