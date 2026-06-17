package com.example.kidsguard.repository

import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.RouteSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlin.math.*

class RouteRepository(private val locationRepository: LocationRepository) {
    private val _routeSessions = MutableStateFlow<List<RouteSession>>(emptyList())
    val routeSessions: StateFlow<List<RouteSession>> = _routeSessions

    init {
        generateRouteSessions()
    }

    fun generateRouteSessions() {
        val allPoints = locationRepository.getLocationHistory().reversed() // Oldest to newest
        if (allPoints.isEmpty()) {
            _routeSessions.value = emptyList()
            return
        }

        val sessions = mutableListOf<RouteSession>()
        var currentPoints = mutableListOf<LocationPoint>()
        
        val gapThresholdMillis = 15 * 60 * 1000 // 15 minutes gap starts a new session

        allPoints.forEach { point ->
            if (currentPoints.isEmpty()) {
                currentPoints.add(point)
            } else {
                val lastPoint = currentPoints.last()
                if (point.timestamp - lastPoint.timestamp > gapThresholdMillis) {
                    // Start new session
                    sessions.add(createSessionFromPoints(currentPoints))
                    currentPoints = mutableListOf(point)
                } else {
                    currentPoints.add(point)
                }
            }
        }
        
        if (currentPoints.isNotEmpty()) {
            sessions.add(createSessionFromPoints(currentPoints))
        }

        _routeSessions.value = sessions.reversed() // Newest first
    }

    private fun createSessionFromPoints(points: List<LocationPoint>): RouteSession {
        var totalDistance = 0.0
        var maxSpeed = 0f
        var totalSpeed = 0f

        for (i in 0 until points.size - 1) {
            val p1 = points[i]
            val p2 = points[i + 1]
            totalDistance += calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude)
            if (p2.speed > maxSpeed) maxSpeed = p2.speed
            totalSpeed += p2.speed
        }

        return RouteSession(
            startTime = points.first().timestamp,
            endTime = points.last().timestamp,
            totalPoints = points.size,
            totalDistanceMeters = totalDistance,
            averageSpeed = if (points.size > 1) totalSpeed / (points.size - 1) else 0f,
            maxSpeed = maxSpeed,
            points = points
        )
    }

    fun getRouteDetails(routeId: String): RouteSession? {
        return _routeSessions.value.find { it.id == routeId }
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
    
    fun getLongestRoute(): RouteSession? {
        return _routeSessions.value.maxByOrNull { it.totalDistanceMeters }
    }
    
    fun getTotalDistanceToday(): Double {
        val today = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
        }.timeInMillis
        
        return _routeSessions.value
            .filter { it.startTime >= today }
            .sumOf { it.totalDistanceMeters }
    }
}
