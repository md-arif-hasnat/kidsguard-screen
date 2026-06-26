import { db } from "../firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";

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

  static async addSafeZone(childId: string, familyId: string, zone: Omit<SafeZone, 'id' | 'createdAt'>): Promise<string> {
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
      actorUid: "current_user",
      actorEmail: "parent",
      familyId,
      action: AuditAction.SAFE_ZONE_CREATED,
      targetType: 'ZONE',
      targetId: id,
      childId: childId,
      severity: AuditSeverity.INFO,
      metadata: { name: zone.name }
    });

    return id;
  }

  static async updateSafeZone(childId: string, familyId: string, zoneId: string, updates: Partial<SafeZone>): Promise<void> {
    if (!db) return;
    const zoneRef = doc(db, "children", childId, "safeZones", zoneId);
    await updateDoc(zoneRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    await AuditRepository.log({
      actorUid: "current_user",
      actorEmail: "parent",
      familyId,
      action: AuditAction.SAFE_ZONE_EDITED,
      targetType: 'ZONE',
      targetId: zoneId,
      childId: childId,
      severity: AuditSeverity.INFO,
      metadata: { updates }
    });
  }

  static async deleteSafeZone(childId: string, familyId: string, zoneId: string): Promise<void> {
    if (!db) return;
    const zoneRef = doc(db, "children", childId, "safeZones", zoneId);
    await deleteDoc(zoneRef);

    await AuditRepository.log({
      actorUid: "current_user",
      actorEmail: "parent",
      familyId,
      action: AuditAction.SAFE_ZONE_DELETED,
      targetType: 'ZONE',
      targetId: zoneId,
      childId: childId,
      severity: AuditSeverity.WARNING
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
