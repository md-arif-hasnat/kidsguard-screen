import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

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
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  invitedBy: string;
  invitedAt: any;
  expiresAt: any;
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
        joinedAt: serverTimestamp(),
        assignedChildren: ["*"]
      }],
      childDeviceIds: [],
      settings: {
        name: `${parentDisplayName || 'New'} Family`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        country: "US", // Default
        language: "en"
      },
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "families", familyId), family);
    return familyId;
  }

  static async sendInvite(familyId: string, email: string, role: FamilyRole, invitedBy: string): Promise<void> {
    if (!db) return;
    const inviteId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invite: FamilyInvite = {
      id: inviteId,
      email: email.toLowerCase(),
      role,
      status: 'PENDING',
      invitedBy,
      invitedAt: serverTimestamp(),
      expiresAt: expiresAt
    };

    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, {
      invites: arrayUnion(invite)
    });

    // In a real app, this would trigger a Cloud Function to send the actual email.
    console.log(`MOCK: Sending invite email to ${email} for role ${role}`);
  }

  static async updateMemberRole(familyId: string, memberUid: string, newRole: FamilyRole): Promise<void> {
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedMembers = data.members.map(m =>
      m.uid === memberUid ? { ...m, role: newRole } : m
    );

    await updateDoc(familyRef, { members: updatedMembers });
  }

  static async removeMember(familyId: string, memberUid: string): Promise<void> {
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedMembers = data.members.filter(m => m.uid !== memberUid);

    await updateDoc(familyRef, { members: updatedMembers });
  }

  static async updateFamilySettings(familyId: string, settings: Partial<FamilySettings>): Promise<void> {
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, { settings: settings });
  }

  static async addEmergencyContact(familyId: string, contact: Omit<EmergencyContact, 'id'>): Promise<void> {
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    await updateDoc(familyRef, {
      emergencyContacts: arrayUnion({ ...contact, id: uuidv4() })
    });
  }

  static async removeEmergencyContact(familyId: string, contactId: string): Promise<void> {
    if (!db) return;
    const familyRef = doc(db, "families", familyId);
    const snap = await getDoc(familyRef);
    if (!snap.exists()) return;

    const data = snap.data() as FamilyData;
    const updatedContacts = data.emergencyContacts?.filter(c => c.id !== contactId) || [];

    await updateDoc(familyRef, { emergencyContacts: updatedContacts });
  }

  static async pairChild(familyId: string, pairingCode: string): Promise<boolean> {
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
    await setDoc(childRef, {
        childId,
        deviceId,
        name: pairingData.childName || "Unnamed Child",
        avatarId: pairingData.avatarId || "avatar_1",
        familyId: familyId,
        pairedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
    }, { merge: true });

    // 4. Mark code as used and store familyId for the child to pick up
    await updateDoc(codeRef, {
        used: true,
        familyId: familyId
    });

    console.log(`WEB: Pairing successful for child ${childId}`);
    return true;
  }
}
