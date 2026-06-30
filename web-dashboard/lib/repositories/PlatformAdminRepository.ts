import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

export enum PlatformAdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  SUPPORT = "SUPPORT",
  DEVELOPER = "DEVELOPER"
}

export interface PlatformAdmin {
  uid: string;
  email: string;
  role: PlatformAdminRole;
  active: boolean;
  createdAt: any;
  createdBy: string;
  displayName?: string;
}

export class PlatformAdminRepository {
  static async getAdminProfile(uid: string): Promise<PlatformAdmin | null> {
    if (!db) return null;
    const ref = doc(db, "platformAdmins", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as PlatformAdmin : null;
  }

  static async isAdmin(uid: string): Promise<boolean> {
    const profile = await this.getAdminProfile(uid);
    return profile?.active === true;
  }

  // Bootstrap function to create first super admin
  static async bootstrapSuperAdmin(uid: string, email: string): Promise<void> {
    if (!db) return;
    const ref = doc(db, "platformAdmins", uid);
    await setDoc(ref, {
      uid,
      email,
      role: PlatformAdminRole.SUPER_ADMIN,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: "SYSTEM_BOOTSTRAP"
    });
  }
}
