package com.example.kidsguard.repository

import android.content.Context
import com.example.kidsguard.models.SosEvent
import com.example.kidsguard.sync.SyncActivityEvent
import com.example.kidsguard.sync.SyncNotificationEvent
import com.example.kidsguard.models.SosStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

class SosRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("sos_prefs", Context.MODE_PRIVATE)
    private var syncProvider: com.example.kidsguard.sync.RemoteSyncProvider? = null

    private val _sosHistory = MutableStateFlow<List<SosEvent>>(loadHistory())
    val sosHistory: StateFlow<List<SosEvent>> = _sosHistory

    private val _activeSos = MutableStateFlow<SosEvent?>(determineActiveSos())
    val activeSos: StateFlow<SosEvent?> = _activeSos

    fun setSyncProvider(provider: com.example.kidsguard.sync.RemoteSyncProvider) {
        this.syncProvider = provider
    }

    fun triggerSos(event: SosEvent) {
        android.util.Log.d("SosRepository", "triggerSos: childId=${event.childId}")
        if (event.id.isBlank()) {
            event.id = java.util.UUID.randomUUID().toString()
            android.util.Log.d("SosRepository", "triggerSos: generated new id=${event.id}")
        }
        val updatedEvent = event.copy(status = SosStatus.ACTIVE)
        val currentList = _sosHistory.value.toMutableList()
        currentList.add(0, updatedEvent)
        _sosHistory.value = currentList
        _activeSos.value = updatedEvent
        saveHistory(currentList)
        
        // Sync to Firebase
        android.util.Log.d("SosRepository", "Syncing SOS event to Firebase")
        syncProvider?.syncSosEvent(updatedEvent)

        // Fan-out: Activity History
        syncProvider?.syncActivity(SyncActivityEvent(
            id = updatedEvent.id,
            childId = updatedEvent.childId,
            type = "SOS",
            title = "Emergency SOS Triggered",
            description = updatedEvent.message,
            latitude = updatedEvent.latitude,
            longitude = updatedEvent.longitude,
            timestamp = updatedEvent.timestamp,
            severity = "critical"
        ))

        // Fan-out: Notification Record
        syncProvider?.syncNotification(SyncNotificationEvent(
            id = updatedEvent.id,
            childId = updatedEvent.childId,
            type = "SOS",
            title = "🆘 SOS ACTIVATED",
            body = updatedEvent.message,
            sentAt = updatedEvent.timestamp,
            read = false
        ))
    }

    fun resolveSos(id: String) {
        val now = System.currentTimeMillis()
        val currentList = _sosHistory.value.map {
            if (it.id == id) it.copy(status = SosStatus.RESOLVED, resolvedAt = now) else it
        }
        _sosHistory.value = currentList
        val resolvedEvent = currentList.find { it.id == id }
        if (_activeSos.value?.id == id) {
            _activeSos.value = null
        }
        saveHistory(currentList)
        
        // Sync update to Firebase
        if (resolvedEvent != null) {
            android.util.Log.d("SosRepository", "Syncing SOS resolution to Firebase")
            syncProvider?.syncSosEvent(resolvedEvent)

            // Fan-out resolution to Activity History
            syncProvider?.syncActivity(SyncActivityEvent(
                id = "${resolvedEvent.id}_resolved",
                childId = resolvedEvent.childId,
                type = "SOS_RESOLVED",
                title = "SOS Resolved",
                description = "The emergency signal was marked as resolved.",
                timestamp = now,
                severity = "info"
            ))
        }
    }

    fun clearSosHistory() {
        _sosHistory.value = emptyList()
        _activeSos.value = null
        prefs.edit().clear().apply()
    }

    private fun determineActiveSos(): SosEvent? {
        return _sosHistory.value.firstOrNull { it.status == SosStatus.ACTIVE }
    }

    private fun saveHistory(history: List<SosEvent>) {
        val jsonArray = JSONArray()
        history.take(50).forEach { event ->
            val obj = JSONObject().apply {
                put("id", event.id)
                put("childId", event.childId)
                put("timestamp", event.timestamp)
                put("lat", event.latitude ?: JSONObject.NULL)
                put("lng", event.longitude ?: JSONObject.NULL)
                put("accuracy", event.accuracy?.toDouble() ?: JSONObject.NULL)
                put("battery", event.batteryPercent ?: JSONObject.NULL)
                put("message", event.message)
                put("status", event.status.name)
                put("resolvedAt", event.resolvedAt ?: JSONObject.NULL)
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString("sos_json", jsonArray.toString()).apply()
    }

    private fun loadHistory(): List<SosEvent> {
        val jsonStr = prefs.getString("sos_json", null) ?: return emptyList()
        val list = mutableListOf<SosEvent>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(SosEvent(
                    id = obj.getString("id"),
                    childId = obj.getString("childId"),
                    timestamp = obj.getLong("timestamp"),
                    latitude = if (obj.isNull("lat")) null else obj.getDouble("lat"),
                    longitude = if (obj.isNull("lng")) null else obj.getDouble("lng"),
                    accuracy = if (obj.isNull("accuracy")) null else obj.getDouble("accuracy").toFloat(),
                    batteryPercent = if (obj.isNull("battery")) null else obj.getInt("battery"),
                    message = obj.getString("message"),
                    status = SosStatus.valueOf(obj.getString("status")),
                    resolvedAt = if (obj.isNull("resolvedAt")) null else obj.getLong("resolvedAt")
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }
}
