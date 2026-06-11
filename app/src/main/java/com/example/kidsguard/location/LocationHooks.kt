package com.example.kidsguard.location

import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone

class SafeZoneChecker {
    fun checkLocation(point: LocationPoint, safeZones: List<SafeZone>) {
        // Future logic to trigger enter/exit events
    }
}

class ActivityGenerator {
    fun generateLocationEvent(point: LocationPoint) {
        // Future logic to add events to ActivityFeed based on movement
    }
}

class NotificationEngine {
    fun sendProximityAlert(zoneName: String, isEntering: Boolean) {
        // Future logic for local notifications
    }
}
