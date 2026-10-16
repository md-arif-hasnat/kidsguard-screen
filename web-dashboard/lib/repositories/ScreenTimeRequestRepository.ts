import { db } from "../firebase";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";

export interface ScreenTimeRequest {
  requestId: string;
  childId: string;
  childName?: string;
  packageName: string;
  appName: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  requestedAt?: unknown;
  appUsageMinutes?: number;
  totalUsageMinutes?: number;
  currentDailyLimitMinutes?: number;
  currentTotalLimitMinutes?: number;
  grantedMinutes?: number;
}

export class ScreenTimeRequestRepository {
  static listen(
    childId: string,
    onUpdate: (requests: ScreenTimeRequest[]) => void
  ) {
    if (!db || !childId) {
      onUpdate([]);
      return () => {};
    }

    const requestsQuery = query(
      collection(db, "children", childId, "appAccessRequests"),
      orderBy("requestedAt", "desc"),
      limit(25)
    );

    return onSnapshot(
      requestsQuery,
      snapshot => {
        onUpdate(snapshot.docs.map(requestDoc => ({
          requestId: requestDoc.id,
          ...requestDoc.data()
        } as ScreenTimeRequest)));
      },
      error => {
        console.error("Failed to load screen-time requests", error);
        onUpdate([]);
      }
    );
  }

  static async resolve(
    childId: string,
    requestId: string,
    parentUid: string,
    status: "APPROVED" | "DENIED",
    grantedMinutes?: number
  ) {
    if (!db) throw new Error("Firebase is not configured.");
    const database = db;

    const minutes = Number(grantedMinutes || 0);
    if (
      status === "APPROVED" &&
      (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440)
    ) {
      throw new Error("Choose between 1 and 1440 minutes.");
    }

    const requestRef = doc(
      database,
      "children",
      childId,
      "appAccessRequests",
      requestId
    );

    await runTransaction(database, async transaction => {
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists()) {
        throw new Error("This request no longer exists.");
      }

      const request = requestSnapshot.data() as ScreenTimeRequest;
      if (request.status !== "PENDING") {
        throw new Error("This request has already been resolved.");
      }

      if (status === "DENIED") {
        transaction.update(requestRef, {
          status,
          reviewedBy: parentUid,
          reviewedAt: serverTimestamp()
        });
        return;
      }

      const packageName = String(request.packageName || "").trim();
      if (!packageName) {
        throw new Error("The request does not contain an app package.");
      }

      const controlRef = doc(
        database,
        "children",
        childId,
        "appControls",
        packageName.replace(/\./g, "_")
      );
      const controlSnapshot = await transaction.get(controlRef);
      const control = controlSnapshot.data() || {};
      const reason = String(request.reason || "").toUpperCase();

      let wellbeingRef: ReturnType<typeof doc> | null = null;
      let wellbeing: Record<string, unknown> = {};
      if (reason === "TOTAL_LIMIT_REACHED") {
        wellbeingRef = doc(
          database,
          "children",
          childId,
          "settings",
          "wellbeing"
        );
        const wellbeingSnapshot = await transaction.get(wellbeingRef);
        wellbeing = wellbeingSnapshot.data() || {};
      }

      const now = Date.now();
      const controlUpdate: Record<string, unknown> = {
        childId,
        packageName,
        appName: request.appName || packageName,
        temporaryAccessUntil: now + minutes * 60_000,
        overrideSource: "PARENT_SCREEN_TIME_APPROVAL",
        updatedAt: serverTimestamp(),
        updatedBy: parentUid,
        revision: Number(control.revision || 0) + 1,
        applyStatus: "PENDING"
      };

      if (reason === "LIMIT_REACHED") {
        const currentLimit = Number(
          control.dailyLimitMinutes || request.currentDailyLimitMinutes || 0
        );
        const currentUsage = Number(request.appUsageMinutes || 0);
        controlUpdate.dailyLimitMinutes =
          Math.max(currentLimit, currentUsage) + minutes;
      }

      transaction.set(controlRef, controlUpdate, { merge: true });

      if (wellbeingRef) {
        const currentLimit = Number(
          wellbeing.dailyTotalLimitMinutes ||
          request.currentTotalLimitMinutes ||
          0
        );
        const currentUsage = Number(request.totalUsageMinutes || 0);
        transaction.set(
          wellbeingRef,
          {
            totalLimitEnabled: true,
            dailyTotalLimitMinutes:
              Math.max(currentLimit, currentUsage) + minutes,
            lastRemoteOverrideAt: serverTimestamp(),
            lastRemoteOverrideBy: parentUid
          },
          { merge: true }
        );
      }

      transaction.update(requestRef, {
        status,
        grantedMinutes: minutes,
        accessUntil: now + minutes * 60_000,
        reviewedBy: parentUid,
        reviewedAt: serverTimestamp()
      });
    });
  }
}
