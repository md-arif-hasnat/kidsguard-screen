import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export interface UpdateConfig {
  latestVersionCode: number;
  latestVersionName: string;
  apkDownloadUrl: string;
  forceUpdate: boolean;
  updateMessage: string;
  releasedAt: any;
  fileSize: string;
  minimumAndroidVersion: string;
  releaseNotes: string;
}

export class ConfigRepository {
  static async getUpdateConfig(): Promise<UpdateConfig | null> {
    if (!db) return null;
    try {
      const ref = doc(db, "appConfig", "update");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as UpdateConfig;
      }
      return null;
    } catch (error) {
      console.error("Error fetching update config:", error);
      return null;
    }
  }
}
