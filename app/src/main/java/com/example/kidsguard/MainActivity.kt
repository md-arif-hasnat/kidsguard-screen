package com.example.kidsguard

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.navigation.KidsGuardApp
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.RouteRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.repository.SosRepository
import com.example.kidsguard.routeintelligence.KnownRouteRepository
import com.example.kidsguard.ai.DailySummaryRepository
import com.example.kidsguard.ai.LocalRuleBasedSummaryProvider
import com.example.kidsguard.sync.ChildStatusManager
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider
import com.example.kidsguard.sync.LocalMockSyncProvider
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.LocalTrackingScheduler
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.update.UpdateRepository
import com.example.kidsguard.ui.theme.KidsGuardTheme
import kotlinx.coroutines.launch

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
    private lateinit var childStatusManager: ChildStatusManager
    private var currentScreenState = mutableStateOf(Screen.Home)
    private var volumeUpTapCount = 0
    private var firstVolumeUpTapTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefHelper = PreferenceHelper(this)
        repository = SafeZoneRepository()
        knownRouteRepository = KnownRouteRepository(this)
        errorLogRepository = com.example.kidsguard.repository.ErrorLogRepository(this)
        reverseGeocoder = com.example.kidsguard.geocoding.ReverseGeocoder(this, errorLogRepository)
        trackingRepository = TrackingRepository(this)
        updateRepository = UpdateRepository(this)
        trackingManager = BackgroundTrackingManager(LocalTrackingScheduler(this), trackingRepository)
        authRepository = AuthRepository(this)

        syncProvider = if (FirebaseConfig.shouldUseFirebase(this)) {
            FirebaseRemoteSyncProvider(this)
        } else {
            LocalMockSyncProvider()
        }

        locationRepository = LocationRepository(this, repository, knownRouteRepository, reverseGeocoder, errorLogRepository, syncProvider)
        sosRepository = SosRepository(this)
        routeRepository = RouteRepository(locationRepository)
        dailySummaryRepository = DailySummaryRepository(this, locationRepository, repository, routeRepository, sosRepository, LocalRuleBasedSummaryProvider(), errorLogRepository)

        childStatusManager = ChildStatusManager(this, prefHelper, syncProvider, trackingRepository, repository, locationRepository)

        if (prefHelper.userRole == "CHILD" && prefHelper.pairingCode.isNotEmpty()) {
            repository.setSyncProvider(syncProvider, prefHelper.pairingCode)
        }

        commandHandler = RemoteCommandHandler(
            context = this,
            prefHelper = prefHelper,
            trackingManager = trackingManager,
            syncProvider = syncProvider,
            onLockRequested = {
                currentScreenState.value = Screen.Locked
            },
            onUnlockRequested = {
                currentScreenState.value = Screen.Home
            },
            onRefreshLocationRequested = {
                repository.addEvent(ActivityEvent(
                    type = "REMOTE_REFRESH",
                    title = "Remote Refresh Requested",
                    description = "Parent requested location update"
                ))
            }
        )
        
        trackingManager.initialize()
        syncProvider.connect()
        
        if (prefHelper.userRole == "CHILD") {
            childStatusManager.startPeriodicSync()
            lifecycleScope.launch {
                trackingManager.isTrackingEnabled.collect {
                    childStatusManager.updateStatus()
                }
            }
        }

        // Initialize Firebase Auth and Register Device
        if (FirebaseConfig.isFirebaseConfigured(this)) {
            lifecycleScope.launchWhenStarted {
                val success = authRepository.signInAnonymously()
                if (success) {
                    authRepository.registerDevice()
                }
            }
        }
        
        // Setup command listener - ensuring it's always active regardless of pairing code for local simulation
        syncProvider.listenForRemoteCommands("") { command ->
            Log.d("MainActivity", "Remote command received: ${command.commandType}")
            commandHandler.handleCommand(command)
        }
        
        // Determine initial screen based on role and pairing status
        val initialScreen = when {
            prefHelper.isLocked -> Screen.Locked
            prefHelper.userRole == "NONE" -> Screen.RoleSelection
            prefHelper.userRole == "PARENT" -> if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
            prefHelper.userRole == "CHILD" -> if (prefHelper.pairedChildId == null) Screen.ChildSetup else Screen.Home
            else -> Screen.Home
        }
        currentScreenState.value = initialScreen

        enableEdgeToEdge()
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
                            }

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
                        authRepository = authRepository
                    )
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (currentScreenState.value == Screen.Locked && 
            keyCode == KeyEvent.KEYCODE_VOLUME_UP && 
            prefHelper.isVolumeUnlockEnabled) {
            val now = System.currentTimeMillis()
            if (volumeUpTapCount == 0 || now - firstVolumeUpTapTime > 5000) {
                volumeUpTapCount = 1
                firstVolumeUpTapTime = now
            } else {
                volumeUpTapCount++
                if (volumeUpTapCount >= 4) {
                    Log.i("KidsGuard", "Emergency Volume Unlock triggered")
                    repository.addEvent(ActivityEvent(type = "VOLUME_UNLOCK", title = "Volume Unlock", description = "Emergency exit triggered"))
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
