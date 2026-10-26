# KidsGuard two-day production readiness gate

The production-critical story is:

1. A verified parent signs in and sends a command or changes a child policy.
2. Firebase authorizes the request for that family and child only.
3. The child foreground service receives, claims, and applies the command once.
4. The child continues publishing a five-minute device heartbeat while the UI is closed.
5. The parent dashboard renders the latest command result and device health without mock data.

## Automated release blockers

Every pull request to `main` must pass the Production Readiness Gate:

- Parent/child command contract alignment
- Parent dashboard lint and production build
- All Firebase Functions tests and dependency audit
- Firestore and Storage authorization tests in emulators
- Child Android compile and unit tests

## Required physical-device smoke test

Before broad production rollout, use the signed release APK on one paired child phone and verify:

- Close the child app UI; the dashboard heartbeat remains fresh for at least 15 minutes.
- Lock, unlock, ring, vibrate, refresh location, and send message each reach `APPLIED` once.
- App usage, browser history, YouTube history, and installed apps continue syncing.
- An adult or gambling page is blocked without making the browser unusable afterward.
- Parent approval and push-notification deep links open the relevant request.
- Reboot the child phone and confirm protection, heartbeat, and remote commands recover.

## Rollout rule

Keep the previous signed APK available for rollback. Do not enable Firebase App Check enforcement until valid Android and web traffic is visible in App Check metrics. Web enforcement waits for the reCAPTCHA Enterprise site key and a verified production redeploy.
