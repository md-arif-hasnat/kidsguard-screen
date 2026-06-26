package com.example.kidsguard.models

import com.google.firebase.Timestamp
import com.google.firebase.firestore.ServerTimestamp

data class DeviceDoc(
    val deviceId: String = "",
    val firebaseUid: String = "",
    val role: String = "NONE",
    val deviceName: String = "",
    val appVersion: String = "",
    val createdAt: Timestamp? = null,
    val lastSeen: Timestamp? = null,
    val fcmToken: String? = null,
    val fcmTokenUpdatedAt: Timestamp? = null,
    val pushEnabled: Boolean = true
)

data class PairingCodeDoc(
    val code: String = "",
    val childId: String = "",
    val deviceId: String = "",
    val childName: String = "",
    val deviceName: String = "",
    val avatarId: String = "avatar_1",
    val firebaseUid: String = "",
    val createdAt: Timestamp? = null,
    val expiresAt: Timestamp? = null,
    val used: Boolean = false
)

data class FamilyDoc(
    val familyId: String = "",
    val parentDeviceId: String = "",
    val childDeviceIds: List<String> = emptyList(),
    val createdAt: Timestamp? = null
)

data class ProtectionModeSchedule(
    val days: List<Int> = emptyList(),
    val startTime: String = "",
    val endTime: String = ""
)

data class ProtectionModeDoc(
    val id: String = "",
    val name: String = "",
    val type: String = "SCHOOL",
    val enabled: Boolean = false,
    val schedule: ProtectionModeSchedule? = null,
    val triggerZoneId: String? = null,
    val allowedApps: List<String> = emptyList(),
    val blockedApps: List<String> = emptyList(),
    val allowedDomains: List<String> = emptyList(),
    val blockedDomains: List<String> = emptyList(),
    val screenTimeLimitMinutes: Int? = null,
    val lockDevice: Boolean = false
)
