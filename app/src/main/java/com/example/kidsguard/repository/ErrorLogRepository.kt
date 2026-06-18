package com.example.kidsguard.repository

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

data class ErrorLogEntry(
    val id: String = UUID.randomUUID().toString(),
    val timestamp: Long = System.currentTimeMillis(),
    val tag: String,
    val message: String,
    val stackTrace: String? = null
) {
    val formattedTime: String
        get() = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(timestamp))
}

class ErrorLogRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("error_logs_prefs", Context.MODE_PRIVATE)
    private val _errors = MutableStateFlow<List<ErrorLogEntry>>(loadErrors())
    val errors: StateFlow<List<ErrorLogEntry>> = _errors

    fun addError(tag: String, message: String, exception: Throwable? = null) {
        val entry = ErrorLogEntry(
            tag = tag,
            message = message,
            stackTrace = exception?.stackTraceToString()
        )
        val currentList = _errors.value.toMutableList()
        currentList.add(0, entry)
        // Keep only last 100 errors
        val trimmedList = currentList.take(100)
        _errors.value = trimmedList
        saveErrors(trimmedList)
    }

    fun clearErrors() {
        _errors.value = emptyList()
        prefs.edit().clear().apply()
    }

    private fun saveErrors(list: List<ErrorLogEntry>) {
        val jsonArray = JSONArray()
        list.forEach { entry ->
            val obj = JSONObject().apply {
                put("id", entry.id)
                put("timestamp", entry.timestamp)
                put("tag", entry.tag)
                put("message", entry.message)
                put("stackTrace", entry.stackTrace ?: "")
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString("logs_json", jsonArray.toString()).apply()
    }

    private fun loadErrors(): List<ErrorLogEntry> {
        val jsonStr = prefs.getString("logs_json", null) ?: return emptyList()
        val list = mutableListOf<ErrorLogEntry>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(ErrorLogEntry(
                    id = obj.getString("id"),
                    timestamp = obj.getLong("timestamp"),
                    tag = obj.getString("tag"),
                    message = obj.getString("message"),
                    stackTrace = obj.getString("stackTrace").takeIf { it.isNotEmpty() }
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }
}
