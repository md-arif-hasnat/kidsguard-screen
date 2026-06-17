package com.example.kidsguard.routeintelligence

import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.notifications.LocalNotificationEngine
import kotlin.math.*

class RouteDeviationChecker(
    private val routeRepository: KnownRouteRepository,
    private val activityRepository: SafeZoneRepository,
    private val notificationEngine: LocalNotificationEngine
) {

    fun checkDeviation(point: LocationPoint, childId: String) {
        val routes = routeRepository.knownRoutes.value.filter { it.enabled }
        if (routes.isEmpty()) return

        routes.forEach { route ->
            val minDistance = distanceFromRoute(point, route)
            if (minDistance > route.toleranceMeters) {
                triggerDeviation(point, route, minDistance, childId)
            }
        }
    }

    private fun distanceFromRoute(point: LocationPoint, route: KnownRoute): Double {
        if (route.routePoints.isEmpty()) return Double.MAX_VALUE
        
        var minDistance = Double.MAX_VALUE
        route.routePoints.forEach { rp ->
            val d = calculateDistance(point.latitude, point.longitude, rp.latitude, rp.longitude)
            if (d < minDistance) minDistance = d
        }
        return minDistance
    }

    private fun triggerDeviation(point: LocationPoint, route: KnownRoute, distance: Double, childId: String) {
        // Simple logic: if distance is > 3x tolerance, it's HIGH severity
        val severity = when {
            distance > route.toleranceMeters * 5 -> DeviationSeverity.HIGH
            distance > route.toleranceMeters * 2 -> DeviationSeverity.MEDIUM
            else -> DeviationSeverity.LOW
        }

        val event = RouteDeviationEvent(
            childId = childId,
            knownRouteId = route.id,
            latitude = point.latitude,
            longitude = point.longitude,
            distanceFromRouteMeters = distance,
            severity = severity,
            message = "Child is ${distance.toInt()}m away from route: ${route.name}"
        )

        routeRepository.addDeviationEvent(event)

        activityRepository.addEvent(ActivityEvent(
            type = "ROUTE_DEVIATION",
            title = "Route Deviation: ${route.name}",
            description = event.message,
            latitude = point.latitude,
            longitude = point.longitude
        ))

        if (severity == DeviationSeverity.HIGH || severity == DeviationSeverity.MEDIUM) {
            notificationEngine.sendSafetyAlert(
                "Route Deviation Alert",
                "${route.name}: Child is ${distance.toInt()}m off course!"
            )
        }
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371e3
        val phi1 = lat1 * PI / 180
        val phi2 = lat2 * PI / 180
        val deltaPhi = (lat2 - lat1) * PI / 180
        val deltaLambda = (lon2 - lon1) * PI / 180
        val a = sin(deltaPhi / 2).pow(2) + cos(phi1) * cos(phi2) * sin(deltaLambda / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }
}
