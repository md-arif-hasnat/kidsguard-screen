import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

export interface RouteDeviation {
  id: string;
  childId: string;
  latitude: number;
  longitude: number;
  message: string;
  timestamp: number;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high';
}

export class DeviationRepository {
  static listenToDeviations(childId: string, onUpdate: (deviations: RouteDeviation[]) => void) {
    if (!db || !childId) return () => {};

    const devRef = collection(db, "children", childId, "routeDeviations");
    const q = query(devRef, orderBy("timestamp", "desc"), limit(10));

    return onSnapshot(q, (snapshot) => {
      const deviations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RouteDeviation));
      onUpdate(deviations);
    }, (error) => {
      console.error("Error listening to deviations:", error);
      onUpdate([]);
    });
  }
}
