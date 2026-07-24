import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";
import { FamilyRole } from "./FamilyRepository";
import { RoleHelper } from "../utils/RoleHelper";
import { PermissionError } from "./ChildRepository";

export enum ProtectionModeType {
  SCHOOL = "SCHOOL",
  HOMEWORK = "HOMEWORK",
  SLEEP = "SLEEP",
  FOCUS = "FOCUS",
  FREE_TIME = "FREE_TIME",
  EMERGENCY = "EMERGENCY"
}

export interface ProtectionMode {
  id: string;
  name: string;
  type: ProtectionModeType;
  enabled: boolean;

  // Triggers
  schedule?: {
    days: number[]; // 0-6
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  } | null;
  triggerZoneId?: string | null;

  // Rules
  allowedApps: string[];
  blockedApps: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  screenTimeLimitMinutes?: number | null;
  lockDevice: boolean;

  createdAt: any;
  updatedAt: any;
}

export class ProtectionModeRepository {
  static listenToModes(childId: string, onUpdate: (modes: ProtectionMode[]) => void) {
    if (!db || !childId) return () => {};
    const ref = collection(db, "children", childId, "protectionModes");
    const q = query(ref, orderBy("createdAt", "asc"));

    return onSnapshot(q, (snapshot) => {
      onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProtectionMode)));
    });
  }

  static async saveMode(childId: string, familyId: string, mode: Omit<ProtectionMode, 'createdAt' | 'updatedAt'>, callerRole?: FamilyRole) {
    if (callerRole && !RoleHelper.canManageProtectionModes(callerRole)) throw new PermissionError();
    if (!db || !childId) return;
    const isNew = !mode.id;
    const id = mode.id || uuidv4();
    const ref = doc(db, "children", childId, "protectionModes", id);

    const data = {
      ...mode,
      id,
      updatedAt: serverTimestamp()
    };

    if (isNew) {
      (data as any).createdAt = serverTimestamp();
      await setDoc(ref, data);
    } else {
      await updateDoc(ref, data);
    }

    await AuditRepository.log({
      actorUid: "current_user",
      actorEmail: "parent",
      familyId,
      childId,
      action: isNew ? AuditAction.PROTECTION_MODE_CREATED : AuditAction.PROTECTION_MODE_EDITED,
      targetType: 'SYSTEM',
      targetId: id,
      severity: AuditSeverity.NOTICE,
      metadata: { modeName: mode.name, type: mode.type }
    });

    return id;
  }

  static async deleteMode(childId: string, familyId: string, modeId: string, callerRole?: FamilyRole) {
    if (callerRole && !RoleHelper.canManageProtectionModes(callerRole)) throw new PermissionError();
    if (!db || !childId) return;
    await deleteDoc(doc(db, "children", childId, "protectionModes", modeId));

    await AuditRepository.log({
        actorUid: "current_user",
        actorEmail: "parent",
        familyId,
        childId,
        action: AuditAction.PROTECTION_MODE_DELETED,
        targetType: 'SYSTEM',
        targetId: modeId,
        severity: AuditSeverity.WARNING
    });
  }
}
