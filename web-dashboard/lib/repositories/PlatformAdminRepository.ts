import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

export enum PlatformAdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  DEV_ADMIN = "DEV_ADMIN",
  EMPLOYEE = "EMPLOYEE",
  ACCOUNTING = "ACCOUNTING"
}

const ALLOWED_PLATFORM_ADMIN_ROLES = new Set<PlatformAdminRole>([
  PlatformAdminRole.SUPER_ADMIN,
  PlatformAdminRole.PLATFORM_ADMIN,
  PlatformAdminRole.DEV_ADMIN,
  PlatformAdminRole.EMPLOYEE,
  PlatformAdminRole.ACCOUNTING
]);

export function isAllowedPlatformAdminRole(
  role: unknown
): role is PlatformAdminRole {
  return typeof role === "string" &&
    ALLOWED_PLATFORM_ADMIN_ROLES.has(role as PlatformAdminRole);
}

export interface PlatformAdmin {
  uid: string;
  email: string;
  role: PlatformAdminRole;
  active: boolean;
  createdAt: any;
  createdBy: string;
  displayName?: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "SECURITY_HOLD";
  approvedAt?: any;
  approvedBy?: string;
}

export class PlatformAdminRepository {
  static async getAdminProfile(uid: string): Promise<PlatformAdmin | null> {
    if (!db) {
        return null;
    }

    try {
        const ref = doc(db, "platformAdmins", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const data = snap.data() as PlatformAdmin;
            return {
              ...data,
              // Authorization is tied to the protected document path, never
              // to a mutable uid field stored inside the document.
              uid: snap.id
            };
        }
        return null;
    } catch {
        return null;
    }
  }

  static async isAdmin(uid: string): Promise<boolean> {
    const profile = await this.getAdminProfile(uid);
    const exists = !!profile;

    // Direct read as requested
    const role = profile?.role;
    const active = profile?.active === true;

    const isAllowedRole = isAllowedPlatformAdminRole(role);

    const allowed = exists && active && isAllowedRole;

    return allowed;
  }

  static async isInternalStaff(uid: string): Promise<boolean> {
    return this.isAdmin(uid);
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
