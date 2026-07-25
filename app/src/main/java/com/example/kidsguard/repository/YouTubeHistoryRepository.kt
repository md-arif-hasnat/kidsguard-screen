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

    fun save(activity: YouTubeActivity) {
        val last = getLast()
        if (last != null && last.videoTitle == activity.videoTitle) {
            val timeDiff = activity.startedAt - last.startedAt
            if (timeDiff < 60000) {
                Log.d(TAG, "Duplicate ignored: ${activity.videoTitle}")
                return
            }
        }

        val currentList = _history.value.toMutableList()
        currentList.add(0, activity)
        if (currentList.size > 100) {
            currentList.removeAt(currentList.size - 1)
        }
        
        _history.value = currentList
        persistHistory(currentList)
        Log.i(TAG, "Saved successfully: ${activity.videoTitle} (Channel: ${activity.channelName})")
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
