# Play Protect installation block audit — KidsGuard 1.0.98

## Observed behavior

A new phone displayed: **App blocked to protect your device** / **This app can request access to sensitive data. This can increase the risk of identity theft or financial fraud.**

Google's developer guidance describes this as an automatic protection for some apps installed from Internet-sideloading sources (browsers, messaging, and file managers) that declare Accessibility and/or Notification Listener. KidsGuard legitimately uses **both**, so simply rebuilding, signing, renaming the APK, or changing download hosting does **not** remove this protection.

References:
- https://developers.google.com/android/play-protect/warning-dev-guidance
- https://support.google.com/googleplay/android-developer/answer/10964491
- https://support.google.com/googleplay/android-developer/answer/12955211

## Code audit findings and fixes in testing branch

- Accessibility service: required for parent-approved app blocking, YouTube/browser content detection and limits. **Do not strip or conceal** this service while claiming these features.
- Notification Listener: required for parent-consented media information. **Do not hide** it to evade Play Protect checks.
- Monitoring classification: AndroidManifest declares `isMonitoringTool=child_monitoring`, appropriate only if all monitoring app, consent, and disclosure policies are actually followed.
- Device Admin: requested a broad set of Android device-owner-like policies including **wipe-data**, despite its child screen-locking purpose. Reduced the policy XML to **force-lock** only.
- Accessibility permission management: replaced interception of Android system settings via `GLOBAL_ACTION_BACK` with notification-only behavior. Users retain Android's ability to revoke special access and remove the app.
- Debug logging of YouTube UI text was disabled to avoid collecting additional sensitive screen content in logs.

## Must complete before claiming Play Protect installation is fixed

1. Run all Android build, manifest-merger, signing, app-unit, Firebase rules and backend checks on the exact candidate commit.
2. Verify in the built AAB/APK that permission set matches the intended functionality; avoid unnecessary dangerous/special permissions.
3. Complete Google Play Console verification and publish **signed AAB to Internal Testing** with the required Accessibility, Notification Listener, background location, monitoring, data-safety and consent declarations as applicable.
4. Test an actual Google Play installation with Play Protect **enabled** on a clean Android device, then test pairing, disclosure, location, and removal flows.
5. If Play Protect flags the Google Play-distributed binary, follow Google's official Play Protect warning guidance and appeal process, supplying evidence; never instruct users to disable or bypass protection.

**Status:** The source-level permission/least-privilege issues were partially mitigated in this branch, but an actual new-phone installation was **not** verified. Do not mark the app Play Protect approved or release-ready.
