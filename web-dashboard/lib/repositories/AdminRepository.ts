import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  getCountFromServer,
  Timestamp,
  orderBy,
  limit
} from "firebase/firestore";

export interface GlobalMetrics {
  totalFamilies: number;
  totalChildren: number;
  totalParents: number;
  totalSafeZones: number;
  totalRemoteCommands: number;
  dailyActiveParents: number;
  criticalSosToday: number;
}

export class AdminRepository {
  /**
   * Fetches global system metrics for the Admin Dashboard.
   * Uses getCountFromServer for cost efficiency where possible.
   */
  static async getGlobalMetrics(): Promise<GlobalMetrics> {
    if (!db) throw new Error("Firestore not initialized");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const [
      familiesCount,
      childrenCount,
      parentsCount,
      // Note: For deep subcollections like safeZones or remoteCommands,
      // we'd ideally use a Cloud Function aggregator, but for MVP/Beta
      // we'll use document counting if volume is low or mock it.
    ] = await Promise.all([
      getCountFromServer(collection(db, "families")),
      getCountFromServer(collection(db, "children")),
      getCountFromServer(collection(db, "parents")),
    ]);

    // Daily Active Parents (active today)
    const todayStr = new Date().toISOString().split('T')[0];
    const activeParentsQuery = query(
      collection(db, "parents"),
      where("lastActiveDate", "==", todayStr)
    );
    const activeParentsCount = await getCountFromServer(activeParentsQuery);

    return {
      totalFamilies: familiesCount.data().count,
      totalChildren: childrenCount.data().count,
      totalParents: parentsCount.data().count,
      totalSafeZones: 0, // Requires aggregator
      totalRemoteCommands: 0, // Requires aggregator
      dailyActiveParents: activeParentsCount.data().count,
      criticalSosToday: 0 // Mock for now
    };
  }

  static async getRecentAuditLogs(count: number = 20) {
    if (!db) return [];
    const q = query(
      collection(db, "auditLogs"),
      orderBy("createdAt", "desc"),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
