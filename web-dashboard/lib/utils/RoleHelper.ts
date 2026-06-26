import { FamilyData, FamilyRole } from "../repositories/FamilyRepository";
import { ParentProfile } from "../repositories/ParentRepository";

export class RoleHelper {
  /**
   * Resolves the current user's role within a family.
   * Priority:
   * 1. Match uid in family.members array.
   * 2. Match uid against family.ownerId (fallback for older docs).
   * 3. Check profile.role (cached role).
   * 4. Default to VIEWER.
   */
  static resolveRole(family: FamilyData | null, uid: string | undefined, profile?: ParentProfile | null): FamilyRole {
    if (!uid) return FamilyRole.VIEWER;

    // 1. Check if user is in members array (most accurate)
    if (family?.members) {
        const member = family.members.find(m => m.uid === uid);
        if (member) return member.role;
    }

    // 2. Fallback to ownerId check (backward compatibility)
    if (family?.ownerId === uid) return FamilyRole.OWNER;

    // 3. Fallback to cached profile role
    if (profile?.role === 'OWNER') return FamilyRole.OWNER;
    if (profile?.role === 'PARENT') return FamilyRole.PARENT;
    if (profile?.role === 'GUARDIAN') return FamilyRole.GUARDIAN;

    // 4. If they have a familyId but weren't found, and we don't have family data yet
    // but they are the only person who could be the owner.
    if (!family && profile?.familyId && !profile.role) {
        // Optimization: Assume OWNER if they have a familyId but no role set yet
        // (will be corrected once family loads)
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

  static canViewChildren(role: FamilyRole): boolean {
    return true; // All roles can view
  }

  static canManageSafeZones(role: FamilyRole): boolean {
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

  static canManageReleaseManager(role: FamilyRole): boolean {
    return role === FamilyRole.OWNER;
  }
}
