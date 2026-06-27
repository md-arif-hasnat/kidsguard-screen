import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, Timestamp } from "firebase/firestore";
import { AuditRepository, AuditAction, AuditSeverity } from "./AuditRepository";

export interface ParentProfile {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  avatarId?: string;
  provider: string;
  familyId: string | null;
  role?: string; // Optional cached role
  region?: 'DE' | 'BD' | 'US' | 'Global';
  lastActiveDate?: string; // Phase AQ (YYYY-MM-DD)
  createdAt: any;
  lastLoginAt: any;
}

export class ParentRepository {
  static async getProfile(uid: string): Promise<ParentProfile | null> {
    if (!db) return null;
    const ref = doc(db, "parents", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as ParentProfile : null;
  }

  static listenToProfile(uid: string, onUpdate: (profile: ParentProfile | null) => void) {
    if (!db || !uid) return () => {};
    const ref = doc(db, "parents", uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as ParentProfile);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Error listening to parent profile:", error);
      onUpdate(null);
    });
  }

  static async createOrUpdateProfile(user: any, provider: string): Promise<ParentProfile> {
    if (!db) throw new Error("Firestore not initialized");

    const existing = await this.getProfile(user.uid);

    const today = new Date().toISOString().split('T')[0];

    const profile: Partial<ParentProfile> = {
      uid: user.uid,
      email: user.email || (existing?.email || null),
      phoneNumber: user.phoneNumber || (existing?.phoneNumber || null),
      displayName: user.displayName || (existing?.displayName || "Parent"),
      avatarId: existing?.avatarId || "parent_1",
      provider: provider,
      lastLoginAt: serverTimestamp(),
      lastActiveDate: today // Phase AQ
    };

    if (existing?.role) {
        profile.role = existing.role;
    } else if (!existing?.familyId) {
        // Only auto-assign OWNER if they don't have a family yet (new creator)
        profile.role = 'OWNER';
    }
    // Note: If they have a familyId but no role, we leave it out of this setDoc
    // to avoid writing 'undefined' and let RoleHelper resolve it from family members.

    if (!existing) {
      profile.createdAt = serverTimestamp();
      profile.familyId = null;
      profile.region = 'DE'; // Default region for new users
    }

    await setDoc(doc(db, "parents", user.uid), profile, { merge: true });

    const updated = await this.getProfile(user.uid);

    if (updated?.familyId) {
      await AuditRepository.log({
        familyId: updated.familyId,
        actorUid: user.uid,
        actorEmail: updated.email || "unknown",
        action: AuditAction.LOGIN,
        targetType: 'SECURITY',
        targetId: user.uid,
        severity: AuditSeverity.INFO,
        metadata: { provider }
      });
    }

    return updated!;
  }

  static async updateFamilyId(uid: string, familyId: string): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, "parents", uid), { familyId }, { merge: true });
  }

  static async updateProfile(uid: string, updates: Partial<ParentProfile>): Promise<void> {
    if (!db) return;
    await setDoc(doc(db, "parents", uid), updates, { merge: true });
  }
}
