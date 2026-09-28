import { FamilyData, FamilyRole } from "../repositories/FamilyRepository";
import { ParentProfile } from "../repositories/ParentRepository";

export class RoleHelper {
  static normalizeRole(role?: FamilyRole | string | null): FamilyRole {
    if (role === FamilyRole.OWNER) return FamilyRole.OWNER;
    if (role === FamilyRole.MANAGER || role === FamilyRole.PARENT) {
      return FamilyRole.MANAGER;
    }
    // Legacy GUARDIAN had limited access. Map it to the least-privileged
    // canonical role instead of silently granting manager permissions.
    return FamilyRole.VIEWER;
  }

  /**
   * Resolves the current user's role within a family.
   * Priority:
   * 1. Match uid against family.ownerId (Highest authority, fallback for missing members).
   * 2. Match uid in family.members array.
   * 3. Check profile.role (cached role from parents collection).
   * 4. Default to VIEWER.
   */
  static resolveRole(
    family: FamilyData | null,
    uid: string | undefined,
    profile?: ParentProfile | null
  ): FamilyRole {
    if (!uid) {
      return FamilyRole.VIEWER;
    }

    // Loaded Family data is always authoritative.
    if (family) {
      if (family.ownerId === uid) {
        return FamilyRole.OWNER;
      }

      const member = family.members?.find(
        item => item.uid === uid
      );

      if (member) {
        return this.normalizeRole(member.role);
      }

      // A user missing from the loaded Family must not
      // inherit permissions from a stale Parent profile.
      return FamilyRole.VIEWER;
    }

    // Temporary fallback while Family data is loading.
    if (profile?.role === "OWNER") {
      return FamilyRole.OWNER;
    }

    return this.normalizeRole(profile?.role);
  }

  static canManageFamily(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }

  static canInviteMembers(role: FamilyRole): boolean {
    return this.normalizeRole(role) === FamilyRole.OWNER;
  }

  static canRemoveMembers(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }

  static canManageChildren(role: FamilyRole): boolean {
    const normalized = this.normalizeRole(role);
    return normalized === FamilyRole.OWNER || normalized === FamilyRole.MANAGER;
  }

  static canEditChild(role: FamilyRole): boolean {
    return this.canManageChildren(role);
  }

  static canRemoveChild(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }

  static canViewChildren(role: FamilyRole): boolean {
    return true; // All roles can view
  }

  static canManageSafeZones(role: FamilyRole): boolean {
    return this.canManageChildren(role);
  }

  static canManageProtectionModes(role: FamilyRole): boolean {
    return this.canManageChildren(role);
  }

  static canSendRemoteCommands(role: FamilyRole): boolean {
    return this.canManageChildren(role);
  }

  static canManageWebProtection(role: FamilyRole): boolean {
    return this.canManageChildren(role);
  }

  static canViewRouteHistory(role: FamilyRole): boolean {
    return this.normalizeRole(role) !== FamilyRole.VIEWER;
  }
}
