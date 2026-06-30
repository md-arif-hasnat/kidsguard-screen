import { db } from "../firebase";
import { doc, getDoc, collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";

export type ReleaseChannel = 'stable' | 'beta' | 'alpha';

export interface UpdateConfig {
  latestVersionCode: number;
  latestVersionName: string;
  apkDownloadUrl: string;
  mandatoryUpdate: boolean; // Renamed from forceUpdate to match requirements
  releaseChannel: ReleaseChannel;
  updateMessage: string;
  releasedAt: any;
  fileSize: string;
  minimumAndroidVersion: string;
  releaseNotes: string | string[]; // Support both formats
  webVersion?: string;
  webUpdateMessage?: string;
  webReleaseNotes?: string | string[];
}

export interface AppRelease extends UpdateConfig {
  id: string;
}

export class ConfigRepository {
  static async getUpdateConfig(): Promise<UpdateConfig | null> {
    if (!db) return null;
    console.log("RELEASE_DEBUG: loading active config started");
    try {
      const ref = doc(db, "appConfig", "update");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        console.log("RELEASE_DEBUG: active config document received");
        // Handle legacy field mapping if necessary
        return {
            ...data,
            mandatoryUpdate: data.mandatoryUpdate ?? data.forceUpdate ?? false,
            releaseChannel: data.releaseChannel || 'stable'
        } as UpdateConfig;
      }
      console.log("RELEASE_DEBUG: active config document not found");
      return null;
    } catch (error) {
      console.error("RELEASE_DEBUG: active config fetch failed", error);
      return null;
    }
  }

  static async getRecentReleases(count: number = 5): Promise<AppRelease[]> {
    if (!db) return [];
    console.log("RELEASE_DEBUG: loading release history started");
    try {
      const ref = collection(db, "appReleases");
      // Use latestVersionCode as defined in the interface
      const q = query(ref, orderBy("latestVersionCode", "desc"), limit(count));
      const snap = await getDocs(q);

      console.log(`RELEASE_DEBUG: snapshot size: ${snap.size}`);

      if (snap.empty) {
          console.log("RELEASE_DEBUG: no releases found in history");
          return [];
      }

      const releases = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppRelease));
      console.log("RELEASE_DEBUG: documents received", releases.length);
      return releases;
    } catch (error) {
      console.error("RELEASE_DEBUG: release history fetch failed", error);
      return [];
    } finally {
        console.log("RELEASE_DEBUG: loading finished");
    }
  }

  static async publishRelease(release: Omit<UpdateConfig, 'releasedAt'>, user: { uid: string, email?: string | null }): Promise<void> {
    if (!db) return;

    const timestamp = serverTimestamp();
    const releaseData = {
        ...release,
        releasedAt: timestamp,
        createdAt: timestamp,
        createdByUid: user.uid,
        createdByEmail: user.email || "unknown"
    };

    // 1. Add to history
    const historyRef = doc(collection(db, "appReleases"));
    await setDoc(historyRef, releaseData);

    // 2. Update current active config
    const activeRef = doc(db, "appConfig", "update");
    await setDoc(activeRef, releaseData, { merge: true });
  }
}
