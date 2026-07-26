package com.example.kidsguard.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.models.*
import com.example.kidsguard.repository.YouTubeHistoryRepository
import com.example.kidsguard.repository.BrowserHistoryRepository
import com.example.kidsguard.utils.*
import java.util.UUID

class KidsGuardAccessibilityService : AccessibilityService() {

    private lateinit var youtubeRepository: YouTubeHistoryRepository
    private lateinit var browserRepository: BrowserHistoryRepository
    private lateinit var classifier: WebsiteCategoryClassifier
    private lateinit var enforcementManager: PolicyEnforcementManager
    
    // YouTube Monitoring
    private var activeYouTubeSession: YouTubeWatchSession? = null
    private val handler = Handler(Looper.getMainLooper())
    
    private val TAG_YT_TRACE = "YOUTUBE_HISTORY_TRACE"
    private val TAG_BROWSER = "BROWSER_MONITOR"
    
    private val PACKAGE_YOUTUBE = "com.google.android.youtube"
    
    private val BROWSER_PACKAGES = setOf(
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.opera.browser"
    )

    override fun onCreate() {
        super.onCreate()
        youtubeRepository = YouTubeHistoryRepository(applicationContext)
        browserRepository = BrowserHistoryRepository(applicationContext)
        classifier = WebsiteCategoryClassifier(applicationContext)
        enforcementManager = PolicyEnforcementManager(applicationContext)
        Log.d("KidGuardAccess", "KidsGuardAccessibilityService created")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return

        if (packageName == PACKAGE_YOUTUBE) {
            handleYouTubeEvent(event)
        } else if (BROWSER_PACKAGES.contains(packageName)) {
            handleBrowserEvent(event, packageName)
        }
    }

    // --- YouTube Handling ---

