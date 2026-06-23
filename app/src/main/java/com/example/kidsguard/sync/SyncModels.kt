package com.example.kidsguard.sync

import java.util.UUID

enum class SyncPlatform { ANDROID, IOS }
enum class SyncRole { PARENT, CHILD }
enum class CommandStatus { PENDING, EXECUTED, FAILED }
enum class CommandType {
    LOCK_NOW,
    UNLOCK_NOW,
    RING_PHONE,
    START_TRACKING,
    STOP_TRACKING,
    REFRESH_LOCATION
}

data class SyncDevice(
    val deviceId: String,
    val platform: SyncPlatform,
    val role: SyncRole,
    val deviceName: String,
    val appVersion: String,
    val lastSeen: Long = System.currentTimeMillis(),
    val online: Boolean = false
)

data class SyncFamily(
    val familyId: String = UUID.randomUUID().toString(),
    val name: String,
    val ownerId: String,
    val members: List<String> = emptyList()
)

data class SyncChildStatus(
    val childId: String,
    val childName: String,
    val avatarId: String = "avatar_1",
    val deviceId: String = "",
    val deviceName: String = "",
    val batteryPercent: Int,
    val charging: Boolean,
    val online: Boolean = true,
    val trackingEnabled: Boolean,
    val kidGuardActive: Boolean,
    val currentZone: String? = null,
    val lastLocation: SyncLocationUpdate? = null,
    val lastSeen: Long = System.currentTimeMillis(),
    val appVersion: String = "",
    val androidVersion: String = ""
)

data class SyncLocationUpdate(
    val childId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val speed: Float,
    val bearing: Float,
    val timestamp: Long = System.currentTimeMillis()
)

data class SyncActivityEvent(
    val id: String = UUID.randomUUID().toString(),
    val childId: String,
    val type: String,
    val title: String,
    val description: String,
    val timestamp: Long = System.currentTimeMillis()
)

data class SyncRemoteCommand(
    val commandId: String = UUID.randomUUID().toString(),
    val childId: String,
    val commandType: CommandType,
    val payload: String? = null,
    val status: CommandStatus = CommandStatus.PENDING,
    val createdAt: Long = System.currentTimeMillis(),
    val executedAt: Long? = null
)

data class SyncNotificationEvent(
    val id: String = UUID.randomUUID().toString(),
    val childId: String,
    val type: String,
    val title: String,
    val body: String,
    val sentAt: Long = System.currentTimeMillis(),
    val read: Boolean = false
)
