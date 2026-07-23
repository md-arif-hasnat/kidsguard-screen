package com.example.kidsguard.sync

import androidx.annotation.Keep

enum class SyncPlatform { ANDROID, IOS }
enum class SyncRole { PARENT, CHILD }
enum class CommandStatus { PENDING, EXECUTING, SUCCESS, FAILED, EXPIRED }
enum class CommandType {
    REFRESH_LOCATION,
    RING_DEVICE,
    LOCK_DEVICE,
    UNLOCK_DEVICE,
    SHOW_MESSAGE,
    VIBRATE_DEVICE,
    // Legacy mapping support
    LOCK_NOW,
    UNLOCK_NOW,
    RING_PHONE,
    SOUND_SIREN,
    START_TRACKING,
    STOP_TRACKING
}

@Keep
data class SyncDevice(
    var deviceId: String = "",
    var platform: SyncPlatform = SyncPlatform.ANDROID,
    var role: SyncRole = SyncRole.CHILD,
    var deviceName: String = "",
    var appVersion: String = "",
    var lastSeen: Long = System.currentTimeMillis(),
    var online: Boolean = false
)

@Keep
data class SyncFamily(
    var familyId: String = "",
    var name: String = "",
    var ownerId: String = "",
    var members: List<String> = emptyList()
)

@Keep
data class SyncChildStatus(
    var childId: String = "",
    var childName: String = "",
    var avatarId: String = "avatar_1",
    var deviceId: String = "",
    var deviceName: String = "",
    var batteryPercent: Int = 0,
    var charging: Boolean = false,
    var online: Boolean = true,
    var trackingEnabled: Boolean = true,
    var kidGuardActive: Boolean = false,
    var currentZone: String? = null,
    var currentZoneId: String? = null,
    var safeZoneStatus: String = "OUTSIDE", // INSIDE / OUTSIDE
    var lastZoneEvent: String? = null, // ENTER_ZONE / EXIT_ZONE
    var lastLocation: SyncLocationUpdate? = null,
    var lastSeen: Long = System.currentTimeMillis(),
    var lastUpdated: Long = System.currentTimeMillis(),
    var appVersion: String = "",
    var androidVersion: String = "",
    // Part 1: Device Health
    var batteryTemp: Float = 0f,
    var internetType: String = "NONE", // WIFI, MOBILE, NONE
    var wifiSsid: String? = null,
    var storageUsedBytes: Long = 0,
    var storageTotalBytes: Long = 0,
    var ramUsedBytes: Long = 0,
    var ramTotalBytes: Long = 0,
    var gpsEnabled: Boolean = true,
    var bluetoothEnabled: Boolean = false,
    var predictions: SyncPredictions? = null
)

@Keep
data class SyncPredictions(
    var batteryRemainingMinutes: Int? = null,
    var batteryDieAtTimestamp: Long? = null,
    var offlineRisk: String? = null, // "Low", "Medium", "High"
    var approachingZoneId: String? = null,
    var distanceToApproachingZone: Double? = null,
    var unusualRouteDetected: Boolean = false,
    var lateArrivalDetected: Boolean = false,
    var longStopDetected: Boolean = false,
    var stopLocation: String? = null,
    var lastPredictionAt: Long = System.currentTimeMillis()
)

@Keep
data class SyncSafetySummary(
    var date: String = "", // YYYY-MM-DD
    var safetyScore: Int = 0,
    var visitedZones: List<String> = emptyList(),
    var totalDistanceKm: Double = 0.0,
    var alertCount: Int = 0,
    var recommendation: String = ""
)

@Keep
data class SyncWeeklyReport(
    var weekStartDate: String = "",
    var averageSafetyScore: Int = 0,
    var totalDistanceKm: Double = 0.0,
    var totalAlerts: Int = 0,
    var topVisitedZones: List<String> = emptyList(),
    var safetyTrend: String = "Stable", // "Improving", "Stable", "Declining"
    var recommendations: List<String> = emptyList()
)

@Keep
data class SyncLocationUpdate(
    var childId: String = "",
    var latitude: Double = 0.0,
    var longitude: Double = 0.0,
    var accuracy: Float = 0f,
    var speed: Float = 0f,
    var bearing: Float = 0f,
    var timestamp: Long = System.currentTimeMillis(),
    var batteryLevel: Int? = null,
    var source: String = "GPS",
    var address: String? = null,
    var city: String? = null,
    var country: String? = null
)

@Keep
data class SyncActivityEvent(
    var id: String = "",
    var childId: String = "",
    var type: String = "", // ENTER_ZONE, EXIT_ZONE, etc.
    var title: String = "",
    var description: String = "",
    var zoneId: String? = null,
    var zoneName: String? = null,
    var zoneType: String? = null,
    var latitude: Double? = null,
    var longitude: Double? = null,
    var distanceMeters: Double? = null,
    var radiusMeters: Double? = null,
    var timestamp: Long = System.currentTimeMillis(),
    var severity: String = "info" // info, warning
)

@Keep
data class SyncRemoteCommand(
    var commandId: String = "",
    var childId: String = "",
    var commandType: CommandType = CommandType.REFRESH_LOCATION,
    var payload: String? = null,
    var status: CommandStatus = CommandStatus.PENDING,
    var createdByParentId: String = "",
    var createdAt: Long = System.currentTimeMillis(),
    var receivedAt: Long? = null,
    var executedAt: Long? = null,
    var expiresAt: Long? = null,
    var resultMessage: String? = null
)

@Keep
data class SyncNotificationEvent(
    var id: String = "",
    var childId: String = "",
    var type: String = "",
    var title: String = "",
    var body: String = "",
    var sentAt: Long = System.currentTimeMillis(),
    var read: Boolean = false
)

@Keep
data class SyncAppUsage(
    var packageName: String = "",
    var appName: String = "",
    var category: String = "",
    var totalTimeMs: Long = 0,
    var lastUsed: Long = 0,
    var date: String = ""
)

@Keep
data class SyncAppLimit(
    var packageName: String = "",
    var dailyLimitMs: Long = 0,
    var enabled: Boolean = true
)

@Keep
data class SyncAppBlockRule(
    var packageName: String = "",
    var isBlocked: Boolean = false
)

@Keep
data class SyncAppControl(
    var packageName: String = "",
    var appName: String = "",
    var blocked: Boolean = false,
    var dailyLimitMinutes: Int? = null,
    var updatedAt: Long? = null
)

@Keep
data class SyncWellbeingSettings(
    var appLimits: List<SyncAppLimit> = emptyList(),
    var blockRules: List<SyncAppBlockRule> = emptyList()
)
