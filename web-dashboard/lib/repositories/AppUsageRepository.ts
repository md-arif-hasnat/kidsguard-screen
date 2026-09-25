import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot, getDocs, Timestamp } from "firebase/firestore";

export type ScreenTimeSummary = {
  todayMs: number;
  yesterdayMs: number;
  avg7DayMs: number;
  recordedDays: number;
};

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
  static subscribeToScreenTimeSummary(
    childId: string,
    callback: (summary: ScreenTimeSummary) => void
  ) {
    if (!db || !childId) {
      callback({
        todayMs: 0,
        yesterdayMs: 0,
        avg7DayMs: 0,
        recordedDays: 0
      });
      return () => {};
    }

    const totals = Array<number>(7).fill(0);
    const hasRecords = Array<boolean>(7).fill(false);
    const ready = new Set<number>();

    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const publish = () => {
      if (ready.size < 7) return;
      const recordedDays = hasRecords.filter(Boolean).length;
      const recordedTotal = totals.reduce(
        (sum, total, index) =>
          sum + (hasRecords[index] ? total : 0),
        0
      );

      callback({
        todayMs: totals[0],
        yesterdayMs: totals[1],
        avg7DayMs:
          recordedDays > 0
            ? Math.round(recordedTotal / recordedDays)
            : 0,
        recordedDays
      });
    };

    const unsubscribers = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - index);
      const dateKey = formatLocalDate(date);
      const appsRef = collection(
        db!,
        "children",
        childId,
        "appUsage",
        dateKey,
        "apps"
      );

      return onSnapshot(
        appsRef,
        snapshot => {
          totals[index] = snapshot.docs.reduce(
            (sum, document) =>
              sum + Number(document.data().totalTimeMs || 0),
            0
          );
          hasRecords[index] = snapshot.docs.length > 0;
          ready.add(index);
          publish();
        },
        error => {
          console.error(
            `Error loading screen time for ${dateKey}:`,
            error
          );
          totals[index] = 0;
          hasRecords[index] = false;
          ready.add(index);
          publish();
        }
      );
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }

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
