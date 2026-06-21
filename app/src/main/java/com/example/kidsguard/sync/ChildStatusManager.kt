package com.example.kidsguard.sync

import android.content.Context
import android.os.BatteryManager
import android.util.Log
import com.example.kidsguard.BuildConfig
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.data.getBatteryLevel
import com.example.kidsguard.repository.ErrorLogRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.tracking.LocalSafeZoneChecker
import com.example.kidsguard.tracking.TrackingRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class ChildStatusManager(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val syncProvider: RemoteSyncProvider,
    private val trackingRepository: TrackingRepository,
    private val safeZoneRepository: SafeZoneRepository,
    private val locationRepository: LocationRepository
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private val errorLogger = ErrorLogRepository(context)
    private val checker = LocalSafeZoneChecker(safeZoneRepository, com.example.kidsguard.notifications.LocalNotificationEngine(context), prefHelper)

    companion object {
        private const val TAG = "ChildStatusManager"
    }

    fun startPeriodicSync() {
        scope.launch {
            while (true) {
                try {
                    updateStatus()
                } catch (e: Exception) {
                    errorLogger.addError(TAG, "Periodic status update failed", e)
                }
                delay(5 * 60 * 1000) // Every 5 minutes
            }
        }
    }

    fun updateStatus() {
        if (prefHelper.userRole != "CHILD") return
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        scope.launch {
            try {
                val batteryLevel = getBatteryLevel(context)
                val isCharging = isDeviceCharging(context)
                val trackingState = trackingRepository.currentState.value
                
                val lastLocation = locationRepository.locationHistory.value.firstOrNull()
                val safeZones = safeZoneRepository.safeZones.value
                
                val nearest = lastLocation?.let { point ->
                    safeZones.minByOrNull { checker.calculateDistance(point.latitude, point.longitude, it.latitude, it.longitude) }
                }
                val distance = nearest?.let { zone ->
                    lastLocation?.let { point ->
                        checker.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude)
                    }
                }
                val isInside = distance != null && distance <= (nearest?.radiusMeters ?: 0.0)
                val currentZone = if (isInside) nearest?.name ?: "Outside" else "Outside"

                val status = SyncChildStatus(
                    childId = childId,
                    childName = prefHelper.childName,
                    deviceId = prefHelper.deviceId,
                    deviceName = prefHelper.deviceName,
                    batteryPercent = batteryLevel,
                    charging = isCharging,
                    online = true,
                    trackingEnabled = trackingState.name != "IDLE",
                    kidGuardActive = prefHelper.isLocked,
                    currentZone = currentZone,
                    appVersion = "1.0.0",
                    androidVersion = android.os.Build.VERSION.RELEASE,
                    lastSeen = System.currentTimeMillis()
                )
                
                syncProvider.syncChildStatus(status)
                Log.d(TAG, "Status update triggered")
            } catch (e: Exception) {
                errorLogger.addError(TAG, "Manual status update failed", e)
            }
        }
    }

    private fun isDeviceCharging(context: Context): Boolean {
        val batteryStatus = context.registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
        val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    }
}
