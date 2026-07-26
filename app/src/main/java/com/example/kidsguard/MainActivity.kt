package com.example.kidsguard

import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.example.kidsguard.ai.DailySummaryRepository
import com.example.kidsguard.ai.LocalRuleBasedSummaryProvider
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.navigation.KidsGuardApp
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.RouteRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.repository.SosRepository
import com.example.kidsguard.routeintelligence.KnownRouteRepository
import com.example.kidsguard.sync.ChildStatusManager
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider
import com.example.kidsguard.sync.LocalMockSyncProvider
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.LocalTrackingScheduler
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.ui.theme.KidsGuardTheme
import com.example.kidsguard.update.UpdateRepository
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {
    private lateinit var prefHelper: PreferenceHelper
    private lateinit var repository: SafeZoneRepository
    private lateinit var locationRepository: LocationRepository
    private lateinit var sosRepository: SosRepository
    private lateinit var routeRepository: RouteRepository
    private lateinit var dailySummaryRepository: DailySummaryRepository
    private lateinit var knownRouteRepository: KnownRouteRepository
    private lateinit var reverseGeocoder: com.example.kidsguard.geocoding.ReverseGeocoder
    private lateinit var errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository
    private lateinit var trackingRepository: TrackingRepository
    private lateinit var updateRepository: UpdateRepository
    private lateinit var trackingManager: BackgroundTrackingManager
    private lateinit var syncProvider: RemoteSyncProvider
    private lateinit var commandHandler: RemoteCommandHandler
    private lateinit var authRepository: AuthRepository
    private lateinit var remoteCommandRepository: com.example.kidsguard.repository.RemoteCommandRepository
    private lateinit var protectionModeRepository: com.example.kidsguard.repository.ProtectionModeRepository
    private lateinit var childStatusManager: ChildStatusManager
    private lateinit var lockScheduleManager: com.example.kidsguard.managers.LockScheduleManager
    private lateinit var wellbeingManager: com.example.kidsguard.wellbeing.WellbeingManager
    private lateinit var webManager: com.example.kidsguard.web.WebProtectionManager
    private lateinit var youtubeHistoryRepository: com.example.kidsguard.repository.YouTubeHistoryRepository
    private lateinit var browserHistoryRepository: com.example.kidsguard.repository.BrowserHistoryRepository
    private lateinit var websitePolicyRepository: com.example.kidsguard.repository.WebsitePolicyRepository
    private lateinit var notificationEngine: LocalNotificationEngine
    private lateinit var parentNotificationManager: com.example.kidsguard.notifications.ParentNotificationManager
    private lateinit var locationProvider: LocalLocationProvider
    private var unpairListener: com.google.firebase.firestore.ListenerRegistration? = null
    private var currentScreenState = mutableStateOf(Screen.Home)
    private var blockedPackageName = mutableStateOf<String?>(null)
    private var blockedReason = mutableStateOf<String?>(null)
    private var blockedUrl = mutableStateOf<String?>(null)
    private var remoteMessage = mutableStateOf<String?>(null)
    private var remoteCommandMode =
        mutableStateOf(com.example.kidsguard.ui.screens.RemoteCommandMode.MESSAGE)
    private var volumeUpTapCount = 0
    private var firstVolumeUpTapTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        FirebaseConfig.initializeAppCheck(this)
        prefHelper = PreferenceHelper(this)
        repository = SafeZoneRepository()
        knownRouteRepository = KnownRouteRepository(this)
        errorLogRepository = com.example.kidsguard.repository.ErrorLogRepository(this)
        notificationEngine = LocalNotificationEngine(this, errorLogRepository)
        locationProvider = LocalLocationProvider(this)
        reverseGeocoder = com.example.kidsguard.geocoding.ReverseGeocoder(this, errorLogRepository)

        trackingRepository = TrackingRepository(this)
        updateRepository = UpdateRepository(this)
        trackingManager =
            BackgroundTrackingManager(LocalTrackingScheduler(this), trackingRepository)
        authRepository = AuthRepository(this)
        protectionModeRepository = com.example.kidsguard.repository.ProtectionModeRepository()
        parentNotificationManager =
            com.example.kidsguard.notifications.ParentNotificationManager(this)

        syncProvider = if (FirebaseConfig.shouldUseFirebase(this)) {
            FirebaseRemoteSyncProvider(this)
        } else {
            LocalMockSyncProvider()
        }

        remoteCommandRepository =
            com.example.kidsguard.repository.RemoteCommandRepository(syncProvider)

        locationRepository = LocationRepository(
            this,
            repository,
            knownRouteRepository,
            reverseGeocoder,
            errorLogRepository,
            syncProvider
        )
        sosRepository = SosRepository(this)
        routeRepository = RouteRepository(locationRepository)
        dailySummaryRepository = DailySummaryRepository(
            this,
            locationRepository,
            repository,
            routeRepository,
            sosRepository,
            LocalRuleBasedSummaryProvider(),
            errorLogRepository
        )
        lockScheduleManager = com.example.kidsguard.managers.LockScheduleManager(
            this,
            prefHelper,
            onLockRequested = { currentScreenState.value = Screen.Locked },
            onUnlockRequested = { currentScreenState.value = Screen.Home }
        )
        wellbeingManager =
            com.example.kidsguard.wellbeing.WellbeingManager(this, prefHelper, syncProvider)
        webManager = com.example.kidsguard.web.WebProtectionManager(this, prefHelper, syncProvider)
        youtubeHistoryRepository = com.example.kidsguard.repository.YouTubeHistoryRepository.getInstance(this)
        browserHistoryRepository = com.example.kidsguard.repository.BrowserHistoryRepository(this)
        websitePolicyRepository = com.example.kidsguard.repository.WebsitePolicyRepository(this)

        // Initialize synchronization for repositories
        val syncId = prefHelper.childId
        if (syncId.isNotEmpty()) {
            repository.setSyncProvider(syncProvider, syncId, prefHelper.familyId)
            sosRepository.setSyncProvider(syncProvider)
            dailySummaryRepository.setSyncProvider(syncProvider)
        }

        childStatusManager = ChildStatusManager(
            this,
            prefHelper,
            syncProvider,
            trackingRepository,
            repository,
            locationRepository
        )

        commandHandler = RemoteCommandHandler(
            androidContext = this,
            prefHelper = prefHelper,
            trackingManager = trackingManager,
            syncProvider = syncProvider,
            safeZoneRepository = repository,
            notificationEngine = notificationEngine,
            onLockRequested = {
                currentScreenState.value = Screen.Locked
            },
            onUnlockRequested = {
                currentScreenState.value = Screen.Home
            },
            onRefreshLocationRequested = {
                locationProvider.requestSingleUpdate { point ->
                    if (point != null) {
                        locationRepository.addLocationPoint(point)
                    }
                }
            },
            onShowMessageRequested = { msg ->
                remoteMessage.value = msg
                remoteCommandMode.value = com.example.kidsguard.ui.screens.RemoteCommandMode.MESSAGE
                currentScreenState.value = Screen.RemoteCommand
            },
            onRingRequested = {
                notificationEngine.triggerSiren()
                remoteCommandMode.value = com.example.kidsguard.ui.screens.RemoteCommandMode.RINGING
                currentScreenState.value = Screen.RemoteCommand
            },
            onVibrateRequested = {
                val vibrator =
                    getSystemService(android.content.Context.VIBRATOR_SERVICE) as android.os.Vibrator
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        android.os.VibrationEffect.createOneShot(
                            5000,
                            android.os.VibrationEffect.DEFAULT_AMPLITUDE
                        )
                    )
                } else {
                    vibrator.vibrate(5000)
                }
            },
            lockScheduleManager = lockScheduleManager
        )

        trackingManager.initialize()
        syncProvider.connect()

        if (prefHelper.userRole == "CHILD") {
            trackingManager.startTracking() // Ensure service is running for commands
            com.example.kidsguard.sync.AppUsageSyncWorker.schedule(this)
            com.example.kidsguard.sync.YouTubeSyncWorker.schedule(this)
            com.example.kidsguard.sync.BrowserSyncWorker.schedule(this)
            com.example.kidsguard.repository.InstalledAppsRepository(this).initialScan()
            
            lifecycleScope.launch(Dispatchers.IO) {
                browserHistoryRepository.categorizeExistingUnknownRecords()
            }
        }

        // Check for updates on startup
        lifecycleScope.launch {
            updateRepository.checkForUpdates()
        }

        if (prefHelper.userRole == "CHILD") {
            childStatusManager.startPeriodicSync()
            lifecycleScope.launch {
                trackingManager.isTrackingEnabled.collect {
                    childStatusManager.updateStatus()
                }
            }

            // Realtime Lock Schedule Listener
            (syncProvider as? com.example.kidsguard.sync.FirebaseRemoteSyncProvider)?.let { provider ->
                lifecycleScope.launch {
                    provider.listenToLockSchedule(prefHelper.childId).collect { schedule ->
                        lockScheduleManager.updateSchedule(schedule)
                    }
                }
            }


            // Periodic schedule check (every minute)
            lifecycleScope.launch {
                while (true) {
                    lockScheduleManager.checkAndApply(null)
                    kotlinx.coroutines.delay(60000)
                }
            }
        }

        // Initialize Firebase Auth and Register Device
        val isConfigured = FirebaseConfig.isFirebaseConfigured(this)
        Log.d("MainActivity", "Firebase configuration status: $isConfigured")

        if (isConfigured) {
            lifecycleScope.launch {
                val currentUser = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
                if (currentUser == null) {
                    val success = authRepository.signInAnonymously()
                    if (success) {
                        authRepository.registerDevice()
                    }
                } else {
                    Log.i("MainActivity", "User already signed in: ${currentUser.uid}")
                    authRepository.registerDevice()
                    if (prefHelper.userRole == "PARENT") {
                        parentNotificationManager.registerParentDevice()
                    }
                }
            }
        }

        // Determining initial screen
        handleIntent(intent)
        val initialScreen = if (currentScreenState.value == Screen.AppBlocked) {
            Screen.AppBlocked
        } else {
            when {
                prefHelper.isLocked -> Screen.Locked
                prefHelper.userRole == "NONE" -> Screen.RoleSelection
                prefHelper.userRole == "PARENT" -> if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
                prefHelper.userRole == "CHILD" -> {
                    if (prefHelper.pairedChildId == null) {
                        Screen.ChildSetup
                    } else {
                        val hasAllPermissions =
                            com.example.kidsguard.utils.PermissionUtils.hasLocationPermission(this) &&
                                    com.example.kidsguard.utils.PermissionUtils.hasBackgroundLocationPermission(
                                        this
                                    ) &&
                                    com.example.kidsguard.utils.PermissionUtils.hasNotificationPermission(
                                        this
                                    ) &&
                                    com.example.kidsguard.utils.PermissionUtils.isBatteryOptimizationIgnored(
                                        this
                                    ) &&
                                    com.example.kidsguard.utils.PermissionUtils.isAccessibilityServiceEnabled(
                                        this
                                    )

                        if (!hasAllPermissions) Screen.PermissionChecklist else Screen.Home
                    }
                }

                else -> Screen.Home
            }
        }
        currentScreenState.value = initialScreen

        enableEdgeToEdge()
        setupUnpairListener()
        setContent {
            KidsGuardTheme(darkTheme = true) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    KidsGuardApp(
                        currentScreen = currentScreenState.value,
                        onScreenChange = { screen ->
                            Log.d("KidsGuard", "Screen changing to: $screen")
                            currentScreenState.value = screen
                            prefHelper.isLocked = (screen == Screen.Locked)

                            if (prefHelper.userRole == "CHILD") {
                                childStatusManager.updateStatus()
                                setupUnpairListener()
                                // Restart tracking service to ensure it picks up new IDs and starts listener
                                trackingManager.startTracking()
                                Log.i(
                                    "PairingSync",
                                    "Background service started/restarted for child: ${prefHelper.childId}"
                                )
                            }

                            // Re-init SOS listener on screen change to catch role/pairing changes
                            sosRepository.refreshActiveAlertListener()

                            // Force portrait in Locked screen for real device realism
                            requestedOrientation = if (screen == Screen.Locked) {
                                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                            } else {
                                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                            }
                        },
                        repository = repository,
                        locationRepository = locationRepository,
                        sosRepository = sosRepository,
                        routeRepository = routeRepository,
                        knownRouteRepository = knownRouteRepository,
                        dailySummaryRepository = dailySummaryRepository,
                        reverseGeocoder = reverseGeocoder,
                        errorLogRepository = errorLogRepository,
                        trackingRepository = trackingRepository,
                        trackingManager = trackingManager,
                        syncProvider = syncProvider,
                        commandHandler = commandHandler,
                        updateRepository = updateRepository,
                        authRepository = authRepository,
                        protectionModeRepository = protectionModeRepository,
                        remoteCommandRepository = remoteCommandRepository,
                        wellbeingManager = wellbeingManager,
                        youtubeHistoryRepository = youtubeHistoryRepository,
                        browserHistoryRepository = browserHistoryRepository,
                        websitePolicyRepository = websitePolicyRepository,
                        onParentLoginSuccess = {
                            lifecycleScope.launch {
                                parentNotificationManager.registerParentDevice()
                            }
                        },
                        blockedPackage = blockedPackageName.value,
                        blockedReason = blockedReason.value,
                        blockedUrl = blockedUrl.value,
                        onRequestWebAccess = { url ->
                            webManager.requestAccess(url)
                        },
                        remoteMessage = remoteMessage.value,
                        remoteCommandMode = remoteCommandMode.value
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleIntent(it) }
    }

    private fun setupUnpairListener() {
        if (prefHelper.userRole == "CHILD") {
            val childId = prefHelper.childId
            // Only trigger unpair if we were actually paired
            val currentlyPaired = prefHelper.pairedChildId != null

            if (childId.isNotEmpty()) {
                Log.d(
                    "MainActivity",
                    "Setting up unpair listener for child: $childId (currentlyPaired=$currentlyPaired)"
                )
                unpairListener?.remove()
                unpairListener = com.google.firebase.firestore.FirebaseFirestore.getInstance()
                    .collection("children")
                    .document(childId)
                    .addSnapshotListener { snapshot, e ->
                        if (e != null) {
                            Log.w("MainActivity", "Unpair listener error", e)
                            return@addSnapshotListener
                        }
                        if (snapshot != null && snapshot.exists()) {
                            val cloudFamilyId = snapshot.getString("familyId")
                            // Trigger unpair ONLY if we were paired and now familyId is gone from cloud
                            if (cloudFamilyId == null && currentlyPaired) {
                                Log.i("MainActivity", "Unpair detected! Child removed from family.")
                                handleUnpair()
                            }
                        }
                    }
            }
        }
    }

    private fun handleUnpair() {
        unpairListener?.remove()
        unpairListener = null

        // Stop tracking and sync
        trackingManager.stopTracking()
        childStatusManager.stopPeriodicSync()

        // Clear local state
        prefHelper.clearPairing()

        // Return to Role Selection
        currentScreenState.value = Screen.RoleSelection

        // Show message
        android.widget.Toast.makeText(
            this,
            "This device was removed by the parent. Pair it again to continue.",
            android.widget.Toast.LENGTH_LONG
        ).show()
    }

    override fun onDestroy() {
        unpairListener?.remove()
        super.onDestroy()
    }

    private fun handleIntent(intent: android.content.Intent) {
        val action = intent.getStringExtra("action")
        if (action == "BLOCK_SCREEN") {
            val pkg = intent.getStringExtra("blocked_package")
            val reason = intent.getStringExtra("block_reason")
            blockedPackageName.value = pkg
            blockedReason.value = reason
            currentScreenState.value = Screen.AppBlocked
        } else if (action == "WEB_BLOCKED") {
            val url = intent.getStringExtra("blocked_url")
            blockedUrl.value = url
            currentScreenState.value = Screen.WebBlocked
        } else if (action == "REMOTE_COMMAND") {
            val cmdAction = intent.getStringExtra("command_action")
            val payload = intent.getStringExtra("payload")
            Log.i("MainActivity", "Handling remote command intent: $cmdAction")

            when (cmdAction) {
                "LOCK" -> currentScreenState.value = Screen.Locked
                "UNLOCK" -> currentScreenState.value = Screen.Home
                "SHOW_MESSAGE" -> {
                    remoteMessage.value = payload
                    remoteCommandMode.value =
                        com.example.kidsguard.ui.screens.RemoteCommandMode.MESSAGE
                    currentScreenState.value = Screen.RemoteCommand
                }

                "RING" -> {
                    notificationEngine.triggerSiren()
                    remoteCommandMode.value =
                        com.example.kidsguard.ui.screens.RemoteCommandMode.RINGING
                    currentScreenState.value = Screen.RemoteCommand
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (currentScreenState.value == Screen.Locked &&
            keyCode == KeyEvent.KEYCODE_VOLUME_UP &&
            prefHelper.isVolumeUnlockEnabled
        ) {
            val now = System.currentTimeMillis()
            if (volumeUpTapCount == 0 || now - firstVolumeUpTapTime > 5000) {
                volumeUpTapCount = 1
                firstVolumeUpTapTime = now
            } else {
                volumeUpTapCount++
                if (volumeUpTapCount >= 4) {
                    Log.i("KidsGuard", "Emergency Volume Unlock triggered")
                    repository.addEvent(
                        ActivityEvent(
                            type = "VOLUME_UNLOCK",
                            title = "Volume Unlock",
                            description = "Emergency exit triggered"
                        )
                    )
                    currentScreenState.value = Screen.Home
                    prefHelper.isLocked = false
                    volumeUpTapCount = 0
                }
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
