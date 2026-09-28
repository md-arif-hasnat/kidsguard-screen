package com.example.kidsguard.repository

import android.content.Context
import android.os.Build
import com.example.kidsguard.BuildConfig
import com.example.kidsguard.data.PreferenceHelper
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*

data class ErrorLogEntry(
    val id: String = UUID.randomUUID().toString(),
    val timestamp: Long = System.currentTimeMillis(),
    val tag: String,
    val message: String,
    val stackTrace: String? = null,
    val isSynced: Boolean = false
) {
    val formattedTime: String
        get() = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(timestamp))
}

class ErrorLogRepository(private val context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("error_logs_prefs", Context.MODE_PRIVATE)
    private val prefHelper = PreferenceHelper(appContext)
    private val db = FirebaseFirestore.getInstance()
    private val _errors = MutableStateFlow<List<ErrorLogEntry>>(loadErrors())
    val errors: StateFlow<List<ErrorLogEntry>> = _errors

    init {
        uploadPending()
    }

    fun addError(tag: String, message: String, exception: Throwable? = null) {
        val entry = ErrorLogEntry(
            tag = sanitize(tag, 80),
            message = sanitize(message, 300),
            stackTrace = exception?.stackTraceToString()?.let {
                sanitize(it, 4000)
            }
        )
        val currentList = _errors.value.toMutableList()
        currentList.add(0, entry)
        // Keep only last 100 errors
        val trimmedList = currentList.take(100)
        _errors.value = trimmedList
        saveErrors(trimmedList)
        uploadEntry(entry)
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
                put("isSynced", entry.isSynced)
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
                    stackTrace = obj.getString("stackTrace").takeIf { it.isNotEmpty() },
                    isSynced = obj.optBoolean("isSynced", false)
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }

    private fun uploadPending() {
        _errors.value
            .asSequence()
            .filter { !it.isSynced }
            .take(MAX_UPLOADS_PER_RUN)
            .forEach(::uploadEntry)
    }

    private fun uploadEntry(entry: ErrorLogEntry) {
        val familyId = prefHelper.familyId
        val childId = prefHelper.pairedChildId ?: prefHelper.childId

        if (
            prefHelper.userRole != "CHILD" ||
            familyId.isNullOrBlank() ||
            childId.isBlank()
        ) return

        // Older locally persisted entries predate upload-time sanitization, so
        // sanitize again at the cloud boundary before sending anything.
        val safeTag = sanitize(entry.tag, 80)
        val safeMessage = sanitize(entry.message, 300)
        val safeStackTrace = entry.stackTrace?.let { sanitize(it, 4_000) }

        val data = mapOf(
            "errorId" to entry.id,
            "familyId" to familyId,
            "childId" to childId,
            "deviceId" to prefHelper.deviceId,
            "tag" to safeTag,
            "message" to safeMessage,
            "stackTrace" to safeStackTrace,
            "fingerprint" to fingerprint(safeTag, safeMessage),
            "capturedAt" to entry.timestamp,
            "appVersion" to BuildConfig.VERSION_NAME,
            "versionCode" to BuildConfig.VERSION_CODE,
            "androidVersion" to Build.VERSION.RELEASE,
            "deviceModel" to Build.MODEL,
            "status" to "OPEN"
        )

        db.collection("children")
            .document(childId)
            .collection("errorReports")
            .document(entry.id)
            .set(data)
            .addOnSuccessListener { markSynced(entry.id) }
            .addOnFailureListener {
                // Keep the local record unsynced. It will retry on the next
                // repository initialization or error without recursive logs.
            }
    }

    @Synchronized
    private fun markSynced(errorId: String) {
        val updated = _errors.value.map { entry ->
            if (entry.id == errorId) entry.copy(isSynced = true) else entry
        }
        _errors.value = updated
        saveErrors(updated)
    }

    private fun fingerprint(tag: String, message: String): String {
        val normalized = "$tag|$message"
            .lowercase(Locale.ROOT)
            .replace(Regex("\\d+"), "#")
        return MessageDigest.getInstance("SHA-256")
            .digest(normalized.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }

    private fun sanitize(value: String, maxLength: Int): String {
        return value
            .replace(Regex("(?i)bearer\\s+[a-z0-9._~+/-]+=*"), "Bearer [REDACTED]")
            .replace(Regex("(?i)(api[_-]?key|token|password|secret)\\s*[:=]\\s*[^\\s,;]+"), "\$1=[REDACTED]")
            .replace(Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE), "[EMAIL]")
            .replace(Regex("(https?://[^?\\s]+)\\?[^\\s]+", RegexOption.IGNORE_CASE), "\$1?[REDACTED]")
            .replace(Regex("[\\r\\n]{3,}"), "\n\n")
            .take(maxLength)
    }

    companion object {
        private const val MAX_UPLOADS_PER_RUN = 20
    }
}
