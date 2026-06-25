package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.RouteRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.update.UpdateRepository
import com.example.kidsguard.sync.CommandType
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.LocalMockSyncProvider
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncRemoteCommand
import com.example.kidsguard.sync.SyncChildStatus
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeveloperMenuScreen(
    onBack: () -> Unit,
    prefHelper: PreferenceHelper,
    repository: SafeZoneRepository,
    locationRepository: LocationRepository,
    onScreenChange: (Screen) -> Unit,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider,
    commandHandler: com.example.kidsguard.sync.RemoteCommandHandler,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: RouteRepository,
    locationProvider: com.example.kidsguard.location.LocationProvider,
    updateRepository: UpdateRepository,
    dailySummaryRepository: com.example.kidsguard.ai.DailySummaryRepository,
    knownRouteRepository: com.example.kidsguard.routeintelligence.KnownRouteRepository,
    reverseGeocoder: com.example.kidsguard.geocoding.ReverseGeocoder,
    errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository,
    authRepository: AuthRepository
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val notificationEngine = remember { com.example.kidsguard.notifications.LocalNotificationEngine(context, errorLogRepository) }
    var showConfirmDialog by remember { mutableStateOf<String?>(null) }
    
    val trackingState by trackingRepository.currentState.collectAsState()
    val activeSos by sosRepository.activeSos.collectAsState()

    val lastRemoteCommand by commandHandler.lastCommandReceived.collectAsState()
    val lastExecutionResult by commandHandler.lastExecutionResult.collectAsState()

    val mockProvider = syncProvider as? LocalMockSyncProvider
    val isSyncConnected by syncProvider.isConnected.collectAsState()
    
    val remoteStatus by (prefHelper.pairedChildId?.let { syncProvider.getChildStatus(it) } ?: kotlinx.coroutines.flow.flowOf(null)).collectAsState(null)
    
    val locationHistory by locationRepository.locationHistory.collectAsState()
    val lastGps = locationHistory.firstOrNull()

    val recentCommandsList = remember { mutableStateListOf<SyncRemoteCommand>() }

    LaunchedEffect(prefHelper.pairingCode) {
        if (prefHelper.pairingCode.isNotEmpty()) {
            syncProvider.listenForRemoteCommands(prefHelper.pairingCode) { cmd ->
                if (recentCommandsList.none { it.commandId == cmd.commandId }) {
                    recentCommandsList.add(0, cmd)
                    if (recentCommandsList.size > 5) recentCommandsList.removeAt(5)
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("Developer Tools", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = "Phase AF - Remote Control Ready", 
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Remote Control Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Execute Local Simulation", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { 
                            commandHandler.handleCommand(SyncRemoteCommand(
                                childId = prefHelper.pairingCode, 
                                commandType = CommandType.SHOW_MESSAGE,
                                payload = "Test message from developer tools"
                            ))
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Message", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = { 
                            commandHandler.handleCommand(SyncRemoteCommand(
                                childId = prefHelper.pairingCode, 
                                commandType = CommandType.RING_DEVICE
                            ))
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Ring", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { 
                            commandHandler.handleCommand(SyncRemoteCommand(
                                childId = prefHelper.pairingCode, 
                                commandType = CommandType.VIBRATE_DEVICE
                            ))
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Vibrate", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = { 
                            commandHandler.handleCommand(SyncRemoteCommand(
                                childId = prefHelper.pairingCode, 
                                commandType = CommandType.REFRESH_LOCATION
                            ))
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Refresh", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Live Command Feed (Last 5)", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall)
                    if (recentCommandsList.isEmpty()) {
                        Text("No commands in queue", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                    }
                    recentCommandsList.forEach { cmd ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${cmd.commandType}", style = MaterialTheme.typography.bodySmall)
                            Text("${cmd.status}", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Black)
                        }
                    }
                    HorizontalDivider()
                    Text("Last Execution: $lastExecutionResult", style = MaterialTheme.typography.bodySmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("QA Test Utilities", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    val baseLat = 51.1912
                    val baseLng = 6.4422
                    val now = System.currentTimeMillis()
                    repeat(10) { i ->
                        locationRepository.addLocationPoint(com.example.kidsguard.models.LocationPoint(
                            baseLat + (0.001 * i), 
                            baseLng + (0.001 * i), 
                            10f, 2.0f, 0f, 
                            now - (i * 60000)
                        ))
                    }
                }, modifier = Modifier.weight(1f)) {
                    Text("Mock 10 GPS", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    prefHelper.isLocked = !prefHelper.isLocked
                    onScreenChange(if (prefHelper.isLocked) Screen.Locked else Screen.Home)
                }, modifier = Modifier.weight(1f)) {
                    Text(if (prefHelper.isLocked) "Unlock" else "Lock", style = MaterialTheme.typography.labelSmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            DeveloperActionItem(
                title = "Reset Role Selection",
                description = "Resets user role to NONE and clears pairing data.",
                onClick = { showConfirmDialog = "RESET_ROLE" }
            )
            DeveloperActionItem(
                title = "Clear Activity History",
                description = "Deletes all events from the activity feed.",
                onClick = { showConfirmDialog = "CLEAR_ACTIVITY" }
            )
            DeveloperActionItem(
                title = "Reset Firebase Identity",
                description = "Generates new deviceId.",
                color = Color.Red,
                onClick = { showConfirmDialog = "RESET_IDENTITY" }
            )
        }

        if (showConfirmDialog != null) {
            AlertDialog(
                onDismissRequest = { showConfirmDialog = null },
                title = { Text("Confirm Action") },
                text = { Text("Are you sure you want to proceed?") },
                confirmButton = {
                    Button(
                        onClick = {
                            when (showConfirmDialog) {
                                "RESET_ROLE" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    onScreenChange(Screen.RoleSelection)
                                }
                                "CLEAR_ACTIVITY" -> repository.clearEvents()
                                "RESET_IDENTITY" -> prefHelper.resetIdentity()
                            }
                            showConfirmDialog = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Confirm")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showConfirmDialog = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun DeveloperActionItem(
    title: String,
    description: String,
    color: Color = MaterialTheme.colorScheme.primary,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
            Text(text = description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
