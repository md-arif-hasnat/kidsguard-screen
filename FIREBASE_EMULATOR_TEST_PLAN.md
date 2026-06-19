# KidsGuard - Firebase Emulator Test Plan

## 1. Overview
The Firebase Emulator Suite provides a local environment for testing the KidsGuard backend logic (Security Rules and Firestore Data Model) without incurring costs or risking production data. This plan outlines how to validate Phase O, P, and R implementations.

## 2. Tools & Setup
### 2.1 Requirements
- Node.js (Latest LTS)
- Firebase CLI (`npm install -g firebase-tools`)
- Java Runtime Environment (JRE) for emulator execution

### 2.2 Setup Commands
```bash
# Initialize firebase in the project root if not done
firebase init emulators

# Start the emulator suite
firebase emulators:start
```

## 3. Emulators to Use
- **Firestore Emulator:** Test security rules in `firestore.rules.draft` and composite index performance.
- **Authentication Emulator:** Simulate anonymous logins and user UID generation.
- **UI Controller:** Use the local dashboard at `http://localhost:4000` to inspect data and logs.

## 4. Test Workflow
1. **Initial Setup:** Load seed data using `EMULATOR_DATA_SEED_PLAN.md`.
2. **Security Rule Validation:** Run automated tests (using `@firebase/rules-unit-testing`) to verify `SECURITY_TEST_CASES.md`.
3. **App Integration Testing:**
   - Modify `FirebaseConfig.kt` to point to `localhost` (10.0.2.2 for Android Emulator).
   - Run the Android app in "Child" mode and "Parent" mode.
4. **Error Simulation:** Manually trigger connection failures or permission denials to verify app resilience.

## 5. FCM Future Notes
Since the FCM emulator is primarily for receiving messages, testing "Push Wakeup" (Phase O.5) requires the emulator to log the receipt of messages which can be inspected via the Emulator UI logs.
