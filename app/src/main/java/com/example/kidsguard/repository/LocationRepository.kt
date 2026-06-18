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

class LocationRepository(
    private val context: Context,
    private val safeZoneRepository: SafeZoneRepository? = null,
    private val knownRouteRepository: KnownRouteRepository? = null,
    private val geocoder: com.example.kidsguard.geocoding.ReverseGeocoder? = null,
    private val errorLogRepository: ErrorLogRepository? = null
) {
    private val prefs = context.getSharedPreferences("location_history_prefs", Context.MODE_PRIVATE)
    private val _locationHistory = MutableStateFlow<List<LocationPoint>>(loadHistory())
    val locationHistory: StateFlow<List<LocationPoint>> = _locationHistory

    private val safeZoneChecker: SafeZoneChecker? = safeZoneRepository?.let { 
        LocalSafeZoneChecker(it, LocalNotificationEngine(context, errorLogRepository), PreferenceHelper(context)) 
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

    fun addLocationPoint(point: LocationPoint) {
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
        val historyJson = prefs.getString("history_json", null) ?: return mockHistory()
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
            return mockHistory()
        }
        return if (history.isEmpty()) mockHistory() else history
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
