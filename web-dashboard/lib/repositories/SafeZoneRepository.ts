import { db } from "../firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

export type SafeZoneType = 'Home' | 'School' | 'Playground' | 'Relative House' | 'Custom';

export interface SafeZone {
  id: string;
  name: string;
  type: SafeZoneType;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  createdAt?: any;
}

export class SafeZoneRepository {
  static listenToSafeZones(familyId: string, onUpdate: (zones: SafeZone[]) => void) {
    if (!db || !familyId) return () => {};

    const zonesRef = collection(db, "families", familyId, "safeZones");
    return onSnapshot(zonesRef, (snapshot) => {
      const zones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SafeZone));
      onUpdate(zones);
    }, (error) => {
      console.error("Error listening to safe zones:", error);
      onUpdate([]);
    });
  }

  static async addSafeZone(familyId: string, zone: Omit<SafeZone, 'id' | 'createdAt'>): Promise<string> {
    if (!db) throw new Error("Firestore not initialized");
    const id = uuidv4();
    const zoneRef = doc(db, "families", familyId, "safeZones", id);
    await setDoc(zoneRef, {
      ...zone,
      id,
      createdAt: serverTimestamp()
    });
    return id;
  }

  static async updateSafeZone(familyId: string, zoneId: string, updates: Partial<SafeZone>): Promise<void> {
    if (!db) return;
    const zoneRef = doc(db, "families", familyId, "safeZones", zoneId);
    await updateDoc(zoneRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  static async deleteSafeZone(familyId: string, zoneId: string): Promise<void> {
    if (!db) return;
    const zoneRef = doc(db, "families", familyId, "safeZones", zoneId);
    await deleteDoc(zoneRef);
  }
}
