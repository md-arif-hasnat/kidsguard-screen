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
    try {
      const ref = doc(db, "appConfig", "update");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        // Handle legacy field mapping if necessary
        return {
            ...data,
            mandatoryUpdate: data.mandatoryUpdate ?? data.forceUpdate ?? false,
            releaseChannel: data.releaseChannel || 'stable'
        } as UpdateConfig;
      }
      return null;
    } catch (error) {
      console.error("Error fetching update config:", error);
      return null;
    }
  }

  static async getRecentReleases(count: number = 5): Promise<AppRelease[]> {
    if (!db) return [];
    try {
      const ref = collection(db, "appReleases");
      const q = query(ref, orderBy("versionCode", "desc"), limit(count));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppRelease));
    } catch (error) {
      console.error("Error fetching releases:", error);
      return [];
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
