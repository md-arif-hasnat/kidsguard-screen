package com.example.kidsguard.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.models.YouTubeActivity
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.repository.YouTubeHistoryRepository
import com.example.kidsguard.repository.BrowserHistoryRepository
import com.example.kidsguard.utils.WebsiteCategoryClassifier
import com.example.kidsguard.utils.DomainNormalizer
import com.example.kidsguard.utils.PolicyEnforcementManager
import java.util.UUID

class KidsGuardAccessibilityService : AccessibilityService() {

    private lateinit var youtubeRepository: YouTubeHistoryRepository
    private lateinit var browserRepository: BrowserHistoryRepository
    private lateinit var classifier: WebsiteCategoryClassifier
    private lateinit var enforcementManager: PolicyEnforcementManager
    
    private var currentYouTubeActivity: YouTubeActivity? = null
    private var currentBrowserHistory: BrowserHistory? = null
    
    private val handler = Handler(Looper.getMainLooper())
    private var lastProcessedYoutubeTitle: String? = null
    private var lastProcessedBrowserUrl: String? = null
    
    private val TAG_YT = "YT_MONITOR"
    private val TAG_BROWSER = "BROWSER_MONITOR"
    
    private val PACKAGE_YOUTUBE = "com.google.android.youtube"
    
    private val BROWSER_PACKAGES = setOf(
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.opera.browser"
    )

    private val EXCLUDED_YT_TEXTS = setOf(
        "Home", "Shorts", "Subscriptions", "Library", "Create", "Search",
        "Premium", "Music", "Like", "Share", "Comments", "LIVE", "Ads",
        "Up next", "Auto-play", "Mix", "Playlists", "Trending", "Gaming",
        "News", "Sport", "Learning", "Fashion & Beauty", "Podcasts",
        "History", "Watch later", "Your videos", "Your movies & TV",
        "Settings", "Help & feedback"
    )

    override fun onCreate() {
        super.onCreate()
        youtubeRepository = YouTubeHistoryRepository(applicationContext)
        browserRepository = BrowserHistoryRepository(applicationContext)
        classifier = WebsiteCategoryClassifier(applicationContext)
        enforcementManager = PolicyEnforcementManager(applicationContext)
        Log.d(TAG_YT, "KidsGuardAccessibilityService created")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return

        when {
            packageName == PACKAGE_YOUTUBE -> {
                handleYoutubeEvent(event)
            }
            BROWSER_PACKAGES.contains(packageName) -> {
                handleBrowserEvent(event, packageName)
            }
        }
    }

