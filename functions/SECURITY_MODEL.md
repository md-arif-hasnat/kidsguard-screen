# KidsGuard - Server Security Model

## 1. Auth Context
Every Callable function must verify the `context.auth` object. Anonymous users are allowed for initial device registration, but elevated actions require the user to be part of a `family` document.

## 2. App Check Enforcement
In production, all Callable functions must verify the presence of a valid App Check token.
- **Verification:** `if (context.app === undefined) throw new HttpsError('failed-precondition', 'The function must be called from a verified app.');`
- **Exemption:** Certain initial registration calls might be exempted during the "Audit" rollout phase, but eventually, all calls will require attestation.
- **Emulator:** The `firebase-functions-test` SDK will be used to simulate App Check tokens during unit testing.

## 3. Role-Based Access Control (RBAC)
- **Parent Role:** Identified by `parentDeviceId` in a family document. Can trigger commands and read telemetry for all `childDeviceIds` in the list.
- **Child Role:** Identified by `childDeviceId` in a family document. Can write telemetry (Location, Activity) and update the status of commands specifically assigned to their UID.

## 3. Rate Limiting
To prevent abuse (especially with Anonymous Auth), the following limits are planned:
- **Pairing Code Generation:** Max 5 attempts per device per hour.
- **Pairing Code Submission:** Max 10 attempts per IP/Account per hour (Brute force protection).
- **Remote Commands:** Max 100 commands per day per family.

## 4. Input Sanitization
- All telemetry data (Coordinates, Battery %) must be validated for data types and range before being accepted into Firestore.
- Command payloads are restricted to predefined `enum` values.

## 5. Metadata Enforcement
The server automatically appends `updatedAt` and `serverTimestamp` fields to all writes, preventing client-side clock drift issues.
