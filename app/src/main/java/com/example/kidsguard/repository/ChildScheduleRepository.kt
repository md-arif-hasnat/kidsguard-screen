package com.example.kidsguard.repository

import android.content.Context
import com.example.kidsguard.models.ChildSchedule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

class ChildScheduleRepository(context: Context) {
    private val prefs = context.getSharedPreferences("child_schedules_prefs", Context.MODE_PRIVATE)
    
    private val _schedules = MutableStateFlow<List<ChildSchedule>>(loadSchedules())
    val schedules: StateFlow<List<ChildSchedule>> = _schedules

    fun addSchedule(schedule: ChildSchedule) {
        val current = _schedules.value.toMutableList()
        current.add(schedule)
        _schedules.value = current
        saveSchedules(current)
    }

    fun deleteSchedule(id: String) {
        val current = _schedules.value.toMutableList()
        current.removeAll { it.id == id }
        _schedules.value = current
        saveSchedules(current)
    }

    private fun saveSchedules(schedules: List<ChildSchedule>) {
        val array = JSONArray()
        schedules.forEach { s ->
            val obj = JSONObject().apply {
                put("id", s.id)
                put("childId", s.childId)
                put("zoneId", s.zoneId)
                put("dayOfWeek", s.dayOfWeek)
                put("arrivalTime", s.arrivalTime)
                put("tolerance", s.toleranceMinutes)
                put("enabled", s.enabled)
            }
            array.put(obj)
        }
        prefs.edit().putString("schedules_json", array.toString()).apply()
    }

    private fun loadSchedules(): List<ChildSchedule> {
        val json = prefs.getString("schedules_json", null) ?: return emptyList()
        val list = mutableListOf<ChildSchedule>()
        try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(ChildSchedule(
                    id = obj.getString("id"),
                    childId = obj.getString("childId"),
                    zoneId = obj.getString("zoneId"),
                    dayOfWeek = obj.getInt("dayOfWeek"),
                    arrivalTime = obj.getString("arrivalTime"),
                    toleranceMinutes = obj.getInt("tolerance"),
                    enabled = obj.getBoolean("enabled")
                ))
            }
        } catch (e: Exception) { e.printStackTrace() }
        return list
    }
}
