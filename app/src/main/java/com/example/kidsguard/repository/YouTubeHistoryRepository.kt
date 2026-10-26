package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.models.YouTubeActivity
import com.example.kidsguard.youtube.YouTubeThumbnailPolicy
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class YouTubeHistoryRepository private constructor(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(
        "youtube_history_prefs",
        Context.MODE_PRIVATE
    )
    private val gson = Gson()
    private val TAG = "YT_MONITOR"

    private val _history = MutableStateFlow<List<YouTubeActivity>>(loadHistory())
    val history: StateFlow<List<YouTubeActivity>> = _history

    var sessionCount = 0
    var savedCount = 0
    var droppedCount = 0
    var duplicateCount = 0
    var adCount = 0

    var lastAccessibilityPackage = "None"
    var lastAccessibilityTime = 0L
    var lastServicePackage = "com.example.kidsguard"
    var lastServiceVersion = "Unknown"
    var lastServiceCode = 0

    private val _debugLogs = MutableStateFlow<List<String>>(emptyList())
    val debugLogs: StateFlow<List<String>> = _debugLogs

    companion object {
        @Volatile
        private var instance: YouTubeHistoryRepository? = null

        fun getInstance(context: Context): YouTubeHistoryRepository {
            return instance ?: synchronized(this) {
                instance ?: YouTubeHistoryRepository(context).also { instance = it }
            }
        }

        // duplicate prefix-match এর জন্য ছোট string false-positive এড়াতে
        // নূন্যতম দৈর্ঘ্য
        private const val MIN_PREFIX_MATCH_LENGTH = 15
    }

    fun addDebugLog(msg: String) {
        val current = _debugLogs.value.toMutableList()
        current.add(0, "[${System.currentTimeMillis() % 100000}] $msg")
        if (current.size > 100) current.removeAt(100)
        _debugLogs.value = current
        Log.d("YOUTUBE_METADATA_DEBUG", msg)
    }

    fun clearDebugLogs() {
        _debugLogs.value = emptyList()
    }

    /**
     * Title normalize করে — zero-width চরিত্র, trailing ellipsis
     * (accessibility tree প্রায়ই দীর্ঘ title "..." দিয়ে truncate করে),
     * বাড়তি whitespace সরিয়ে lowercase করে।
     */
    private fun normalizeTitle(value: String): String {
        return value
            .replace(Regex("[\\u200B-\\u200D\\uFEFF]"), "")
            .replace(Regex("""[…]+$"""), "")       // ইউনিকোড ellipsis ক্যারেক্টার
            .replace(Regex("""\.{3,}$"""), "")      // "..." তিন বা ততোধিক ডট
            .replace(Regex("\\s+"), " ")
            .trim()
            .lowercase()
    }

    /**
     * দুইটা normalized title একই ভিডিওর টাইটেল কিনা যাচাই করে,
     * exact match অথবা truncation-tolerant prefix match দিয়ে।
     * Accessibility tree থেকে আসা title প্রায়ই UI দ্বারা truncate করা
     * থাকে, কিন্তু MediaSession থেকে আসা title পূর্ণ — তাই শুধু exact
     * match যথেষ্ট না।
     */
    private fun isSameVideoTitle(a: String, b: String): Boolean {
        if (a == b) return true
        if (a.isEmpty() || b.isEmpty()) return false

        val shorter = if (a.length <= b.length) a else b
        val longer = if (a.length <= b.length) b else a

        if (shorter.length < MIN_PREFIX_MATCH_LENGTH) return false

        return longer.startsWith(shorter)
    }

    fun save(activity: YouTubeActivity) {
        sessionCount++
        val last = getLast()

        if (last != null) {
            val timeDiff = kotlin.math.abs(activity.startedAt - last.startedAt)

            val sameVideoId =
                !activity.videoId.isNullOrBlank() &&
                        !last.videoId.isNullOrBlank() &&
                        activity.videoId == last.videoId

            val sameTitle = isSameVideoTitle(
                normalizeTitle(activity.videoTitle),
                normalizeTitle(last.videoTitle)
            )

            if (
                sameVideoId ||
                (sameTitle && timeDiff < 5 * 60 * 1000)
            ) {
                duplicateCount++

                Log.d(
                    TAG,
                    "Duplicate ignored: ${activity.videoTitle} " +
                            "videoId=${activity.videoId}"
                )

                return
            }
        }

        savedCount++
        val currentList = _history.value.toMutableList()
        currentList.add(
            0, activity
        )
        if (currentList.size > 100) {
            currentList.removeAt(
                currentList.size - 1
            )
        }

        _history.value = currentList
        persistHistory(currentList)
        Log.i(TAG, "Saved successfully: ${activity.videoTitle} (Channel: ${activity.channelName})")
    }

    fun enrichSavedActivity(
        title: String,
        channelName: String?,
        videoId: String?,
        youtubeUrl: String?,
        thumbnailUrl: String?,
        linkSource: String?,
        linkConfidence: Float?
    ) {
        val currentList = _history.value.toMutableList()
        Log.d(
            TAG,
            "ENRICH_ATTEMPT title=$title historySize=${currentList.size}"
        )
        val normalizedTitle = normalizeTitle(title)

        val index = currentList.indexOfFirst { activity ->
            isSameVideoTitle(
                normalizeTitle(activity.videoTitle),
                normalizedTitle
            )
        }

        if (index == -1) {
            Log.d(TAG, "Enrich skipped - history item not found: $title")
            return
        }

        val old = currentList[index]

        val updated = old.copy(
            channelName = channelName
                ?.trim()
                ?.takeIf {
                    it.isNotBlank() &&
                            !it.equals("Unknown channel", ignoreCase = true) &&
                            !it.equals("Unknown Channel", ignoreCase = true)
                }
                ?: old.channelName,
            videoId = videoId ?: old.videoId,
            youtubeUrl = youtubeUrl ?: old.youtubeUrl,
            thumbnailUrl = thumbnailUrl
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?: old.thumbnailUrl,
            linkSource = linkSource ?: old.linkSource,
            linkConfidence = linkConfidence ?: old.linkConfidence
        )

        val metadataChanged =
            updated.channelName != old.channelName ||
                    updated.videoId != old.videoId ||
                    updated.youtubeUrl != old.youtubeUrl ||
                    updated.thumbnailUrl != old.thumbnailUrl ||
                    updated.linkSource != old.linkSource ||
                    updated.linkConfidence != old.linkConfidence

        val finalUpdated = if (metadataChanged) {
            updated.copy(isSynced = false)
        } else {
            updated
        }

        currentList[index] = finalUpdated
        Log.d(
            TAG,
            "ENRICH_SUCCESS title=$title id=${finalUpdated.videoId} thumb=${finalUpdated.thumbnailUrl}"
        )

        _history.value = currentList
        persistHistory(currentList)

        Log.i(
            TAG,
            "History enriched: $title | videoId=${finalUpdated.videoId}"
        )
    }

    /**
     * Enriches exactly one saved record. Retry workers use the local UUID so
     * repeated/truncated titles cannot update the wrong history item.
     */
    @Synchronized
    fun enrichSavedActivityById(
        activityId: String,
        channelName: String?,
        videoId: String,
        youtubeUrl: String,
        thumbnailUrl: String,
        linkSource: String,
        linkConfidence: Float
    ): Boolean {
        val currentList = _history.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == activityId }
        if (index == -1) {
            addDebugLog("THUMBNAIL_RETRY_ITEM_MISSING id=$activityId")
            return false
        }

        val old = currentList[index]
        currentList[index] = old.copy(
            channelName = channelName?.trim()?.takeIf { it.isNotBlank() }
                ?: old.channelName,
            videoId = videoId,
            youtubeUrl = youtubeUrl,
            thumbnailUrl = thumbnailUrl,
            linkSource = linkSource,
            linkConfidence = linkConfidence,
            isSynced = false,
            thumbnailFailureReason = null
        )
        _history.value = currentList
        persistHistory(currentList)
        addDebugLog("THUMBNAIL_RETRY_RESOLVED id=$activityId videoId=$videoId")
        return true
    }

    /**
     * Repairs records where a video ID exists but MediaSession supplied a
     * device-only content:// artwork URI (or no artwork at all).
     */
    @Synchronized
    fun repairDerivedThumbnails(): Int {
        var repairCount = 0
        val updated = _history.value.map { activity ->
            val remoteThumbnail = YouTubeThumbnailPolicy.remoteThumbnailOrNull(
                activity.videoId,
                activity.thumbnailUrl
            )

            if (
                remoteThumbnail != null &&
                remoteThumbnail != activity.thumbnailUrl
            ) {
                repairCount++
                activity.copy(
                    thumbnailUrl = remoteThumbnail,
                    isSynced = false,
                    thumbnailFailureReason = null
                )
            } else {
                activity
            }
        }

        if (repairCount > 0) {
            _history.value = updated
            persistHistory(updated)
            addDebugLog("THUMBNAIL_DERIVED_REPAIRED count=$repairCount")
        }
        return repairCount
    }

    @Synchronized
    fun getNextUnresolvedThumbnail(
        now: Long = System.currentTimeMillis(),
        retryCooldownMs: Long = 60 * 60 * 1000L,
        maxRetries: Int = 3
    ): YouTubeActivity? {
        return _history.value
            .asReversed()
            .firstOrNull { activity ->
                val hasRemoteThumbnail = YouTubeThumbnailPolicy.remoteThumbnailOrNull(
                    videoId = null,
                    candidateUrl = activity.thumbnailUrl
                ) != null
                val retryReady = activity.lastThumbnailRetryAt == null ||
                    now - activity.lastThumbnailRetryAt >= retryCooldownMs

                !hasRemoteThumbnail &&
                    activity.videoId.isNullOrBlank() &&
                    activity.videoTitle.isNotBlank() &&
                    activity.thumbnailRetryCount < maxRetries &&
                    retryReady
            }
    }

    @Synchronized
    fun recordThumbnailRetryFailure(activityId: String, reason: String) {
        val currentList = _history.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == activityId }
        if (index == -1) return

        val old = currentList[index]
        currentList[index] = old.copy(
            thumbnailRetryCount = old.thumbnailRetryCount + 1,
            lastThumbnailRetryAt = System.currentTimeMillis(),
            thumbnailFailureReason = reason.take(160)
        )
        _history.value = currentList
        persistHistory(currentList)
        addDebugLog(
            "THUMBNAIL_RETRY_FAILED id=$activityId " +
                "attempt=${old.thumbnailRetryCount + 1} reason=$reason"
        )
    }

    fun updateIfMoreMetadata(
        activityId: String,
        videoId: String?,
        url: String?,
        thumbnail: String?
    ) {
        if (videoId == null && url == null && thumbnail == null) return

        val currentList = _history.value.toMutableList()
        val index = currentList.indexOfFirst { it.id == activityId }
        if (index != -1) {
            val old = currentList[index]
            if ((videoId != null && old.videoId == null) || (url != null && old.youtubeUrl == null) || (thumbnail != null && old.thumbnailUrl == null)) {
                val updated = old.copy(
                    videoId = videoId ?: old.videoId,
                    youtubeUrl = url ?: old.youtubeUrl,
                    thumbnailUrl = thumbnail ?: old.thumbnailUrl,
                    isSynced = false
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
            val updated =
                currentList[index].copy(isSynced = true, uploadedAt = System.currentTimeMillis())
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
