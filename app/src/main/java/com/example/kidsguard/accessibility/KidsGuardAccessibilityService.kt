package com.example.kidsguard.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.models.YouTubeActivity
import com.example.kidsguard.repository.YouTubeHistoryRepository
import java.util.UUID

class KidsGuardAccessibilityService : AccessibilityService() {

    private lateinit var repository: YouTubeHistoryRepository
    private var currentActivity: YouTubeActivity? = null
    private val handler = Handler(Looper.getMainLooper())
    private var lastProcessedTitle: String? = null
    
    private val TAG = "YT_MONITOR"
    private val PACKAGE_YOUTUBE = "com.google.android.youtube"

    private val EXCLUDED_TEXTS = setOf(
        "Home", "Shorts", "Subscriptions", "Library", "Create", "Search",
        "Premium", "Music", "Like", "Share", "Comments", "LIVE", "Ads",
        "Up next", "Auto-play", "Mix", "Playlists", "Trending", "Gaming",
        "News", "Sport", "Learning", "Fashion & Beauty", "Podcasts",
        "History", "Watch later", "Your videos", "Your movies & TV",
        "Settings", "Help & feedback"
    )

    override fun onCreate() {
        super.onCreate()
        repository = YouTubeHistoryRepository(applicationContext)
        Log.d(TAG, "KidsGuardAccessibilityService created")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return
        if (packageName != PACKAGE_YOUTUBE) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                debounceScan()
            }
        }
    }

    private val scanRunnable = Runnable {
        scanForVideoInfo()
    }

    private fun debounceScan() {
        handler.removeCallbacks(scanRunnable)
        handler.postDelayed(scanRunnable, 500)
    }

    private fun scanForVideoInfo() {
        val rootNode = rootInActiveWindow ?: return
        val allTexts = mutableListOf<String>()
        extractAllText(rootNode, allTexts)

        val potentialTitle = findProbableTitle(allTexts)
        if (potentialTitle != null && potentialTitle != lastProcessedTitle) {
            val potentialChannel = findProbableChannel(allTexts, potentialTitle)
            handleNewVideo(potentialTitle, potentialChannel)
        }
    }

    private fun extractAllText(node: AccessibilityNodeInfo, list: MutableList<String>) {
        val text = node.text?.toString()
        if (!text.isNullOrBlank()) {
            list.add(text)
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            extractAllText(child, list)
        }
    }

    private fun findProbableTitle(texts: List<String>): String? {
        for (text in texts) {
            val trimmed = text.trim()
            if (trimmed.length in 8..150 && 
                !isNumeric(trimmed) && 
                !EXCLUDED_TEXTS.contains(trimmed) &&
                !isTimeOrViews(trimmed)) {
                return trimmed
            }
        }
        return null
    }

    private fun findProbableChannel(texts: List<String>, title: String): String? {
        val titleIndex = texts.indexOf(title)
        if (titleIndex != -1 && titleIndex + 1 < texts.size) {
            val next = texts[titleIndex + 1].trim()
            if (next.isNotBlank() && !isTimeOrViews(next) && !EXCLUDED_TEXTS.contains(next)) {
                return next
            }
        }
        return null
    }

    private fun isNumeric(s: String): Boolean = s.all { it.isDigit() || it.isWhitespace() }

    private fun isTimeOrViews(s: String): Boolean {
        val lower = s.lowercase()
        return lower.contains("views") || 
               lower.contains("ago") || 
               lower.matches(Regex(".*\\d:\\d+.*")) || // Looks like time 10:05
               lower.contains("subscribers")
    }

    private fun handleNewVideo(title: String, channel: String?) {
        val now = System.currentTimeMillis()
        
        // Finish previous activity if exists
        currentActivity?.let {
            it.endedAt = now
            it.watchDurationSeconds = (now - it.startedAt) / 1000
            repository.save(it)
        }

        lastProcessedTitle = title
        currentActivity = YouTubeActivity(
            id = UUID.randomUUID().toString(),
            videoTitle = title,
            channelName = channel,
            startedAt = now
        )
        
        Log.i(TAG, "New Video Detected: $title (Channel: $channel)")
        
        // Trigger one-time sync
        com.example.kidsguard.sync.YouTubeSyncWorker.runOnce(applicationContext)
    }

    override fun onInterrupt() {
        finishCurrentActivity()
    }

    override fun onDestroy() {
        finishCurrentActivity()
        super.onDestroy()
    }

    private fun finishCurrentActivity() {
        val now = System.currentTimeMillis()
        currentActivity?.let {
            it.endedAt = now
            it.watchDurationSeconds = (now - it.startedAt) / 1000
            repository.save(it)
            currentActivity = null
        }
    }
}
