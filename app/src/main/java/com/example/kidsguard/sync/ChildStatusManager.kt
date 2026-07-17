package com.example.kidsguard.sync

import android.content.Context
import android.os.BatteryManager
import android.util.Log
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.os.Build
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.data.getBatteryLevel
import com.example.kidsguard.repository.ErrorLogRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.prediction.PredictionEngine
import com.example.kidsguard.tracking.LocalSafeZoneChecker
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.utils.DeviceUtils
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
    private val locationRepository: LocationRepository,
    private val scheduleRepository: com.example.kidsguard.repository.ChildScheduleRepository? = null
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private val errorLogger = ErrorLogRepository(context)
    private val checker = LocalSafeZoneChecker(safeZoneRepository, com.example.kidsguard.notifications.LocalNotificationEngine(context), prefHelper)
    private val predictionEngine = PredictionEngine(context, locationRepository, safeZoneRepository, scheduleRepository)
    private var lastWifiSsid: String? = null

    init {
        registerNetworkCallback()
    }

    private fun registerNetworkCallback() {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = android.net.NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .build()

        cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val wifiInfo = capabilities.transportInfo as? WifiInfo
                    lastWifiSsid = wifiInfo?.ssid?.removeSurrounding("\"")
                } else {
                    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager
                    lastWifiSsid = wifiManager.connectionInfo.ssid.removeSurrounding("\"")
                }

                if (lastWifiSsid == "<unknown ssid>") {
                    lastWifiSsid = null
                }
            }

            override fun onLost(network: Network) {
                lastWifiSsid = null
            }
        })
    }

    companion object {
        private const val TAG = "ChildStatusManager"
    }

    private var syncJob: kotlinx.coroutines.Job? = null

    fun startPeriodicSync() {
        syncJob?.cancel()
        syncJob = scope.launch {
            while (true) {
                try {
                    updateStatus()
            } catch (t: Throwable) {
                errorLogger.addError(TAG, "Periodic status update failed", t)
            }
                delay(5 * 60 * 1000) // Every 5 minutes
            }
        }
    }

    fun stopPeriodicSync() {
        syncJob?.cancel()
        syncJob = null
        Log.d(TAG, "Periodic sync stopped")
    }

    fun updateStatus() {
        Log.d(TAG, "updateStatus: role=${prefHelper.userRole}, childId=${prefHelper.childId}")
        if (prefHelper.userRole != "CHILD") return
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        scope.launch {
            try {
                val batteryLevel = getBatteryLevel(context)
                val isCharging = isDeviceCharging(context)
                val batteryTemp = getBatteryTemperature(context)
                val trackingState = trackingRepository.currentState.value
                
                val lastLocation = locationRepository.locationHistory.value.firstOrNull()
                val safeZones = safeZoneRepository.safeZones.value
                
                val nearest = lastLocation?.let { point ->
                    safeZones.minByOrNull { DeviceUtils.calculateDistance(point.latitude, point.longitude, it.latitude, it.longitude) }
                }
                val distance = nearest?.let { zone ->
                    lastLocation?.let { point ->
                        DeviceUtils.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude)
                    }
                }
                val isInside = distance != null && distance <= (nearest?.radiusMeters ?: 0.0)
                val currentZone = if (isInside) nearest?.name ?: "Outside" else "Outside"

                // Part 1: Device Health Collection
                val internetInfo = getInternetInfo(context)
                val storageInfo = try {
                    getStorageInfo()
                } catch (t: Throwable) {
                    Log.e(TAG, "Storage info collection failed", t)
                    0L to 0L
                }
                val ramInfo = getRamInfo(context)

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
                    lastSeen = System.currentTimeMillis(),
                    batteryTemp = batteryTemp,
                    internetType = internetInfo.first,
                    wifiSsid = internetInfo.second,
                    storageUsedBytes = storageInfo.first,
                    storageTotalBytes = storageInfo.second,
                    ramUsedBytes = ramInfo.first,
                    ramTotalBytes = ramInfo.second,
                    gpsEnabled = isGpsEnabled(context),
                    bluetoothEnabled = isBluetoothEnabled()
                )

                // Add Predictions
                val predictions = predictionEngine.generatePredictions(status, locationRepository.locationHistory.value)
                val finalStatus = status.copy(predictions = predictions)
                
                syncProvider.syncChildStatus(finalStatus)
                Log.d(TAG, "Status update triggered")
            } catch (t: Throwable) {
                errorLogger.addError(TAG, "Manual status update failed", t)
            }
        }
    }

    private fun isDeviceCharging(context: Context): Boolean {
        val batteryStatus = context.registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
        val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    }

    private fun getBatteryTemperature(context: Context): Float {
        val batteryStatus = context.registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
        return (batteryStatus?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10f
    }

    private fun getInternetInfo(context: Context): Pair<String, String?> {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            ?: return "NONE" to null
            
        return try {
            val activeNetwork = cm.activeNetwork ?: return "NONE" to null
            val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return "NONE" to null
            
            when {
                capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) -> {
                    "WIFI" to lastWifiSsid
                }
                capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) -> {
                    "MOBILE" to null
                }
                capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET) -> {
                    "ETHERNET" to null
                }
                else -> "OTHER" to null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting internet info", e)
            "ERROR" to null
        }
    }

    private fun getStorageInfo(): Pair<Long, Long> {
        val stat = android.os.StatFs(android.os.Environment.getDataDirectory().path)
        val blockSize = stat.blockSizeLong
        val totalBlocks = stat.blockCountLong
        val availableBlocks = stat.availableBlocksLong
        return (totalBlocks - availableBlocks) * blockSize to totalBlocks * blockSize
    }

    private fun getRamInfo(context: Context): Pair<Long, Long> {
        val mi = android.app.ActivityManager.MemoryInfo()
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        activityManager.getMemoryInfo(mi)
        return (mi.totalMem - mi.availMem) to mi.totalMem
    }

    private fun isGpsEnabled(context: Context): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
        return lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
    }

    private fun isBluetoothEnabled(): Boolean {
        return try {
            android.bluetooth.BluetoothAdapter.getDefaultAdapter()?.isEnabled ?: false
        } catch (e: Exception) {
            false
        }
    }
}
