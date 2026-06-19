# KidsGuard - Known Production Risks

## 1. Device Hardware & OS
- **Background Restrictions:** OEM-specific "battery savers" (Xiaomi, Samsung, Huawei) may kill background location tracking despite permissions.
- **GPS Accuracy:** Deep urban canyons or indoor use will lead to accuracy fluctuations (>50m).
- **Notification Delay:** FCM delivery can be delayed by Google Play Services sleep states.

## 2. Firebase & Backend
- **Anonymous Auth:** Users will lose access to their "Family" if they clear app data or change phones without upgrading to email auth.
- **Concurrency:** Large familias (>10 children) may hit Firestore document update limits for the family root.
- **Quota:** Real-time location sync (every 30s) can consume free tier read/write quotas quickly.

## 3. Data Integrity
- **Clock Drift:** If child device time is incorrect, historical location logs will appear out of order in parent history.
- **Sync Conflict:** Offline edits to safe zones may cause conflicts when coming back online.

## 4. Security
- **Physical Bypass:** A technically savvy child may attempt to disable "KidGuard Accessibility Service" manually.
- **Rule Complexity:** Excessive `get()` calls in security rules may increase latency and cost.
