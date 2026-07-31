package com.example.kidsguard.accessibility

import android.accessibilityservice.AccessibilityService
import android.app.ActivityOptions
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.MainActivity
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.managers.ProtectionModeManager
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.models.YouTubeActivity
import com.example.kidsguard.models.YouTubeMetadataCandidate
import com.example.kidsguard.models.YouTubeScreenType
import com.example.kidsguard.models.YouTubeWatchSession
import com.example.kidsguard.repository.BrowserHistoryRepository
import com.example.kidsguard.repository.YouTubeHistoryRepository
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider
import com.example.kidsguard.utils.DomainNormalizer
import com.example.kidsguard.utils.MediaSessionMetadataReader
import com.example.kidsguard.utils.PolicyEnforcementManager
import com.example.kidsguard.utils.WebsiteCategoryClassifier
import com.example.kidsguard.utils.YouTubeMetadataExtractor
import com.example.kidsguard.utils.YouTubeScreenDetector
import com.example.kidsguard.web.WebProtectionManager
import com.example.kidsguard.wellbeing.AppBlockReason
import com.example.kidsguard.wellbeing.WellbeingManager
import com.example.kidsguard.youtube.YouTubeApiClient
import com.example.kidsguard.youtube.YouTubeVideoResolver
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * CONSOLIDATED ACCESSIBILITY SERVICE
 * Handles:
 * 1. App Blocking (Protection Modes, Wellbeing Limits)
 * 2. Global Lock Mode
 * 3. YouTube Watch History Tracking
 * 4. Browser History Tracking & Content Filtering
 */
class KidsGuardAccessibilityService : AccessibilityService() {
    private val serviceScope = CoroutineScope(
        SupervisorJob() + Dispatchers.IO
    )

    companion object {
        private var instance: KidsGuardAccessibilityService? = null
        fun getInstance(): KidsGuardAccessibilityService? = instance
    }

    private var lastYouTubeEventSource: AccessibilityNodeInfo? = null
    private var lastYouTubeScanAt = 0L

    private lateinit var youtubeRepository: YouTubeHistoryRepository
    private lateinit var browserRepository: BrowserHistoryRepository
    private lateinit var classifier: WebsiteCategoryClassifier
    private lateinit var enforcementManager: PolicyEnforcementManager
    private lateinit var prefHelper: PreferenceHelper

    private var wellbeingManager: WellbeingManager? = null
    private var webManager: WebProtectionManager? = null
    private var protectionModeManager: ProtectionModeManager? = null

    // YouTube Monitoring
    private var activeYouTubeSession: YouTubeWatchSession? = null
    private val handler = Handler(Looper.getMainLooper())

    private val TAG_RUNTIME = "YOUTUBE_MONITOR_RUNTIME"
    private val TAG_YT_TRACE = "YOUTUBE_HISTORY_TRACE"
    private val TAG_BROWSER = "BROWSER_MONITOR"
    private val TAG_BLOCK = "APP_BLOCKING"

    private val PACKAGE_YOUTUBE = "com.google.android.youtube"

    private val BROWSER_PACKAGES = setOf(
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.opera.browser",
        "com.sec.android.app.sbrowser"
    )