    private fun handleYouTubeEvent(event: AccessibilityEvent) {
        logYouTubeEvent(event)

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED,
            AccessibilityEvent.TYPE_VIEW_CLICKED -> {
                debounceYouTubeScan()
            }
        }
    }

    private fun logYouTubeEvent(event: AccessibilityEvent) {
        if (!com.example.kidsguard.BuildConfig.DEBUG) return
        
        Log.v(TAG_YT_TRACE, "Event: ${event.eventType}, Class: ${event.className}, ID: ${event.source?.viewIdResourceName}, Text: ${event.text}")
    }

    private val youtubeScanRunnable = Runnable { scanYouTube() }

    private fun debounceYouTubeScan() {
        handler.removeCallbacks(youtubeScanRunnable)
        handler.postDelayed(youtubeScanRunnable, 800)
    }

    private fun scanYouTube() {
        val rootNode = rootInActiveWindow ?: return
        val screenType = YouTubeScreenDetector.detect(rootNode)
        
        Log.d(TAG_YT_TRACE, "Detected Screen: $screenType")

        if (screenType == YouTubeScreenType.AD_PLAYING) {
            activeYouTubeSession?.let { it.isAdPlaying = true }
            youtubeRepository.adCount++
            Log.d(TAG_YT_TRACE, "Ad detected, pausing metadata updates")
            return
        }

        activeYouTubeSession?.let { it.isAdPlaying = false }

        if (screenType == YouTubeScreenType.WATCH_PAGE || screenType == YouTubeScreenType.SHORTS) {
            val metadata = YouTubeMetadataExtractor.extract(rootNode)
            if (metadata != null && !metadata.title.isNullOrBlank()) {
                updateYouTubeSession(metadata, screenType)
            }
        } else if (screenType != YouTubeScreenType.MINIPLAYER) {
            // If they are on home feed or search, maybe close current session after a threshold
            // For now, just keep it but check timing later
        }
    }

    private fun updateYouTubeSession(metadata: YouTubeMetadata, screenType: YouTubeScreenType) {
        val currentSession = activeYouTubeSession
        
        if (currentSession != null && currentSession.title == metadata.title) {
            // Same video, update last seen
            currentSession.lastSeenAt = System.currentTimeMillis()
            currentSession.screenType = screenType
            Log.v(TAG_YT_TRACE, "Session updated: ${metadata.title}")
        } else {
            // New video detected
            finishYouTubeSession()
            
            activeYouTubeSession = YouTubeWatchSession(
                title = metadata.title,
                channel = metadata.channel,
                videoId = metadata.videoId,
                screenType = screenType,
                lastDetectionConfidence = metadata.confidence
            )
            Log.i(TAG_YT_TRACE, "New Session Started: ${metadata.title} (Strategy: ${metadata.strategy})")
        }
    }

    private fun finishYouTubeSession() {
        val session = activeYouTubeSession ?: return
        val now = System.currentTimeMillis()
        val duration = (now - session.startedAt) / 1000
        
        // Threshold: 5s for videos, 2s for shorts
        val threshold = if (session.screenType == YouTubeScreenType.SHORTS) 2 else 5
        
        if (duration >= threshold && !session.title.isNullOrBlank()) {
            val activity = YouTubeActivity(
                id = UUID.randomUUID().toString(),
                videoTitle = session.title!!,
                channelName = session.channel ?: "Unknown channel",
                videoId = session.videoId,
                thumbnailUrl = session.thumbnailUrl,
                startedAt = session.startedAt,
                endedAt = now,
                watchDurationSeconds = duration
            )
            youtubeRepository.save(activity)
            Log.i(TAG_YT_TRACE, "Session Saved: ${session.title}, Duration: ${duration}s")
            com.example.kidsguard.sync.YouTubeSyncWorker.runOnce(applicationContext)
        } else {
            youtubeRepository.droppedCount++
            Log.d(TAG_YT_TRACE, "Session Dropped (below threshold or empty): ${session.title}, Duration: ${duration}s")
        }
        
        activeYouTubeSession = null
    }

    // --- Browser Handling ---

    private fun handleBrowserEvent(event: AccessibilityEvent, packageName: String) {
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                debounceBrowserScan(packageName)
            }
        }
    }

    private var lastBrowserPackage: String? = null
    private val browserScanRunnable = Runnable { scanBrowser(lastBrowserPackage ?: "") }

    private fun debounceBrowserScan(packageName: String) {
        lastBrowserPackage = packageName
        handler.removeCallbacks(browserScanRunnable)
        handler.postDelayed(browserScanRunnable, 800)
    }

    private fun scanBrowser(packageName: String) {
        val rootNode = rootInActiveWindow ?: return
        
        val url = findUrlHeuristic(rootNode, packageName)
        val title = findBrowserTitleHeuristic(rootNode, packageName)
        
        if (url != null && isValidUrl(url)) {
            if (url != lastProcessedBrowserUrl) {
                handleNewBrowserVisit(url, title, packageName)
            }
        }
    }

    private fun findUrlHeuristic(rootNode: AccessibilityNodeInfo, packageName: String): String? {
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
        return rootNode.window?.title?.toString()
    }

    private fun isValidUrl(url: String): Boolean {
        val lower = url.lowercase().trim()
        if (lower.isEmpty()) return false
        val blacklistedPrefixes = listOf("about:", "chrome://", "edge://", "opera://", "file://", "localhost")
        if (blacklistedPrefixes.any { lower.startsWith(it) }) return false
        return lower.contains(".") && !lower.contains(" ")
    }

    private var lastProcessedBrowserUrl: String? = null
    private var currentBrowserHistory: BrowserHistory? = null

    private fun handleNewBrowserVisit(url: String, title: String?, browserPackage: String) {
        val now = System.currentTimeMillis()
        finishBrowserHistory()

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
        
        Log.i(TAG_BROWSER, "New Browser Visit: $url (Category: ${classification.category})")
        browserRepository.save(currentBrowserHistory!!)
        enforcementManager.enforce(currentBrowserHistory!!)
        com.example.kidsguard.sync.BrowserSyncWorker.runOnce(applicationContext)
    }

    private fun finishBrowserHistory() {
        val history = currentBrowserHistory ?: return
        val now = System.currentTimeMillis()
        history.endedAt = now
        history.durationSeconds = (now - history.startedAt) / 1000
        browserRepository.save(history)
        currentBrowserHistory = null
    }

    override fun onInterrupt() {
        finishYouTubeSession()
        finishBrowserHistory()
    }

    override fun onDestroy() {
        finishYouTubeSession()
        finishBrowserHistory()
        super.onDestroy()
    }
}
