package com.example.kidsguard.ui.dashboard

import android.content.Context
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.tracking.LocalSafeZoneChecker
import com.example.kidsguard.tracking.TrackingConfig
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.tracking.TrackingState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import java.text.SimpleDateFormat
import java.util.*

class DashboardRepository(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val safeZoneRepository: SafeZoneRepository,
    private val locationRepository: LocationRepository,
    private val trackingRepository: TrackingRepository,
    private val syncProvider: RemoteSyncProvider,
    private val commandHandler: RemoteCommandHandler
) {
    private val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    private val checker = LocalSafeZoneChecker(safeZoneRepository, com.example.kidsguard.notifications.LocalNotificationEngine(context), prefHelper)

    val dashboardState: Flow<DashboardState> = combine(
        locationRepository.locationHistory,
        safeZoneRepository.safeZones,
        safeZoneRepository.activityEvents,
        trackingRepository.currentState,
        trackingRepository.currentConfig,
        syncProvider.isConnected,
        syncProvider.lastSyncTimestamp,
        commandHandler.lastCommandReceived
    ) { args: Array<Any> ->
        val locationHistory = args[0] as List<LocationPoint>
        val safeZones = args[1] as List<SafeZone>
        val events = args[2] as List<ActivityEvent>
        val trackingState = args[3] as TrackingState
        val trackingConfig = args[4] as TrackingConfig
        val isConnected = args[5] as Boolean
        val lastSync = args[6] as Long
        val lastCommand = args[7] as String
        
        val lastLocation = locationHistory.firstOrNull()
        val nearest = lastLocation?.let { point ->
            safeZones.minByOrNull { checker.calculateDistance(point.latitude, point.longitude, it.latitude, it.longitude) }
        }
        val distance = nearest?.let { zone ->
            lastLocation?.let { point ->
                checker.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude)
            }
        }
        
        val isInside = distance != null && distance <= (nearest?.radiusMeters ?: 0.0)
        
        val today = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
        }.timeInMillis
        
        val eventsToday = events.count { it.timestamp >= today }
        val lastEnter = events.firstOrNull { it.type == "SAFE_ZONE_ENTER" }
        val lastExit = events.firstOrNull { it.type == "SAFE_ZONE_EXIT" }

        DashboardState.Success(
            DashboardUiModel(
                childName = prefHelper.childName,
                deviceName = prefHelper.deviceName,
                isOnline = isConnected,
                lastSeen = if (lastSync > 0) sdf.format(Date(lastSync)) else "Never",
                batteryPercent = 85, 
                isCharging = false,
                trackingState = trackingState.name,
                kidGuardStatus = if (prefHelper.isLocked) "LOCKED" else "UNLOCKED",
                
                currentLat = lastLocation?.latitude,
                currentLng = lastLocation?.longitude,
                accuracy = lastLocation?.accuracy,
                speed = lastLocation?.speed,
                lastLocationUpdate = lastLocation?.let { sdf.format(Date(it.timestamp)) } ?: "Never",
                
                currentZone = if (isInside) nearest?.name ?: "None" else "Outside Zones",
                nearestZone = nearest?.name ?: "None",
                distanceToNearest = distance?.let { "${it.toInt()}m" } ?: "Unknown",
                lastEnterEvent = lastEnter?.let { sdf.format(Date(it.timestamp)) } ?: "None",
                lastExitEvent = lastExit?.let { sdf.format(Date(it.timestamp)) } ?: "None",
                
                totalEventsToday = eventsToday,
                lastActivityTitle = events.firstOrNull()?.title ?: "None",
                lastNotificationTitle = "Safety Alert: ${lastEnter?.title ?: "None"}",
                lastCommandTitle = lastCommand,
                
                trackingConfigSummary = "${trackingConfig.updateIntervalSeconds}s updates",
                totalPointsSaved = locationHistory.size,
                lastGpsPointTime = lastLocation?.let { sdf.format(Date(it.timestamp)) } ?: "Never"
            )
        )
    }
}
