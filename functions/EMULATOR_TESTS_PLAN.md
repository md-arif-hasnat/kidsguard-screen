# KidsGuard - Functions Emulator Test Plan

## 1. Test Environment
- **Firestore Emulator:** Active
- **Functions Emulator:** Active
- **Auth Emulator:** Active

## 2. Test Cases

### 2.1 Pairing
- **Scenario:** Valid code submission.
- **Action:** Call `acceptPairingCode`.
- **Verify:** Family document updated, code deleted.

- **Scenario:** Expired code.
- **Action:** Call `acceptPairingCode`.
- **Verify:** Error 404 (Not Found) or 410 (Gone).

### 2.2 Remote Commands
- **Scenario:** Unauthorized command.
- **Action:** User B attempts `sendRemoteCommand` to Child A.
- **Verify:** Error 403 (Permission Denied).

- **Scenario:** Valid command.
- **Action:** Parent A sends `LOCK_NOW` to Child A.
- **Verify:** Document created in Child A sub-collection.

### 2.3 Automated Logic
- **Scenario:** SOS Trigger.
- **Action:** Insert doc to `sosEvents`.
- **Verify:** FCM log in Emulator UI shows notification sent.

- **Scenario:** Cleanup.
- **Action:** Trigger `cleanupExpiredPairingCodes` manually via shell.
- **Verify:** Expired documents are gone.
