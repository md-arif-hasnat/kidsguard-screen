
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";

export interface SosEvent {
  id: string;
  childId: string;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  message: string;
  status: string;
  active: boolean;
  batteryPercent: number | null;
  createdAt?: number | null;
  resolvedAt?: number | null;
  address?: string;
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
    const q = query(sosRef, orderBy("timestamp", "desc"), limit(10));

    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SosEvent));
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
      const q = query(sosRef, orderBy("timestamp", "desc"), limit(20));

      const unsub = onSnapshot(q, (snapshot) => {
        // Remove old events for this child to ensure fresh data from this snapshot
        eventMap.forEach((event, id) => {
          if (event.childId === childId) {
            eventMap.delete(id);
          }
        });

        snapshot.docs.forEach(doc => {
          eventMap.set(doc.id, {
            id: doc.id,
            ...doc.data()
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
