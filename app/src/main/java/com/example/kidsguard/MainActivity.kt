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
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.navigation.KidsGuardApp
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.LocalMockSyncProvider
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.LocalTrackingScheduler
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.ui.theme.KidsGuardTheme

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {
    private lateinit var prefHelper: PreferenceHelper
    private lateinit var repository: SafeZoneRepository
    private lateinit var locationRepository: LocationRepository
    private lateinit var trackingRepository: TrackingRepository
    private lateinit var trackingManager: BackgroundTrackingManager
    private lateinit var syncProvider: LocalMockSyncProvider
    private lateinit var commandHandler: RemoteCommandHandler
    private var currentScreenState = mutableStateOf(Screen.Home)
    private var volumeUpTapCount = 0
    private var firstVolumeUpTapTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefHelper = PreferenceHelper(this)
        repository = SafeZoneRepository()
        locationRepository = LocationRepository(this, repository)
        trackingRepository = TrackingRepository(this)
        trackingManager = BackgroundTrackingManager(LocalTrackingScheduler(this), trackingRepository)
        syncProvider = LocalMockSyncProvider()
        commandHandler = RemoteCommandHandler(prefHelper, trackingManager, syncProvider)
        
        trackingManager.initialize()
        syncProvider.connect()
        
        // Setup command listener
        prefHelper.pairingCode.let { code ->
            if (code.isNotEmpty()) {
                syncProvider.listenForRemoteCommands(code) { command ->
                    commandHandler.handleCommand(command)
                }
            }
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
                            
                            // Force portrait in Locked screen for real device realism
                            requestedOrientation = if (screen == Screen.Locked) {
                                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                            } else {
                                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                            }
                        },
                        repository = repository,
                        locationRepository = locationRepository,
                        trackingRepository = trackingRepository,
                        trackingManager = trackingManager,
                        syncProvider = syncProvider
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
