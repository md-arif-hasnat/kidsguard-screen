import { FamilyData, FamilyRole } from "../repositories/FamilyRepository";

export class RoleHelper {
  static resolveRole(family: FamilyData | null, uid: string | undefined): FamilyRole {
    if (!family || !uid) return FamilyRole.VIEWER;

    // 1. Check if user is in members array
    const member = (family.members ?? []).find(m => m.uid === uid);
    if (member) return member.role;

    // 2. Fallback to ownerId check
    if (family.ownerId === uid) return FamilyRole.OWNER;

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
