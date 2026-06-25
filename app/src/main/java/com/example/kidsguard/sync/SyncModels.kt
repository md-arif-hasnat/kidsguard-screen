package com.example.kidsguard.sync

import java.util.UUID

enum class SyncPlatform { ANDROID, IOS }
enum class SyncRole { PARENT, CHILD }
enum class CommandStatus { PENDING, RECEIVED, EXECUTED, FAILED, EXPIRED }
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
    val currentZoneId: String? = null,
    val safeZoneStatus: String = "OUTSIDE", // INSIDE / OUTSIDE
    val lastZoneEvent: String? = null, // ENTER_ZONE / EXIT_ZONE
    val lastLocation: SyncLocationUpdate? = null,
    val lastSeen: Long = System.currentTimeMillis(),
    val lastUpdated: Long = System.currentTimeMillis(),
    val appVersion: String = "",
    val androidVersion: String = "",
    // Part 1: Device Health
    val batteryTemp: Float = 0f,
    val internetType: String = "NONE", // WIFI, MOBILE, NONE
    val wifiSsid: String? = null,
    val storageUsedBytes: Long = 0,
    val storageTotalBytes: Long = 0,
    val ramUsedBytes: Long = 0,
    val ramTotalBytes: Long = 0,
    val gpsEnabled: Boolean = true,
    val bluetoothEnabled: Boolean = false,
    val predictions: SyncPredictions? = null
)

data class SyncPredictions(
    val batteryRemainingMinutes: Int? = null,
    val batteryDieAtTimestamp: Long? = null,
    val offlineRisk: String? = null, // "Low", "Medium", "High"
    val approachingZoneId: String? = null,
    val distanceToApproachingZone: Double? = null,
    val unusualRouteDetected: Boolean = false,
    val lateArrivalDetected: Boolean = false,
    val longStopDetected: Boolean = false,
    val stopLocation: String? = null,
    val lastPredictionAt: Long = System.currentTimeMillis()
)

data class SyncSafetySummary(
    val date: String, // YYYY-MM-DD
    val safetyScore: Int,
    val visitedZones: List<String>,
    val totalDistanceKm: Double,
    val alertCount: Int,
    val recommendation: String
)

data class SyncWeeklyReport(
    val weekStartDate: String,
    val averageSafetyScore: Int,
    val totalDistanceKm: Double,
    val totalAlerts: Int,
    val topVisitedZones: List<String>,
    val safetyTrend: String, // "Improving", "Stable", "Declining"
    val recommendations: List<String>
)

data class SyncLocationUpdate(
    val childId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val speed: Float,
    val bearing: Float,
    val timestamp: Long = System.currentTimeMillis(),
    val batteryLevel: Int? = null,
    val source: String = "GPS"
)

data class SyncActivityEvent(
    val id: String = UUID.randomUUID().toString(),
    val childId: String,
    val type: String, // ENTER_ZONE, EXIT_ZONE, etc.
    val title: String,
    val description: String,
    val zoneId: String? = null,
    val zoneName: String? = null,
    val zoneType: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val distanceMeters: Double? = null,
    val radiusMeters: Double? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val severity: String = "info" // info, warning
)

data class SyncRemoteCommand(
    val commandId: String = UUID.randomUUID().toString(),
    val childId: String,
    val commandType: CommandType,
    val payload: String? = null,
    val status: CommandStatus = CommandStatus.PENDING,
    val createdByParentId: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val receivedAt: Long? = null,
    val executedAt: Long? = null,
    val expiresAt: Long? = null,
    val resultMessage: String? = null
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

data class SyncAppUsage(
    val packageName: String,
    val appName: String,
    val category: String,
    val totalTimeMs: Long,
    val lastUsed: Long,
    val date: String
)

data class SyncAppLimit(
    val packageName: String,
    val dailyLimitMs: Long,
    val enabled: Boolean = true
)

data class SyncAppBlockRule(
    val packageName: String,
    val isBlocked: Boolean = false
)

data class SyncWellbeingSettings(
    val appLimits: List<SyncAppLimit> = emptyList(),
    val blockRules: List<SyncAppBlockRule> = emptyList()
)
