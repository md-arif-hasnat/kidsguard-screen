package com.example.kidsguard.repository

import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncActivityEvent
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SafeZoneRepository {
    private val _safeZones = MutableStateFlow<List<SafeZone>>(emptyList())
    val safeZones: StateFlow<List<SafeZone>> = _safeZones

    private val _activityEvents = MutableStateFlow<List<ActivityEvent>>(emptyList())
    val activityEvents: StateFlow<List<ActivityEvent>> = _activityEvents

    private var syncProvider: RemoteSyncProvider? = null
    private var childId: String? = null
    private var familyId: String? = null
    private var syncJob: kotlinx.coroutines.Job? = null

    init {
        // Production: No mock data in release
        if (com.example.kidsguard.BuildConfig.DEBUG) {
            _safeZones.value = listOf(
                SafeZone(name = "Home", type = "Home", address = "Musterstraße 10, 41236 Mönchengladbach", latitude = 37.7749, longitude = -122.4194, radiusMeters = 300.0),
                SafeZone(name = "School", type = "School", address = "Example School, Mönchengladbach", latitude = 37.7849, longitude = -122.4294, radiusMeters = 200.0)
            )
        }
    }

    fun setSyncProvider(provider: RemoteSyncProvider, id: String, familyId: String? = null) {
        this.syncProvider = provider
        this.childId = id
        this.familyId = familyId
        
        if (id.isNotEmpty() && familyId != null && familyId.isNotEmpty()) {
            startSync(id, familyId)
        }
    }

    private fun startSync(childId: String, familyId: String) {
        syncJob?.cancel()
        syncJob = GlobalScope.launch(Dispatchers.IO) {
            // Combine both family-level and child-level zones
            val familyFlow = syncProvider?.getSafeZones(familyId) ?: kotlinx.coroutines.flow.flowOf(emptyList())
            val childFlow = syncProvider?.getSafeZonesForChild(childId) ?: kotlinx.coroutines.flow.flowOf(emptyList())
            
            kotlinx.coroutines.flow.combine(familyFlow, childFlow) { familyZones, childZones ->
                // Merge lists, childZones take priority
                val merged = familyZones.toMutableList()
                childZones.forEach { cz ->
                    val index = merged.indexOfFirst { it.id == cz.id }
                    if (index != -1) {
                        merged[index] = cz
                    } else {
                        merged.add(cz)
                    }
                }
                merged
            }.collect { zones ->
                _safeZones.value = zones
                android.util.Log.d("SafeZoneRepo", "Received ${zones.size} combined zones from Firebase")
            }
        }
    }

    fun addSafeZone(zone: SafeZone) {
        _safeZones.value = _safeZones.value + zone
        
        val currentChildId = childId
        if (syncProvider != null && currentChildId != null && currentChildId.isNotEmpty()) {
            android.util.Log.d("SafeZoneRepo", "Syncing new safe zone for child: ${zone.name}")
            syncProvider?.syncSafeZone(currentChildId, zone)
        }
    }

    fun updateSafeZone(updatedZone: SafeZone) {
        _safeZones.value = _safeZones.value.map {
            if (it.id == updatedZone.id) updatedZone else it
        }
        
        val currentChildId = childId
        if (syncProvider != null && currentChildId != null && currentChildId.isNotEmpty()) {
            android.util.Log.d("SafeZoneRepo", "Syncing updated safe zone for child: ${updatedZone.name}")
            syncProvider?.syncSafeZone(currentChildId, updatedZone)
        }
    }

    fun deleteSafeZone(id: String) {
        _safeZones.value = _safeZones.value.filter { it.id != id }
    }

    fun addEvent(event: ActivityEvent, detailed: SyncActivityEvent? = null) {
        _activityEvents.value = listOf(event) + _activityEvents.value
        
        // Sync to Firebase if provider available
        val currentChildId = childId
        if (syncProvider != null && currentChildId != null && currentChildId.isNotEmpty()) {
            val syncEvent = detailed ?: SyncActivityEvent(
                id = event.id,
                childId = currentChildId,
                type = event.type,
                title = event.title,
                description = event.description,
                timestamp = event.timestamp
            )
            syncProvider?.syncActivity(syncEvent)
        }
    }

    fun updateSyncStatus(zoneName: String, zoneId: String?, status: String) {
        val currentChildId = childId
        if (syncProvider != null && currentChildId != null && currentChildId.isNotEmpty()) {
            GlobalScope.launch(Dispatchers.IO) {
                // Get current status from flow and update it
                syncProvider?.getChildStatus(currentChildId)?.collect { current ->
                    if (current != null) {
                        val updated = current.copy(
                            currentZone = if (status == "INSIDE") zoneName else "Outside Zones",
                            currentZoneId = if (status == "INSIDE") zoneId else null,
                            safeZoneStatus = status,
                            lastZoneEvent = if (status == "INSIDE") "ENTER_ZONE" else "EXIT_ZONE",
                            lastUpdated = System.currentTimeMillis()
                        )
                        syncProvider?.syncChildStatus(updated)
                    }
                    this.cancel() // Only update once
                }
            }
        }
    }

    fun clearEvents() {
        _activityEvents.value = emptyList()
    }

    fun clearAllSafeZones() {
        _safeZones.value = emptyList()
    }
}
