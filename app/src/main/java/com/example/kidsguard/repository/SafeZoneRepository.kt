package com.example.kidsguard.repository

import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.models.ActivityEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SafeZoneRepository {
    private val _safeZones = MutableStateFlow<List<SafeZone>>(emptyList())
    val safeZones: StateFlow<List<SafeZone>> = _safeZones

    private val _activityEvents = MutableStateFlow<List<ActivityEvent>>(emptyList())
    val activityEvents: StateFlow<List<ActivityEvent>> = _activityEvents

    init {
        // Mock data
        _safeZones.value = listOf(
            SafeZone(name = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 500.0),
            SafeZone(name = "School", latitude = 37.7849, longitude = -122.4294, radiusMeters = 200.0),
            SafeZone(name = "Playground", latitude = 37.7649, longitude = -122.4094, radiusMeters = 1000.0)
        )
        
        _activityEvents.value = listOf(
            ActivityEvent(type = "Left", zoneName = "Home", details = "08:12"),
            ActivityEvent(type = "Arrived", zoneName = "School", details = "08:36"),
            ActivityEvent(type = "Left", zoneName = "School", details = "14:45"),
            ActivityEvent(type = "Arrived", zoneName = "Playground", details = "15:04"),
            ActivityEvent(type = "Arrived", zoneName = "Home", details = "18:20")
        )
    }

    fun addSafeZone(zone: SafeZone) {
        _safeZones.value = _safeZones.value + zone
    }

    fun updateSafeZone(updatedZone: SafeZone) {
        _safeZones.value = _safeZones.value.map {
            if (it.id == updatedZone.id) updatedZone else it
        }
    }

    fun deleteSafeZone(id: String) {
        _safeZones.value = _safeZones.value.filter { it.id != id }
    }

    fun addActivityEvent(event: ActivityEvent) {
        _activityEvents.value = listOf(event) + _activityEvents.value
    }
}
