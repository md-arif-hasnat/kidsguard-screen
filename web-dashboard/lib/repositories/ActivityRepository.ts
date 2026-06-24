import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export interface ActivityEvent {
  id: string;
  childId: string;
  type: string;
  title: string;
  description: string;
  zoneId?: string;
  zoneName?: string;
  zoneType?: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
  severity: 'info' | 'warning';
}

export class ActivityRepository {
  static listenToActivity(childId: string, onUpdate: (events: ActivityEvent[]) => void) {
    if (!db || !childId) return () => {};

    const activityRef = collection(db, "children", childId, "activities");
    const q = query(activityRef, orderBy("timestamp", "desc"), limit(50));

    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityEvent));
      onUpdate(events);
    }, (error) => {
      console.error("Error listening to activity:", error);
      onUpdate([]);
    });
  }
}
