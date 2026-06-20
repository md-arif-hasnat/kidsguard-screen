import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export interface SafeZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
}

export class SafeZoneRepository {
  static listenToSafeZones(familyId: string, onUpdate: (zones: SafeZone[]) => void) {
    if (!db || !familyId) return () => {};

    const zonesRef = collection(db, "safeZones", familyId);
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
}
