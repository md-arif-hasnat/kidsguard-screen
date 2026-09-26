import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

export type ReleaseChannel = 'stable' | 'beta' | 'alpha';
export type ReleaseStatus = 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'DEPRECATED';

export interface UpdateConfig {
  latestVersionCode: number;
  latestVersionName: string;
  apkDownloadUrl: string;
  mandatoryUpdate: boolean;
  releaseChannel: ReleaseChannel;
  updateMessage: string;
  releasedAt: any;
  fileSize: string;
  apkSha256: string;
  minimumAndroidVersion: string;
  releaseNotes: string | string[];
  webVersion?: string;
  webUpdateMessage?: string;
  webReleaseNotes?: string | string[];
}

export interface AppRelease extends UpdateConfig {
  id: string;
  status?: ReleaseStatus;
  createdAt?: any;
  updatedAt?: any;
  publishedAt?: any;
  deprecatedAt?: any;
  createdByUid?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByEmail?: string;
}

type ReleaseInput = Omit<UpdateConfig, 'releasedAt'>;
type ReleaseActor = { uid: string; email?: string | null };

export class ConfigRepository {
  static async getUpdateConfig(): Promise<UpdateConfig | null> {
    if (!db) return null;
    console.log("RELEASE_DEBUG: loading active config started");
    try {
      const ref = doc(db, "appConfig", "update");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        console.log("RELEASE_DEBUG: active config document not found");
        return null;
      }

      const data = snap.data();
      console.log("RELEASE_DEBUG: active config document received");
      return {
        ...data,
        mandatoryUpdate:
          data.mandatoryUpdate ?? data.forceUpdate ?? false,
        releaseChannel: data.releaseChannel || 'stable'
      } as UpdateConfig;
    } catch (error) {
      console.error("RELEASE_DEBUG: active config fetch failed", error);
      return null;
    }
  }

  static async getRecentReleases(
    count: number = 5
  ): Promise<AppRelease[]> {
    if (!db) return [];
    console.log("RELEASE_DEBUG: loading release history started");
    try {
      const ref = collection(db, "appReleases");
      const releasesQuery = query(
        ref,
        orderBy("latestVersionCode", "desc"),
        limit(count)
      );
      const snap = await getDocs(releasesQuery);
      return snap.docs.map(releaseDoc => {
        const data = releaseDoc.data();
        return {
          id: releaseDoc.id,
          ...data,
          status: data.status || 'PUBLISHED'
        } as AppRelease;
      });
    } catch (error) {
      console.error("RELEASE_DEBUG: release history fetch failed", error);
      return [];
    }
  }

  static async createRelease(
    release: ReleaseInput,
    status: ReleaseStatus,
    user: ReleaseActor
  ): Promise<void> {
    if (!db) throw new Error("Firebase is not configured.");
    if (status === 'DEPRECATED') {
      throw new Error("A new release cannot start as deprecated.");
    }

    const timestamp = serverTimestamp();
    const historyRef = doc(collection(db, "appReleases"));
    const releaseData = {
      ...release,
      status,
      releasedAt: status === 'PUBLISHED' ? timestamp : null,
      publishedAt: status === 'PUBLISHED' ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUid: user.uid,
      createdByEmail: user.email || "unknown",
      updatedByUid: user.uid,
      updatedByEmail: user.email || "unknown"
    };

    const batch = writeBatch(db);
    batch.set(historyRef, releaseData);

    if (status === 'PUBLISHED') {
      const activeRef = doc(db, "appConfig", "update");
      batch.set(
        activeRef,
        this.toActiveConfig(release, timestamp),
        { merge: true }
      );
    }

    await batch.commit();
  }

  static async updateReleaseStatus(
    releaseId: string,
    nextStatus: ReleaseStatus,
    user: ReleaseActor
  ): Promise<void> {
    if (!db) throw new Error("Firebase is not configured.");

    const releaseRef = doc(db, "appReleases", releaseId);
    const releaseSnap = await getDoc(releaseRef);
    if (!releaseSnap.exists()) {
      throw new Error("Release not found.");
    }

    const release = {
      id: releaseSnap.id,
      ...releaseSnap.data()
    } as AppRelease;
    const currentStatus = release.status || 'PUBLISHED';

    const allowedTransitions: Record<ReleaseStatus, ReleaseStatus[]> = {
      DRAFT: ['TESTING', 'PUBLISHED', 'DEPRECATED'],
      TESTING: ['PUBLISHED', 'DEPRECATED'],
      PUBLISHED: ['DEPRECATED'],
      DEPRECATED: []
    };
    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new Error(
        `Cannot change ${currentStatus} release to ${nextStatus}.`
      );
    }

    const activeRef = doc(db, "appConfig", "update");
    const activeSnap = await getDoc(activeRef);
    const active = activeSnap.exists()
      ? activeSnap.data() as UpdateConfig
      : null;

    if (
      nextStatus === 'DEPRECATED' &&
      active?.latestVersionCode === release.latestVersionCode
    ) {
      throw new Error(
        "Publish a newer release before deprecating the active release."
      );
    }

    const timestamp = serverTimestamp();
    const batch = writeBatch(db);
    const statusUpdate: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: timestamp,
      updatedByUid: user.uid,
      updatedByEmail: user.email || "unknown"
    };

    if (nextStatus === 'PUBLISHED') {
      statusUpdate.releasedAt = timestamp;
      statusUpdate.publishedAt = timestamp;
      batch.set(
        activeRef,
        this.toActiveConfig(release, timestamp),
        { merge: true }
      );
    }
    if (nextStatus === 'DEPRECATED') {
      statusUpdate.deprecatedAt = timestamp;
    }

    batch.update(releaseRef, statusUpdate);
    await batch.commit();
  }

  private static toActiveConfig(
    release: ReleaseInput,
    releasedAt: unknown
  ): UpdateConfig {
    return {
      latestVersionCode: release.latestVersionCode,
      latestVersionName: release.latestVersionName,
      apkDownloadUrl: release.apkDownloadUrl,
      apkSha256: release.apkSha256,
      mandatoryUpdate: release.mandatoryUpdate,
      releaseChannel: release.releaseChannel,
      updateMessage: release.updateMessage,
      releaseNotes: release.releaseNotes,
      fileSize: release.fileSize,
      minimumAndroidVersion: release.minimumAndroidVersion,
      webVersion: release.webVersion,
      webUpdateMessage: release.webUpdateMessage,
      webReleaseNotes: release.webReleaseNotes,
      releasedAt
    };
  }
}
