package com.example.kidsguard.utils

import com.example.kidsguard.repository.FamilyData
import com.example.kidsguard.repository.ParentProfile

enum class FamilyRole {
    OWNER, PARENT, GUARDIAN, VIEWER
}

object RoleHelper {
    fun resolveRole(family: FamilyData?, uid: String?, profile: ParentProfile?): FamilyRole {
        if (uid == null) return FamilyRole.VIEWER

        // 1. Check ownerId
        if (family?.ownerId == uid) return FamilyRole.OWNER

        // 2. Check members array
        family?.members?.find { it.uid == uid }?.let {
            return when (it.role) {
                "OWNER" -> FamilyRole.OWNER
                "PARENT" -> FamilyRole.PARENT
                "GUARDIAN" -> FamilyRole.GUARDIAN
                else -> FamilyRole.VIEWER
            }
        }

        // 3. Fallback to cached profile role
        return when (profile?.role) {
            "OWNER" -> FamilyRole.OWNER
            "PARENT" -> FamilyRole.PARENT
            "GUARDIAN" -> FamilyRole.GUARDIAN
            else -> FamilyRole.VIEWER
        }
    }

    fun canManageFamily(role: FamilyRole): Boolean = role == FamilyRole.OWNER
    fun canInviteMembers(role: FamilyRole): Boolean = role == FamilyRole.OWNER || role == FamilyRole.PARENT
    fun canManageChildren(role: FamilyRole): Boolean = role == FamilyRole.OWNER || role == FamilyRole.PARENT
    fun canSendRemoteCommands(role: FamilyRole): Boolean = role == FamilyRole.OWNER || role == FamilyRole.PARENT
    fun canManageSafeZones(role: FamilyRole): Boolean = role == FamilyRole.OWNER || role == FamilyRole.PARENT
}
