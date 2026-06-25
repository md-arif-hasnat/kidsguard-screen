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
  orderBy
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";

export class SecurityRepository {
  static async deleteAccount(uid: string, familyId?: string | null): Promise<void> {
    if (!db || !uid) return;

    const batch = writeBatch(db);

    // 1. Delete parent profile
    batch.delete(doc(db, "parents", uid));

    // 2. Remove from audit logs actor
    // (Logs usually persist for compliance but we could anonymize)

    await batch.commit();

    // 3. Delete from Auth
    const user = auth?.currentUser;
    if (user && user.uid === uid) {
      await deleteUser(user);
    }
  }

  static async exportAllData(uid: string, familyId: string): Promise<any> {
    if (!db) return null;

    const exportData: any = {
      exportedAt: new Date().toISOString(),
      profile: {},
      family: {},
      auditLogs: [],
      children: []
    };

    // Fetch Profile
    const profileSnap = await getDoc(doc(db, "parents", uid));
    if (profileSnap.exists()) exportData.profile = profileSnap.data();

    // Fetch Family
    const familySnap = await getDoc(doc(db, "families", familyId));
    if (familySnap.exists()) {
        exportData.family = familySnap.data();

        // Fetch Audit Logs
        const logsSnap = await getDocs(query(collection(db, "auditLogs"), where("familyId", "==", familyId)));
        exportData.auditLogs = logsSnap.docs.map(d => d.data());

        // Fetch Children Data (Summary)
        const childrenIds = exportData.family.childDeviceIds || [];
        for (const childId of childrenIds) {
            const childSnap = await getDoc(doc(db, "children", childId));
            if (childSnap.exists()) {
                exportData.children.push({
                    info: childSnap.data(),
                    // In a full export, we'd loop through locations, activities etc.
                    // For MVP we just export the main records.
                });
            }
        }
    }

    return exportData;
  }
}
