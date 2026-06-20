import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  bearing: number;
  timestamp: number;
}

export class LocationRepository {
  static listenToLatestLocation(childId: string, onUpdate: (location: LocationPoint | null) => void) {
    if (!db || !childId) return () => {};

    const latestRef = doc(db, "children", childId, "locations", "latest");
    return onSnapshot(latestRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as LocationPoint);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to latest location:", error);
      onUpdate(null);
    });
  }

  static listenToLocationHistory(childId: string, onUpdate: (history: LocationPoint[]) => void) {
    if (!db || !childId) return () => {};

    const locationsRef = collection(db, "children", childId, "locations");
    const q = query(locationsRef, orderBy("timestamp", "desc"), limit(100));

    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs
        .filter(doc => doc.id !== "latest")
        .map(doc => doc.data() as LocationPoint);
      onUpdate(history);
    }, (error) => {
      console.error("Error listening to location history:", error);
      onUpdate([]);
    });
  }
}
