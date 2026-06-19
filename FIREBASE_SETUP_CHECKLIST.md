# Firebase Setup Checklist

This checklist guides the initial configuration and verification of the KidsGuard backend services.

## 1. Project Initialization
- [ ] Create a new project in the [Firebase Console](https://console.firebase.google.com/).
- [ ] Enable **Google Analytics** (Optional but recommended).

## 2. Authentication
- [ ] Enable **Anonymous** sign-in (Required for current Phase).
- [ ] Enable **Email/Password** sign-in (For Parent Web Dashboard).
- [ ] Enable **Google Sign-in** (Optional future feature).

## 3. Cloud Firestore
- [ ] Create Firestore database in **Production Mode** (or start in Test Mode and apply rules immediately).
- [ ] Select appropriate location (e.g., `us-central`).
- [ ] Apply `firestore.rules.draft` to the Rules tab.
- [ ] Configure composite indexes as defined in `FIRESTORE_INDEXES.md`.

## 4. Firebase Cloud Messaging (FCM)
- [ ] Note the **Sender ID** and **Server Key** (if using legacy API) or configure **HTTP v1 API**.

## 5. Android Integration
- [ ] Add Android App to Firebase project.
- [ ] **Package Name:** `com.example.kidsguard`.
- [ ] **SHA-1 Fingerprint:** Add from Android Studio Gradle `signingReport`.
- [ ] Download `google-services.json`.
- [ ] Place `google-services.json` in `app/` directory of the project.

## 6. Functional Verification
- [ ] Build app and verify **Anonymous Login** success in Developer Menu.
- [ ] Test **Child Device Registration** (Verify document in `devices` collection).
- [ ] Test **Pairing Flow** (Generate code on child, enter on parent).
- [ ] Verify **Family Document** creation in Firestore.
- [ ] Verify **Child Status Sync** (Battery, Online status updates).
- [ ] Verify **Remote Commands** (Send Lock from parent, verify execution on child).
- [ ] Verify **Location Sync** (Points appearing in `locations` sub-collection).

## 7. Security & Hardening
- [ ] Verify no collections have `allow read, write: if true;`.
- [ ] Test restricted access (Ensure User A cannot read User B's locations).
