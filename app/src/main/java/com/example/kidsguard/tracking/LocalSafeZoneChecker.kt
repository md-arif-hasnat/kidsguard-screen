package com.example.kidsguard.tracking

import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.SafeZoneRepository
import kotlin.math.*

class LocalSafeZoneChecker(
    private val safeZoneRepository: SafeZoneRepository,
    private val notificationEngine: NotificationEngine,
    private val prefHelper: PreferenceHelper
) : SafeZoneChecker {

    // Tracks the last known "inside" status for each zone ID to detect transitions
    private val lastInsideStatus = mutableMapOf<String, Boolean>()

    override fun checkLocation(point: LocationPoint, zones: List<SafeZone>) {
        zones.forEach { zone ->
            if (!zone.enabled) return@forEach

            val distance = calculateDistance(
                point.latitude, point.longitude,
                zone.latitude, zone.longitude
            )
            val currentlyInside = distance <= zone.radiusMeters
            val previouslyInside = lastInsideStatus[zone.id] ?: currentlyInside // Default to current to avoid initial trigger if unknown

            if (currentlyInside && !previouslyInside) {
                // Entered Zone
                if (zone.notifyOnEnter) {
                    val body = "${prefHelper.childName.ifEmpty { "Child" }} arrived at ${zone.name}"
                    
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "SAFE_ZONE_ENTER",
                        title = "Entered ${zone.name}",
                        description = "Smart Safe Zone detected entry",
                        latitude = point.latitude,
                        longitude = point.longitude
                    ))

                    if (prefHelper.isSafeZoneNotificationsEnabled) {
                        notificationEngine.sendSafetyAlert("KidsGuard Alert", body)
                    }
                }
            } else if (!currentlyInside && previouslyInside) {
                // Left Zone
                if (zone.notifyOnExit) {
                    val body = "${prefHelper.childName.ifEmpty { "Child" }} left ${zone.name}"

                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "SAFE_ZONE_EXIT",
                        title = "Left ${zone.name}",
                        description = "Smart Safe Zone detected exit",
                        latitude = point.latitude,
                        longitude = point.longitude
                    ))

                    if (prefHelper.isSafeZoneNotificationsEnabled) {
                        notificationEngine.sendSafetyAlert("KidsGuard Alert", body)
                    }
                }
            }

            lastInsideStatus[zone.id] = currentlyInside
        }
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
