package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.models.WebsiteCategory
import com.example.kidsguard.utils.WebsiteCategoryClassifier
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class BrowserHistoryRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("browser_history_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val TAG = "BROWSER_MONITOR"

    private val _history = MutableStateFlow<List<BrowserHistory>>(loadHistory())
    val history: StateFlow<List<BrowserHistory>> = _history

    fun save(history: BrowserHistory) {
        val last = getLast()
        if (last != null && last.url == history.url && history.url != null) {
            val timeDiff = history.startedAt - last.startedAt
            if (timeDiff < 30000) {
                Log.d(TAG, "Duplicate ignored: ${history.url}")
                return
            }
        }

        val currentList = _history.value.toMutableList()
        currentList.add(0, history)
        if (currentList.size > 100) {
            currentList.removeAt(currentList.size - 1)
        }
        
        _history.value = currentList
        persistHistory(currentList)
        Log.i(TAG, "Saved: ${history.pageTitle ?: history.url} (Browser: ${history.browserPackage})")
    }

    fun getHistory(): List<BrowserHistory> {
        return _history.value
    }

    fun getLast(): BrowserHistory? {
        return _history.value.firstOrNull()
    }

    fun clear() {
        _history.value = emptyList()
        prefs.edit().clear().apply()
        Log.d(TAG, "History cleared")
    }

    fun markAsSynced(id: String) {
        val currentList = _history.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == id }
        if (index != -1) {
            val updated = currentList[index].copy(isSynced = true, uploadedAt = System.currentTimeMillis())
            currentList[index] = updated
            _history.value = currentList
            persistHistory(currentList)
            Log.d(TAG, "Marked as synced locally: $id")
        }
    }

    fun getUnsynced(): List<BrowserHistory> {
        return _history.value.filter { !it.isSynced }
    }

    fun categorizeExistingUnknownRecords() {
        val classifier = WebsiteCategoryClassifier(context)
        val currentList = _history.value.toMutableList()
        var updatedCount = 0

        currentList.forEachIndexed { index, item ->
            if (item.category == WebsiteCategory.UNKNOWN || item.categorySource == null) {
                val classification = classifier.classify(item.url, item.domain, item.pageTitle)
                if (classification.category != WebsiteCategory.UNKNOWN) {
                    currentList[index] = item.copy(
                        category = classification.category,
                        categoryConfidence = classification.confidence,
                        categorySource = classification.source,
                        categorizedAt = System.currentTimeMillis(),
                        riskLevel = classification.riskLevel
                    )
                    updatedCount++
                }
            }
        }

        if (updatedCount > 0) {
            _history.value = currentList
            persistHistory(currentList)
            Log.i(TAG, "Backfilled $updatedCount unknown records with categories")
        }
    }

    private fun loadHistory(): List<BrowserHistory> {
        val json = prefs.getString("history_json", null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<BrowserHistory>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error loading history", e)
            emptyList()
        }
    }

    private fun persistHistory(list: List<BrowserHistory>) {
        val json = gson.toJson(list)
        prefs.edit().putString("history_json", json).apply()
    }
}
