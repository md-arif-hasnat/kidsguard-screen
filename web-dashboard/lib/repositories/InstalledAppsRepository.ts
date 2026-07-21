import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

export interface InstalledApp {
  packageName: string;
  appName: string;
  installedAt: number;
  firstInstallTime: number;
  versionName: string;
  versionCode: number;
}

export class InstalledAppsRepository {
  static listenToInstalledApps(childId: string, onUpdate: (apps: InstalledApp[]) => void) {
    if (!db || !childId) return () => {};

    const appsRef = collection(db, "children", childId, "installedApps");
    const q = query(appsRef);

    return onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => doc.data() as InstalledApp);
      onUpdate(apps);
    }, (error) => {
      console.error("Error listening to installed apps:", error);
      onUpdate([]);
    });
  }
}
