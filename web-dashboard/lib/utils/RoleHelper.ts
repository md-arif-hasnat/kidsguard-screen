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
  static resolveRole(family: FamilyData | null, uid: string | undefined, profile?: ParentProfile | null): FamilyRole {
    if (!uid) return FamilyRole.VIEWER;

    // 1. Check ownerId (Highest authority & backward compatibility)
    if (family?.ownerId === uid) return FamilyRole.OWNER;

    // 2. Check if user is in members array
    if (family?.members) {
        const member = family.members.find(m => m.uid === uid);
        if (member) return member.role;
    }

    // 3. Fallback to cached profile role
    if (profile?.role === 'OWNER') return FamilyRole.OWNER;
    if (profile?.role === 'PARENT') return FamilyRole.PARENT;
    if (profile?.role === 'GUARDIAN') return FamilyRole.GUARDIAN;

    // 4. Optimization: if they have a familyId but the family data hasn't loaded yet,
    // and they were the creator (profile.role === 'OWNER'), return OWNER.
    if (!family && profile?.familyId && profile.role === 'OWNER') {
        return FamilyRole.OWNER;
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
