package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.models.LocationPoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

class LocationRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("location_history_prefs", Context.MODE_PRIVATE)
    private val _locationHistory = MutableStateFlow<List<LocationPoint>>(loadHistory())
    val locationHistory: StateFlow<List<LocationPoint>> = _locationHistory

    private var _isTracking = false
    val isTracking: Boolean get() = _isTracking

    fun startTracking() {
        _isTracking = true
    }

    fun stopTracking() {
        _isTracking = false
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
        val currentList = _locationHistory.value.toMutableList()
        currentList.add(0, point)
        _locationHistory.value = currentList
        saveHistory(currentList)
    }

    fun clearLocationHistory() {
        _locationHistory.value = emptyList()
        prefs.edit().clear().apply()
    }

    private fun saveHistory(history: List<LocationPoint>) {
        try {
            val jsonArray = JSONArray()
            history.take(100).forEach { point ->
                val jsonObject = JSONObject().apply {
                    put("lat", point.latitude)
                    put("lng", point.longitude)
                    put("accuracy", point.accuracy.toDouble())
                    put("speed", point.speed.toDouble())
                    put("bearing", point.bearing.toDouble())
                    put("timestamp", point.timestamp)
                }
                jsonArray.put(jsonObject)
            }
            prefs.edit().putString("history_json", jsonArray.toString()).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save location history", e)
        }
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
                        timestamp = obj.getLong("timestamp")
                    )
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse location history JSON, falling back to mock data", e)
            return mockHistory()
        }
        return if (history.isEmpty()) mockHistory() else history
    }

    companion object {
        private const val TAG = "LocationRepository"
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