    private var debugEventCount = 0

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG_RUNTIME, "SERVICE_CREATED")

        try {
            youtubeRepository = YouTubeHistoryRepository.getInstance(applicationContext)
            youtubeRepository.addDebugLog("SERVICE_CREATED")
            //youtubeRepository.lastServiceVersion = com.example.kidsguard.BuildConfig.VERSION_NAME
            //youtubeRepository.lastServiceCode = com.example.kidsguard.BuildConfig.VERSION_CODE
            youtubeRepository.lastServicePackage = applicationContext.packageName

            prefHelper = PreferenceHelper(applicationContext)
            val sync = FirebaseRemoteSyncProvider(applicationContext)

            browserRepository = BrowserHistoryRepository(applicationContext)
            classifier = WebsiteCategoryClassifier(applicationContext)
            enforcementManager = PolicyEnforcementManager(applicationContext)

            wellbeingManager = WellbeingManager(applicationContext, prefHelper, sync)
            webManager = WebProtectionManager(applicationContext, prefHelper, sync)
            protectionModeManager = ProtectionModeManager(applicationContext, prefHelper.childId)

            youtubeRepository.addDebugLog("YOUTUBE_MONITOR_INIT - PID: ${android.os.Process.myPid()}")
        } catch (e: Exception) {
            Log.e(TAG_RUNTIME, "Critical failure in onCreate", e)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG_RUNTIME, "SERVICE_CONNECTED")
        youtubeRepository.addDebugLog("SERVICE_CONNECTED")

        // Log configuration
        val info = serviceInfo
        Log.d(TAG_RUNTIME, "Configured Event Types: ${info.eventTypes}")
        Log.d(TAG_RUNTIME, "Configured Package Names: ${info.packageNames?.joinToString()}")

        youtubeRepository.addDebugLog("MONITOR_ATTACHED")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: "unknown"
        val eventType = event.eventType
        val className = event.className?.toString() ?: ""

        Log.d(
            TAG_RUNTIME,
            "ACCESSIBILITY_WINDOW package=$packageName class=$className type=$eventType"
        )
        if (
            eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            isKidsGuardTamperScreen(packageName, className)
        ) {
            Log.w(
                TAG_RUNTIME,
                "KIDSGUARD_TAMPER_BLOCKED package=$packageName class=$className"
            )

            sendTamperAlert("KIDSGUARD_SETTINGS_TAMPER_ATTEMPT")

            performGlobalAction(GLOBAL_ACTION_BACK)
            return
        }

        // Update diagnostics regardless of package
        youtubeRepository.lastAccessibilityPackage = packageName
        youtubeRepository.lastAccessibilityTime = System.currentTimeMillis()

        // 0. TRACE ALL EVENTS UNTIL STABLE
        if (debugEventCount < 20) {
            youtubeRepository.addDebugLog("EVENT_RECEIVED package=$packageName type=$eventType")
            debugEventCount++
        }

        // 0.1 IMMEDIATE LOG FOR YOUTUBE specifically
        if (packageName == PACKAGE_YOUTUBE) {
            youtubeRepository.addDebugLog("YOUTUBE_EVENT_FORWARDED type=$eventType")
            Log.i(TAG_RUNTIME, "EVENT_RECEIVED package=$packageName type=$eventType")
        }

        // 1. System Unlocked check
        val userManager = getSystemService(android.os.UserManager::class.java)
        if (userManager != null && !userManager.isUserUnlocked) {
            if (packageName == PACKAGE_YOUTUBE) {
                youtubeRepository.addDebugLog("EVENT_REJECTED reason=DEVICE_LOCKED")
            }
            return
        }

        // 2. Protection Modes Enforcement (Highest Priority)
        if (packageName != applicationContext.packageName && protectionModeManager?.isAppBlocked(
                packageName
            ) == true
        ) {
            if (packageName == PACKAGE_YOUTUBE) {
                youtubeRepository.addDebugLog("EVENT_REJECTED reason=APP_BLOCKED_BY_PROTECTION")
            }
            blockApp(packageName)
            return
        }

        // 3. Global Lock Mode
        if (prefHelper.isLocked && packageName != applicationContext.packageName) {
            if (packageName == PACKAGE_YOUTUBE) {
                youtubeRepository.addDebugLog("EVENT_REJECTED reason=GLOBAL_LOCK_ACTIVE")
            }
            bringOurAppToFront()
            return
        }

        // 4. YouTube & Browser Monitoring
        when {
            packageName == PACKAGE_YOUTUBE -> {
                handleYouTubeEvent(event)
            }

            BROWSER_PACKAGES.contains(packageName) -> {
                handleBrowserEvent(event, packageName)
            }
        }

        // 5. Individual App Blocking (Wellbeing)
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (packageName != applicationContext.packageName) {
                val reason = wellbeingManager?.getAppBlockReason(packageName) ?: AppBlockReason.NONE
                if (reason != AppBlockReason.NONE) {
                    Log.i(TAG_BLOCK, "App Blocked by Wellbeing: $packageName (Reason: $reason)")
                    blockApp(packageName, reason)
                }
            }
        }
    }

    private var lastTamperAlertTime = 0L

    private fun sendTamperAlert(reason: String) {
        youtubeRepository.addDebugLog(
            "TAMPER_ALERT_ATTEMPT reason=$reason"
        )
        val now = System.currentTimeMillis()

        // Prevent repeated alerts from the same Settings screen
        if (now - lastTamperAlertTime < 30_000) return
        lastTamperAlertTime = now

        val childId = prefHelper.childId
        val familyId = prefHelper.familyId

        if (childId.isNullOrBlank()) {
            youtubeRepository.addDebugLog(
                "TAMPER_ALERT_FAILED CHILD_ID_MISSING"
            )
            return
        }

        if (familyId.isNullOrBlank()) {
            youtubeRepository.addDebugLog(
                "TAMPER_ALERT_FAILED FAMILY_ID_MISSING"
            )
            return
        }
        youtubeRepository.addDebugLog(
            "TAMPER_PARENT_UID=${prefHelper.parentUid ?: "NULL"}"
        )

        val notification = mapOf(
            "type" to "TAMPER_ALERT",
            "title" to "Security Alert",
            "body" to "Someone tried to disable or remove KidsGuard protection.",
            "reason" to reason,
            "childId" to childId,
            "childName" to prefHelper.childName,
            "familyId" to familyId,
            "userId" to prefHelper.parentUid,
            "createdAt" to FieldValue.serverTimestamp(),
            "read" to false,
            "clickAction" to "/dashboard/$childId"
        )

        FirebaseFirestore.getInstance()
            .collection(FirebaseConfig.COL_NOTIFICATIONS)
            .add(notification)
            .addOnSuccessListener {
                Log.i(TAG_RUNTIME, "TAMPER_ALERT_SENT reason=$reason")

                youtubeRepository.addDebugLog(
                    "TAMPER_ALERT_SENT reason=$reason"
                )
            }
            .addOnFailureListener { e ->
                Log.e(TAG_RUNTIME, "TAMPER_ALERT_FAILED", e)

                youtubeRepository.addDebugLog(
                    "TAMPER_ALERT_FIRESTORE_FAILED ${e.message}"
                )
            }
    }

    private fun isKidsGuardTamperScreen(
        packageName: String,
        className: String
    ): Boolean {
        if (prefHelper.authorizedUninstall) {
            return false
        }

        val settingsPackage =
            packageName == "com.android.settings" ||
                    packageName.startsWith("com.android.settings")

        val installerPackage =
            packageName == "com.android.packageinstaller" ||
                    packageName == "com.google.android.packageinstaller"

        if (!settingsPackage && !installerPackage) {
            return false
        }

        val root = rootInActiveWindow ?: return false

        val screenText = buildString {
            root.findAccessibilityNodeInfosByText("KidsGuard")
                ?.forEach { node ->
                    append(node.text?.toString().orEmpty())
                    append(" ")
                }

            root.findAccessibilityNodeInfosByText("Uninstall")
                ?.forEach { node ->
                    append(node.text?.toString().orEmpty())
                    append(" ")
                }

            root.findAccessibilityNodeInfosByText("Deactivate")
                ?.forEach { node ->
                    append(node.text?.toString().orEmpty())
                    append(" ")
                }
            root.findAccessibilityNodeInfosByText("Stop")
                ?.forEach { node ->
                    append(node.text?.toString().orEmpty())
                    append(" ")
                }

            root.findAccessibilityNodeInfosByText("Turn off")
                ?.forEach { node ->
                    append(node.text?.toString().orEmpty())
                    append(" ")
                }
        }.lowercase()


        val mentionsKidsGuard =
            screenText.contains("kidsguard")

        val looksDangerous =
            screenText.contains("uninstall") ||
                    screenText.contains("deactivate") ||
                    screenText.contains("stop kidsguard") ||
                    screenText.contains("turn off") ||
                    className.contains("DeviceAdmin", ignoreCase = true) ||
                    className.contains("InstalledApp", ignoreCase = true) ||
                    className.contains("AppInfo", ignoreCase = true)

        return mentionsKidsGuard && looksDangerous
    }

    // --- YouTube Handling ---

    private fun handleYouTubeEvent(event: AccessibilityEvent) {
        logYouTubeEvent(event)

        val supportedEvent = when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_VIEW_SCROLLED,
            AccessibilityEvent.TYPE_VIEW_CLICKED -> true

            else -> false
        }

        if (!supportedEvent) return

        event.source?.let { source ->
            if (source.packageName?.toString() == PACKAGE_YOUTUBE) {
                lastYouTubeEventSource = source
            }
        }

        val now = System.currentTimeMillis()

        // Continuous YouTube events must not postpone scanning forever.
        if (now - lastYouTubeScanAt >= 300L) {
            lastYouTubeScanAt = now
            scanYouTube()
        }

        scheduleYouTubeRetry()
    }

    private fun logYouTubeEvent(event: AccessibilityEvent) {
        //
        // if (!com.example.kidsguard.BuildConfig.DEBUG) return
        Log.v(
            TAG_YT_TRACE,
            "Event: ${event.eventType}, Class: ${event.className}, ID: ${event.source?.viewIdResourceName}, Text: ${event.text}"
        )
    }

    private val youtubeScanRunnable = Runnable { scanYouTube() }

    private fun scheduleYouTubeRetry() {
        handler.removeCallbacks(youtubeScanRunnable)

        handler.postDelayed(
            youtubeScanRunnable,
            600L
        )
    }

    private fun scanYouTube() {
        youtubeRepository.addDebugLog("MONITOR_RECEIVED_EVENT")
        val activeRoot = rootInActiveWindow
        val eventRoot = lastYouTubeEventSource

        val rootNode = when {
            activeRoot?.packageName?.toString() == PACKAGE_YOUTUBE -> activeRoot
            eventRoot?.packageName?.toString() == PACKAGE_YOUTUBE -> eventRoot
            else -> null
        } ?: run {
            youtubeRepository.addDebugLog(
                "PARSER_ABORT reason=NO_YOUTUBE_ROOT " +
                        "activePkg=${activeRoot?.packageName} " +
                        "sourcePkg=${eventRoot?.packageName}"
            )
            return
        }

        youtubeRepository.addDebugLog(
            "ROOT_SELECTED pkg=${rootNode.packageName} children=${rootNode.childCount}"
        )

        youtubeRepository.addDebugLog("PARSER_STARTED")
        val screenType = YouTubeScreenDetector.detect(rootNode)
        Log.d(TAG_YT_TRACE, "Detected Screen: $screenType")

        if (screenType == YouTubeScreenType.AD) {
            activeYouTubeSession?.let { it.isAdPlaying = true }
            youtubeRepository.adCount++
            youtubeRepository.addDebugLog("Screen: AD - Pausing capture")
            return
        }

        activeYouTubeSession?.let { it.isAdPlaying = false }

        val candidate = YouTubeMetadataExtractor.extract(
            rootNode,
            screenType,
            youtubeRepository
        )
        if (candidate != null) {
            updateYouTubeSession(candidate)

        } else {

            val mediaSnapshot =
                MediaSessionMetadataReader.readYouTubeSession(applicationContext)

            if (
                mediaSnapshot?.title.isNullOrBlank().not() &&
                screenType != YouTubeScreenType.FEED &&
                screenType != YouTubeScreenType.SEARCH_RESULTS &&
                screenType != YouTubeScreenType.AD
            ) {
                youtubeRepository.addDebugLog(
                    "MEDIA_SESSION_FALLBACK " +
                            "title=${mediaSnapshot?.title} " +
                            "artist=${mediaSnapshot?.artist} " +
                            "mediaId=${mediaSnapshot?.mediaId} " +
                            "mediaUri=${mediaSnapshot?.mediaUri} " +
                            "artworkUri=${mediaSnapshot?.artworkUri} " +
                            "durationMs=${mediaSnapshot?.durationMs} " +
                            "playbackState=${mediaSnapshot?.playbackState}"
                )
                val resolveRequest = YouTubeVideoResolver.buildRequest(
                    title = mediaSnapshot?.title,
                    channel = mediaSnapshot?.artist,
                    durationMs = mediaSnapshot?.durationMs,
                    mediaId = mediaSnapshot?.mediaId,
                    mediaUri = mediaSnapshot?.mediaUri
                )

                val directResolved = resolveRequest?.let {
                    YouTubeVideoResolver.resolveDirect(it)
                }

                if (directResolved != null) {
                    youtubeRepository.addDebugLog(
                        "DIRECT_VIDEO_RESOLVED " +
                                "id=${directResolved.videoId} " +
                                "source=${directResolved.source} " +
                                "url=${directResolved.youtubeUrl}"
                    )
                } else {
                    youtubeRepository.addDebugLog(
                        "DIRECT_VIDEO_NOT_RESOLVED"
                    )
                }

                val mediaCandidate = YouTubeMetadataCandidate(
                    videoTitle = mediaSnapshot?.title,
                    channelName = mediaSnapshot?.artist,
                    videoId = null,
                    youtubeUrl = null,
                    thumbnailUrl = mediaSnapshot?.artworkUri,
                    linkSource = "MEDIA_SESSION",
                    linkConfidence = null,
                    screenType = screenType,
                    confidence = 0.90f,
                    extractionStrategy = "MEDIA_SESSION_FALLBACK"
                )

                updateYouTubeSession(mediaCandidate)

                if (directResolved == null && resolveRequest != null) {
                    serviceScope.launch {

                        youtubeRepository.addDebugLog(
                            "YOUTUBE_API_SEARCH_STARTED title=${resolveRequest.title}"
                        )

                        val searchResponse =
                            YouTubeApiClient.searchVideos(resolveRequest)

                        if (searchResponse == null) {
                            youtubeRepository.addDebugLog(
                                "YOUTUBE_API_SEARCH_NO_RESPONSE"
                            )
                            return@launch
                        }

                        val apiResolved =
                            YouTubeVideoResolver.resolveFromSearch(
                                request = resolveRequest,
                                response = searchResponse
                            )

                        if (apiResolved == null) {
                            youtubeRepository.addDebugLog(
                                "YOUTUBE_API_NO_MATCH title=${resolveRequest.title}"
                            )
                            return@launch
                        }

                        val apiCandidate = YouTubeMetadataCandidate(
                            videoTitle = resolveRequest.title,
                            channelName = resolveRequest.channel,
                            videoId = apiResolved.videoId,
                            youtubeUrl = apiResolved.youtubeUrl,
                            thumbnailUrl = apiResolved.thumbnailUrl,
                            linkSource = apiResolved.source,
                            linkConfidence = apiResolved.confidence,
                            screenType = screenType,
                            confidence = apiResolved.confidence,
                            extractionStrategy = "YOUTUBE_SEARCH_API"
                        )

                        withContext(Dispatchers.Main.immediate) {
                            updateYouTubeSession(apiCandidate)
                        }

                        youtubeRepository.enrichSavedActivity(
                            title = resolveRequest.title,
                            videoId = apiResolved.videoId,
                            youtubeUrl = apiResolved.youtubeUrl,
                            thumbnailUrl = apiResolved.thumbnailUrl,
                            linkSource = apiResolved.source,
                            linkConfidence = apiResolved.confidence
                        )


                        youtubeRepository.addDebugLog(
                            "YOUTUBE_API_RESOLVED " +
                                    "id=${apiResolved.videoId} " +
                                    "confidence=${apiResolved.confidence}"
                        )
                    }
                }

            } else {
                if (
                    screenType == YouTubeScreenType.FEED ||
                    screenType == YouTubeScreenType.SEARCH_RESULTS
                ) {
                    finishYouTubeSession()
                }
            }
        }
    }

    private fun updateYouTubeSession(candidate: YouTubeMetadataCandidate) {
        val current = activeYouTubeSession
        // val now = System.currentTimeMillis()

        if (
            current != null &&
            current.title == candidate.videoTitle
        //&& now - current.lastSeenAt > 30_000
        ) {
            finishYouTubeSession()
        }

        val active = activeYouTubeSession

        if (active != null && active.title == candidate.videoTitle) {
            // active.lastSeenAt = now
            active.screenType = candidate.screenType

            if (active.videoId == null && candidate.videoId != null) {
                active.videoId = candidate.videoId
                active.youtubeUrl = candidate.youtubeUrl
                active.thumbnailUrl = candidate.thumbnailUrl
                active.linkSource = candidate.linkSource
                active.linkConfidence = candidate.linkConfidence

                youtubeRepository.addDebugLog(
                    "Session Enriched ID=${candidate.videoId}"
                )
            }
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
        }

        youtubeRepository.addDebugLog(
            "YOUTUBE_MONITOR_PARSER: Found ${candidate.videoTitle}"
        )
    }

    private fun finishYouTubeSession() {
        val session = activeYouTubeSession ?: return
        // Try to enrich the Accessibility session with Android MediaSession metadata.
        val mediaSnapshot =
            MediaSessionMetadataReader.readYouTubeSession(applicationContext)

        if (mediaSnapshot != null) {
            youtubeRepository.addDebugLog(
                "MEDIA_SESSION_FOUND " +
                        "title=${mediaSnapshot.title} " +
                        "artist=${mediaSnapshot.artist} " +
                        "mediaId=${mediaSnapshot.mediaId} " +
                        "artwork=${mediaSnapshot.artworkUri} " +
                        "durationMs=${mediaSnapshot.durationMs}"
            )
        } else {
            youtubeRepository.addDebugLog("MEDIA_SESSION_NOT_FOUND")
        }
        val now = System.currentTimeMillis()
        val duration = (now - session.startedAt) / 1000

        val threshold = if (session.screenType == YouTubeScreenType.SHORTS) 2 else 5

        youtubeRepository.addDebugLog("HISTORY_SAVE_ATTEMPT: ${session.title}")

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
            youtubeRepository.addDebugLog("SAVE_HISTORY: ${session.title} (${duration}s)")
            com.example.kidsguard.sync.YouTubeSyncWorker.runOnce(applicationContext)
        } else {
            val reason =
                if (session.title.isNullOrBlank()) "EMPTY_TITLE" else "SHORT_DURATION (${duration}s)"
            youtubeRepository.droppedCount++
            youtubeRepository.addDebugLog("SAVE_ABORT reason=$reason")
        }
        activeYouTubeSession = null
    }

    // --- Tree Dumping ---

    fun dumpTree() {
        val root = rootInActiveWindow ?: return
        youtubeRepository.addDebugLog("--- TREE DUMP START ---")
        dumpNode(root, 0)
        youtubeRepository.addDebugLog("--- TREE DUMP END ---")
    }

    private fun dumpNode(node: AccessibilityNodeInfo, depth: Int) {
        if (depth > 50) return
        val indent = "  ".repeat(depth)
        val info =
            "ID: ${node.viewIdResourceName}, Text: ${node.text}, Desc: ${node.contentDescription}"
        Log.d("TREE_DUMP", "$indent $info")
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            dumpNode(child, depth + 1)
        }
    }

    // --- Browser Handling ---

    private fun handleBrowserEvent(event: AccessibilityEvent, packageName: String) {
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        ) {
            checkBrowserUrl(event, packageName)
        }

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

    private fun checkBrowserUrl(event: AccessibilityEvent, packageName: String) {
        val source = event.source ?: return
        val url = findUrlHeuristic(source, packageName)
        if (!url.isNullOrEmpty()) {
            if (webManager?.checkUrl(url, packageName) == false) {
                blockWeb(url, packageName)
            }
        }
    }

    private fun findUrlHeuristic(rootNode: AccessibilityNodeInfo, packageName: String): String? {
        val addressBarIds = when (packageName) {
            "com.android.chrome" -> listOf(
                "com.android.chrome:id/url_bar",
                "com.android.chrome:id/search_box_text"
            )

            "org.mozilla.firefox" -> listOf("org.mozilla.firefox:id/mozac_browser_toolbar_url_view")
            "com.sec.android.app.sbrowser" -> listOf("com.sec.android.app.sbrowser:id/location_bar_edit_text")
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

    private fun findBrowserTitleHeuristic(
        rootNode: AccessibilityNodeInfo,
        packageName: String
    ): String? {
        return rootNode.window?.title?.toString()
    }

    private fun isValidUrl(url: String): Boolean {
        val lower = url.lowercase().trim()
        if (lower.isEmpty()) return false
        val blacklistedPrefixes =
            listOf("about:", "chrome://", "edge://", "opera://", "file://", "localhost")
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

    // --- App Blocking UI ---

    private var lastLaunchTime = 0L
    private val launchThrottleMs = 1000L

    private fun safeStartActivity(intent: Intent) {
        val now = System.currentTimeMillis()
        if (now - lastLaunchTime < launchThrottleMs) return
        lastLaunchTime = now

        try {
            if (Build.VERSION.SDK_INT >= 35) {
                val options = ActivityOptions.makeBasic()
                options.pendingIntentBackgroundActivityStartMode =
                    ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
                startActivity(intent, options.toBundle())
            } else {
                startActivity(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG_BLOCK, "Failed to start activity: ${e.message}")
        }
    }

    private fun blockApp(
        packageName: String,
        reason: AppBlockReason = AppBlockReason.STATIC_BLOCK
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("action", "BLOCK_SCREEN")
            putExtra("blocked_package", packageName)
            putExtra("block_reason", reason.name)
        }
        safeStartActivity(intent)
    }


    private fun blockWeb(url: String, packageName: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("action", "WEB_BLOCKED")
            putExtra("blocked_url", url)
            putExtra("browser_package", packageName)
        }
        safeStartActivity(intent)
    }

    private fun bringOurAppToFront() {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        safeStartActivity(intent)
    }

    override fun onInterrupt() {
        Log.i(TAG_RUNTIME, "SERVICE_INTERRUPTED")
        Log.w(TAG_RUNTIME, "KIDSGUARD_ACCESSIBILITY_INTERRUPTED")
        youtubeRepository.addDebugLog("SERVICE_INTERRUPTED")
        finishYouTubeSession()
        finishBrowserHistory()
    }

    override fun onDestroy() {
        Log.w(TAG_RUNTIME, "KIDSGUARD_ACCESSIBILITY_DESTROYED")
        Log.i(TAG_RUNTIME, "SERVICE_DESTROYED")
        youtubeRepository.addDebugLog("SERVICE_DESTROYED")
        finishYouTubeSession()
        finishBrowserHistory()
        instance = null
        super.onDestroy()
        serviceScope.cancel()
    }
}
