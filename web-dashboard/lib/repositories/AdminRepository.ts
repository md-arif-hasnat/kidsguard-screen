import { auth, db } from "../firebase";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  getCountFromServer,
  Timestamp,
  orderBy,
  limit,
  serverTimestamp,
  setDoc
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

export interface AdminDeviceHealth {
  childId: string;
  childName: string;
  familyId: string;
  deviceName?: string;
  online: boolean;
  lastSeen?: number;
  batteryPercent?: number;
  appVersion?: string;
  androidVersion?: string;
  syncHealthy?: boolean;
  syncFailureCount?: number;
  syncFailureSource?: string;
  syncErrorMessage?: string;
  locationPermissionGranted?: boolean;
  backgroundLocationPermissionGranted?: boolean;
  usageAccessGranted?: boolean;
  overlayPermissionGranted?: boolean;
  accessibilityPermissionGranted?: boolean;
  batteryOptimizationExempt?: boolean;
}

export interface AdminFamilyOverview {
  familyId: string;
  familyName: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  memberCount: number;
  managerCount: number;
  childCount: number;
  subscriptionStatus: string;
  childSlots: number;
  dataRetentionDays?: number;
  deletionStatus?: string;
  createdAt?: number;
  lastActiveDate?: string;
}

export type AdminIssueStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface AdminIssueTriage {
  fingerprint: string;
  status: AdminIssueStatus;
  updatedAt?: number;
  updatedBy?: string;
}

export interface AdminErrorReport {
  id: string;
  childId: string;
  familyId: string;
  deviceId?: string;
  tag: string;
  message: string;
  stackTrace?: string | null;
  fingerprint: string;
  capturedAt: number;
  appVersion?: string;
  versionCode?: number;
  androidVersion?: string;
  deviceModel?: string;
  status: string;
}

export class AdminRepository {
  static async getErrorReports(
    count: number = 200
  ): Promise<AdminErrorReport[]> {
    if (!db) throw new Error("Firestore not initialized");

    const reportsQuery = query(
      collectionGroup(db, "errorReports"),
      orderBy("capturedAt", "desc"),
      limit(count)
    );
    const snapshot = await getDocs(reportsQuery);

    return snapshot.docs.map(reportDocument => ({
      id: reportDocument.id,
      ...reportDocument.data()
    } as AdminErrorReport));
  }

  static async getIssueTriage(): Promise<Record<string, AdminIssueTriage>> {
    if (!db) throw new Error("Firestore not initialized");

    const snapshot = await getDocs(collection(db, "issueTriage"));
    return Object.fromEntries(snapshot.docs.map(triageDocument => {
      const data = triageDocument.data();
      const rawUpdatedAt = data.updatedAt;
      return [
        triageDocument.id,
        {
          fingerprint: data.fingerprint || triageDocument.id,
          status: data.status as AdminIssueStatus,
          updatedAt: typeof rawUpdatedAt === "number"
            ? rawUpdatedAt
            : rawUpdatedAt?.toMillis?.(),
          updatedBy: data.updatedBy
        }
      ];
    }));
  }

  static async setIssueStatus(
    fingerprint: string,
    status: AdminIssueStatus
  ): Promise<void> {
    if (!db) throw new Error("Firestore not initialized");
    const user = auth?.currentUser;
    if (!user) throw new Error("Admin authentication required");
    if (!fingerprint || fingerprint.length > 128 || fingerprint.includes("/")) {
      throw new Error("Invalid issue fingerprint");
    }

    await setDoc(
      doc(db, "issueTriage", fingerprint),
      {
        fingerprint,
        status,
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  static async getFamilyOverview(
    count: number = 200
  ): Promise<AdminFamilyOverview[]> {
    if (!db) throw new Error("Firestore not initialized");
    const database = db;

    const [familiesSnapshot, childrenSnapshot, parentsSnapshot] =
      await Promise.all([
        getDocs(query(collection(database, "families"), limit(count))),
        getDocs(query(collection(database, "children"), limit(1000))),
        getDocs(query(collection(database, "parents"), limit(1000)))
      ]);

    const childCounts = new Map<string, number>();
    childrenSnapshot.docs.forEach(childDocument => {
      const familyId = childDocument.data().familyId;
      if (typeof familyId === "string") {
        childCounts.set(familyId, (childCounts.get(familyId) || 0) + 1);
      }
    });

    const parentsById = new Map(
      parentsSnapshot.docs.map(parentDocument => [
        parentDocument.id,
        parentDocument.data()
      ])
    );

    return familiesSnapshot.docs.map(familyDocument => {
      const family = familyDocument.data();
      const owner = parentsById.get(family.ownerId) || {};
      const subscription = family.subscription || {};
      const rawCreatedAt = family.createdAt;

      return {
        familyId: familyDocument.id,
        familyName: family.settings?.name || family.name || "Unnamed family",
        ownerId: family.ownerId || "Unknown owner",
        ownerName: owner.displayName,
        ownerEmail: owner.email,
        memberCount: Array.isArray(family.memberUids)
          ? family.memberUids.length
          : Array.isArray(family.members)
            ? family.members.length
            : 0,
        managerCount: Array.isArray(family.managerUids)
          ? family.managerUids.length
          : 0,
        childCount: childCounts.get(familyDocument.id) || 0,
        subscriptionStatus: subscription.status || "UNKNOWN",
        childSlots:
          (subscription.baseChildSlots || 0) +
          (subscription.extraChildSlots || 0),
        dataRetentionDays: family.settings?.dataRetentionDays,
        deletionStatus: family.deletionStatus || "ACTIVE",
        createdAt: typeof rawCreatedAt === "number"
          ? rawCreatedAt
          : rawCreatedAt?.toMillis?.(),
        lastActiveDate: owner.lastActiveDate
      };
    });
  }

  static async getDeviceHealth(
    count: number = 200
  ): Promise<AdminDeviceHealth[]> {
    if (!db) throw new Error("Firestore not initialized");
    const database = db;

    const childrenQuery = query(
      collection(database, "children"),
      limit(count)
    );
    const childrenSnapshot = await getDocs(childrenQuery);

    return Promise.all(childrenSnapshot.docs.map(async childDocument => {
      const child = childDocument.data();
      const statusSnapshot = await getDoc(
        doc(database, "children", childDocument.id, "status", "current")
      );
      const status = statusSnapshot.exists()
        ? statusSnapshot.data()
        : {};

      const rawLastSeen = status.lastSeen;
      const lastSeen = typeof rawLastSeen === "number"
        ? rawLastSeen
        : rawLastSeen?.toMillis?.();

      return {
        childId: childDocument.id,
        childName: status.childName || child.name || child.childName || "Unknown child",
        familyId: child.familyId || "Unknown family",
        deviceName: status.deviceName,
        online: status.online === true,
        lastSeen,
        batteryPercent: status.batteryPercent,
        appVersion: status.appVersion,
        androidVersion: status.androidVersion,
        syncHealthy: status.syncHealthy,
        syncFailureCount: status.syncFailureCount,
        syncFailureSource: status.syncFailureSource,
        syncErrorMessage: status.syncErrorMessage,
        locationPermissionGranted: status.locationPermissionGranted,
        backgroundLocationPermissionGranted:
          status.backgroundLocationPermissionGranted,
        usageAccessGranted: status.usageAccessGranted,
        overlayPermissionGranted: status.overlayPermissionGranted,
        accessibilityPermissionGranted:
          status.accessibilityPermissionGranted,
        batteryOptimizationExempt: status.batteryOptimizationExempt
      };
    }));
  }

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
