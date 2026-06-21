package com.example.kidsguard.ai

import android.content.Context
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.RouteSession
import com.example.kidsguard.models.SosEvent
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.RouteRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.repository.SosRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.util.*

class DailySummaryRepository(
    private val context: Context,
    private val locationRepository: LocationRepository,
    private val safeZoneRepository: SafeZoneRepository,
    private val routeRepository: RouteRepository,
    private val sosRepository: SosRepository,
    private val aiProvider: AiSummaryProvider,
    private val errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository? = null
) {
    private val prefs = context.getSharedPreferences("ai_summary_prefs", Context.MODE_PRIVATE)
    private val _summaryHistory = MutableStateFlow<List<DailySummary>>(loadHistory())
    val summaryHistory: StateFlow<List<DailySummary>> = _summaryHistory

    private val _latestSummary = MutableStateFlow<DailySummary?>(_summaryHistory.value.firstOrNull())
    val latestSummary: StateFlow<DailySummary?> = _latestSummary

    private var syncProvider: com.example.kidsguard.sync.RemoteSyncProvider? = null

    fun setSyncProvider(provider: com.example.kidsguard.sync.RemoteSyncProvider) {
        this.syncProvider = provider
    }

    suspend fun generateDailySummary(date: Long): DailySummary {
        return try {
            val calendar = Calendar.getInstance().apply {
                timeInMillis = date
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            calendar.add(Calendar.DAY_OF_YEAR, 1)
            val endTime = calendar.timeInMillis

            val dayEvents = safeZoneRepository.activityEvents.value.filter { it.timestamp in startTime until endTime }
            val dayLocations = locationRepository.locationHistory.value.filter { it.timestamp in startTime until endTime }
            val dayRoutes = routeRepository.routeSessions.value.filter { it.startTime in startTime until endTime }
            val daySos = sosRepository.sosHistory.value.filter { it.timestamp in startTime until endTime }

            val prefHelper = com.example.kidsguard.data.PreferenceHelper(context)
            val currentChildId = when {
                prefHelper.userRole == "PARENT" -> prefHelper.selectedChildId
                prefHelper.userRole == "CHILD" -> prefHelper.pairedChildId ?: prefHelper.deviceId
                else -> prefHelper.deviceId
            } ?: "unknown_child"

            if (currentChildId == "unknown_child") {
                android.util.Log.e("DailySummaryRepo", "Cannot generate valid summary: childId is missing or unknown")
            }

            val input = DailySummaryInput(
                childId = currentChildId,
                events = dayEvents,
                locations = dayLocations,
                routes = dayRoutes,
                sosEvents = daySos
            )

            val summaryText = try {
                aiProvider.generateSummary(input)
            } catch (e: Exception) {
                errorLogRepository?.addError("DailySummary", "AI text generation failed", e)
                "Summary unavailable due to AI processing error."
            }
            
            val safetyScore = try {
                aiProvider.calculateSafetyScore(input)
            } catch (e: Exception) {
                errorLogRepository?.addError("DailySummary", "Safety score calculation failed", e)
                80 // Default safe score
            }

            val summary = DailySummary(
                date = startTime,
                childId = currentChildId,
                totalDistanceMeters = dayRoutes.sumOf { it.totalDistanceMeters },
                totalTimeAtHomeMinutes = dayEvents.count { it.title.contains("Home") } * 30, // Rough estimate
                totalTimeAtSchoolMinutes = dayEvents.count { it.title.contains("School") } * 30,
                totalTimeAtPlaygroundMinutes = dayEvents.count { it.title.contains("Playground") } * 30,
                totalTrackingMinutes = dayLocations.size * 5, // Assuming 5 min updates
                totalLockMinutes = dayEvents.count { it.type == "KID_MODE_ENABLED" } * 60,
                totalUnlockAttempts = dayEvents.count { it.type.contains("PIN") },
                totalSafeZoneEvents = dayEvents.count { it.type.startsWith("SAFE_ZONE") },
                totalSosEvents = daySos.size,
                lowestBatteryPercent = daySos.mapNotNull { it.batteryPercent }.minOrNull() ?: 100,
                highestSpeed = dayLocations.map { it.speed }.maxOrNull() ?: 0f,
                summaryText = summaryText,
                safetyScore = safetyScore
            )

            saveSummary(summary)
            
            // Sync to Firebase
            android.util.Log.d("DailySummaryRepo", "DailySummary generated locally")
            if (syncProvider != null) {
                android.util.Log.d("DailySummaryRepo", "Syncing DailySummary to Firebase")
                syncProvider?.syncDailySummary(summary)
            } else {
                android.util.Log.w("DailySummaryRepo", "Syncing skipped: No sync provider connected")
            }

            summary
        } catch (e: Exception) {
            errorLogRepository?.addError("DailySummary", "Full summary generation failed", e)
            val fallback = DailySummary(
                date = date,
                childId = "current_child",
                totalDistanceMeters = 0.0,
                totalTimeAtHomeMinutes = 0,
                totalTimeAtSchoolMinutes = 0,
                totalTimeAtPlaygroundMinutes = 0,
                totalTrackingMinutes = 0,
                totalLockMinutes = 0,
                totalUnlockAttempts = 0,
                totalSafeZoneEvents = 0,
                totalSosEvents = 0,
                lowestBatteryPercent = 0,
                highestSpeed = 0f,
                summaryText = "Error generating daily summary. Please check logs.",
                safetyScore = 0
            )
            fallback
        }
    }

    private fun saveSummary(summary: DailySummary) {
        val currentList = _summaryHistory.value.toMutableList()
        currentList.removeAll { it.date == summary.date }
        currentList.add(0, summary)
        currentList.sortByDescending { it.date }
        
        _summaryHistory.value = currentList
        _latestSummary.value = currentList.firstOrNull()
        
        saveHistoryToDisk(currentList)
    }

    private fun saveHistoryToDisk(history: List<DailySummary>) {
        val jsonArray = JSONArray()
        history.take(30).forEach { item ->
            val obj = JSONObject().apply {
                put("id", item.id)
                put("date", item.date)
                put("childId", item.childId)
                put("distance", item.totalDistanceMeters)
                put("homeMin", item.totalTimeAtHomeMinutes)
                put("schoolMin", item.totalTimeAtSchoolMinutes)
                put("playMin", item.totalTimeAtPlaygroundMinutes)
                put("trackingMin", item.totalTrackingMinutes)
                put("lockMin", item.totalLockMinutes)
                put("unlockAttempts", item.totalUnlockAttempts)
                put("safeZoneEvents", item.totalSafeZoneEvents)
                put("sosEvents", item.totalSosEvents)
                put("lowestBattery", item.lowestBatteryPercent)
                put("highestSpeed", item.highestSpeed.toDouble())
                put("text", item.summaryText)
                put("score", item.safetyScore)
                put("generatedAt", item.generatedAt)
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString("summary_history_json", jsonArray.toString()).apply()
    }

    private fun loadHistory(): List<DailySummary> {
        val jsonStr = prefs.getString("summary_history_json", null) ?: return emptyList()
        val list = mutableListOf<DailySummary>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(DailySummary(
                    id = obj.getString("id"),
                    date = obj.getLong("date"),
                    childId = obj.getString("childId"),
                    totalDistanceMeters = obj.getDouble("distance"),
                    totalTimeAtHomeMinutes = obj.getInt("homeMin"),
                    totalTimeAtSchoolMinutes = obj.getInt("schoolMin"),
                    totalTimeAtPlaygroundMinutes = obj.getInt("playMin"),
                    totalTrackingMinutes = obj.getInt("trackingMin"),
                    totalLockMinutes = obj.getInt("lockMin"),
                    totalUnlockAttempts = obj.getInt("unlockAttempts"),
                    totalSafeZoneEvents = obj.getInt("safeZoneEvents"),
                    totalSosEvents = obj.getInt("sosEvents"),
                    lowestBatteryPercent = obj.getInt("lowestBattery"),
                    highestSpeed = obj.getDouble("highestSpeed").toFloat(),
                    summaryText = obj.getString("text"),
                    safetyScore = obj.getInt("score"),
                    generatedAt = obj.getLong("generatedAt")
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }

    fun clearSummaryHistory() {
        _summaryHistory.value = emptyList()
        _latestSummary.value = null
        prefs.edit().clear().apply()
    }
}
