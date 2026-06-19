package com.example.kidsguard.repository

import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncActivityEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SafeZoneRepository {
    private val _safeZones = MutableStateFlow<List<SafeZone>>(emptyList())
    val safeZones: StateFlow<List<SafeZone>> = _safeZones

    private val _activityEvents = MutableStateFlow<List<ActivityEvent>>(emptyList())
    val activityEvents: StateFlow<List<ActivityEvent>> = _activityEvents

    private var syncProvider: RemoteSyncProvider? = null
    private var childId: String? = null

    init {
        // Mock data for Safe Zones
        _safeZones.value = listOf(
            SafeZone(name = "Home", type = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 500.0),
            SafeZone(name = "School", type = "School", latitude = 37.7849, longitude = -122.4294, radiusMeters = 200.0),
            SafeZone(name = "Playground", type = "Playground", latitude = 37.7649, longitude = -122.4094, radiusMeters = 1000.0)
        )
        
        // Mock data for Activity Feed
        _activityEvents.value = listOf(
            ActivityEvent(type = "KID_MODE_DISABLED", title = "Kid Mode Disabled", description = "Manual unlock", timestamp = System.currentTimeMillis() - 1000 * 60 * 10),
            ActivityEvent(type = "SAFE_ZONE_ENTER", title = "Entered Home", description = "Smart Safe Zone", timestamp = System.currentTimeMillis() - 1000 * 60 * 60 * 2),
            ActivityEvent(type = "SAFE_ZONE_EXIT", title = "Left School", description = "Smart Safe Zone", timestamp = System.currentTimeMillis() - 1000 * 60 * 60 * 4),
            ActivityEvent(type = "KID_MODE_ENABLED", title = "Kid Mode Enabled", description = "Scheduled lock", timestamp = System.currentTimeMillis() - 1000 * 60 * 60 * 8)
        )
    }

    fun setSyncProvider(provider: RemoteSyncProvider, id: String) {
        this.syncProvider = provider
        this.childId = id
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

    fun addEvent(event: ActivityEvent) {
        _activityEvents.value = listOf(event) + _activityEvents.value
        
        // Sync to Firebase if provider available
        val currentChildId = childId
        if (syncProvider != null && currentChildId != null && currentChildId.isNotEmpty()) {
            syncProvider?.syncActivity(
                SyncActivityEvent(
                    id = event.id,
                    childId = currentChildId,
                    type = event.type,
                    title = event.title,
                    description = event.description,
                    timestamp = event.timestamp
                )
            )
        }
    }

    fun clearEvents() {
        _activityEvents.value = emptyList()
    }

    fun clearAllSafeZones() {
        _safeZones.value = emptyList()
    }
}