    private fun handleYoutubeEvent(event: AccessibilityEvent) {
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                debounceYoutubeScan()
            }
        }
    }

    private fun handleBrowserEvent(event: AccessibilityEvent, packageName: String) {
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                debounceBrowserScan(packageName)
            }
        }
    }

    private val youtubeScanRunnable = Runnable { scanForYoutubeInfo() }
    private var lastBrowserPackage: String? = null
    private val browserScanRunnable = Runnable { scanForBrowserInfo(lastBrowserPackage ?: "") }

    private fun debounceYoutubeScan() {
        handler.removeCallbacks(youtubeScanRunnable)
        handler.postDelayed(youtubeScanRunnable, 500)
    }

    private fun debounceBrowserScan(packageName: String) {
        lastBrowserPackage = packageName
        handler.removeCallbacks(browserScanRunnable)
        handler.postDelayed(browserScanRunnable, 800)
    }

    private fun scanForYoutubeInfo() {
        val rootNode = rootInActiveWindow ?: return
        val allTexts = mutableListOf<String>()
        extractAllText(rootNode, allTexts)

        val potentialTitle = findProbableYoutubeTitle(allTexts)
        if (potentialTitle != null && potentialTitle != lastProcessedYoutubeTitle) {
            val potentialChannel = findProbableYoutubeChannel(allTexts, potentialTitle)
            handleNewYoutubeVideo(potentialTitle, potentialChannel)
        }
    }

    private fun scanForBrowserInfo(packageName: String) {
        val rootNode = rootInActiveWindow ?: return
        val allTexts = mutableListOf<String>()
        extractAllText(rootNode, allTexts)
        
        // Strategy: Look for things that look like URLs or search terms in address bars
        val url = findUrlHeuristic(rootNode, packageName)
        val title = findBrowserTitleHeuristic(rootNode, packageName)
        
        if (url != null && isValidUrl(url)) {
            if (url != lastProcessedBrowserUrl) {
                handleNewBrowserVisit(url, title, packageName)
            }
        } else if (title != null && title.length > 3) {
             // If we only have title, maybe it's still worth saving if it changed significantly
             // But prompt says save title if URL is missing only if meaningful
        }
    }

    private fun extractAllText(node: AccessibilityNodeInfo?, list: MutableList<String>) {
        if (node == null) return
        val text = node.text?.toString()
        if (!text.isNullOrBlank()) {
            list.add(text)
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            extractAllText(child, list)
        }
    }

    // --- YouTube Heuristics ---

    private fun findProbableYoutubeTitle(texts: List<String>): String? {
        for (text in texts) {
            val trimmed = text.trim()
            if (trimmed.length in 8..150 && 
                !isNumeric(trimmed) && 
                !EXCLUDED_YT_TEXTS.contains(trimmed) &&
                !isTimeOrViews(trimmed)) {
                return trimmed
            }
        }
        return null
    }

    private fun findProbableYoutubeChannel(texts: List<String>, title: String): String? {
        val titleIndex = texts.indexOf(title)
        if (titleIndex != -1 && titleIndex + 1 < texts.size) {
            val next = texts[titleIndex + 1].trim()
            if (next.isNotBlank() && !isTimeOrViews(next) && !EXCLUDED_YT_TEXTS.contains(next)) {
                return next
            }
        }
        return null
    }

    private fun isTimeOrViews(s: String): Boolean {
        val lower = s.lowercase()
        return lower.contains("views") || 
               lower.contains("ago") || 
               lower.matches(Regex(".*\\d:\\d+.*")) || 
               lower.contains("subscribers")
    }

    // --- Browser Heuristics ---

    private fun findUrlHeuristic(rootNode: AccessibilityNodeInfo, packageName: String): String? {
        // Common Address Bar IDs (simplified)
        val addressBarIds = when (packageName) {
            "com.android.chrome" -> listOf("com.android.chrome:id/url_bar", "com.android.chrome:id/search_box_text")
            "org.mozilla.firefox" -> listOf("org.mozilla.firefox:id/mozac_browser_toolbar_url_view")
            else -> emptyList()
        }

        for (id in addressBarIds) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                val text = nodes[0].text?.toString()
                if (!text.isNullOrBlank()) return text
            }
        }

        // Fallback: search tree for text containing "." or starting with http
        return findUrlInTree(rootNode)
    }

    private fun findUrlInTree(node: AccessibilityNodeInfo?): String? {
        if (node == null) return null
        val text = node.text?.toString()
        if (!text.isNullOrBlank() && (text.contains(".") || text.startsWith("http"))) {
            if (isValidUrl(text)) return text
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findUrlInTree(child)
            if (found != null) return found
        }
        return null
    }

    private fun findBrowserTitleHeuristic(rootNode: AccessibilityNodeInfo, packageName: String): String? {
        // Usually the window title or a large text node at the top
        return rootNode.window?.title?.toString()
    }

    private fun isValidUrl(url: String): Boolean {
        val lower = url.lowercase().trim()
        if (lower.isEmpty()) return false
        val blacklistedPrefixes = listOf("about:", "chrome://", "edge://", "opera://", "file://", "localhost")
        for (prefix in blacklistedPrefixes) {
            if (lower.startsWith(prefix)) return false
        }
        // Basic check for search terms vs URLs
        return lower.contains(".") && !lower.contains(" ")
    }

    private fun handleNewYoutubeVideo(title: String, channel: String?) {
        val now = System.currentTimeMillis()
        finishCurrentYoutubeActivity()

        lastProcessedYoutubeTitle = title
        currentYouTubeActivity = YouTubeActivity(
            id = UUID.randomUUID().toString(),
            videoTitle = title,
            channelName = channel,
            startedAt = now
        )
        
        Log.i(TAG_YT, "New Video Detected: $title (Channel: $channel)")
        com.example.kidsguard.sync.YouTubeSyncWorker.runOnce(applicationContext)
    }

    private fun handleNewBrowserVisit(url: String, title: String?, browserPackage: String) {
        val now = System.currentTimeMillis()
        finishCurrentBrowserHistory()

        lastProcessedBrowserUrl = url
        val normalizedDomain = DomainNormalizer.normalize(url)
        val classification = classifier.classify(url, normalizedDomain, title)
        
        currentBrowserHistory = BrowserHistory(
            url = url,
            domain = normalizedDomain,
            pageTitle = title,
            browserPackage = browserPackage,
            startedAt = now,
            category = classification.category,
            categoryConfidence = classification.confidence,
            categorySource = classification.source,
            categorizedAt = now,
            riskLevel = classification.riskLevel
        )
        
        Log.i(TAG_BROWSER, "New Browser Visit: $url (Category: ${classification.category}, Risk: ${classification.riskLevel})")
        browserRepository.save(currentBrowserHistory!!)
        
        // Enforce Policy
        enforcementManager.enforce(currentBrowserHistory!!)

        // Trigger one-time sync
        com.example.kidsguard.sync.BrowserSyncWorker.runOnce(applicationContext)
    }

    override fun onInterrupt() {
        finishCurrentYoutubeActivity()
        finishCurrentBrowserHistory()
    }

    override fun onDestroy() {
        finishCurrentYoutubeActivity()
        finishCurrentBrowserHistory()
        super.onDestroy()
    }

    private fun finishCurrentYoutubeActivity() {
        val now = System.currentTimeMillis()
        currentYouTubeActivity?.let {
            it.endedAt = now
            it.watchDurationSeconds = (now - it.startedAt) / 1000
            youtubeRepository.save(it)
            currentYouTubeActivity = null
        }
    }

    private fun finishCurrentBrowserHistory() {
        val now = System.currentTimeMillis()
        currentBrowserHistory?.let {
            it.endedAt = now
            it.durationSeconds = (now - it.startedAt) / 1000
            browserRepository.save(it)
            currentBrowserHistory = null
        }
    }

    private fun isNumeric(s: String): Boolean = s.all { it.isDigit() || it.isWhitespace() }
}
