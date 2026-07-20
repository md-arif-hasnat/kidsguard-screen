
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";

export interface SosEvent {
  id: string;
  alertId?: string; // Standardized
  childId: string;
  familyId?: string;
  childName?: string;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy?: number | null; // Standardized
  accuracy?: number | null; // Legacy
  message: string;
  status: string;
  active: boolean;
  batteryPercent: number | null;
  createdAt?: number | null;
  resolvedAt?: number | null;
  locationTimestamp?: number | null;
  address?: string;
  // ... rest
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  resolvedBy?: string;
  resolvedByUid?: string;
  updatedAt?: any;
}

export class SosRepository {
  static listenToSosEvents(childId: string, onUpdate: (events: SosEvent[]) => void) {
    if (!db || !childId) return () => {};

    // We can listen to specific child SOS or use a collection group if needed.
    // Based on FirebaseConfig.COL_CHILDREN/status structure, it might be in children/{id}/sos
    // But the prompt says children/{childId}/activity/{activityId} for general events.
    // Let's assume a similar structure or use the one from ARCHITECTURE.md

    const sosRef = collection(db, "children", childId, "sosEvents");
    // Use a simpler query first to avoid index issues if timestamp is missing or index not ready
    const q = query(sosRef, limit(20));

    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp || data.createdAt || Date.now();
        return {
          id: doc.id,
          ...data,
          timestamp
        } as SosEvent;
      }).sort((a, b) => b.timestamp - a.timestamp);

      onUpdate(events);
    }, (error) => {
      console.error("Error listening to SOS events:", error);
      onUpdate([]);
    });
  }

  static async updateSosAddress(childId: string, eventId: string, addressData: Partial<SosEvent>) {
    if (!db || !childId || !eventId) return;
    const ref = doc(db, "children", childId, "sosEvents", eventId);
    await updateDoc(ref, addressData);
  }

  static async resolveSos(childId: string, eventId: string, resolvedByUid: string) {
    if (!db || !childId || !eventId) return;
    const ref = doc(db, "children", childId, "sosEvents", eventId);
    await updateDoc(ref, {
      status: "RESOLVED",
      active: false,
      resolvedBy: "PARENT",
      resolvedByUid: resolvedByUid,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  static listenToFamilySosEvents(childIds: string[], onUpdate: (events: SosEvent[]) => void) {
    if (!db || !childIds || childIds.length === 0) {
      onUpdate([]);
      return () => {};
    }

    const eventMap = new Map<string, SosEvent>();
    const unsubscribes: (() => void)[] = [];

    childIds.forEach(childId => {
      const sosRef = collection(db!, "children", childId, "sosEvents");
      // Removing explicit orderBy on Firestore side to avoid missing index failures
      const q = query(sosRef, limit(50));

      console.log(`WEB SosSync: Listening to path: children/${childId}/sosEvents`);

      const unsub = onSnapshot(q, (snapshot) => {
        console.log(`WEB SosSync: Received update for child ${childId}. Docs: ${snapshot.size}`);

        // Remove old events for this child to ensure fresh data from this snapshot
        eventMap.forEach((event, id) => {
          if (event.childId === childId) {
            eventMap.delete(id);
          }
        });

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Canonical logic: Ensure timestamp exists for sorting, fallback to createdAt
          const timestamp = data.timestamp || data.createdAt || Date.now();
          eventMap.set(doc.id, {
            id: doc.id,
            ...data,
            timestamp // Normalize the timestamp field
          } as SosEvent);
        });

        const sortedEvents = Array.from(eventMap.values())
          .sort((a, b) => b.timestamp - a.timestamp);

        onUpdate(sortedEvents);
      }, (error) => {
        console.error(`Error listening to SOS events for child ${childId}:`, error);
      });

      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }
}
