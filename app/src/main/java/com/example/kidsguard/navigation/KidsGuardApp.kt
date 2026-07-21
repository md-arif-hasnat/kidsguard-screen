package com.example.kidsguard.navigation

import androidx.compose.animation.Crossfade
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.ui.screens.*
import com.example.kidsguard.routeintelligence.KnownRouteRepository
import com.example.kidsguard.repository.ErrorLogRepository
import kotlinx.coroutines.flow.MutableStateFlow

@Composable
fun KidsGuardApp(
    currentScreen: Screen, 
    onScreenChange: (Screen) -> Unit, 
    repository: SafeZoneRepository,
    locationRepository: LocationRepository,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: com.example.kidsguard.repository.RouteRepository,
    dailySummaryRepository: com.example.kidsguard.ai.DailySummaryRepository,
    knownRouteRepository: KnownRouteRepository,
    reverseGeocoder: com.example.kidsguard.geocoding.ReverseGeocoder,
    errorLogRepository: ErrorLogRepository,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider,
    commandHandler: com.example.kidsguard.sync.RemoteCommandHandler,
    updateRepository: com.example.kidsguard.update.UpdateRepository,
    authRepository: AuthRepository,
    protectionModeRepository: com.example.kidsguard.repository.ProtectionModeRepository,
    remoteCommandRepository: com.example.kidsguard.repository.RemoteCommandRepository,
    wellbeingManager: com.example.kidsguard.wellbeing.WellbeingManager,
    onParentLoginSuccess: () -> Unit = {},
    blockedPackage: String? = null,
    blockedReason: String? = null,
    blockedUrl: String? = null,
    onRequestWebAccess: (String) -> Unit = {},
    remoteMessage: String? = null,
    remoteCommandMode: com.example.kidsguard.ui.screens.RemoteCommandMode = com.example.kidsguard.ui.screens.RemoteCommandMode.MESSAGE
) {
    val context = LocalContext.current
    val prefHelper = remember { PreferenceHelper(context) }
    val locationProvider = remember { LocalLocationProvider(context) }
    
    var selectedRouteId by remember { mutableStateOf<String?>(null) }
    var selectedZone by remember { mutableStateOf<com.example.kidsguard.models.SafeZone?>(null) }
    val selectedChildIdFlow = remember { MutableStateFlow<String?>(prefHelper.selectedChildId) }
    val selectedChildId by selectedChildIdFlow.collectAsState()
    
    LaunchedEffect(selectedChildId) {
        prefHelper.selectedChildId = selectedChildId
    }
    
    // Initial redirection based on role and pairing status
    val userRole = prefHelper.userRole
    val pairedId = prefHelper.pairedChildId

    // Update Dialog State
    val updateState by updateRepository.updateState.collectAsState()
    var showUpdateDialog by remember { mutableStateOf(false) }
    
    LaunchedEffect(updateState.isUpdateAvailable) {
        if (updateState.isUpdateAvailable) {
            showUpdateDialog = true
        }
    }

    if (showUpdateDialog && updateState.updateInfo != null) {
        UpdateDialog(
            updateInfo = updateState.updateInfo!!,
            onUpdate = {
                updateRepository.openUpdateUrl(updateState.updateInfo!!.apkDownloadUrl)
                if (!(updateState.updateInfo!!.mandatoryUpdate || updateState.updateInfo!!.forceUpdate)) {
                    showUpdateDialog = false
                }
            },
            onDismiss = {
                showUpdateDialog = false
            }
        )
    }

    val showWhatsNew by updateRepository.showWhatsNew.collectAsState()
    if (showWhatsNew != null) {
        WhatsNewDialog(
            updateInfo = showWhatsNew!!,
            onDismiss = {
                updateRepository.dismissWhatsNew()
            }
        )
    }

    val startScreen = remember(currentScreen, userRole, pairedId) {
        if (currentScreen == Screen.Home) {
            when (userRole) {
                "NONE" -> Screen.RoleSelection
                "PARENT" -> {
                    val currentUser = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
                    if (currentUser == null) {
                        Screen.ParentLogin
                    } else if (pairedId == null) {
                        Screen.ParentSetup
                    } else {
                        Screen.ParentDashboard
                    }
                }
                "CHILD" -> {
                    if (pairedId == null) {
                        Screen.ChildSetup
                    } else {
                        val hasAllPermissions = com.example.kidsguard.utils.PermissionUtils.hasLocationPermission(context) &&
                            com.example.kidsguard.utils.PermissionUtils.hasBackgroundLocationPermission(context) &&
                            com.example.kidsguard.utils.PermissionUtils.hasNotificationPermission(context) &&
                            com.example.kidsguard.utils.PermissionUtils.isBatteryOptimizationIgnored(context) &&
                            com.example.kidsguard.utils.PermissionUtils.isAccessibilityServiceEnabled(context)
                        
                        if (!hasAllPermissions) {
                            Screen.PermissionChecklist
                        } else {
                            Screen.Home
                        }
                    }
                }
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
                    if (role == "CHILD" && prefHelper.pairedChildId == null) {
                        // Reset identity for fresh pairing if not already paired
                        prefHelper.removedByParent = false
                        prefHelper.childId = java.util.UUID.randomUUID().toString()
                        android.util.Log.i("KidsGuardApp", "Generated fresh childId for new setup: ${prefHelper.childId}")
                    }

                    prefHelper.userRole = role
                    val nextScreen = when(role) {
                        "PARENT" -> {
                            val currentUser = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
                            if (currentUser == null) Screen.ParentLogin else if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
                        }
                        "CHILD" -> if (prefHelper.pairedChildId == null) Screen.ChildSetup else Screen.Home
                        else -> Screen.RoleSelection
                    }
                    onScreenChange(nextScreen)
                },
                onOpenDeveloperMenu = { onScreenChange(Screen.DeveloperMenu) }
            )
            Screen.ParentLogin -> ParentLoginScreen(
                authRepository = authRepository,
                onLoginSuccess = {
                    onParentLoginSuccess()
                    val next = if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
                    onScreenChange(next)
                },
                onBack = { 
                    prefHelper.userRole = "NONE"
                    onScreenChange(Screen.RoleSelection)
                }
            )
            Screen.ChildSetup -> ChildSetupScreen(
                prefHelper = prefHelper,
                authRepository = authRepository,
                repository = repository,
                syncProvider = syncProvider,
                onSetupComplete = {
                    val hasAllPermissions = com.example.kidsguard.utils.PermissionUtils.hasLocationPermission(context) &&
                        com.example.kidsguard.utils.PermissionUtils.hasBackgroundLocationPermission(context) &&
                        com.example.kidsguard.utils.PermissionUtils.hasNotificationPermission(context) &&
                        com.example.kidsguard.utils.PermissionUtils.isBatteryOptimizationIgnored(context) &&
                        com.example.kidsguard.utils.PermissionUtils.isAccessibilityServiceEnabled(context)
                    
                    if (hasAllPermissions) {
                        android.util.Log.i("KidsGuardApp", "All permissions granted, navigating to Home")
                        onScreenChange(Screen.Home)
                    } else {
                        android.util.Log.i("KidsGuardApp", "Missing permissions, navigating to PermissionChecklist")
                        onScreenChange(Screen.PermissionChecklist)
                    }
                },
                onBack = { 
                    prefHelper.userRole = "NONE"
                    onScreenChange(Screen.RoleSelection) 
                }
            )
            Screen.ParentSetup -> ParentSetupScreen(
                prefHelper = prefHelper,
                authRepository = authRepository,
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
                authRepository = authRepository,
                onOpenSettings = { onScreenChange(Screen.Settings) },
                onOpenSafeZones = { onScreenChange(Screen.SafeZoneList) },
                onOpenActivityFeed = { onScreenChange(Screen.ActivityFeed) },
                onOpenLocationHistory = { onScreenChange(Screen.LocationHistory) },
                onOpenLiveMap = { onScreenChange(Screen.LiveMap) },
                onOpenSosHistory = { onScreenChange(Screen.SosHistory) },
                onOpenRouteHistory = { onScreenChange(Screen.RouteHistory) },
                onOpenDailySummary = { onScreenChange(Screen.DailySummary) },
                onOpenKnownRoutes = { onScreenChange(Screen.KnownRoutes) },
                onOpenRouteDeviations = { onScreenChange(Screen.RouteDeviations) },
                onOpenChildList = { onScreenChange(Screen.ChildList) },
                onOpenChildDetail = { id -> 
                    selectedChildIdFlow.value = id
                    onScreenChange(Screen.ChildDetail)
                },
                onOpenNotifications = { onScreenChange(Screen.Notifications) },
                onBack = { onScreenChange(Screen.RoleSelection) },
                locationRepository = locationRepository,
                safeZoneRepository = repository,
                locationProvider = locationProvider,
                trackingRepository = trackingRepository,
                trackingManager = trackingManager,
                syncProvider = syncProvider,
                commandHandler = commandHandler,
                remoteCommandRepository = remoteCommandRepository,
                sosRepository = sosRepository,
                routeRepository = routeRepository,
                updateRepository = updateRepository,
                dailySummaryRepository = dailySummaryRepository,
                knownRouteRepository = knownRouteRepository,
                selectedChildIdFlow = selectedChildIdFlow
            )
            Screen.ChildDetail -> {
                selectedChildId?.let { id ->
                    ChildDetailScreen(
                        childId = id,
                        syncProvider = syncProvider,
                        remoteCommandRepository = remoteCommandRepository,
                        onBack = { onScreenChange(Screen.ParentDashboard) },
                        onOpenProtectionModes = { onScreenChange(Screen.ProtectionModes) },
                        onOpenLocationHistory = { onScreenChange(Screen.LocationHistory) },
                        onOpenInternetProtection = { onScreenChange(Screen.InternetProtection) }
                    )
                } ?: onScreenChange(Screen.ParentDashboard)
            }
            Screen.InternetProtection -> {
                selectedChildId?.let { id ->
                    InternetProtectionScreen(
                        childId = id,
                        syncProvider = syncProvider,
                        onBack = { onScreenChange(Screen.ChildDetail) }
                    )
                } ?: onScreenChange(Screen.ParentDashboard)
            }
            Screen.ProtectionModes -> {
                selectedChildId?.let { id ->
                    ProtectionModesScreen(
                        childId = id,
                        repository = protectionModeRepository,
                        onBack = { onScreenChange(Screen.ChildDetail) }
                    )
                } ?: onScreenChange(Screen.ParentDashboard)
            }
            Screen.Notifications -> {
                selectedChildId?.let { id ->
                    NotificationsScreen(
                        childId = id,
                        syncProvider = syncProvider,
                        onBack = { onScreenChange(Screen.ParentDashboard) }
                    )
                } ?: onScreenChange(Screen.ParentDashboard)
            }
            Screen.SecurityAudit -> {
                onScreenChange(Screen.ParentDashboard)
            }
            Screen.DailySummary -> DailySummaryScreen(
                repository = dailySummaryRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) },
                prefHelper = prefHelper,
                syncProvider = syncProvider
            )
            Screen.KnownRoutes -> KnownRoutesScreen(
                repository = knownRouteRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.RouteDeviations -> RouteDeviationsScreen(
                repository = knownRouteRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.RouteHistory -> RouteHistoryScreen(
                repository = routeRepository,
                onRouteSelected = { id: String ->
                    selectedRouteId = id
                    onScreenChange(Screen.RouteReplay)
                },
                onBack = { onScreenChange(Screen.ParentDashboard) },
                prefHelper = prefHelper,
                syncProvider = syncProvider
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
                onBack = { onScreenChange(Screen.ParentDashboard) },
                onAddZone = { 
                    selectedZone = null
                    onScreenChange(Screen.SafeZoneEditor)
                },
                onEditZone = { zone ->
                    selectedZone = zone
                    onScreenChange(Screen.SafeZoneEditor)
                }
            )
            Screen.SafeZoneEditor -> {
                SafeZoneEditorScreen(
                    zone = selectedZone,
                    repository = repository,
                    onBack = { onScreenChange(Screen.SafeZoneList) }
                )
            }
            Screen.ActivityFeed -> ActivityFeedScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) },
                prefHelper = prefHelper,
                syncProvider = syncProvider
            )
            Screen.LocationHistory -> LocationHistoryScreen(
                repository = locationRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) },
                locationProvider = locationProvider,
                safeZoneRepository = repository,
                prefHelper = prefHelper,
                syncProvider = syncProvider
            )
            Screen.LiveMap -> MapScreen(
                locationRepository = locationRepository,
                safeZoneRepository = repository,
                trackingRepository = trackingRepository,
                knownRouteRepository = knownRouteRepository,
                syncProvider = syncProvider,
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
            Screen.Settings -> {
                if (prefHelper.userRole == "PARENT") {
                    ParentSettingsScreen(
                        onBack = { onScreenChange(Screen.ParentDashboard) },
                        prefHelper = prefHelper,
                        authRepository = authRepository,
                        onLogout = {
                            com.google.firebase.auth.FirebaseAuth.getInstance().signOut()
                            prefHelper.userRole = "NONE"
                            onScreenChange(Screen.RoleSelection)
                        }
                    )
                } else {
                    SettingsScreen(
                        onBack = { onScreenChange(Screen.Home) },
                        prefHelper = prefHelper
                    )
                }
            }
            Screen.DeveloperMenu -> {
                if (com.example.kidsguard.BuildConfig.DEBUG) {
                    DeveloperMenuScreen(
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
                        updateRepository = updateRepository,
                        dailySummaryRepository = dailySummaryRepository,
                        knownRouteRepository = knownRouteRepository,
                        reverseGeocoder = reverseGeocoder,
                        errorLogRepository = errorLogRepository,
                        authRepository = authRepository
                    )
                } else {
                    onScreenChange(Screen.Home)
                }
            }
            Screen.Diagnostics -> DiagnosticsScreen(
                onBack = { onScreenChange(Screen.DeveloperMenu) }
            )
            Screen.ReleaseChecklist -> ReleaseChecklistScreen(
                onBack = { onScreenChange(Screen.DeveloperMenu) }
            )
            Screen.ErrorLogs -> ErrorLogScreen(
                repository = errorLogRepository,
                onBack = { onScreenChange(Screen.DeveloperMenu) }
            )
            Screen.ChildList -> ChildListScreen(
                onBack = { onScreenChange(Screen.ParentDashboard) },
                onAddChild = { onScreenChange(Screen.ParentSetup) },
                prefHelper = prefHelper,
                syncProvider = syncProvider,
                onSelectChild = { id ->
                    selectedChildIdFlow.value = id
                    onScreenChange(Screen.ParentDashboard)
                }
            )
            Screen.AppBlocked -> AppBlockedScreen(
                packageName = blockedPackage,
                reason = blockedReason,
                onBackToHome = { onScreenChange(Screen.Home) },
                onRequestAccess = { pkg, reason ->
                    wellbeingManager.requestAccess(pkg, reason)
                    android.widget.Toast.makeText(context, "Access request sent to parent.", android.widget.Toast.LENGTH_SHORT).show()
                }
            )
            Screen.WebBlocked -> WebBlockedScreen(
                url = blockedUrl,
                onRequestAccess = { blockedUrl?.let { onRequestWebAccess(it) } },
                onBackToHome = { onScreenChange(Screen.Home) }
            )
            Screen.RemoteCommand -> RemoteCommandScreen(
                mode = remoteCommandMode,
                message = remoteMessage,
                onDismiss = { onScreenChange(Screen.Home) }
            )
        }
    }
}
