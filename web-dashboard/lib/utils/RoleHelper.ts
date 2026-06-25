import { FamilyRole } from "../repositories/FamilyRepository";

export class RoleHelper {
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
