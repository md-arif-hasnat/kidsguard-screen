import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot, getDocs, Timestamp } from "firebase/firestore";

export type AppUsageItem = {
  id: string;
  appName: string;
  packageName: string;
  totalTimeMs: number;
  lastUsed: number;
  date: string;
  category?: string;
};

export class AppUsageRepository {
  /**
   * Helper to normalize lastUsed which can be number or Timestamp
   */
  private static normalizeTimestamp(value: any): number {
    if (value instanceof Timestamp) {
      return value.toMillis();
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }

  static async getChildAppUsageForDate(childId: string, date: string): Promise<AppUsageItem[]> {
    if (!db || !childId || !date) return [];

    const appsRef = collection(db, "children", childId, "appUsage", date, "apps");
    const q = query(appsRef, orderBy("totalTimeMs", "desc"));

    try {
      const snap = await getDocs(q);
      return snap.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            appName: data.appName || 'Unknown',
            packageName: data.packageName || '',
            totalTimeMs: data.totalTimeMs || 0,
            lastUsed: this.normalizeTimestamp(data.lastUsed),
            date: data.date || date,
            category: data.category
          } as AppUsageItem;
        })
        .filter(app => app.totalTimeMs > 0);
    } catch (error) {
      console.error("Error fetching app usage:", error);
      return [];
    }
  }

  static subscribeToChildAppUsageForDate(
    childId: string,
    date: string,
    callback: (apps: AppUsageItem[]) => void
  ) {
    if (!db || !childId || !date) {
      callback([]);
      return () => {};
    }

    const appsRef = collection(db, "children", childId, "appUsage", date, "apps");
    const q = query(appsRef, orderBy("totalTimeMs", "desc"));

    return onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            appName: data.appName || 'Unknown',
            packageName: data.packageName || '',
            totalTimeMs: data.totalTimeMs || 0,
            lastUsed: this.normalizeTimestamp(data.lastUsed),
            date: data.date || date,
            category: data.category
          } as AppUsageItem;
        })
        .filter(app => app.totalTimeMs > 0);
      callback(apps);
    }, (error) => {
      console.error("Error subscribing to app usage:", error);
      callback([]);
    });
  }
}
