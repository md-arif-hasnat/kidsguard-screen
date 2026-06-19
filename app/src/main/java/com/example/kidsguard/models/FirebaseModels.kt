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
    val pairingCode: String = "",
    val childDeviceId: String = "",
    val childName: String = "",
    val createdAt: Timestamp? = null,
    val expiresAt: Timestamp? = null
)

data class FamilyDoc(
    val familyId: String = "",
    val parentDeviceId: String = "",
    val childDeviceId: String = "",
    val createdAt: Timestamp? = null
)
