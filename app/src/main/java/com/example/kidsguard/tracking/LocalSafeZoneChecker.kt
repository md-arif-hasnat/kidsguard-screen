package com.example.kidsguard.tracking

import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.SyncActivityEvent
import kotlin.math.*

class LocalSafeZoneChecker(
    private val safeZoneRepository: SafeZoneRepository,
    private val notificationEngine: NotificationEngine,
    private val prefHelper: PreferenceHelper
) : SafeZoneChecker {

    // Tracks the last known "inside" status for each zone ID to detect transitions
    private val lastInsideStatus = mutableMapOf<String, Boolean>()

    override fun checkLocation(point: LocationPoint, zones: List<SafeZone>) {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        var foundInsideAny = false
        var insideZoneId: String? = null
        var insideZoneName: String? = null

        zones.forEach { zone ->
            if (!zone.enabled) return@forEach

            val distance = calculateDistance(
                point.latitude, point.longitude,
                zone.latitude, zone.longitude
            )
            val currentlyInside = distance <= zone.radiusMeters
            val previouslyInside = lastInsideStatus[zone.id] ?: currentlyInside // Default to current if unknown

            if (currentlyInside) {
                foundInsideAny = true
                insideZoneId = zone.id
                insideZoneName = zone.name

                if (!previouslyInside) {
                    // ENTER_ZONE transition
                    triggerZoneEvent(childId, zone, point, distance, "ENTER_ZONE")
                }
            } else if (previouslyInside) {
                // EXIT_ZONE transition
                triggerZoneEvent(childId, zone, point, distance, "EXIT_ZONE")
            }

            lastInsideStatus[zone.id] = currentlyInside
        }

        // Update overall status
        updateOverallStatus(childId, foundInsideAny, insideZoneId, insideZoneName)
    }

    private fun triggerZoneEvent(
        childId: String,
        zone: SafeZone,
        point: LocationPoint,
        distance: Double,
        type: String
    ) {
        val title = if (type == "ENTER_ZONE") {
            if (zone.type == "Home" || zone.type == "School") "Arrived at ${zone.type}" else "Entered ${zone.name}"
        } else {
            if (zone.type == "Home" || zone.type == "School") "Left ${zone.type}" else "Left ${zone.name}"
        }

        val body = "${prefHelper.childName.ifEmpty { "Child" }} ${if (type == "ENTER_ZONE") "arrived at" else "left"} ${zone.name}"
        
        // Detailed event for sync logic to pick up
        val event = SyncActivityEvent(
            childId = childId,
            type = type,
            title = title,
            description = body,
            zoneId = zone.id,
            zoneName = zone.name,
            zoneType = zone.type,
            latitude = point.latitude,
            longitude = point.longitude,
            distanceMeters = distance,
            radiusMeters = zone.radiusMeters,
            timestamp = System.currentTimeMillis(),
            severity = if (type == "EXIT_ZONE") "warning" else "info"
        )

        // 1. Add to local repository (which syncs to Firestore)
        safeZoneRepository.addEvent(
            ActivityEvent(
                id = event.id,
                type = event.type,
                title = event.title,
                description = event.description,
                latitude = point.latitude,
                longitude = point.longitude,
                timestamp = event.timestamp
            ),
            detailed = event
        )

        // Send local notification
        if (prefHelper.isSafeZoneNotificationsEnabled) {
            notificationEngine.sendSafetyAlert("KidsGuard Alert", body)
        }
    }

    private fun updateOverallStatus(
        childId: String,
        inside: Boolean,
        zoneId: String?,
        zoneName: String?
    ) {
        // SafeZoneRepository should expose a way to update the "status/current" fields
        safeZoneRepository.updateSyncStatus(
            zoneName ?: "Unknown",
            zoneId,
            if (inside) "INSIDE" else "OUTSIDE"
        )
    }

    /**
     * Haversine formula to calculate distance between two points in meters.
     */
    fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
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
}
