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
    private val prefHelper = com.example.kidsguard.data.PreferenceHelper(context)
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
        prefHelper.activeSosId = updatedEvent.id
        saveHistory(currentList)
        
        // Sync to Firebase
        android.util.Log.d("SosRepository", "SOS created childId=${updatedEvent.childId} eventId=${updatedEvent.id}")
        syncProvider?.syncSosEvent(updatedEvent) { success, exception ->
            if (success) {
                // Done
            } else {
                android.util.Log.e("SosRepository", "SOS sync failed", exception)
            }
        }

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
        val eventId = id.ifBlank {
            prefHelper.activeSosId.orEmpty()
        }

        val childId = prefHelper.childId

        if (eventId.isBlank()) {
            android.util.Log.e(
                "SosRepository",
                "RESOLVE STOPPED: eventId is blank"
            )
            return
        }

        if (childId.isBlank()) {
            android.util.Log.e(
                "SosRepository",
                "RESOLVE STOPPED: childId is blank"
            )
            return
        }

        android.util.Log.d(
            "SosRepository",
            "DIRECT RESOLVE START childId=$childId eventId=$eventId"
        )

        val documentRef =
            com.google.firebase.firestore.FirebaseFirestore
                .getInstance()
                .collection("children")
                .document(childId)
                .collection("sosEvents")
                .document(eventId)

        val updates = mapOf<String, Any>(
            "status" to "RESOLVED",
            "active" to false,
            "resolvedAt" to
                    com.google.firebase.firestore.FieldValue.serverTimestamp(),
            "updatedAt" to
                    com.google.firebase.firestore.FieldValue.serverTimestamp()
        )

        documentRef.update(updates)
            .addOnSuccessListener {
                android.util.Log.d(
                    "SosRepository",
                    "DIRECT RESOLVE SUCCESS path=children/$childId/sosEvents/$eventId"
                )

                val resolvedEvent =
                    _activeSos.value?.takeIf { it.id == eventId }
                        ?: _sosHistory.value.find { it.id == eventId }

                if (resolvedEvent != null) {
                    val updatedEvent = resolvedEvent.copy(
                        status = SosStatus.RESOLVED,
                        resolvedAt = System.currentTimeMillis(),
                        active = false
                    )

                    _sosHistory.value = _sosHistory.value.map {
                        if (it.id == eventId) updatedEvent else it
                    }

                    saveHistory(_sosHistory.value)
                }

                _activeSos.value = null
                prefHelper.activeSosId = null
            }
            .addOnFailureListener { exception ->
                android.util.Log.e(
                    "SosRepository",
                    "DIRECT RESOLVE FAILED path=children/$childId/sosEvents/$eventId",
                    exception
                )
            }
    }

    fun clearSosHistory() {
        _sosHistory.value = emptyList()
        _activeSos.value = null
        prefHelper.activeSosId = null
        prefs.edit().clear().apply()
    }

    private fun determineActiveSos(): SosEvent? {
        val activeId = prefHelper.activeSosId
        return _sosHistory.value.firstOrNull { it.status == SosStatus.ACTIVE || it.id == activeId }
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
                put("active", event.active)
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
                    resolvedAt = if (obj.isNull("resolvedAt")) null else obj.getLong("resolvedAt"),
                    active = obj.optBoolean("active", true)
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }
}
