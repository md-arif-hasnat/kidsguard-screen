import { db } from "../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

export interface FeatureFlags {
  enableAiInsights: boolean;
  enableProtectionModes: boolean;
  enableWebFiltering: boolean;
  betaEnrollmentOpen: boolean;
  canaryUsers: string[]; // List of UIDs
}

export class FeatureFlagRepository {
  static listenToFlags(onUpdate: (flags: FeatureFlags) => void) {
    if (!db) return () => {};
    const ref = doc(db, "appConfig", "featureFlags");
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as FeatureFlags);
      } else {
        // Default flags if doc missing
        onUpdate({
          enableAiInsights: true,
          enableProtectionModes: true,
          enableWebFiltering: true,
          betaEnrollmentOpen: false,
          canaryUsers: []
        });
      }
    });
  }

  static isFeatureEnabled(flags: FeatureFlags, feature: keyof FeatureFlags, uid?: string): boolean {
    const val = flags[feature];
    if (typeof val === 'boolean') {
        // If it's a global boolean, return it
        return val;
    }
    if (Array.isArray(val) && uid) {
        // If it's a list (canary), check if user is in it
        return val.includes(uid);
    }
    return false;
  }
}
