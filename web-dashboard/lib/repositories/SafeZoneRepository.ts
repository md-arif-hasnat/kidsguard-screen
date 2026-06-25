import { db } from "../firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { AuditRepository, AuditAction } from "./AuditRepository";

export type SafeZoneType = 'Home' | 'School' | 'Playground' | 'Relative House' | 'Custom';

export interface SafeZone {
  id: string;
  childId?: string;
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
  updatedAt?: any;
}

export class SafeZoneRepository {
  /**
   * Listens to safe zones for a specific child.
   * Merges legacy family-level zones and new child-specific zones.
   */
  static listenToChildSafeZones(childId: string, familyId: string, onUpdate: (zones: SafeZone[]) => void) {
    if (!db) return () => {};

    const familyZonesRef = collection(db, "families", familyId, "safeZones");
    const childZonesRef = collection(db, "children", childId, "safeZones");

    let familyZones: SafeZone[] = [];
    let childZones: SafeZone[] = [];

    const triggerUpdate = () => {
      // Merge zones, child-specific zones take priority if IDs collide
      const merged = [...familyZones];
      childZones.forEach(cz => {
        const index = merged.findIndex(fz => fz.id === cz.id);
        if (index > -1) {
          merged[index] = cz;
        } else {
          merged.push(cz);
        }
      });
      onUpdate(merged);
    };

    const unsubFamily = onSnapshot(familyZonesRef, (snapshot) => {
      familyZones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeZone));
      triggerUpdate();
    }, (error) => {
      console.error("Error listening to family zones:", error);
    });

    const unsubChild = onSnapshot(childZonesRef, (snapshot) => {
      childZones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeZone));
      triggerUpdate();
    }, (error) => {
      console.error("Error listening to child zones:", error);
    });

    return () => {
      unsubFamily();
      unsubChild();
    };
  }

  static async addSafeZone(childId: string, zone: Omit<SafeZone, 'id' | 'createdAt'>): Promise<string> {
    if (!db) throw new Error("Firestore not initialized");
    const id = uuidv4();
    const zoneRef = doc(db, "children", childId, "safeZones", id);
    await setDoc(zoneRef, {
      ...zone,
      id,
      childId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await AuditRepository.log({
      familyId: localStorage.getItem("kidsguard_family_id") || "unknown",
      actorUid: "current_user",
      actorName: "Parent",
      action: AuditAction.SAFE_ZONE_EDITED,
      targetId: childId,
      details: `Added safe zone: ${zone.name}`
    });

    return id;
  }

  static async updateSafeZone(childId: string, zoneId: string, updates: Partial<SafeZone>): Promise<void> {
    if (!db) return;
    const zoneRef = doc(db, "children", childId, "safeZones", zoneId);
    await updateDoc(zoneRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    await AuditRepository.log({
      familyId: localStorage.getItem("kidsguard_family_id") || "unknown",
      actorUid: "current_user",
      actorName: "Parent",
      action: AuditAction.SAFE_ZONE_EDITED,
      targetId: childId,
      details: `Updated safe zone: ${updates.name || zoneId}`
    });
  }

  static async deleteSafeZone(childId: string, zoneId: string): Promise<void> {
    if (!db) return;
    const zoneRef = doc(db, "children", childId, "safeZones", zoneId);
    await deleteDoc(zoneRef);

    await AuditRepository.log({
      familyId: localStorage.getItem("kidsguard_family_id") || "unknown",
      actorUid: "current_user",
      actorName: "Parent",
      action: AuditAction.SAFE_ZONE_EDITED,
      targetId: childId,
      details: `Deleted safe zone: ${zoneId}`
    });
  }

  // Keep legacy for backward compatibility if needed temporarily
  static listenToSafeZones(familyId: string, onUpdate: (zones: SafeZone[]) => void) {
    if (!db || !familyId) return () => {};
    const zonesRef = collection(db, "families", familyId, "safeZones");
    return onSnapshot(zonesRef, (snapshot) => {
      onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeZone)));
    });
  }
}
