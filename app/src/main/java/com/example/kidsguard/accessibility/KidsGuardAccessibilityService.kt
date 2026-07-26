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

    companion object {
        private var instance: KidsGuardAccessibilityService? = null
        fun getInstance(): KidsGuardAccessibilityService? = instance
    }

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
        instance = this
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

        if (screenType == YouTubeScreenType.AD) {
            activeYouTubeSession?.let { it.isAdPlaying = true }
            youtubeRepository.adCount++
            youtubeRepository.addDebugLog("Ad playing, metadata updates paused.")
            return
        }

        activeYouTubeSession?.let { it.isAdPlaying = false }

        val candidate = YouTubeMetadataExtractor.extract(rootNode, screenType)
        if (candidate != null) {
            updateYouTubeSession(candidate)
        } else {
            // Check if we should close the session (e.g. they are on Home Feed now)
            if (screenType == YouTubeScreenType.FEED || screenType == YouTubeScreenType.SEARCH_RESULTS) {
                // If they've been on feed for a while, finish. 
                // Using a short delay or threshold would be better.
                finishYouTubeSession()
            }
        }
    }

    private fun updateYouTubeSession(candidate: YouTubeMetadataCandidate) {
        val current = activeYouTubeSession
        
        if (current != null && current.title == candidate.videoTitle) {
            current.lastSeenAt = System.currentTimeMillis()
            current.screenType = candidate.screenType
            
            // Enrich existing session if new link data found
            if (current.videoId == null && candidate.videoId != null) {
                current.videoId = candidate.videoId
                current.youtubeUrl = candidate.youtubeUrl
                current.thumbnailUrl = candidate.thumbnailUrl
                current.linkSource = candidate.linkSource
                current.linkConfidence = candidate.linkConfidence
                youtubeRepository.addDebugLog("Enriched active session with videoId: ${candidate.videoId}")
                Log.d("YOUTUBE_THUMBNAIL_DEBUG", "Video ID enriched: ${candidate.videoId}, Thumb: ${candidate.thumbnailUrl}")
            }
            
            Log.v(TAG_YT_TRACE, "Session active: ${candidate.videoTitle}")
        } else {
            finishYouTubeSession()
            activeYouTubeSession = YouTubeWatchSession(
                videoId = candidate.videoId,
                youtubeUrl = candidate.youtubeUrl,
                title = candidate.videoTitle,
                channel = candidate.channelName,
                thumbnailUrl = candidate.thumbnailUrl,
                linkSource = candidate.linkSource,
                linkConfidence = candidate.linkConfidence,
                screenType = candidate.screenType,
                lastDetectionConfidence = candidate.confidence
            )
            youtubeRepository.addDebugLog("New Session: ${candidate.videoTitle} (Strategy: ${candidate.extractionStrategy}, Link: ${candidate.videoId != null})")
            if (candidate.videoId != null) {
                Log.d("YOUTUBE_THUMBNAIL_DEBUG", "Video ID detected: ${candidate.videoId}, Thumb: ${candidate.thumbnailUrl}")
            }
        }
    }

    private fun finishYouTubeSession() {
        val session = activeYouTubeSession ?: return
        val now = System.currentTimeMillis()
        val duration = (now - session.startedAt) / 1000
        
        val threshold = if (session.screenType == YouTubeScreenType.SHORTS) 2 else 5
        
        if (duration >= threshold && !session.title.isNullOrBlank()) {
            val activity = YouTubeActivity(
                id = UUID.randomUUID().toString(),
                videoTitle = session.title!!,
                channelName = session.channel ?: "Unknown channel",
                videoId = session.videoId,
                youtubeUrl = session.youtubeUrl,
                thumbnailUrl = session.thumbnailUrl,
                linkSource = session.linkSource,
                linkConfidence = session.linkConfidence,
                startedAt = session.startedAt,
                endedAt = now,
                watchDurationSeconds = duration
            )
            youtubeRepository.save(activity)
            youtubeRepository.addDebugLog("Saved History: ${session.title} (${duration}s)")
            com.example.kidsguard.sync.YouTubeSyncWorker.runOnce(applicationContext)
        } else {
            youtubeRepository.droppedCount++
            youtubeRepository.addDebugLog("Dropped Session: ${session.title} (Duration ${duration}s < ${threshold}s)")
        }
        activeYouTubeSession = null
    }

    // --- Tree Dumping ---
    
    fun dumpTree() {
        val root = rootInActiveWindow ?: return
        youtubeRepository.addDebugLog("--- ACCESSIBILITY TREE DUMP ---")
        dumpNode(root, 0)
        youtubeRepository.addDebugLog("--- END DUMP ---")
    }

    private fun dumpNode(node: AccessibilityNodeInfo, depth: Int) {
        if (depth > 50) return // Safety
        val indent = "  ".repeat(depth)
        val info = "ID: ${node.viewIdResourceName}, Text: ${node.text}, Desc: ${node.contentDescription}, Class: ${node.className}"
        Log.d("TREE_DUMP", "$indent $info")
        
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            dumpNode(child, depth + 1)
        }
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
        instance = null
        super.onDestroy()
    }
}
