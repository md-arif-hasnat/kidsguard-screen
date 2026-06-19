# KidsGuard - Cloud Functions Architecture

## 1. Overview
Cloud Functions provide a secure middle layer between the KidsGuard mobile/web apps and the Firestore database. By moving critical logic to the server, we prevent malicious actors from spoofing family relationships, injecting false location data, or triggering unauthorized remote commands.

## 2. Secure Pairing Flow
Instead of the client writing directly to the `families` collection, the following flow is enforced:
1. **Child** calls `createPairingCode` (Callable). Server generates a 6-digit code, saves it to `pairingCodes` with a 15-minute TTL.
2. **Parent** calls `acceptPairingCode` (Callable). Server validates the code, looks up the child device ID, and creates/updates the `family` document.
3. **Atomic Operation:** The server ensures that a child cannot be linked to more than one family without explicit unpairing.

## 3. Remote Command Security
Parents must be authenticated and verified members of the target family before `sendRemoteCommand` executes.
- **Validation:** Server checks `families/{familyId}.parentDeviceId == context.auth.uid`.
- **Targeting:** Server writes the command to `children/{childId}/remoteCommands/{commandId}` with `status = PENDING`.

## 4. Telemetry Validation
- **Location writes:** Use Firestore triggers (`onCreate`) or Callables to verify that the `deviceId` in the payload matches the `auth.uid` of the sender.
- **Status updates:** Ensure children cannot mark themselves as "Online" if their device is registered as "Inactive" in the `devices` collection.

## 5. Automated Maintenance
- **Pairing Codes:** Daily cleanup of codes where `expiresAt < now`.
- **Location History:** Cleanup of points older than 30 days to stay within Firestore storage quotas and respect privacy.

## 6. Integration Points
- **FCM:** Functions are the primary triggers for sending push notifications for SOS alerts and Safe Zone breaches.
- **AI Engine:** (Future) Triggering the rule-based summary provider on the server at 11:59 PM every day.
