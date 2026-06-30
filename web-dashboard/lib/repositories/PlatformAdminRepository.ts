import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

export enum PlatformAdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  DEV_ADMIN = "DEV_ADMIN",
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
    if (!db) {
        console.warn("INTERNAL_DEBUG: Firestore (db) is not initialized.");
        return null;
    }
    const path = `platformAdmins/${uid}`;
    console.log(`INTERNAL_DEBUG: Looking up admin profile at: ${path}`);

    try {
        const ref = doc(db, "platformAdmins", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const data = snap.data() as PlatformAdmin;
            console.log("INTERNAL_DEBUG: Admin document found:", data);
            return data;
        } else {
            console.warn(`INTERNAL_DEBUG: No admin document found at ${path}`);
            return null;
        }
    } catch (error) {
        console.error(`INTERNAL_DEBUG: Error fetching admin profile at ${path}:`, error);
        return null;
    }
  }

  static async isAdmin(uid: string): Promise<boolean> {
    const profile = await this.getAdminProfile(uid);
    const exists = !!profile;

    // Direct read as requested
    const role = profile?.role;
    const active = profile?.active === true;

    const isAllowedRole = role === "SUPER_ADMIN" ||
                         role === "PLATFORM_ADMIN" ||
                         role === "DEV_ADMIN";

    const allowed = exists && active && isAllowedRole;

    console.log("ADMIN CHECK", {
        role,
        active,
        exists,
        allowed
    });

    return allowed;
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
