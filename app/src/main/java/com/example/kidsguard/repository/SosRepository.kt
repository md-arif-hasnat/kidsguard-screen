package com.example.kidsguard.repository

import android.content.Context
import com.example.kidsguard.models.SosEvent
import com.example.kidsguard.models.SosStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

class SosRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("sos_prefs", Context.MODE_PRIVATE)
    private val _sosHistory = MutableStateFlow<List<SosEvent>>(loadHistory())
    val sosHistory: StateFlow<List<SosEvent>> = _sosHistory

    private val _activeSos = MutableStateFlow<SosEvent?>(determineActiveSos())
    val activeSos: StateFlow<SosEvent?> = _activeSos

    fun triggerSos(event: SosEvent) {
        val updatedEvent = event.copy(status = SosStatus.ACTIVE)
        val currentList = _sosHistory.value.toMutableList()
        currentList.add(0, updatedEvent)
        _sosHistory.value = currentList
        _activeSos.value = updatedEvent
        saveHistory(currentList)
    }

    fun resolveSos(id: String) {
        val currentList = _sosHistory.value.map {
            if (it.id == id) it.copy(status = SosStatus.RESOLVED) else it
        }
        _sosHistory.value = currentList
        if (_activeSos.value?.id == id) {
            _activeSos.value = null
        }
        saveHistory(currentList)
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
                    status = SosStatus.valueOf(obj.getString("status"))
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }
}
