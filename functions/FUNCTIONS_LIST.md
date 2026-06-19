# KidsGuard - Functions List

## 1. `createFamily`
- **Type:** HTTPS Callable
- **Input:** `name: string`
- **Validation:** User must not already be an owner of a family.
- **Action:** Creates `families/{familyId}` with `parentDeviceId = auth.uid`.

## 2. `createPairingCode`
- **Type:** HTTPS Callable
- **Input:** `childName: string`
- **Validation:** Limit per hour per device.
- **Action:** Generates unique code, saves to `pairingCodes/{code}`.

## 3. `acceptPairingCode`
- **Type:** HTTPS Callable
- **Input:** `code: string`
- **Validation:** Code exists and not expired. Parent must own a family.
- **Action:** Adds `auth.uid` to family's `childDeviceIds`, deletes pairing code.

## 4. `sendRemoteCommand`
- **Type:** HTTPS Callable
- **Input:** `childId: string, command: string`
- **Validation:** `auth.uid` must be parent of `childId`.
- **Action:** Writes to `children/{childId}/remoteCommands`.

## 5. `markCommandExecuted`
- **Type:** HTTPS Callable
- **Input:** `commandId: string`
- **Validation:** `auth.uid` must be the target child.
- **Action:** Updates status to `EXECUTED`.

## 6. `createSosAlert`
- **Type:** Firestore Trigger (`onCreate` on `sosEvents`)
- **Action:** Sends high-priority FCM message to the parent linked to the child.

## 7. `cleanupExpiredPairingCodes`
- **Type:** Scheduled (Cron)
- **Schedule:** Every 24 hours.
- **Action:** Deletes expired docs from `pairingCodes`.
