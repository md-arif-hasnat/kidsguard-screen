package com.example.kidsguard.models

import androidx.annotation.Keep
import java.util.UUID

enum class DevicePlatform { ANDROID, IOS }
enum class UserRole { PARENT, CHILD, NONE }

@Keep
data class SafeZone(
    var id: String = "",
    var name: String = "",
    var type: String = "Custom", // Home, School, Playground, Relative House, Custom
    var address: String = "",
    var latitude: Double = 0.0,
    var longitude: Double = 0.0,
    var radiusMeters: Double = 100.0,
    var notifyOnEnter: Boolean = true,
    var notifyOnExit: Boolean = true,
    var enabled: Boolean = true
)

@Keep
data class ActivityEvent(
    var id: String = "",
    var timestamp: Long = System.currentTimeMillis(),
    var type: String = "", // e.g., "KID_MODE_ENABLED", "PIN_SUCCESS"
    var title: String = "",
    var description: String = "",
    var latitude: Double? = null,
    var longitude: Double? = null
)

@Keep
data class ParentDevice(
    var id: String = "",
    var platform: DevicePlatform = DevicePlatform.ANDROID,
    var name: String = ""
)

@Keep
data class ChildDevice(
    var id: String = "",
    var platform: DevicePlatform = DevicePlatform.ANDROID,
    var name: String = "",
    var batteryLevel: Int = -1,
    var isLocked: Boolean = false,
    var lastActive: Long = System.currentTimeMillis()
)

@Keep
data class LocationUpdate(
    var latitude: Double = 0.0,
    var longitude: Double = 0.0,
    var timestamp: Long = System.currentTimeMillis(),
    var accuracy: Float = 0f
)

@Keep
data class LocationPoint(
    var latitude: Double = 0.0,
    var longitude: Double = 0.0,
    var accuracy: Float = 0f,
    var speed: Float = 0f,
    var bearing: Float = 0f,
    var timestamp: Long = System.currentTimeMillis(),
    var address: String? = null,
    var city: String? = null,
    var country: String? = null
)

@Keep
data class PairingCode(
    var code: String = "", // Format: KDG-123456
    var expiresAt: Long = 0L
)

@Keep
data class DeviceStatus(
    var isOnline: Boolean = false,
    var batteryPercentage: Int = 0,
    var isKidGuardActive: Boolean = false,
    var lastUpdated: Long = 0L
)

@Keep
data class RemoteCommand(
    var id: String = "",
    var command: String = "", // e.g., "LOCK", "UNLOCK", "RING"
    var targetChildId: String = "",
    var timestamp: Long = System.currentTimeMillis()
)

enum class SosStatus { ACTIVE, TRIGGERED, RESOLVED }

@Keep
data class SosAlert(
    var alertId: String = "",
    var familyId: String = "",
    var childId: String = "",
    var childName: String = "",
    var status: String = "ACTIVE", // ACTIVE, RESOLVED
    var createdAt: Long = System.currentTimeMillis(),
    var timestamp: Long = System.currentTimeMillis(), // For web query compatibility
    var resolvedAt: Long? = null,
    var resolvedBy: String? = null, // PARENT, CHILD
    var latitude: Double? = null,
    var longitude: Double? = null,
    var address: String? = null,
    var locationAccuracy: Float? = null,
    var locationTimestamp: Long? = null,
    var batteryPercent: Int? = null,
    var active: Boolean = true,
    var message: String = "Emergency SOS Triggered"
)

@Keep
data class SosEvent(
    var id: String = "",
    var childId: String = "",
    var timestamp: Long = System.currentTimeMillis(),
    var latitude: Double? = null,
    var longitude: Double? = null,
    var accuracy: Float? = null,
    var batteryPercent: Int? = null,
    var message: String = "Emergency SOS Triggered",
    var status: SosStatus = SosStatus.TRIGGERED,
    var resolvedAt: Long? = null,
    var active: Boolean = true,
    var address: String? = null,
    var street: String? = null,
    var houseNumber: String? = null,
    var postalCode: String? = null,
    var city: String? = null,
    var country: String? = null
)

@Keep
data class RouteSession(
    var id: String = "",
    var startTime: Long = 0L,
    var endTime: Long = 0L,
    var totalPoints: Int = 0,
    var totalDistanceMeters: Double = 0.0,
    var averageSpeed: Float = 0f,
    var maxSpeed: Float = 0f,
    var points: List<LocationPoint> = emptyList()
)
