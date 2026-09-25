package com.example.kidsguard.tracking

import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.SyncActivityEvent
import com.example.kidsguard.utils.DeviceUtils
import kotlin.math.max
import kotlin.math.min

class LocalSafeZoneChecker(
    private val safeZoneRepository: SafeZoneRepository,
    private val notificationEngine: NotificationEngine,
    private val prefHelper: PreferenceHelper
) : SafeZoneChecker {

    private val lastInsideStatus = mutableMapOf<String, Boolean>()

    override fun checkLocation(point: LocationPoint, zones: List<SafeZone>) {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        var foundInsideAny = false
        var insideZoneId: String? = null
        var insideZoneName: String? = null

        zones.forEach { zone ->
            if (!zone.enabled) return@forEach

            val stateKey = zoneStateKey(zone)
            val distance = DeviceUtils.calculateDistance(
                point.latitude,
                point.longitude,
                zone.latitude,
                zone.longitude
            )
            val previousState =
                lastInsideStatus[stateKey]
                    ?: prefHelper.getSafeZoneInsideState(stateKey)

            // GPS fixes often move around near a boundary. A small accuracy-aware
            // hysteresis prevents repeated enter/exit alerts while the device is
            // effectively stationary.
            val hysteresisMeters = min(
                max(point.accuracy.toDouble(), MIN_HYSTERESIS_METERS),
                min(MAX_HYSTERESIS_METERS, zone.radiusMeters * HYSTERESIS_RADIUS_RATIO)
            )
            val currentlyInside = when (previousState) {
                true -> distance <= zone.radiusMeters + hysteresisMeters
                false -> distance <= max(0.0, zone.radiusMeters - hysteresisMeters)
                null -> distance <= zone.radiusMeters
            }

            if (currentlyInside) {
                foundInsideAny = true
                if (insideZoneId == null) {
                    insideZoneId = zone.id
                    insideZoneName = zone.name
                }
            }

            if (previousState != null && previousState != currentlyInside) {
                val eventType = if (currentlyInside) "ENTER_ZONE" else "EXIT_ZONE"
                val notificationEnabled =
                    if (currentlyInside) zone.notifyOnEnter else zone.notifyOnExit

                if (notificationEnabled) {
                    triggerZoneEvent(
                        childId,
                        zone,
                        point,
                        distance,
                        eventType
                    )
                } else {
                    android.util.Log.d(
                        TAG,
                        "Transition recorded without alert: type=$eventType zone=${zone.name}"
                    )
                }
            }

            if (previousState == null || previousState != currentlyInside) {
                prefHelper.setSafeZoneInsideState(stateKey, currentlyInside)
            }
            lastInsideStatus[stateKey] = currentlyInside
        }

        updateOverallStatus(
            foundInsideAny,
            insideZoneId,
            insideZoneName
        )
    }

    private fun triggerZoneEvent(
        childId: String,
        zone: SafeZone,
        point: LocationPoint,
        distance: Double,
        type: String
    ) {
        android.util.Log.d(TAG, "triggerZoneEvent: type=$type, zone=${zone.name}")
        val title = if (type == "ENTER_ZONE") {
            if (zone.type == "Home" || zone.type == "School") {
                "Arrived at ${zone.type}"
            } else {
                "Entered ${zone.name}"
            }
        } else {
            if (zone.type == "Home" || zone.type == "School") {
                "Left ${zone.type}"
            } else {
                "Left ${zone.name}"
            }
        }

        val movement = if (type == "ENTER_ZONE") "arrived at" else "left"
        val body =
            "${prefHelper.childName.ifEmpty { "Child" }} $movement ${zone.name}"

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

        if (prefHelper.isSafeZoneNotificationsEnabled) {
            notificationEngine.sendSafetyAlert("KidsGuard Alert", body)
        }
    }

    private fun updateOverallStatus(
        inside: Boolean,
        zoneId: String?,
        zoneName: String?
    ) {
        val previousZoneId = prefHelper.currentZoneId
        val nextZoneId = if (inside) zoneId else null
        prefHelper.currentZoneId = nextZoneId

        // Avoid a Firestore read/write on every location callback. The status
        // only needs to be synced when the overall zone membership changes.
        if (previousZoneId == nextZoneId) return

        safeZoneRepository.updateSyncStatus(
            zoneName ?: "Unknown",
            zoneId,
            if (inside) "INSIDE" else "OUTSIDE"
        )
    }

    private fun zoneStateKey(zone: SafeZone): String {
        if (zone.id.isNotBlank()) return zone.id
        return "${zone.name}_${zone.latitude}_${zone.longitude}"
    }

    companion object {
        private const val TAG = "SafeZoneChecker"
        private const val MIN_HYSTERESIS_METERS = 10.0
        private const val MAX_HYSTERESIS_METERS = 50.0
        private const val HYSTERESIS_RADIUS_RATIO = 0.25
    }
}
