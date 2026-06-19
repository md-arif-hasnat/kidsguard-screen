package com.example.kidsguard.ui.dashboard

import android.content.Context
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.RouteRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncActivityEvent
import com.example.kidsguard.sync.SyncChildStatus
import com.example.kidsguard.sync.SyncLocationUpdate
import com.example.kidsguard.tracking.LocalSafeZoneChecker
import com.example.kidsguard.tracking.TrackingConfig
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.tracking.TrackingState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import java.text.SimpleDateFormat
import java.util.*

class DashboardRepository(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val safeZoneRepository: SafeZoneRepository,
    private val locationRepository: LocationRepository,
    private val trackingRepository: TrackingRepository,
    private val syncProvider: RemoteSyncProvider,
    private val commandHandler: RemoteCommandHandler,
    private val routeRepository: RouteRepository
) {
    private val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
    private val checker = LocalSafeZoneChecker(safeZoneRepository, com.example.kidsguard.notifications.LocalNotificationEngine(context), prefHelper)

    @kotlinx.coroutines.ExperimentalCoroutinesApi
    val dashboardState: Flow<DashboardState> = combine(
        locationRepository.locationHistory,
        safeZoneRepository.safeZones,
        safeZoneRepository.activityEvents,
        trackingRepository.currentState,
        trackingRepository.currentConfig,
        syncProvider.isConnected,
        syncProvider.lastSyncTimestamp,
        commandHandler.lastCommandReceived,
        prefHelper.pairedChildId?.let { syncProvider.getChildStatus(it) } ?: flowOf(null),
        prefHelper.pairedChildId?.let { syncProvider.getLatestActivity(it) } ?: flowOf(null)
    ) { args: Array<Any?> ->
        @Suppress("UNCHECKED_CAST")
        val locationHistory = args[0] as List<LocationPoint>
        @Suppress("UNCHECKED_CAST")
        val safeZones = args[1] as List<SafeZone>
        @Suppress("UNCHECKED_CAST")
        val events = args[2] as List<ActivityEvent>
        val trackingState = args[3] as TrackingState
        val trackingConfig = args[4] as TrackingConfig
        val isConnected = args[5] as Boolean
        val lastSync = args[6] as Long
        val lastCommand = args[7] as String
        val remoteStatus = args[8] as SyncChildStatus?
        val remoteActivity = args[9] as SyncActivityEvent?
        
        val lastLocationLocal = locationHistory.firstOrNull()
        
        // Determine if we should use remote data or local mock data
        val useRemote = remoteStatus != null && isConnected
        
        val effectiveLastLocation: SyncLocationUpdate? = if (useRemote) {
            remoteStatus?.lastLocation
        } else {
            lastLocationLocal?.let {
                SyncLocationUpdate(
                    childId = "local",
                    latitude = it.latitude,
                    longitude = it.longitude,
                    accuracy = it.accuracy,
                    speed = it.speed,
                    bearing = it.bearing,
                    timestamp = it.timestamp
                )
            }
        }

        val nearest = effectiveLastLocation?.let { point ->
            safeZones.minByOrNull { checker.calculateDistance(point.latitude, point.longitude, it.latitude, it.longitude) }
        }
        val distance = nearest?.let { zone ->
            effectiveLastLocation?.let { point ->
                checker.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude)
            }
        }
        
        val isInside = distance != null && distance <= (nearest?.radiusMeters ?: 0.0)
        
        val today = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        
        val eventsToday = events.count { it.timestamp >= today }
        val lastEnter = events.firstOrNull { it.type == "SAFE_ZONE_ENTER" }
        val lastExit = events.firstOrNull { it.type == "SAFE_ZONE_EXIT" }
        
        DashboardState.Success(
            DashboardUiModel(
                childName = if (useRemote) remoteStatus?.childName ?: prefHelper.childName else prefHelper.childName,
                deviceName = if (useRemote) remoteStatus?.deviceName ?: prefHelper.deviceName else prefHelper.deviceName,
                isOnline = if (useRemote) remoteStatus?.online ?: isConnected else isConnected,
                lastSeen = if (useRemote) remoteStatus?.let { sdf.format(Date(it.lastSeen)) } ?: "Unknown" else if (lastSync > 0) sdf.format(Date(lastSync)) else "Never",
                batteryPercent = if (useRemote) remoteStatus?.batteryPercent ?: 0 else 85, 
                isCharging = if (useRemote) remoteStatus?.charging ?: false else false,
                trackingState = if (useRemote) (if (remoteStatus?.trackingEnabled == true) "RUNNING" else "STOPPED") else trackingState.name,
                kidGuardStatus = if (useRemote) (if (remoteStatus?.kidGuardActive == true) "LOCKED" else "UNLOCKED") else if (prefHelper.isLocked) "LOCKED" else "UNLOCKED",
                
                currentLat = effectiveLastLocation?.latitude,
                currentLng = effectiveLastLocation?.longitude,
                accuracy = effectiveLastLocation?.accuracy,
                speed = effectiveLastLocation?.speed,
                lastLocationUpdate = effectiveLastLocation?.let { sdf.format(Date(it.timestamp)) } ?: "Never",
                currentAddress = if (useRemote) "Remote Location" else lastLocationLocal?.address,
                currentCity = if (useRemote) null else lastLocationLocal?.city,
                currentCountry = if (useRemote) null else lastLocationLocal?.country,
                
                currentZone = if (useRemote && remoteStatus?.currentZone != null) remoteStatus.currentZone!! else if (isInside) nearest?.name ?: "None" else "Outside Zones",
                nearestZone = nearest?.name ?: "None",
                distanceToNearest = distance?.let { "${it.toInt()}m" } ?: "Unknown",
                lastEnterEvent = lastEnter?.let { sdf.format(Date(it.timestamp)) } ?: "None",
                lastExitEvent = lastExit?.let { sdf.format(Date(it.timestamp)) } ?: "None",
                
                totalEventsToday = eventsToday,
                lastActivityTitle = if (useRemote) remoteActivity?.title ?: "No Activity" else events.firstOrNull()?.title ?: "None",
                lastNotificationTitle = "Safety Alert: ${lastEnter?.title ?: "None"}",
                lastCommandTitle = lastCommand,
                
                trackingConfigSummary = "${trackingConfig.updateIntervalSeconds}s updates",
                totalPointsSaved = locationHistory.size,
                lastGpsPointTime = effectiveLastLocation?.let { sdf.format(Date(it.timestamp)) } ?: "Never",
                totalDistanceToday = "${"%.1f".format(routeRepository.getTotalDistanceToday() / 1000)} km",
                isMockChild = prefHelper.pairedChildId == "mock_child_001"
            )
        )
    }
}
