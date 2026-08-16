import { FamilyData, FamilyRole } from "../repositories/FamilyRepository";
import { ParentProfile } from "../repositories/ParentRepository";

export class RoleHelper {
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
        return member.role;
      }

      // A user missing from the loaded Family must not
      // inherit permissions from a stale Parent profile.
      return FamilyRole.VIEWER;
    }

    // Temporary fallback while Family data is loading.
    if (profile?.role === "OWNER") {
      return FamilyRole.OWNER;
    }

    if (profile?.role === "PARENT") {
      return FamilyRole.PARENT;
    }

    if (profile?.role === "GUARDIAN") {
      return FamilyRole.GUARDIAN;
    }

    return FamilyRole.VIEWER;
  }

  static canManageFamily(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }

  static canInviteMembers(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canRemoveMembers(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }

  static canManageChildren(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canEditChild(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canRemoveChild(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }

  static canViewChildren(role: FamilyRole): boolean {
    return true; // All roles can view
  }

  static canManageSafeZones(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canManageProtectionModes(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canSendRemoteCommands(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canManageWebProtection(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER || role === FamilyRole.PARENT;
  }

  static canViewRouteHistory(role: FamilyRole): boolean {
    return role !== FamilyRole.VIEWER;
  }
}
