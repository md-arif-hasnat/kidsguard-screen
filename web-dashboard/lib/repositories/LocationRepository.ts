import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, where, Timestamp, getDoc } from "firebase/firestore";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  bearing: number;
  timestamp: number;
  batteryLevel?: number;
  source?: string;
  fullAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  address?: string; // Legacy field
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

    // Use unified devices collection for latest status as primary source
    const deviceRef = doc(db, "devices", childId);
    return onSnapshot(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log("RAW_LATEST_LOCATION_DOC", snapshot.id, data);
        if (data.currentLocation) {
            onUpdate({
                latitude: data.currentLocation.latitude,
                longitude: data.currentLocation.longitude,
                accuracy: data.currentLocation.accuracy,
                timestamp: data.currentLocation.updatedAt?.toMillis() || Date.now(),
                speed: data.currentLocation.speed || 0,
                bearing: data.currentLocation.bearing || 0,
                fullAddress: data.currentLocation.fullAddress || data.currentLocation.address,
                street: data.currentLocation.street,
                city: data.currentLocation.city,
                state: data.currentLocation.state,
                country: data.currentLocation.country,
                postalCode: data.currentLocation.postalCode
            } as LocationPoint);
            return;
        }
      }

      // Fallback to children collection if not found in devices
      if (db) {
        const latestRef = doc(db, "children", childId, "locations", "latest");
        getDoc(latestRef).then(snap => {
            if (snap.exists()) {
                onUpdate(snap.data() as LocationPoint);
            } else {
                onUpdate(null);
            }
        });
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
        .map(doc => {
            const data = doc.data();
            console.log("RAW_LOCATION_HISTORY_DOC", doc.id, data);
            return {
                ...data,
                fullAddress: data.fullAddress ?? data.address ?? null
            } as LocationPoint;
        });
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
        .map(doc => {
            const data = doc.data();
            console.log("RAW_LOCATION_HISTORY_DOC", doc.id, data);
            return {
                ...data,
                fullAddress: data.fullAddress ?? data.address ?? null
            } as LocationPoint;
        });
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
