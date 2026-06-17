package com.example.kidsguard.models

import java.util.UUID

enum class DevicePlatform { ANDROID, IOS }
enum class UserRole { PARENT, CHILD, NONE }

data class SafeZone(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val type: String = "Custom", // Home, School, Playground, Mosque, Grandma, Custom
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Double,
    val notifyOnEnter: Boolean = true,
    val notifyOnExit: Boolean = true,
    val enabled: Boolean = true
)

data class ActivityEvent(
    val id: String = UUID.randomUUID().toString(),
    val timestamp: Long = System.currentTimeMillis(),
    val type: String, // e.g., "KID_MODE_ENABLED", "PIN_SUCCESS"
    val title: String,
    val description: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class ParentDevice(
    val id: String,
    val platform: DevicePlatform,
    val name: String
)

data class ChildDevice(
    val id: String,
    val platform: DevicePlatform,
    val name: String,
    val batteryLevel: Int = -1,
    val isLocked: Boolean = false,
    val lastActive: Long = System.currentTimeMillis()
)

data class LocationUpdate(
    val latitude: Double,
    val longitude: Double,
    val timestamp: Long = System.currentTimeMillis(),
    val accuracy: Float = 0f
)

data class LocationPoint(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val speed: Float,
    val bearing: Float,
    val timestamp: Long = System.currentTimeMillis()
)

data class PairingCode(
    val code: String, // Format: KDG-123456
    val expiresAt: Long
)

data class DeviceStatus(
    val isOnline: Boolean,
    val batteryPercentage: Int,
    val isKidGuardActive: Boolean,
    val lastUpdated: Long
)

data class RemoteCommand(
    val id: String = UUID.randomUUID().toString(),
    val command: String, // e.g., "LOCK", "UNLOCK", "RING"
    val targetChildId: String,
    val timestamp: Long = System.currentTimeMillis()
)

enum class SosStatus { CREATED, ACTIVE, RESOLVED }

data class SosEvent(
    val id: String = UUID.randomUUID().toString(),
    val childId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracy: Float? = null,
    val batteryPercent: Int? = null,
    val message: String = "Emergency SOS Triggered",
    val status: SosStatus = SosStatus.CREATED
)
