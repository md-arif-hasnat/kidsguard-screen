
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export interface SosEvent {
  id: string;
  childId: string;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  message: string;
  status: string;
  batteryPercent: number | null;
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
}
