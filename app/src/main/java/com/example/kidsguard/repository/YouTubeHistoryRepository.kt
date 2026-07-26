package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.models.YouTubeActivity
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class YouTubeHistoryRepository(context: Context) {
    private val prefs = context.getSharedPreferences("youtube_history_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val TAG = "YT_MONITOR"

    private val _history = MutableStateFlow<List<YouTubeActivity>>(loadHistory())
    val history: StateFlow<List<YouTubeActivity>> = _history

    // Diagnostic Stats & Logs
    var sessionCount = 0
    var savedCount = 0
    var droppedCount = 0
    var duplicateCount = 0
    var adCount = 0
    
    private val _debugLogs = MutableStateFlow<List<String>>(emptyList())
    val debugLogs: StateFlow<List<String>> = _debugLogs

    fun addDebugLog(msg: String) {
        val current = _debugLogs.value.toMutableList()
        current.add(0, msg)
        if (current.size > 50) current.removeAt(50)
        _debugLogs.value = current
        Log.d("YOUTUBE_METADATA_DEBUG", msg)
    }

    fun clearDebugLogs() {
        _debugLogs.value = emptyList()
    }

    fun save(activity: YouTubeActivity) {
        sessionCount++
        val last = getLast()
        if (last != null && last.videoTitle == activity.videoTitle) {
            val timeDiff = activity.startedAt - last.startedAt
            if (timeDiff < 60000) {
                duplicateCount++
                Log.d(TAG, "Duplicate ignored: ${activity.videoTitle}")
                return
            }
        }

        savedCount++
        val currentList = _history.value.toMutableList()
        currentList.add(0, activity)
        if (currentList.size > 100) {
            currentList.removeAt(currentList.size - 1)
        }
        
        _history.value = currentList
        persistHistory(currentList)
        Log.i(TAG, "Saved successfully: ${activity.videoTitle} (Channel: ${activity.channelName})")
    }

    fun updateIfMoreMetadata(activityId: String, videoId: String?, url: String?, thumbnail: String?) {
        if (videoId == null && url == null && thumbnail == null) return
        
        val currentList = _history.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == activityId }
        if (index != -1) {
            val old = currentList[index]
            // Only update if we are adding new info
            if ((videoId != null && old.videoId == null) || (url != null && old.youtubeUrl == null) || (thumbnail != null && old.thumbnailUrl == null)) {
                val updated = old.copy(
                    videoId = videoId ?: old.videoId,
                    youtubeUrl = url ?: old.youtubeUrl,
                    thumbnailUrl = thumbnail ?: old.thumbnailUrl,
                    isSynced = false // Mark as unsynced so we upload the new data
                )
                currentList[index] = updated
                _history.value = currentList
                persistHistory(currentList)
                Log.d(TAG, "Updated record with more metadata: $activityId")
            }
        }
    }

    fun getHistory(): List<YouTubeActivity> {
        return _history.value
    }

    fun getLast(): YouTubeActivity? {
        return _history.value.firstOrNull()
    }

    fun clear() {
        _history.value = emptyList()
        prefs.edit().clear().apply()
        Log.d(TAG, "History cleared")
    }

    fun markAsSynced(activityId: String) {
        val currentList = _history.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == activityId }
        if (index != -1) {
            val updated = currentList[index].copy(isSynced = true, uploadedAt = System.currentTimeMillis())
            currentList[index] = updated
            _history.value = currentList
            persistHistory(currentList)
            Log.d(TAG, "Marked as synced locally: $activityId")
        }
    }

    fun getUnsynced(): List<YouTubeActivity> {
        return _history.value.filter { !it.isSynced }
    }

    private fun loadHistory(): List<YouTubeActivity> {
        val json = prefs.getString("history_json", null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<YouTubeActivity>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error loading history", e)
            emptyList()
        }
    }

    private fun persistHistory(list: List<YouTubeActivity>) {
        val json = gson.toJson(list)
        prefs.edit().putString("history_json", json).apply()
    }
}
