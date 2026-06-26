import { db, auth } from "../firebase";
import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  getDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";

export class SecurityRepository {
  static async deleteAccount(uid: string, familyId?: string | null): Promise<void> {
    if (!db || !uid) return;

    const batch = writeBatch(db);

    // 1. Delete parent profile
    batch.delete(doc(db, "parents", uid));

    await batch.commit();

    // 2. Delete from Auth
    const user = auth?.currentUser;
    if (user && user.uid === uid) {
      await deleteUser(user);
    }
  }

  /**
   * Part 3 - Data Export
   * Fetches all sensitive data for the family and returns a structured object.
   */
  static async exportAllFamilyData(familyId: string): Promise<any> {
    if (!db || !familyId) return null;

    const exportData: any = {
      exportedAt: new Date().toISOString(),
      family: {},
      children: [],
      auditLogs: []
    };

    // 1. Fetch Family Doc
    const familySnap = await getDoc(doc(db, "families", familyId));
    if (familySnap.exists()) {
        exportData.family = familySnap.data();
    }

    // 2. Fetch Audit Logs
    const logsSnap = await getDocs(query(collection(db, "auditLogs"), where("familyId", "==", familyId)));
    exportData.auditLogs = logsSnap.docs.map(d => d.data());

    // 3. Fetch Children Data
    const childIds = exportData.family.childDeviceIds || [];
    for (const childId of childIds) {
        const childObj: any = { id: childId, details: {}, status: {}, safeZones: [], activities: [] };

        const childSnap = await getDoc(doc(db, "children", childId));
        if (childSnap.exists()) childObj.details = childSnap.data();

        const statusSnap = await getDoc(doc(db, "children", childId, "status", "current"));
        if (statusSnap.exists()) childObj.status = statusSnap.data();

        const zonesSnap = await getDocs(collection(db, "children", childId, "safeZones"));
        childObj.safeZones = zonesSnap.docs.map(d => d.data());

        const activitiesSnap = await getDocs(query(collection(db, "children", childId, "activities"), orderBy("timestamp", "desc"), limit(100)));
        childObj.activities = activitiesSnap.docs.map(d => d.data());

        exportData.children.push(childObj);
    }

    return exportData;
  }
}
