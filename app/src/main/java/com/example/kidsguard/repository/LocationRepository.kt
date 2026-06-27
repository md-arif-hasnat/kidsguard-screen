package com.example.kidsguard.repository

import android.content.Context
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.routeintelligence.RouteDeviationChecker
import com.example.kidsguard.routeintelligence.KnownRouteRepository
import com.example.kidsguard.tracking.LocalSafeZoneChecker
import com.example.kidsguard.tracking.SafeZoneChecker
import com.example.kidsguard.tracking.TrackingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

class LocationRepository(
    private val context: Context,
    private val safeZoneRepository: SafeZoneRepository? = null,
    private val knownRouteRepository: KnownRouteRepository? = null,
    private val geocoder: com.example.kidsguard.geocoding.ReverseGeocoder? = null,
    private val errorLogRepository: ErrorLogRepository? = null,
    private val syncProvider: com.example.kidsguard.sync.RemoteSyncProvider? = null
) {
    private val prefs = context.getSharedPreferences("location_history_prefs", Context.MODE_PRIVATE)
    private val prefHelper = PreferenceHelper(context)
    private val _locationHistory = MutableStateFlow<List<LocationPoint>>(loadHistory())
    val locationHistory: StateFlow<List<LocationPoint>> = _locationHistory

    private val safeZoneChecker: SafeZoneChecker? = safeZoneRepository?.let { 
        LocalSafeZoneChecker(it, LocalNotificationEngine(context, errorLogRepository), prefHelper)
    }

    private val deviationChecker: RouteDeviationChecker? = knownRouteRepository?.let {
        safeZoneRepository?.let { safeRepo ->
            RouteDeviationChecker(it, safeRepo, LocalNotificationEngine(context, errorLogRepository))
        }
    }

    private val _trackingState = MutableStateFlow(TrackingState.STOPPED)
    val trackingState: StateFlow<TrackingState> = _trackingState

    private var _isTracking = false
    val isTracking: Boolean get() = _isTracking

    fun startTracking() {
        _isTracking = true
        _trackingState.value = TrackingState.RUNNING
    }

    fun stopTracking() {
        _isTracking = false
        _trackingState.value = TrackingState.STOPPED
    }

    fun getCurrentLocation(): LocationPoint? {
        return _locationHistory.value.firstOrNull()
    }

    fun getLastKnownLocation(): LocationPoint? {
        return _locationHistory.value.firstOrNull()
    }

    fun getLocationHistory(): List<LocationPoint> {
        return _locationHistory.value
    }

    private var lastSyncedLocation: LocationPoint? = null
    private var lastSyncTime = 0L

    fun addLocationPoint(point: LocationPoint, forceSync: Boolean = false) {
        try {
            val pointWithAddress = if (point.address == null && geocoder != null) {
                try {
                    val info = geocoder.getAddress(point.latitude, point.longitude)
                    point.copy(
                        address = info?.fullAddress,
                        city = info?.city,
                        country = info?.country
                    )
                } catch (e: Exception) {
                    errorLogRepository?.addError("LocationRepository", "Geocoding failed", e)
                    point
                }
            } else {
                point
            }

            val currentList = _locationHistory.value.toMutableList()
            currentList.add(0, pointWithAddress)
            _locationHistory.value = currentList
            saveHistory(currentList)

            // Filter for excessive writes
            val now = System.currentTimeMillis()
            val distanceSinceLast = lastSyncedLocation?.let {
                calculateDistance(it.latitude, it.longitude, pointWithAddress.latitude, pointWithAddress.longitude)
            } ?: Double.MAX_VALUE

            // Sync to Firebase if:
            // 1. First time
            // 2. Moved > 30 meters
            // 3. More than 5 minutes passed (heartbeat)
            // 4. Forced by remote command
            val shouldSync = forceSync || lastSyncedLocation == null || distanceSinceLast > 30 || (now - lastSyncTime > 300000)

            // Sync to Firebase if Child role and Firebase active
            if (shouldSync && prefHelper.userRole == "CHILD" && prefHelper.childId.isNotEmpty()) {
                val battery = com.example.kidsguard.data.getBatteryLevel(context)
                val update = com.example.kidsguard.sync.SyncLocationUpdate(
                    childId = prefHelper.childId,
                    latitude = pointWithAddress.latitude,
                    longitude = pointWithAddress.longitude,
                    accuracy = pointWithAddress.accuracy,
                    speed = pointWithAddress.speed,
                    bearing = pointWithAddress.bearing,
                    timestamp = pointWithAddress.timestamp,
                    batteryLevel = battery
                )
                
                android.util.Log.i("LocationRepository", "Syncing GPS to Firebase for child: ${prefHelper.childId}")
                syncProvider?.syncLocation(update)
                lastSyncedLocation = pointWithAddress
                lastSyncTime = now
            }

            // Trigger Safe Zone Check
            try {
                safeZoneRepository?.let { repo ->
                    safeZoneChecker?.checkLocation(pointWithAddress, repo.safeZones.value)
                }
            } catch (e: Exception) {
                errorLogRepository?.addError("LocationRepository", "Safe zone check failed", e)
            }

            // Trigger Route Deviation Check
            try {
                deviationChecker?.checkDeviation(pointWithAddress, PreferenceHelper(context).pairedChildId ?: "unknown_child")
            } catch (e: Exception) {
                errorLogRepository?.addError("LocationRepository", "Route deviation check failed", e)
            }
        } catch (e: Exception) {
            errorLogRepository?.addError("LocationRepository", "addLocationPoint failed", e)
        }
    }

    fun clearLocationHistory() {
        _locationHistory.value = emptyList()
        prefs.edit().clear().apply()
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371e3 // Earth's radius in meters
        val phi1 = lat1 * PI / 180
        val phi2 = lat2 * PI / 180
        val deltaPhi = (lat2 - lat1) * PI / 180
        val deltaLambda = (lon2 - lon1) * PI / 180

        val a = sin(deltaPhi / 2).pow(2) +
                cos(phi1) * cos(phi2) *
                sin(deltaLambda / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return r * c
    }

    private fun saveHistory(history: List<LocationPoint>) {
        val jsonArray = JSONArray()
        history.take(100).forEach { point -> // Limit to 100 points for simple persistence
            val jsonObject = JSONObject().apply {
                put("lat", point.latitude)
                put("lng", point.longitude)
                put("accuracy", point.accuracy.toDouble())
                put("speed", point.speed.toDouble())
                put("bearing", point.bearing.toDouble())
                put("timestamp", point.timestamp)
                put("address", point.address ?: "")
                put("city", point.city ?: "")
                put("country", point.country ?: "")
            }
            jsonArray.put(jsonObject)
        }
        prefs.edit().putString("history_json", jsonArray.toString()).apply()
    }

    private fun loadHistory(): List<LocationPoint> {
        val historyJson = prefs.getString("history_json", null) ?: return if (com.example.kidsguard.BuildConfig.DEBUG) mockHistory() else emptyList()
        val history = mutableListOf<LocationPoint>()
        try {
            val jsonArray = JSONArray(historyJson)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                history.add(
                    LocationPoint(
                        latitude = obj.getDouble("lat"),
                        longitude = obj.getDouble("lng"),
                        accuracy = obj.getDouble("accuracy").toFloat(),
                        speed = obj.getDouble("speed").toFloat(),
                        bearing = obj.getDouble("bearing").toFloat(),
                        timestamp = obj.getLong("timestamp"),
                        address = obj.optString("address").takeIf { it.isNotEmpty() },
                        city = obj.optString("city").takeIf { it.isNotEmpty() },
                        country = obj.optString("country").takeIf { it.isNotEmpty() }
                    )
                )
            }
        } catch (e: Exception) {
            return if (com.example.kidsguard.BuildConfig.DEBUG) mockHistory() else emptyList()
        }
        return if (history.isEmpty() && com.example.kidsguard.BuildConfig.DEBUG) mockHistory() else history
    }

    private fun mockHistory(): List<LocationPoint> {
        val now = System.currentTimeMillis()
        return listOf(
            LocationPoint(51.5074, -0.1278, 10f, 0f, 0f, now),
            LocationPoint(51.5075, -0.1279, 8f, 1.2f, 45f, now - 60000),
            LocationPoint(51.5076, -0.1280, 5f, 4.5f, 90f, now - 120000)
        )
    }
}
