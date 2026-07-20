import { db } from "../firebase";
import { doc, onSnapshot, collection, updateDoc, serverTimestamp } from "firebase/firestore";

export interface ChildStatus {
  childId: string;
  childName: string;
  avatarId?: string;
  photoUrl?: string;
  batteryPercent: number;
  charging: boolean;
  online: boolean;
  lastSeen: number;
  kidGuardActive: boolean;
  trackingEnabled: boolean;
  currentZone: string | null;
  currentZoneId?: string | null;
  safeZoneStatus?: 'INSIDE' | 'OUTSIDE';
  lastZoneEvent?: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
    speed?: number;
    bearing?: number;
  };
  deviceName?: string;
  appVersion?: string;
  androidVersion?: string;

  // Part 1: Device Health
  batteryTemp?: number;
  internetType?: 'WIFI' | 'MOBILE' | 'NONE';
  wifiSsid?: string;
  storageUsedBytes?: number;
  storageTotalBytes?: number;
  ramUsedBytes?: number;
  ramTotalBytes?: number;
  gpsEnabled?: boolean;
  bluetoothEnabled?: boolean;
  predictions?: SyncPredictions;
}

export interface SyncPredictions {
  batteryRemainingMinutes?: number;
  batteryDieAtTimestamp?: number;
  offlineRisk?: 'Low' | 'Medium' | 'High';
  approachingZoneId?: string;
  distanceToApproachingZone?: number;
  unusualRouteDetected: boolean;
  lateArrivalDetected: boolean;
  longStopDetected: boolean;
  stopLocation?: string;
  lastPredictionAt: number;
}

export interface SyncSafetySummary {
  date: string;
  safetyScore: number;
  visitedZones: string[];
  totalDistanceKm: number;
  alertCount: number;
  recommendation: string;
}

export class ChildRepository {
  static listenToChildStatus(childId: string, onUpdate: (status: ChildStatus | null) => void) {
    if (!db || !childId) return () => {};

    const statusRef = doc(db, "children", childId, "status", "current");
    return onSnapshot(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as ChildStatus);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to child status:", error);
      onUpdate(null);
    });
  }

  static async updateAvatar(childId: string, avatarId: string): Promise<void> {
    if (!db) return;
    const childRef = doc(db, "children", childId);
    const statusRef = doc(db, "children", childId, "status", "current");

    // Update both document and status
    await updateDoc(childRef, { avatarId, updatedAt: serverTimestamp() });
    await updateDoc(statusRef, { avatarId });
  }

  /**
   * Part 9: Ensures a child document has the correct familyId link.
   */
  static async ensureFamilyLink(childId: string, familyId: string): Promise<void> {
      if (!db || !childId || !familyId) return;
      const ref = doc(db, "children", childId);
      await updateDoc(ref, { familyId, updatedAt: serverTimestamp() });
  }

  static async renameChild(childId: string, newName: string): Promise<void> {
    if (!db || !childId) return;
    const childRef = doc(db, "children", childId);
    const statusRef = doc(db, "children", childId, "status", "current");

    await updateDoc(childRef, { name: newName, updatedAt: serverTimestamp() });
    try {
        await updateDoc(statusRef, { childName: newName });
    } catch (e) {
        console.warn("Status doc might not exist yet:", e);
    }
  }

  static async updateChild(childId: string, data: { name?: string, avatarId?: string }): Promise<void> {
    if (!db || !childId) return;
    const childRef = doc(db, "children", childId);
    const statusRef = doc(db, "children", childId, "status", "current");

    const updates: any = { ...data, updatedAt: serverTimestamp() };
    await updateDoc(childRef, updates);

    const statusUpdates: any = {};
    if (data.name) statusUpdates.childName = data.name;
    if (data.avatarId) statusUpdates.avatarId = data.avatarId;

    if (Object.keys(statusUpdates).length > 0) {
        try {
            await updateDoc(statusRef, statusUpdates);
        } catch (e) {
            console.warn("Status doc might not exist yet:", e);
        }
    }
  }
}
