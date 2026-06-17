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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentDashboardScreen(
    prefHelper: PreferenceHelper, 
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
    onBack: () -> Unit,
    locationRepository: LocationRepository,
    safeZoneRepository: SafeZoneRepository,
    locationProvider: LocalLocationProvider,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider,
    commandHandler: RemoteCommandHandler,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: com.example.kidsguard.repository.RouteRepository,
    updateRepository: com.example.kidsguard.update.UpdateRepository,
    dailySummaryRepository: com.example.kidsguard.ai.DailySummaryRepository,
    knownRouteRepository: com.example.kidsguard.routeintelligence.KnownRouteRepository
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    val summary by dailySummaryRepository.latestSummary.collectAsState()
    val deviations by knownRouteRepository.deviationEvents.collectAsState()
    val activeDeviations = deviations.filter { !it.resolved }

    val activeSos by sosRepository.activeSos.collectAsState()
    
    val dashboardRepository = remember {
        DashboardRepository(context, prefHelper, safeZoneRepository, locationRepository, trackingRepository, syncProvider, commandHandler, routeRepository)
    }
    
    val dashboardState by dashboardRepository.dashboardState.collectAsState(DashboardState.Loading)
    
    var isRefreshing by remember { mutableStateOf(false) }
    var showExitDialog by remember { mutableStateOf(false) }

    fun refreshDashboard() {
        scope.launch {
            isRefreshing = true
            // In a real app, this would trigger repository refreshes
            delay(1000)
            isRefreshing = false
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Parent Dashboard") },
                navigationIcon = {
                    IconButton(onClick = { showExitDialog = true }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Change Role")
                    }
                },
                actions = {
                    IconButton(onClick = { refreshDashboard() }) {
                        if (isRefreshing) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                        }
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
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
                        onLock = {
                            commandHandler.handleCommand(SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.LOCK_NOW))
                        },
                        onUnlock = {
                            commandHandler.handleCommand(SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.UNLOCK_NOW))
                        },
                        onRefreshLocation = {
                            commandHandler.handleCommand(SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.REFRESH_LOCATION))
                        }
                    )
                }
                is DashboardState.Error -> {
                    Text(state.message, color = Color.Red, modifier = Modifier.align(Alignment.Center))
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
fun DashboardContent(
    data: DashboardUiModel,
    summary: com.example.kidsguard.ai.DailySummary?,
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
    onLock: () -> Unit,
    onUnlock: () -> Unit,
    onRefreshLocation: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (activeSos != null) {
            SosAlertCard(activeSos, onResolveSos, onViewSosHistory)
        }

        AiSummaryCard(summary, onViewSummary)

        ChildStatusCard(data)
        LocationSummaryCard(data, onOpenLiveMap)
        
        RouteIntelligenceCard(
            activeDeviations = activeDeviations,
            onManageRoutes = onOpenKnownRoutes,
            onViewDeviations = onOpenRouteDeviations
        )

        SafeZoneSummaryCard(data)
        
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Movement History", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total Points: ${data.totalPointsSaved}", style = MaterialTheme.typography.bodySmall)
                    Text("Distance Today: ${data.totalDistanceToday}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(12.dp))
                Button(onClick = onOpenRouteHistory, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Route, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("View Route History")
                }
            }
        }

        ActivitySummaryCard(data, onOpenActivityFeed)
        TrackingSummaryCard(data)
        
        Text("Quick Actions", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        
        QuickActionsGrid(
            onLock = onLock,
            onUnlock = onUnlock,
            onRefreshLocation = onRefreshLocation,
            onOpenMap = onOpenLiveMap,
            onOpenActivity = onOpenActivityFeed,
            onOpenSafeZones = onOpenSafeZones
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "v1.0.0 (Debug)", 
            modifier = Modifier.fillMaxWidth(),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun ChildStatusCard(data: DashboardUiModel) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(data.childName.ifEmpty { "Unnamed Child" }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        if (data.isMockChild) {
                            Surface(
                                color = MaterialTheme.colorScheme.tertiaryContainer,
                                shape = RoundedCornerShape(4.dp),
                                modifier = Modifier.padding(start = 8.dp)
                            ) {
                                Text(
                                    "QA Mode Active - Mock Child",
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    Text(data.deviceName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                OnlineStatusBadge(data.isOnline)
            }
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatusInfoItem(Icons.Default.BatteryChargingFull, "${data.batteryPercent}%", if (data.isCharging) "Charging" else "On Battery")
                StatusInfoItem(Icons.Default.GpsFixed, data.trackingState, "Tracking")
                StatusInfoItem(if (data.kidGuardStatus == "LOCKED") Icons.Default.Lock else Icons.Default.LockOpen, data.kidGuardStatus, "KidGuard")
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            Text("Last seen: ${data.lastSeen}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun LocationSummaryCard(data: DashboardUiModel, onOpenMap: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Location Summary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))
            
            if (data.currentLat != null) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("LAT: ${"%.5f".format(data.currentLat)}", style = MaterialTheme.typography.bodyMedium)
                        Text("LNG: ${"%.5f".format(data.currentLng)}", style = MaterialTheme.typography.bodyMedium)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("±${data.accuracy?.toInt() ?: 0}m", style = MaterialTheme.typography.bodyMedium)
                        Text("${"%.1f".format((data.speed ?: 0f) * 3.6)} km/h", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text("Updated: ${data.lastLocationUpdate}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Text("No location data available", style = MaterialTheme.typography.bodyMedium, color = Color.Red)
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onOpenMap, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Map, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open Live Map")
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

@Composable
fun TrackingSummaryCard(data: DashboardUiModel) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Tracking Service", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Config", style = MaterialTheme.typography.labelSmall)
                    Text(data.trackingConfigSummary, style = MaterialTheme.typography.bodyMedium)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Saved Points", style = MaterialTheme.typography.labelSmall)
                    Text("${data.totalPointsSaved}", style = MaterialTheme.typography.bodyMedium)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("Last GPS Signal: ${data.lastGpsPointTime}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    onOpenSafeZones: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickActionButton(Icons.Default.Lock, "Lock Now", Color.Red, onLock, Modifier.weight(1f))
            QuickActionButton(Icons.Default.LockOpen, "Unlock", Color.Green, onUnlock, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickActionButton(Icons.Default.Refresh, "Refresh GPS", MaterialTheme.colorScheme.primary, onRefreshLocation, Modifier.weight(1f))
            QuickActionButton(Icons.Default.Map, "Open Map", MaterialTheme.colorScheme.secondary, onOpenMap, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickActionButton(Icons.Default.List, "Activity", MaterialTheme.colorScheme.tertiary, onOpenActivity, Modifier.weight(1f))
            QuickActionButton(Icons.Default.LocationOn, "Safe Zones", MaterialTheme.colorScheme.secondary, onOpenSafeZones, Modifier.weight(1f))
        }
    }
}

@Composable
fun QuickActionButton(icon: ImageVector, label: String, color: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.filledTonalButtonColors(containerColor = color.copy(alpha = 0.1f), contentColor = color)
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(label, style = MaterialTheme.typography.labelLarge)
    }
}

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
