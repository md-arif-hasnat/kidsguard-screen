import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, where, Timestamp } from "firebase/firestore";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  bearing: number;
  timestamp: number;
  batteryLevel?: number;
  source?: string;
}

export interface RouteSummary {
  childId: string;
  date: string;
  startTime: number;
  endTime: number;
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  maxSpeedKmh: number;
  averageSpeedKmh: number;
  stopsCount: number;
  safeZoneVisits: number;
  generatedAt: number;
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

  static listenToLocationHistoryByDate(childId: string, dateStr: string, onUpdate: (history: LocationPoint[]) => void) {
    if (!db || !childId) return () => {};

    // dateStr format: YYYY-MM-DD
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const locationsRef = collection(db, "children", childId, "locations");
    const q = query(
      locationsRef,
      where("timestamp", ">=", startOfDay.getTime()),
      where("timestamp", "<=", endOfDay.getTime()),
      orderBy("timestamp", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs
        .filter(doc => doc.id !== "latest")
        .map(doc => doc.data() as LocationPoint);
      onUpdate(history);
    }, (error) => {
      console.error("Error listening to filtered location history:", error);
      onUpdate([]);
    });
  }

  static listenToRouteSummary(childId: string, dateStr: string, onUpdate: (summary: RouteSummary | null) => void) {
    if (!db || !childId) return () => {};

    const summaryRef = doc(db, "children", childId, "routeSummaries", dateStr);
    return onSnapshot(summaryRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as RouteSummary);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to route summary:", error);
      onUpdate(null);
    });
  }
}
