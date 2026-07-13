package com.example.kidsguard.tracking

import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.SyncActivityEvent
import com.example.kidsguard.utils.DeviceUtils

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

            val distance = DeviceUtils.calculateDistance(
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
        android.util.Log.d("SafeZoneChecker", "triggerZoneEvent: type=$type, zone=${zone.name}")
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
        // Update preference helper for local automation (Protection Modes)
        prefHelper.currentZoneId = if (inside) zoneId else null

        // SafeZoneRepository should expose a way to update the "status/current" fields
        safeZoneRepository.updateSyncStatus(
            zoneName ?: "Unknown",
            zoneId,
            if (inside) "INSIDE" else "OUTSIDE"
        )
    }
}
