import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getMessaging, Messaging } from "firebase/messaging";
import {
  AppCheck,
  ReCaptchaEnterpriseProvider,
  getAppCheck,
  initializeAppCheck,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let messaging: Messaging | undefined;
let appCheck: AppCheck | undefined;

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);

  // Messaging and App Check only run in the browser.
  if (typeof window !== "undefined") {
    const appCheckSiteKey =
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY || "";

    if (appCheckSiteKey) {
      try {
        appCheck = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (appCheckError) {
        // Next.js hot reload may evaluate this module more than once.
        try {
          appCheck = getAppCheck(app);
        } catch {
          console.error(
            "Firebase App Check could not be initialized.",
            appCheckError
          );
        }
      }
    }

    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn("FCM not supported in this browser environment.");
    }
  }
}

export { app, auth, db, messaging, appCheck };

export const isDev = process.env.NODE_ENV === 'development';
export const showMocks = isDev && !isFirebaseConfigured;
