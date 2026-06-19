# KidsGuard Security Review Notes

## 1. Current Risk Assessment
- **Anonymous Auth:** While convenient for Phase 1, it allows anyone to generate pairing codes if rules aren't strict.
- **Client-Side Validations:** Much of the pairing logic depends on the client. A malicious client could bypass some checks.
- **Rules Draft:** The current rules are a draft and haven't been tested in a live production environment with complex data relationships.

## 2. Key Limitations
- **No Cloud Functions:** Rules currently rely on `get()` calls to verify family relationships. This can be slow and expensive. Cloud Functions should handle pairing and sensitive data transitions.
- **No App Check:** The API is currently open to any Firebase-enabled client. **Firebase App Check** should be enabled to prevent unauthorized SDK usage.

## 3. Future Hardening Requirements
- **App Check:** Enforce that only the official KidsGuard app (verified by Play Integrity) can write to Firestore.
- **Rate Limiting:** Implement rate limits for pairing code generation via Cloud Functions.
- **Data Sanitization:** Use rules or Cloud Functions to enforce strict schema validation (e.g., coordinates must be numbers, battery must be 0-100).
- **Audit Logs:** Log all administrative or high-risk actions (Unpairing, Remote Wipes) to a dedicated audit collection.

## 4. App Check Considerations
- **Abuse Reduction:** App Check significantly reduces the risk of automated script attacks but it **does not replace** Firestore Security Rules.
- **No User Auth:** App Check verifies the *app*, not the *user*. Family membership must still be validated server-side.
- **Rollout:** Enforcement should be enabled gradually after a period of monitoring to avoid blocking legitimate users on devices with compromised integrity.

## 5. Pending Tasks
- [ ] Live testing of `firestore.rules.draft` using the Firebase Emulator Suite.
- [ ] Verification of performance for `isFamilyMember()` helper in high-volume traffic.
- [ ] Design of Cloud Functions for "Pairing" to move the logic away from the client.
