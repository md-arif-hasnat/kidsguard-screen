package com.example.kidsguard.geofence

import com.example.kidsguard.models.SafeZone
import kotlin.math.*

class GeofenceManager {

    /**
     * Calculates the distance between two points using the Haversine formula.
     */
    fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0 // Earth's radius in meters
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    fun isInsideZone(lat: Double, lon: Double, zone: SafeZone): Boolean {
        val distance = calculateDistance(lat, lon, zone.latitude, zone.longitude)
        return distance <= zone.radiusMeters
    }

    /**
     * Checks for transitions and returns ActivityEvents if triggered.
     * In a real app, this would compare previous location vs current location.
     */
    fun checkTransitions(
        prevLat: Double?, prevLon: Double?,
        currLat: Double, currLon: Double,
        zones: List<SafeZone>
    ): List<String> {
        val events = mutableListOf<String>()
        if (prevLat == null || prevLon == null) return events

        zones.filter { it.enabled }.forEach { zone ->
            val wasInside = isInsideZone(prevLat, prevLon, zone)
            val isInside = isInsideZone(currLat, currLon, zone)

            if (!wasInside && isInside && zone.notifyOnEnter) {
                events.add("Entered ${zone.name}")
            } else if (wasInside && !isInside && zone.notifyOnExit) {
                events.add("Left ${zone.name}")
            }
        }
        return events
    }
}
