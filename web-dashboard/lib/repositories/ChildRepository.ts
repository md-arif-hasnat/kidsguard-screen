import { db } from "../firebase";
import { doc, onSnapshot, collection, updateDoc, serverTimestamp } from "firebase/firestore";

export interface ChildStatus {
  childId: string;
  childName: string;
  avatarId?: string;
  batteryPercent: number;
  charging: boolean;
  online: boolean;
  lastSeen: number;
  kidGuardActive: boolean;
  trackingEnabled: boolean;
  currentZone: string | null;
  deviceName?: string;
  appVersion?: string;
  androidVersion?: string;
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
}
