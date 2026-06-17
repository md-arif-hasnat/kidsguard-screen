package com.example.kidsguard.navigation

import androidx.compose.animation.Crossfade
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.update.UpdateRepository
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.ui.screens.*

@Composable
fun KidsGuardApp(
    currentScreen: Screen, 
    onScreenChange: (Screen) -> Unit, 
    repository: SafeZoneRepository,
    locationRepository: LocationRepository,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: com.example.kidsguard.repository.RouteRepository,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider,
    commandHandler: com.example.kidsguard.sync.RemoteCommandHandler,
    updateRepository: com.example.kidsguard.update.UpdateRepository
) {
    val context = LocalContext.current
    val prefHelper = remember { PreferenceHelper(context) }
    val locationProvider = remember { LocalLocationProvider(context) }
    
    var selectedRouteId by remember { mutableStateOf<String?>(null) }
    
    // Initial redirection based on role and pairing status
    val userRole = prefHelper.userRole
    val pairedId = prefHelper.pairedChildId
    val startScreen = remember(currentScreen, userRole, pairedId) {
        if (currentScreen == Screen.Home) {
            when (userRole) {
                "NONE" -> Screen.RoleSelection
                "PARENT" -> if (pairedId == null) Screen.ParentSetup else Screen.ParentDashboard
                "CHILD" -> if (pairedId == null) Screen.ChildSetup else Screen.Home
                else -> currentScreen
            }
        } else {
            currentScreen
        }
    }

    Crossfade(targetState = startScreen, label = "screenTransition") { screen ->
        when (screen) {
            Screen.RoleSelection -> RoleSelectionScreen(
                onRoleSelected = { role: String ->
                    prefHelper.userRole = role
                    val nextScreen = when(role) {
                        "PARENT" -> if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
                        "CHILD" -> if (prefHelper.pairedChildId == null) Screen.ChildSetup else Screen.Home
                        else -> Screen.RoleSelection
                    }
                    onScreenChange(nextScreen)
                },
                onOpenDeveloperMenu = { onScreenChange(Screen.DeveloperMenu) }
            )
            Screen.ChildSetup -> ChildSetupScreen(
                prefHelper = prefHelper,
                onSetupComplete = { onScreenChange(Screen.Home) },
                onBack = { 
                    prefHelper.userRole = "NONE"
                    onScreenChange(Screen.RoleSelection) 
                }
            )
            Screen.ParentSetup -> ParentSetupScreen(
                prefHelper = prefHelper,
                onSetupComplete = { onScreenChange(Screen.ParentDashboard) },
                onBack = { 
                    prefHelper.userRole = "NONE"
                    onScreenChange(Screen.RoleSelection) 
                }
            )
            Screen.Home -> HomeScreen(
                onActivate = { 
                    repository.addEvent(ActivityEvent(type = "KID_MODE_ENABLED", title = "Kid Mode Enabled", description = "Manual activation"))
                    onScreenChange(Screen.Locked) 
                },
                onOpenSettings = { onScreenChange(Screen.Settings) },
                onOpenDeveloperMenu = { onScreenChange(Screen.DeveloperMenu) },
                onOpenLocationHistory = { onScreenChange(Screen.LocationHistory) },
                onOpenTrackingStatus = { onScreenChange(Screen.TrackingStatus) },
                onOpenPermissionChecklist = { onScreenChange(Screen.PermissionChecklist) },
                prefHelper = prefHelper,
                repository = repository,
                sosRepository = sosRepository,
                locationRepository = locationRepository
            )
            Screen.TrackingStatus -> TrackingStatusScreen(
                onBack = { onScreenChange(Screen.Home) },
                trackingRepository = trackingRepository,
                trackingManager = trackingManager,
                locationRepository = locationRepository
            )
            Screen.PermissionChecklist -> PermissionChecklistScreen(
                onBack = { onScreenChange(Screen.Home) }
            )
            Screen.ParentDashboard -> ParentDashboardScreen(
                prefHelper = prefHelper,
                onOpenSettings = { onScreenChange(Screen.Settings) },
                onOpenSafeZones = { onScreenChange(Screen.SafeZoneList) },
                onOpenActivityFeed = { onScreenChange(Screen.ActivityFeed) },
                onOpenLocationHistory = { onScreenChange(Screen.LocationHistory) },
                onOpenLiveMap = { onScreenChange(Screen.LiveMap) },
                onOpenSosHistory = { onScreenChange(Screen.SosHistory) },
                onOpenRouteHistory = { onScreenChange(Screen.RouteHistory) },
                onBack = { onScreenChange(Screen.RoleSelection) },
                locationRepository = locationRepository,
                safeZoneRepository = repository,
                locationProvider = locationProvider,
                trackingRepository = trackingRepository,
                trackingManager = trackingManager,
                syncProvider = syncProvider,
                commandHandler = commandHandler,
                sosRepository = sosRepository,
                routeRepository = routeRepository,
                updateRepository = updateRepository
            )
            Screen.RouteHistory -> RouteHistoryScreen(
                repository = routeRepository,
                onRouteSelected = { id: String ->
                    selectedRouteId = id
                    onScreenChange(Screen.RouteReplay)
                },
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.RouteReplay -> {
                val route = selectedRouteId?.let { routeRepository.getRouteDetails(it) }
                if (route != null) {
                    RouteReplayScreen(
                        route = route,
                        onBack = { onScreenChange(Screen.RouteHistory) }
                    )
                } else {
                    onScreenChange(Screen.RouteHistory)
                }
            }
            Screen.SafeZoneList -> SafeZoneListScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.ActivityFeed -> ActivityFeedScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.LocationHistory -> LocationHistoryScreen(
                repository = locationRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) },
                locationProvider = locationProvider,
                safeZoneRepository = repository
            )
            Screen.LiveMap -> MapScreen(
                locationRepository = locationRepository,
                safeZoneRepository = repository,
                trackingRepository = trackingRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.SosHistory -> SosHistoryScreen(
                repository = sosRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.Locked -> LockedScreen(
                onUnlock = { 
                    repository.addEvent(ActivityEvent(type = "KID_MODE_DISABLED", title = "Kid Mode Disabled", description = "Unlocked by child"))
                    onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home) 
                },
                prefHelper = prefHelper,
                repository = repository
            )
            Screen.Settings -> SettingsScreen(
                onBack = { onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home) },
                prefHelper = prefHelper
            )
            Screen.DeveloperMenu -> DeveloperMenuScreen(
                onBack = { 
                    if (prefHelper.userRole == "NONE") {
                        onScreenChange(Screen.RoleSelection)
                    } else {
                        onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home)
                    }
                },
                prefHelper = prefHelper,
                repository = repository,
                locationRepository = locationRepository,
                onScreenChange = onScreenChange,
                trackingRepository = trackingRepository,
                trackingManager = trackingManager,
                syncProvider = syncProvider,
                commandHandler = commandHandler,
                sosRepository = sosRepository,
                routeRepository = routeRepository,
                locationProvider = locationProvider,
                updateRepository = updateRepository
            )
        }
    }
}
