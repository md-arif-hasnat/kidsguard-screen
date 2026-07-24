import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";

import { RoleHelper } from "../utils/RoleHelper";
import { PermissionError } from "./ChildRepository";

export enum FamilyRole {
  OWNER = "OWNER",
  PARENT = "PARENT",
  GUARDIAN = "GUARDIAN",
  VIEWER = "VIEWER"
}

export interface FamilyMember {
  uid: string;
  email?: string;
  displayName?: string;
  role: FamilyRole;
  joinedAt: any;
  invitedBy?: string;
  assignedChildren: string[]; // List of childIds or ["*"] for all
}

export interface FamilyInvite {
  id: string;
  email: string;
  role: FamilyRole;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  invitedBy: string;
  invitedByName?: string;
  invitedAt: any;
  expiresAt: any;
  token?: string; // Client-side only for link generation
}

export interface DetailedInvite extends FamilyInvite {
  familyId: string;
  familyName: string;
  tokenHash: string;
  acceptedAt?: any;
  acceptedByUid?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  priority: number;
}

export interface FamilySettings {
  name: string;
  photoUrl?: string;
  timezone: string;
  country: string;
  language: string;
  dataRetentionDays?: number; // Phase AI
}

export interface FamilyData {
  familyId: string;
  ownerId: string;
  members: FamilyMember[];
  invites?: FamilyInvite[];
  childDeviceIds: string[];
  emergencyContacts?: EmergencyContact[];
  settings: FamilySettings;
  createdAt: any;
}

