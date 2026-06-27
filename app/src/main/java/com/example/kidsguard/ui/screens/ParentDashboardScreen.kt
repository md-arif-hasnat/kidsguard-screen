package com.example.kidsguard.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.CommandType
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncRemoteCommand
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.ui.dashboard.DashboardRepository
import com.example.kidsguard.ui.dashboard.DashboardState
import com.example.kidsguard.ui.dashboard.DashboardUiModel
import com.example.kidsguard.utils.RoleHelper
import com.example.kidsguard.utils.FamilyRole
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentDashboardScreen(
    prefHelper: PreferenceHelper, 
    authRepository: AuthRepository,
    onOpenSettings: () -> Unit,
    onOpenSafeZones: () -> Unit,
    onOpenActivityFeed: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onOpenLiveMap: () -> Unit,
    onOpenSosHistory: () -> Unit,
    onOpenRouteHistory: () -> Unit,
    onOpenDailySummary: () -> Unit,
    onOpenKnownRoutes: () -> Unit,
    onOpenRouteDeviations: () -> Unit,
    onOpenChildList: () -> Unit,
    onOpenChildDetail: (String) -> Unit,
    onOpenNotifications: () -> Unit,
    onBack: () -> Unit,
    locationRepository: LocationRepository,
    safeZoneRepository: SafeZoneRepository,
    locationProvider: LocalLocationProvider,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider,
    commandHandler: RemoteCommandHandler,
    remoteCommandRepository: com.example.kidsguard.repository.RemoteCommandRepository,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: com.example.kidsguard.repository.RouteRepository,
    updateRepository: com.example.kidsguard.update.UpdateRepository,
    dailySummaryRepository: com.example.kidsguard.ai.DailySummaryRepository,
    knownRouteRepository: com.example.kidsguard.routeintelligence.KnownRouteRepository,
    selectedChildIdFlow: MutableStateFlow<String?>
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val summary by dailySummaryRepository.latestSummary.collectAsState()
    val deviations by knownRouteRepository.deviationEvents.collectAsState()
    val activeDeviations = deviations.filter { !it.resolved }

    val activeSos by sosRepository.activeSos.collectAsState()
    val selectedChildId by selectedChildIdFlow.collectAsState()
    
    val dashboardRepository = remember {
        DashboardRepository(
            context, prefHelper, safeZoneRepository, locationRepository, 
            trackingRepository, syncProvider, commandHandler, routeRepository,
            selectedChildIdFlow
        )
    }
    
    val dashboardState by dashboardRepository.dashboardState.collectAsState(DashboardState.Loading)
    
    // RBAC Resolution (Simplified for MVP, would normally load profile/family docs)
    // We assume current user is OWNER if they paired the device.
    val currentRole = FamilyRole.OWNER 

    var isRefreshing by remember { mutableStateOf(false) }
    var showExitDialog by remember { mutableStateOf(false) }

    fun refreshDashboard() {
        scope.launch {
            isRefreshing = true
            delay(1000)
            isRefreshing = false
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("KidsGuard Parent", style = MaterialTheme.typography.titleMedium)
                        Text(currentRole.name + " ACCOUNT", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { showExitDialog = true }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Change Role")
                    }
                },
                actions = {
                    IconButton(onClick = onOpenChildList) {
                        Icon(Icons.Default.Group, contentDescription = "Children")
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = true,
                    onClick = { /* Already Home */ },
                    icon = { Icon(Icons.Default.Dashboard, null) },
                    label = { Text("Overview") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onOpenLiveMap,
                    icon = { Icon(Icons.Default.Map, null) },
                    label = { Text("Map") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onOpenNotifications,
                    icon = { Icon(Icons.Default.Notifications, null) },
                    label = { Text("Alerts") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (val state = dashboardState) {
                is DashboardState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is DashboardState.Success -> {
                    DashboardContent(
                        data = state.data,
                        summary = summary,
                        prefHelper = prefHelper,
                        onViewSummary = { onOpenDailySummary() },
                        activeDeviations = activeDeviations,
                        onOpenKnownRoutes = onOpenKnownRoutes,
                        onOpenRouteDeviations = onOpenRouteDeviations,
                        activeSos = activeSos,
                        onResolveSos = { sosRepository.resolveSos(it) },
                        onViewSosHistory = onOpenSosHistory,
                        onOpenLiveMap = onOpenLiveMap,
                        onOpenActivityFeed = onOpenActivityFeed,
                        onOpenSafeZones = onOpenSafeZones,
                        onOpenLocationHistory = onOpenLocationHistory,
                        onOpenRouteHistory = onOpenRouteHistory,
                        onOpenChildDetail = { onOpenChildDetail(selectedChildId ?: "") },
                        onLock = {
                            selectedChildId?.let { id ->
                                syncProvider.sendCommand(SyncRemoteCommand(childId = id, commandType = CommandType.LOCK_NOW))
                            }
                        },
                        onUnlock = {
                            selectedChildId?.let { id ->
                                syncProvider.sendCommand(SyncRemoteCommand(childId = id, commandType = CommandType.UNLOCK_NOW))
                            }
                        },
                        onRefreshLocation = {
                            selectedChildId?.let { id ->
                                syncProvider.sendCommand(SyncRemoteCommand(childId = id, commandType = CommandType.REFRESH_LOCATION))
                            }
                        },
                        onOpenChildList = onOpenChildList,
                        syncProvider = syncProvider,
                        selectedChildId = selectedChildId,
                        role = currentRole
                    )
                }
                is DashboardState.Error -> {
                    Column(modifier = Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.message, color = Color.Red)
                        Button(onClick = onOpenChildList, modifier = Modifier.padding(top = 16.dp)) {
                            Text("Select Child")
                        }
                    }
                }
            }
        }

        if (showExitDialog) {
            AlertDialog(
                onDismissRequest = { showExitDialog = false },
                title = { Text("Change Role") },
                text = { Text("Are you sure you want to go back to role selection? This will logout of the parent dashboard.") },
                confirmButton = {
                    Button(onClick = {
                        showExitDialog = false
                        prefHelper.userRole = "NONE"
                        onBack()
                    }) {
                        Text("Confirm")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showExitDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun DashboardContent(
    data: DashboardUiModel,
    summary: com.example.kidsguard.ai.DailySummary?,
    prefHelper: PreferenceHelper,
    onViewSummary: () -> Unit,
    activeDeviations: List<com.example.kidsguard.routeintelligence.RouteDeviationEvent>,
    onOpenKnownRoutes: () -> Unit,
    onOpenRouteDeviations: () -> Unit,
    activeSos: com.example.kidsguard.models.SosEvent?,
    onResolveSos: (String) -> Unit,
    onViewSosHistory: () -> Unit,
    onOpenLiveMap: () -> Unit,
    onOpenActivityFeed: () -> Unit,
    onOpenSafeZones: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onOpenRouteHistory: () -> Unit,
    onOpenChildDetail: () -> Unit,
    onLock: () -> Unit,
    onUnlock: () -> Unit,
    onRefreshLocation: () -> Unit,
    onOpenChildList: () -> Unit,
    syncProvider: RemoteSyncProvider,
    selectedChildId: String?,
    role: FamilyRole
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ChildSelectorCard(onOpenChildList, syncProvider, prefHelper, selectedChildId)

        if (activeSos != null) {
            SosAlertCard(activeSos, onResolveSos, onViewSosHistory)
        }

        AiSummaryCard(summary, onViewSummary)

        // Main Child Status Card (Clickable to detail)
        Card(
            modifier = Modifier.fillMaxWidth().clickable { onOpenChildDetail() }
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(data.childName.ifEmpty { "Unnamed Child" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    OnlineStatusBadge(data.isOnline)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    StatusInfoItem(Icons.Default.BatteryChargingFull, "${data.batteryPercent}%", "Battery")
                    StatusInfoItem(Icons.Default.LocationOn, data.currentZone, "Location")
                    StatusInfoItem(if (data.kidGuardStatus == "LOCKED") Icons.Default.Lock else Icons.Default.LockOpen, data.kidGuardStatus, "Security")
                }
                Spacer(modifier = Modifier.height(12.dp))
                TextButton(onClick = onOpenChildDetail, modifier = Modifier.align(Alignment.End)) {
                    Text("View Full Profile")
                    Icon(Icons.Default.ChevronRight, null)
                }
            }
        }

        Text("Quick Actions", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        
        QuickActionsGrid(
            onLock = onLock,
            onUnlock = onUnlock,
            onRefreshLocation = onRefreshLocation,
            onOpenMap = onOpenLiveMap,
            onOpenActivity = onOpenActivityFeed,
            onOpenSafeZones = onOpenSafeZones,
            canControl = RoleHelper.canSendRemoteCommands(role)
        )

        RouteIntelligenceCard(
            activeDeviations = activeDeviations,
            onManageRoutes = onOpenKnownRoutes,
            onViewDeviations = onOpenRouteDeviations
        )

        SafeZoneSummaryCard(data)
        
        ActivitySummaryCard(data, onOpenActivityFeed)
        
        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
fun ChildSelectorCard(
    onOpenChildList: () -> Unit,
    syncProvider: RemoteSyncProvider,
    prefHelper: PreferenceHelper,
    selectedChildId: String?
) {
    val status by (selectedChildId?.let { syncProvider.getChildStatus(it) } ?: kotlinx.coroutines.flow.flowOf(null)).collectAsState(initial = null)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onOpenChildList() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.ChildCare, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = status?.childName ?: "Select a Child",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (selectedChildId != null) {
                    Text(
                        text = if (status?.online == true) "Online" else "Offline",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (status?.online == true) Color.Green else Color.Gray
                    )
                }
            }
            Icon(Icons.Default.ExpandMore, contentDescription = "Switch Child")
        }
    }
}

@Composable
fun QuickActionsGrid(
    onLock: () -> Unit,
    onUnlock: () -> Unit,
    onRefreshLocation: () -> Unit,
    onOpenMap: () -> Unit,
    onOpenActivity: () -> Unit,
    onOpenSafeZones: () -> Unit,
    canControl: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickActionButton(Icons.Default.Lock, "Lock", Color.Red, onLock, Modifier.weight(1f), enabled = canControl)
            QuickActionButton(Icons.Default.LockOpen, "Unlock", Color.Green, onUnlock, Modifier.weight(1f), enabled = canControl)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickActionButton(Icons.Default.MyLocation, "Locate", MaterialTheme.colorScheme.primary, onRefreshLocation, Modifier.weight(1f), enabled = canControl)
            QuickActionButton(Icons.Default.Map, "Map", MaterialTheme.colorScheme.secondary, onOpenMap, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickActionButton(Icons.Default.History, "Activity", MaterialTheme.colorScheme.tertiary, onOpenActivity, Modifier.weight(1f))
            QuickActionButton(Icons.Default.LocationOn, "Zones", MaterialTheme.colorScheme.secondary, onOpenSafeZones, Modifier.weight(1f))
        }
    }
}

@Composable
fun QuickActionButton(icon: ImageVector, label: String, color: Color, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        enabled = enabled,
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.filledTonalButtonColors(containerColor = color.copy(alpha = 0.1f), contentColor = color)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(label, style = MaterialTheme.typography.labelLarge)
    }
}

// ... existing helper components (StatusInfoItem, OnlineStatusBadge, SosAlertCard etc) ...
@Composable
fun ActivitySummaryItem(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text("$label: ", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
        Text(value, style = MaterialTheme.typography.bodySmall, maxLines = 1)
    }
}

@Composable
fun StatusInfoItem(icon: ImageVector, value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun OnlineStatusBadge(isOnline: Boolean) {
    Surface(
        color = if (isOnline) Color.Green.copy(alpha = 0.2f) else Color.Gray.copy(alpha = 0.2f),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(8.dp).background(if (isOnline) Color.Green else Color.Gray, shape = CircleShape))
            Spacer(modifier = Modifier.width(6.dp))
            Text(if (isOnline) "ONLINE" else "OFFLINE", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = if (isOnline) Color.Green else Color.Gray)
        }
    }
}

@Composable
fun SosAlertCard(
    event: com.example.kidsguard.models.SosEvent,
    onResolve: (String) -> Unit,
    onViewHistory: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Spacer(modifier = Modifier.width(12.dp))
                Text("ACTIVE SOS ALERT", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text("A child has triggered an emergency alert.", style = MaterialTheme.typography.bodyMedium)
            
            if (event.latitude != null) {
                Text("Location: ${"%.5f".format(event.latitude)}, ${"%.5f".format(event.longitude)}", style = MaterialTheme.typography.bodySmall)
            }
            Text("Battery: ${event.batteryPercent ?: "Unknown"}%", style = MaterialTheme.typography.bodySmall)
            
            Spacer(modifier = Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { onResolve(event.id) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Resolve SOS")
                }
                OutlinedButton(
                    onClick = onViewHistory,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("SOS History")
                }
            }
        }
    }
}

@Composable
fun RouteIntelligenceCard(
    activeDeviations: List<com.example.kidsguard.routeintelligence.RouteDeviationEvent>,
    onManageRoutes: () -> Unit,
    onViewDeviations: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Timeline, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Route Intelligence", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(12.dp))
            
            if (activeDeviations.isNotEmpty()) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("${activeDeviations.size} Route Deviations!", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                            Text("Last: ${activeDeviations.first().message}", style = MaterialTheme.typography.bodySmall, maxLines = 1)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            } else {
                Text("No active route deviations detected.", style = MaterialTheme.typography.bodySmall)
                Spacer(modifier = Modifier.height(12.dp))
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onViewDeviations, modifier = Modifier.weight(1f)) {
                    Text("Deviations", style = MaterialTheme.typography.labelSmall)
                }
                OutlinedButton(onClick = onManageRoutes, modifier = Modifier.weight(1f)) {
                    Text("Manage Routes", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
fun AiSummaryCard(
    summary: com.example.kidsguard.ai.DailySummary?,
    onViewSummary: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onViewSummary() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Today Summary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            if (summary != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${summary.safetyScore}",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = summary.summaryText,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                        modifier = Modifier.weight(1f)
                    )
                }
            } else {
                Text("No summary generated for today yet.", style = MaterialTheme.typography.bodySmall)
            }
            TextButton(onClick = onViewSummary, modifier = Modifier.align(Alignment.End)) {
                Text("View Details")
                Icon(Icons.Default.ChevronRight, contentDescription = null)
            }
        }
    }
}

@Composable
fun SafeZoneSummaryCard(data: DashboardUiModel) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Safe Zone Status", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))
            
            Text("Current: ${data.currentZone}", style = MaterialTheme.typography.bodyLarge, color = if (data.currentZone != "Outside Zones") Color.Green else MaterialTheme.colorScheme.primary)
            Text("Nearest: ${data.nearestZone} (${data.distanceToNearest})", style = MaterialTheme.typography.bodySmall)
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Last Enter", style = MaterialTheme.typography.labelSmall)
                    Text(data.lastEnterEvent, style = MaterialTheme.typography.bodyMedium)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Last Exit", style = MaterialTheme.typography.labelSmall)
                    Text(data.lastExitEvent, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
fun ActivitySummaryCard(data: DashboardUiModel, onOpenFeed: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Activity Today", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Badge { Text("${data.totalEventsToday}") }
            }
            Spacer(modifier = Modifier.height(12.dp))
            
            ActivitySummaryItem("Latest", data.lastActivityTitle)
            ActivitySummaryItem("Notification", data.lastNotificationTitle)
            ActivitySummaryItem("Remote Command", data.lastCommandTitle)
            
            Spacer(modifier = Modifier.height(12.dp))
            TextButton(onClick = onOpenFeed, modifier = Modifier.fillMaxWidth()) {
                Text("View Full Activity Feed")
                Icon(Icons.Default.ChevronRight, contentDescription = null)
            }
        }
    }
}
