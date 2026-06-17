package com.example.kidsguard.routeintelligence

import com.example.kidsguard.models.LocationPoint
import java.util.UUID

data class KnownRoute(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val startZoneId: String? = null,
    val endZoneId: String? = null,
    val routePoints: List<LocationPoint>,
    val toleranceMeters: Double = 100.0,
    val activeDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7), // 1=Sun, 7=Sat
    val startTimeWindow: String = "00:00",
    val endTimeWindow: String = "23:59",
    val enabled: Boolean = true
)

enum class DeviationSeverity {
    LOW, MEDIUM, HIGH
}

data class RouteDeviationEvent(
    val id: String = UUID.randomUUID().toString(),
    val childId: String,
    val knownRouteId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val latitude: Double,
    val longitude: Double,
    val distanceFromRouteMeters: Double,
    val severity: DeviationSeverity,
    val message: String,
    val resolved: Boolean = false
)