export class FamilyRepository {
  static listenToFamily(familyId: string, onUpdate: (data: FamilyData | null) => void) {
    if (!db || !familyId) return () => {};

    const familyRef = doc(db, "families", familyId);
    return onSnapshot(familyRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as FamilyData);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to family:", error);
      onUpdate(null);
    });
  }

  static async createFamily(parentId: string, parentEmail?: string | null, parentDisplayName?: string | null): Promise<string> {
    if (!db) throw new Error("Firestore not initialized");
    const familyId = uuidv4();
    const family: FamilyData = {
      familyId,
      ownerId: parentId,
      members: [{
        uid: parentId,
        email: parentEmail || undefined,
        displayName: parentDisplayName || "Owner",
        role: FamilyRole.OWNER,
        joinedAt: Timestamp.now(),
        assignedChildren: ["*"]
      }],
      childDeviceIds: [],
      settings: {
        name: `${parentDisplayName || 'New'} Family`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        country: "US", // Default
        language: "en",
        dataRetentionDays: 365 // Default to 1 year
      },
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "families", familyId), family);

    await AuditRepository.log({
        actorUid: parentId,
        actorEmail: parentEmail || "unknown",
        familyId,
        action: AuditAction.FAMILY_CREATED,
        targetType: 'FAMILY',
        targetId: familyId,
        severity: AuditSeverity.NOTICE,
        metadata: { familyName: family.settings.name }
    });

    return familyId;
  }

  static async sendInvite(familyId: string, familyName: string, email: string, role: FamilyRole, invitedBy: string, invitedByName?: string, callerRole?: FamilyRole): Promise<string> {
    if (callerRole && !RoleHelper.canInviteMembers(callerRole)) throw new PermissionError();
    if (!db) throw new Error("Firestore not initialized");
    const inviteId = uuidv4();
    const token = uuidv4().replace(/-/g, ''); // Simple token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invite: DetailedInvite = {
      id: inviteId,
      familyId,
      familyName,
      email: email.toLowerCase(),
      role,
      status: 'PENDING',
      invitedBy,
      invitedByName,
      invitedAt: serverTimestamp(),
      expiresAt: expiresAt,
      tokenHash: token // In production, hash this. Storing raw for MVP simplicity as requested to be in URL.
    };

    // 1. Create secure invite document
    await setDoc(doc(db, "familyInvitations", inviteId), invite);

    // 2. Update family summary
    const summary: FamilyInvite = {
      id: inviteId,
      email: invite.email,
      role: invite.role,
      status: 'PENDING',
      invitedBy: invite.invitedBy,
      invitedAt: Timestamp.now(),
      expiresAt: invite.expiresAt
    };

    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, {
      invites: arrayUnion(summary)
    });

    await AuditRepository.log({
      actorUid: invitedBy,
      actorEmail: "current_user", // Simplification
      familyId,
      action: AuditAction.MEMBER_INVITED,
      targetType: 'MEMBER',
      targetId: email,
      severity: AuditSeverity.INFO,
      metadata: { role, inviteId }
    });

    console.log(`WEB: Invite created. Link: /invite/${inviteId}?token=${token}`);
    return token;
  }

  static async getInvite(inviteId: string): Promise<DetailedInvite | null> {
    if (!db) return null;
    const snap = await getDoc(doc(db, "familyInvitations", inviteId));
    return snap.exists() ? snap.data() as DetailedInvite : null;
  }

  static async acceptInvite(inviteId: string, uid: string, email: string, displayName: string): Promise<string> {
    if (!db) throw new Error("Firestore not initialized");

    const inviteRef = doc(db, "familyInvitations", inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error("Invitation not found");

    const invite = inviteSnap.data() as DetailedInvite;
    if (invite.status !== 'PENDING') throw new Error(`Invitation is ${invite.status}`);
    if (invite.email !== email.toLowerCase()) throw new Error("This invitation was sent to another email address");

    const now = new Date();
    if (invite.expiresAt.toDate() < now) throw new Error("Invitation has expired");

    // 1. Update invite status
    await updateDoc(inviteRef, {
      status: 'ACCEPTED',
      acceptedAt: serverTimestamp(),
      acceptedByUid: uid
    });

    // 2. Add member to family
    const familyRef = doc(db, "families", invite.familyId);
    const newMember: FamilyMember = {
      uid,
      email,
      displayName,
      role: invite.role,
      joinedAt: Timestamp.now(),
      invitedBy: invite.invitedBy,
      assignedChildren: ["*"] // Default to all for now
    };

    await updateDoc(familyRef, {
      members: arrayUnion(newMember)
    });

    // 3. Update family invites summary
    const familySnap = await getDoc(familyRef);
    if (familySnap.exists()) {
      const familyData = familySnap.data() as FamilyData;
      const updatedInvites = (familyData.invites ?? []).map(i =>
        i.id === inviteId ? { ...i, status: 'ACCEPTED' as const } : i
      );
      await updateDoc(familyRef, { invites: updatedInvites });
    }

    // 4. Update parent profile
    const parentRef = doc(db, "parents", uid);
    await updateDoc(parentRef, { familyId: invite.familyId });

    await AuditRepository.log({
        actorUid: uid,
        actorEmail: email,
        familyId: invite.familyId,
        action: AuditAction.INVITE_ACCEPTED,
        targetType: 'MEMBER',
        targetId: uid,
        severity: AuditSeverity.NOTICE,
        metadata: { role: invite.role, invitedBy: invite.invitedBy }
    });

    return invite.familyId;
  }

  static async revokeInvite(familyId: string, inviteId: string, callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canInviteMembers(callerRole)) throw new PermissionError();
    if (!db) return;

    // 1. Update secure invite
    await updateDoc(doc(db, "familyInvitations", inviteId), { status: 'REVOKED' });

    // 2. Update family summary
    const familyRef = doc(db, "families", familyId);
    const familySnap = await getDoc(familyRef);
    if (familySnap.exists()) {
      const data = familySnap.data() as FamilyData;
      const updatedInvites = (data.invites ?? []).map(i =>
        i.id === inviteId ? { ...i, status: 'REVOKED' as const } : i
      );
      await updateDoc(familyRef, { invites: updatedInvites });
    }
  }

  static async updateMemberRole(familyId: string, memberUid: string, newRole: FamilyRole, callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canManageFamily(callerRole)) throw new PermissionError();
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedMembers = data.members.map(m =>
      m.uid === memberUid ? { ...m, role: newRole } : m
    );

    await updateDoc(familyRef, { members: updatedMembers });

    await AuditRepository.log({
      actorUid: "current_user",
      actorEmail: "admin",
      familyId,
      action: AuditAction.ROLE_CHANGED,
      targetType: 'MEMBER',
      targetId: memberUid,
      severity: AuditSeverity.NOTICE,
      metadata: { newRole }
    });
  }

  static async removeMember(familyId: string, memberUid: string, callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canRemoveMembers(callerRole)) throw new PermissionError();
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedMembers = data.members.filter(m => m.uid !== memberUid);

    await updateDoc(familyRef, { members: updatedMembers });

    await AuditRepository.log({
      actorUid: "current_user",
      actorEmail: "admin",
      familyId,
      action: AuditAction.MEMBER_REMOVED,
      targetType: 'MEMBER',
      targetId: memberUid,
      severity: AuditSeverity.WARNING
    });
  }

  static async removeChildFromFamily(familyId: string, childId: string, parentUid: string = "current_user", parentEmail: string = "parent@kidsguard.app", callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canRemoveChild(callerRole)) throw new PermissionError();
    if (!db || !familyId || !childId) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedChildren = (data.childDeviceIds || []).filter(id => id !== childId);

    await updateDoc(familyRef, { childDeviceIds: updatedChildren });

    // Also update the child doc to remove the familyId link
    const childRef = doc(db, "children", childId);
    await updateDoc(childRef, {
        familyId: null,
        updatedAt: serverTimestamp()
    });

    await AuditRepository.log({
      actorUid: parentUid,
      actorEmail: parentEmail,
      familyId,
      action: AuditAction.CHILD_REMOVED,
      targetType: 'CHILD',
      targetId: childId,
      severity: AuditSeverity.WARNING
    });
  }

  static async updateFamilySettings(familyId: string, settings: Partial<FamilySettings>, callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canManageFamily(callerRole)) throw new PermissionError();
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, { settings: settings });
  }

  static async addEmergencyContact(familyId: string, contact: Omit<EmergencyContact, 'id'>, callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canManageFamily(callerRole)) throw new PermissionError();
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, {
      emergencyContacts: arrayUnion({ ...contact, id: uuidv4() })
    });
  }

  static async removeEmergencyContact(familyId: string, contactId: string, callerRole?: FamilyRole): Promise<void> {
    if (callerRole && !RoleHelper.canManageFamily(callerRole)) throw new PermissionError();
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedContacts = data.emergencyContacts?.filter(c => c.id !== contactId) || [];

    await updateDoc(familyRef, { emergencyContacts: updatedContacts });
  }

  static async pairChild(familyId: string, pairingCode: string, parentName: string = "Parent"): Promise<boolean> {
    if (!db) return false;

    console.log(`WEB: Searching for pair code: ${pairingCode}`);
    const codePath = `pairingCodes/${pairingCode}`;
    console.log(`WEB: Target Firestore path: ${codePath}`);

    // 1. Find pairing code in pairingCodes collection (Document ID is the code)
    const codeRef = doc(db, "pairingCodes", pairingCode);
    const snap = await getDoc(codeRef);

    if (!snap.exists()) {
      console.warn(`WEB: Pair code ${pairingCode} NOT FOUND at ${codePath}`);
      return false;
    }

    const pairingData = snap.data();
    console.log(`WEB: Document found:`, pairingData);

    // Check used status
    if (pairingData.used) {
        console.warn(`WEB: Pair code ${pairingCode} has already been used.`);
        return false;
    }

    // Check expiry
    const expiresAt = pairingData.expiresAt?.toMillis() || 0;
    if (Date.now() > expiresAt) {
      console.warn(`WEB: Pair code ${pairingCode} has expired.`);
      return false;
    }

    const deviceId = pairingData.deviceId || pairingData.childDeviceId;
    const childId = pairingData.childId || deviceId;

    if (!deviceId || !childId) {
        console.error(`WEB: Missing ID in pairing document.`);
        return false;
    }

    console.log(`WEB: Linking child ${childId} (device: ${deviceId}) to family ${familyId}`);

    // 2. Add childId to family
    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, {
      childDeviceIds: arrayUnion(childId)
    });

    // 3. Create/Update child record
    const childRef = doc(db, "children", childId);
    const childUpdate: any = {
        childId,
        deviceId,
        name: pairingData.childName || "Unnamed Child",
        avatarId: pairingData.avatarId || "avatar_1",
        familyId: familyId,
        pairedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    };
    await setDoc(childRef, childUpdate, { merge: true });

    // 4. Mark code as used and store familyId/parentName for the child to pick up
    console.log("DEBUG parent name", parentName)
    await updateDoc(codeRef, {
        used: true,
        familyId: familyId,
        parentName: parentName,
        pairedAt: serverTimestamp()
    });

    await AuditRepository.log({
        actorUid: "admin",
        actorEmail: "admin",
        familyId,
        action: AuditAction.CHILD_PAIRED,
        targetType: 'CHILD',
        targetId: childId,
        severity: AuditSeverity.NOTICE,
        metadata: { childName: pairingData.childName || childId }
    });

    console.log(`WEB: Pairing successful for child ${childId}`);
    return true;
  }
}
