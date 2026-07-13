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
  getDocs,
  Timestamp
} from "firebase/firestore";

export enum AuditAction {
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  FAMILY_CREATED = "FAMILY_CREATED",
  MEMBER_INVITED = "MEMBER_INVITED",
  INVITE_ACCEPTED = "INVITE_ACCEPTED",
  ROLE_CHANGED = "ROLE_CHANGED",
  MEMBER_REMOVED = "MEMBER_REMOVED",
  CHILD_PAIRED = "CHILD_PAIRED",
  CHILD_REMOVED = "CHILD_REMOVED",
  SAFE_ZONE_CREATED = "SAFE_ZONE_CREATED",
  SAFE_ZONE_EDITED = "SAFE_ZONE_EDITED",
  SAFE_ZONE_DELETED = "SAFE_ZONE_DELETED",
  REMOTE_COMMAND_SENT = "REMOTE_COMMAND_SENT",
  WEB_RULE_CHANGED = "WEB_RULE_CHANGED",
  DATA_EXPORTED = "DATA_EXPORTED",
  ACCOUNT_DELETED_REQUEST = "ACCOUNT_DELETED_REQUEST",
  RETENTION_POLICY_CHANGED = "RETENTION_POLICY_CHANGED",
  PROTECTION_MODE_CREATED = "PROTECTION_MODE_CREATED",
  PROTECTION_MODE_EDITED = "PROTECTION_MODE_EDITED",
  PROTECTION_MODE_DELETED = "PROTECTION_MODE_DELETED",
  PROTECTION_MODE_TOGGLED = "PROTECTION_MODE_TOGGLED",
  SUPPORT_REQUEST_SUBMITTED = "SUPPORT_REQUEST_SUBMITTED",
  PWA_INSTALL_CLICKED = "PWA_INSTALL_CLICKED",
  PWA_INSTALLED = "PWA_INSTALLED",
  FEATURE_FLAG_CHANGED = "FEATURE_FLAG_CHANGED"
}

export enum AuditSeverity {
  INFO = "INFO",
  NOTICE = "NOTICE",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL"
}

export interface AuditLog {
  id?: string;
  actorUid: string;
  actorEmail: string;
  familyId: string;
  childId?: string;
  action: AuditAction;
  targetType: 'FAMILY' | 'MEMBER' | 'CHILD' | 'ZONE' | 'WEB' | 'SYSTEM' | 'SECURITY';
  targetId?: string;
  metadata?: any;
  createdAt: any;
  severity: AuditSeverity;
}

export class AuditRepository {
  static async log(params: Omit<AuditLog, 'id' | 'createdAt'>) {
    if (!db) return;
    try {
      await addDoc(collection(db, "auditLogs"), {
        ...params,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Audit log failed:", e);
    }
  }

  static listenToFamilyLogs(familyId: string, onUpdate: (logs: AuditLog[]) => void) {
    if (!db || !familyId) return () => {};
    const q = query(
      collection(db, "auditLogs"),
      where("familyId", "==", familyId),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (error) => {
      console.error("Error listening to family logs:", error);
      onUpdate([]);
    });
  }

  static async getFamilyLogsForExport(familyId: string): Promise<AuditLog[]> {
    if (!db || !familyId) return [];
    const q = query(
        collection(db, "auditLogs"),
        where("familyId", "==", familyId),
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
  }
}
