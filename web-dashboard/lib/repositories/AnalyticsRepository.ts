import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, where, getDocs, Timestamp } from "firebase/firestore";

export interface DeviceAnalytics {
  id: string;
  date: string; // YYYY-MM-DD
  onlineMinutes: number;
  movementMinutes: number;
  stationaryMinutes: number;
  distanceTravelledMeters: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  safeZoneVisits: number;
  alertCount: number;
  safetyScore: number;
  batteryHistory: Array<{ t: number, p: number, c: boolean }>;
  connectionHistory: Array<{ t: number, s: 'ONLINE' | 'OFFLINE' | 'INTERNET_LOST' | 'GPS_LOST' }>;
}

export class AnalyticsRepository {
  static listenToDailyAnalytics(childId: string, date: string, onUpdate: (data: DeviceAnalytics | null) => void) {
    if (!db || !childId) return () => {};

    const ref = doc(db, "children", childId, "analytics", date);
    return onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ id: snapshot.id, ...snapshot.data() } as DeviceAnalytics);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to analytics:", error);
      onUpdate(null);
    });
  }

  static async getAnalyticsRange(childId: string, startDate: string, endDate: string): Promise<DeviceAnalytics[]> {
    if (!db || !childId) return [];

    const ref = collection(db, "children", childId, "analytics");
    const q = query(
        ref,
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "asc")
    );

    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeviceAnalytics));
  }
}
