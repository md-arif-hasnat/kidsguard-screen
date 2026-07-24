import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FamilyRole } from "./FamilyRepository";
import { RoleHelper } from "../utils/RoleHelper";
import { PermissionError } from "./ChildRepository";

export interface InstalledApp {
  packageName: string;
  appName: string;
  installedAt: number;
  firstInstallTime: number;
  versionName: string;
  versionCode: number;
}

export interface AppControl {
  childId: string;
  packageName: string;
  appName: string;
  blocked: boolean;
  dailyLimitMinutes: number | null;
  createdAt?: any;
  updatedAt?: any;
  updatedBy: string;
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

  static listenToAppControls(childId: string, onUpdate: (controls: Record<string, AppControl>) => void) {
    if (!db || !childId) return () => {};

    const controlsRef = collection(db, "children", childId, "appControls");

    return onSnapshot(controlsRef, (snapshot) => {
      const controls: Record<string, AppControl> = {};
      snapshot.docs.forEach(doc => {
        controls[doc.id] = doc.data() as AppControl;
      });
      onUpdate(controls);
    }, (error) => {
      console.error("Error listening to app controls:", error);
      onUpdate({});
    });
  }

  static async updateAppControl(childId: string, parentUid: string, control: Partial<AppControl> & { packageName: string, appName: string }, callerRole?: FamilyRole) {
    if (callerRole && !RoleHelper.canManageChildren(callerRole)) throw new PermissionError();
    if (!db || !childId) return;

    // Sanitize package name for document ID
    const docId = control.packageName.replace(/\./g, "_");
    const controlRef = doc(db, "children", childId, "appControls", docId);

    const data = {
      ...control,
      childId,
      updatedAt: serverTimestamp(),
      updatedBy: parentUid
    };

    // If it's a new control, add createdAt
    await setDoc(controlRef, data, { merge: true });
  }

  static async deleteAppControl(childId: string, packageName: string, callerRole?: FamilyRole) {
    if (callerRole && !RoleHelper.canManageChildren(callerRole)) throw new PermissionError();
    if (!db || !childId) return;
    const docId = packageName.replace(/\./g, "_");
    const controlRef = doc(db, "children", childId, "appControls", docId);
    await deleteDoc(controlRef);
  }
}
