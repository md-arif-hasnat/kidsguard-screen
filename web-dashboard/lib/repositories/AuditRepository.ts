import { db } from "../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from "firebase/firestore";

export enum AuditAction {
  MEMBER_INVITED = "MEMBER_INVITED",
  ROLE_CHANGED = "ROLE_CHANGED",
  SAFE_ZONE_EDITED = "SAFE_ZONE_EDITED",
  REMOTE_COMMAND_SENT = "REMOTE_COMMAND_SENT",
  CHILD_PAIRED = "CHILD_PAIRED",
  CHILD_REMOVED = "CHILD_REMOVED",
  SETTINGS_CHANGED = "SETTINGS_CHANGED",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  DATA_EXPORTED = "DATA_EXPORTED",
  MEMBER_REMOVED = "MEMBER_REMOVED",
  MEMBER_JOINED = "MEMBER_JOINED"
}

export interface AuditLog {
  id?: string;
  familyId: string;
  actorUid: string;
  actorName: string;
  action: AuditAction;
  targetId?: string; // childId, memberUid, etc.
  details: string;
  timestamp: any;
  ip?: string;
  userAgent?: string;
}

export class AuditRepository {
  static async log(log: Omit<AuditLog, "id" | "timestamp">) {
    if (!db) return;
    try {
      await addDoc(collection(db, "auditLogs"), {
        ...log,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Audit logging failed", e);
    }
  }

  static listenToFamilyLogs(familyId: string, onUpdate: (logs: AuditLog[]) => void, onError?: (error: any) => void) {
    if (!db || !familyId) return () => {};
    const q = query(
      collection(db, "auditLogs"),
      where("familyId", "==", familyId),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (err) => {
      console.error("Error listening to audit logs:", err);
      if (onError) onError(err);
    });
  }

  static async getLogsForExport(familyId: string): Promise<AuditLog[]> {
    if (!db) return [];
    const q = query(
      collection(db, "auditLogs"),
      where("familyId", "==", familyId),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
  }
}
