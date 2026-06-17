package com.example.kidsguard.routeintelligence

import android.content.Context
import com.example.kidsguard.models.LocationPoint
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

class KnownRouteRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("known_routes_prefs", Context.MODE_PRIVATE)
    
    private val _knownRoutes = MutableStateFlow<List<KnownRoute>>(loadRoutes())
    val knownRoutes: StateFlow<List<KnownRoute>> = _knownRoutes

    private val _deviationEvents = MutableStateFlow<List<RouteDeviationEvent>>(loadEvents())
    val deviationEvents: StateFlow<List<RouteDeviationEvent>> = _deviationEvents

    fun addKnownRoute(route: KnownRoute) {
        val current = _knownRoutes.value.toMutableList()
        current.add(route)
        _knownRoutes.value = current
        saveRoutes(current)
    }

    fun updateKnownRoute(route: KnownRoute) {
        val current = _knownRoutes.value.toMutableList()
        val index = current.indexOfFirst { it.id == route.id }
        if (index != -1) {
            current[index] = route
            _knownRoutes.value = current
            saveRoutes(current)
        }
    }

    fun deleteKnownRoute(id: String) {
        val current = _knownRoutes.value.toMutableList()
        current.removeAll { it.id == id }
        _knownRoutes.value = current
        saveRoutes(current)
    }

    fun addDeviationEvent(event: RouteDeviationEvent) {
        val current = _deviationEvents.value.toMutableList()
        current.add(0, event)
        _deviationEvents.value = current
        saveEvents(current)
    }

    fun resolveDeviation(id: String) {
        val current = _deviationEvents.value.toMutableList()
        val index = current.indexOfFirst { it.id == id }
        if (index != -1) {
            current[index] = current[index].copy(resolved = true)
            _deviationEvents.value = current
            saveEvents(current)
        }
    }

    fun clearAll() {
        _knownRoutes.value = emptyList()
        _deviationEvents.value = emptyList()
        prefs.edit().clear().apply()
    }

    private fun saveRoutes(routes: List<KnownRoute>) {
        val array = JSONArray()
        routes.forEach { route ->
            val obj = JSONObject().apply {
                put("id", route.id)
                put("name", route.name)
                put("startZoneId", route.startZoneId ?: "")
                put("endZoneId", route.endZoneId ?: "")
                put("tolerance", route.toleranceMeters)
                put("enabled", route.enabled)
                
                val pointsArray = JSONArray()
                route.routePoints.forEach { p ->
                    pointsArray.put(JSONObject().apply {
                        put("lat", p.latitude)
                        put("lng", p.longitude)
                    })
                }
                put("points", pointsArray)
            }
            array.put(obj)
        }
        prefs.edit().putString("routes_json", array.toString()).apply()
    }

    private fun loadRoutes(): List<KnownRoute> {
        val json = prefs.getString("routes_json", null) ?: return emptyList()
        val list = mutableListOf<KnownRoute>()
        try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val points = mutableListOf<LocationPoint>()
                val pArray = obj.getJSONArray("points")
                for (j in 0 until pArray.length()) {
                    val pObj = pArray.getJSONObject(j)
                    points.add(LocationPoint(pObj.getDouble("lat"), pObj.getDouble("lng"), 0f, 0f, 0f, 0L))
                }
                list.add(KnownRoute(
                    id = obj.getString("id"),
                    name = obj.getString("name"),
                    startZoneId = obj.optString("startZoneId").takeIf { it.isNotEmpty() },
                    endZoneId = obj.optString("endZoneId").takeIf { it.isNotEmpty() },
                    routePoints = points,
                    toleranceMeters = obj.getDouble("tolerance"),
                    enabled = obj.getBoolean("enabled")
                ))
            }
        } catch (e: Exception) { e.printStackTrace() }
        return list
    }

    private fun saveEvents(events: List<RouteDeviationEvent>) {
        val array = JSONArray()
        events.take(50).forEach { e ->
            val obj = JSONObject().apply {
                put("id", e.id)
                put("childId", e.childId)
                put("routeId", e.knownRouteId)
                put("timestamp", e.timestamp)
                put("lat", e.latitude)
                put("lng", e.longitude)
                put("dist", e.distanceFromRouteMeters)
                put("severity", e.severity.name)
                put("msg", e.message)
                put("resolved", e.resolved)
            }
            array.put(obj)
        }
        prefs.edit().putString("events_json", array.toString()).apply()
    }

    private fun loadEvents(): List<RouteDeviationEvent> {
        val json = prefs.getString("events_json", null) ?: return emptyList()
        val list = mutableListOf<RouteDeviationEvent>()
        try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(RouteDeviationEvent(
                    id = obj.getString("id"),
                    childId = obj.getString("childId"),
                    knownRouteId = obj.getString("routeId"),
                    timestamp = obj.getLong("timestamp"),
                    latitude = obj.getDouble("lat"),
                    longitude = obj.getDouble("lng"),
                    distanceFromRouteMeters = obj.getDouble("dist"),
                    severity = DeviationSeverity.valueOf(obj.getString("severity")),
                    message = obj.getString("msg"),
                    resolved = obj.getBoolean("resolved")
                ))
            }
        } catch (e: Exception) { e.printStackTrace() }
        return list
    }
}
