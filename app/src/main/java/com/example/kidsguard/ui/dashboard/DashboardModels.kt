package com.example.kidsguard.ui.dashboard

data class DashboardUiModel(
    val childName: String = "",
    val deviceName: String = "",
    val isOnline: Boolean = false,
    val lastSeen: String = "Never",
    val batteryPercent: Int = 0,
    val isCharging: Boolean = false,
    val trackingState: String = "STOPPED",
    val kidGuardStatus: String = "UNLOCKED",
    
    val currentLat: Double? = null,
    val currentLng: Double? = null,
    val accuracy: Float? = null,
    val speed: Float? = null,
    val lastLocationUpdate: String = "Never",
    
    val currentZone: String = "None",
    val nearestZone: String = "None",
    val distanceToNearest: String = "0m",
    val lastEnterEvent: String = "None",
    val lastExitEvent: String = "None",
    
    val totalEventsToday: Int = 0,
    val lastActivityTitle: String = "None",
    val lastNotificationTitle: String = "None",
    val lastCommandTitle: String = "None",
    
    val trackingConfigSummary: String = "",
    val totalPointsSaved: Int = 0,
    val lastGpsPointTime: String = "Never"
)

sealed class DashboardState {
    object Loading : DashboardState()
    data class Success(val data: DashboardUiModel) : DashboardState()
    data class Error(val message: String) : DashboardState()
}
