import { auth, db } from "../firebase";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

export interface WeeklyChildReport {
  childId: string;
  childName: string;
  screenTimeMs: number;
  previousScreenTimeMs: number;
  youtubeViews: number;
  browserVisits: number;
  installedApps: number;
  blockedAttempts: number;
  deviceOnline: boolean;
  topApps: Array<{
    appName: string;
    packageName: string;
    totalTimeMs: number;
  }>;
}

export interface WeeklySafetyReport {
  id: string;
  familyId: string;
  periodStart: number;
  periodEnd: number;
  generatedAt: unknown;
  childReports: WeeklyChildReport[];
  totals: {
    screenTimeMs: number;
    previousScreenTimeMs: number;
    screenTimeChangePercent: number;
    youtubeViews: number;
    browserVisits: number;
    installedApps: number;
    blockedAttempts: number;
    safetyAlerts: number;
    offlineDevices: number;
  };
  highlights: string[];
}

export class WeeklyReportRepository {
  static listen(
    familyId: string,
    onUpdate: (reports: WeeklySafetyReport[]) => void,
    onError?: (error: Error) => void
  ) {
    if (!db || !familyId) {
      onUpdate([]);
      return () => {};
    }

    const reportsQuery = query(
      collection(db, "families", familyId, "weeklyReports"),
      orderBy("periodEnd", "desc"),
      limit(12)
    );

    return onSnapshot(reportsQuery, snapshot => {
      onUpdate(snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      } as WeeklySafetyReport)));
    }, error => {
      console.error("Weekly reports could not be loaded:", error);
      onUpdate([]);
      onError?.(error);
    });
  }

  static async generateNow(familyId: string): Promise<string> {
    const user = auth?.currentUser;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!user || !projectId) throw new Error("Authenticated Firebase user required");
    const token = await user.getIdToken();
    const response = await fetch(
      `https://us-central1-${projectId}.cloudfunctions.net/generateWeeklySafetyReportNow`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data: { familyId } })
      }
    );
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message || "Report generation failed");
    }
    return payload.result?.reportId || payload.data?.reportId;
  }
}
