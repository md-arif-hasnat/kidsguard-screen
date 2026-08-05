package com.example.kidsguard.models

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.IgnoreExtraProperties

@Keep
data class DeviceDoc(
    var deviceId: String = "",
    var firebaseUid: String = "",
    var role: String = "NONE",
    var deviceName: String = "",
    var appVersion: String = "",
    var createdAt: Timestamp? = null,
    var lastSeen: Timestamp? = null,
    var fcmToken: String? = null,
    var fcmTokenUpdatedAt: Timestamp? = null,
    var pushEnabled: Boolean = true
)

@Keep
data class PairingCodeDoc(
    var code: String = "",
    var childId: String = "",
    var deviceId: String = "",
    var childName: String = "",
    var deviceName: String = "",
    var avatarId: String = "avatar_1",
    var firebaseUid: String = "",
    var createdAt: Timestamp? = null,
    var expiresAt: Timestamp? = null,
    var used: Boolean = false
)

@Keep
data class FamilyDoc(
    var familyId: String = "",
    var parentDeviceId: String = "",
    var childDeviceIds: List<String> = emptyList(),
    var createdAt: Timestamp? = null
)

@Keep
data class ProtectionModeSchedule(
    var days: List<Int> = emptyList(),
    var startTime: String = "",
    var endTime: String = ""
)

@Keep
@IgnoreExtraProperties
data class ProtectionModeDoc(
    var id: String = "",
    var name: String = "",
    var type: String = "SCHOOL",
    var enabled: Boolean = false,
    var schedule: ProtectionModeSchedule? = null,
    var triggerZoneId: String? = null,
    var allowedApps: List<String> = emptyList(),
    var blockedApps: List<String> = emptyList(),
    var allowedDomains: List<String> = emptyList(),
    var blockedDomains: List<String> = emptyList(),
    var screenTimeLimitMinutes: Int? = null,
    var lockDevice: Boolean = false
)
