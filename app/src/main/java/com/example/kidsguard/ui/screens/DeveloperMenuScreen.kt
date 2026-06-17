package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.CommandType
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.LocalMockSyncProvider
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncRemoteCommand
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository

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
    commandHandler: com.example.kidsguard.sync.RemoteCommandHandler
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val notificationEngine = remember { LocalNotificationEngine(context) }
    var showConfirmDialog by remember { mutableStateOf<String?>(null) }
    val trackingState by trackingRepository.currentState.collectAsState()
    val trackingConfig by trackingRepository.currentConfig.collectAsState()

    val lastRemoteCommand by commandHandler.lastCommandReceived.collectAsState()
    val lastExecutionResult by commandHandler.lastExecutionResult.collectAsState()

    val mockProvider = syncProvider as? LocalMockSyncProvider
    val isSyncConnected by syncProvider.isConnected.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Developer Tools") },
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
            Text("Remote Sync Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            val lastSync by syncProvider.lastSyncTimestamp.collectAsState()
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Sync Provider: Local Mock", style = MaterialTheme.typography.bodySmall)
                    Text("Status: ${if (isSyncConnected) "CONNECTED" else "DISCONNECTED"}", style = MaterialTheme.typography.bodySmall)
                    val sdf = remember { java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()) }
                    Text("Last Sync: ${if (lastSync > 0) sdf.format(java.util.Date(lastSync)) else "Never"}", style = MaterialTheme.typography.bodySmall)
                    Text("Pending Commands: 0", style = MaterialTheme.typography.bodySmall)
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { 
                            android.util.Log.d("DeveloperMenu", "LOCK button clicked")
                            val cmd = SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.LOCK_NOW)
                            // Call handler directly for immediate local feedback in dev menu
                            commandHandler.handleCommand(cmd)
                            // Also simulate via provider to test the sync infrastructure
                            mockProvider?.simulateRemoteCommand(cmd)
                        }, modifier = Modifier.weight(1f)) {
                            Text("LOCK", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = { 
                            android.util.Log.d("DeveloperMenu", "UNLOCK button clicked")
                            val cmd = SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.UNLOCK_NOW)
                            commandHandler.handleCommand(cmd)
                            mockProvider?.simulateRemoteCommand(cmd)
                        }, modifier = Modifier.weight(1f)) {
                            Text("UNLOCK", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { 
                            android.util.Log.d("DeveloperMenu", "REFRESH button clicked")
                            val cmd = SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.REFRESH_LOCATION)
                            commandHandler.handleCommand(cmd)
                            mockProvider?.simulateRemoteCommand(cmd)
                        }, modifier = Modifier.weight(1f)) {
                            Text("REFRESH GPS", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = { 
                            if (isSyncConnected) syncProvider.disconnect() else syncProvider.connect()
                        }, modifier = Modifier.weight(1f)) {
                            Text(if (isSyncConnected) "OFFLINE" else "ONLINE", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Button(
                        onClick = { mockProvider?.clearMockSyncData() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                    ) {
                        Text("Clear Mock Sync Data", style = MaterialTheme.typography.labelSmall)
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    Text("Execution Status", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    Text("Last Command: $lastRemoteCommand", style = MaterialTheme.typography.bodySmall)
                    Text("Last Result: $lastExecutionResult", style = MaterialTheme.typography.bodySmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            DeveloperActionItem(
                title = "Reset Role Selection",
                description = "Resets user role to NONE and clears pairing data.",
                onClick = { showConfirmDialog = "RESET_ROLE" }
            )
            DeveloperActionItem(
                title = "Clear Pairing Data",
                description = "Clears child ID, name, and pairing code.",
                onClick = { showConfirmDialog = "CLEAR_PAIRING" }
            )
            DeveloperActionItem(
                title = "Clear Activity History",
                description = "Deletes all events from the activity feed.",
                onClick = { showConfirmDialog = "CLEAR_ACTIVITY" }
            )
            DeveloperActionItem(
                title = "Clear Location History",
                description = "Deletes all recorded location points.",
                onClick = { showConfirmDialog = "CLEAR_LOCATION" }
            )
            DeveloperActionItem(
                title = "Clear Safe Zones",
                description = "Removes all defined safe zones.",
                onClick = { showConfirmDialog = "CLEAR_SAFEZONES" }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Notification Tests", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    val title = "Entered Home"
                    notificationEngine.sendSafetyAlert("KidsGuard Alert", "${prefHelper.childName.ifEmpty { "Child" }} arrived at Home")
                    repository.addEvent(ActivityEvent(type = "SAFE_ZONE_ENTER", title = title))
                }, modifier = Modifier.weight(1f)) {
                    Text("Enter", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    val title = "Left School"
                    notificationEngine.sendSafetyAlert("KidsGuard Alert", "${prefHelper.childName.ifEmpty { "Child" }} left School")
                    repository.addEvent(ActivityEvent(type = "SAFE_ZONE_EXIT", title = title))
                }, modifier = Modifier.weight(1f)) {
                    Text("Exit", style = MaterialTheme.typography.labelSmall)
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    notificationEngine.sendSafetyAlert("Battery Low", "Child device battery is below 15%")
                    repository.addEvent(ActivityEvent(type = "BATTERY_LOW", title = "Battery Low", description = "Below 15%"))
                }, modifier = Modifier.weight(1f)) {
                    Text("Battery", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    notificationEngine.sendSafetyAlert("SOS Alert", "Emergency event triggered!")
                    repository.addEvent(ActivityEvent(type = "SOS", title = "SOS Alert", description = "Manual test"))
                }, modifier = Modifier.weight(1f)) {
                    Text("SOS", style = MaterialTheme.typography.labelSmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Tracking Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            val lastLocation by locationRepository.locationHistory.collectAsState()
            val safeZones by repository.safeZones.collectAsState()
            val checker = remember { com.example.kidsguard.tracking.LocalSafeZoneChecker(repository, notificationEngine, prefHelper) }
            val lastEvent by repository.activityEvents.collectAsState()
            
            val nearest = lastLocation.firstOrNull()?.let { point ->
                safeZones.minByOrNull { checker.calculateDistance(point.latitude, point.longitude, it.latitude, it.longitude) }
            }
            val distance = nearest?.let { zone ->
                lastLocation.firstOrNull()?.let { point ->
                    checker.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude)
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("State: ${trackingState.name}", style = MaterialTheme.typography.bodyMedium)
                    Text("Config: $trackingConfig", style = MaterialTheme.typography.bodySmall)
                    Text("Last Saved: ${lastLocation.firstOrNull()?.latitude}, ${lastLocation.firstOrNull()?.longitude}", style = MaterialTheme.typography.bodySmall)
                    Text("Safe Zones: ${safeZones.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Current Zone: ${if (distance != null && distance <= (nearest?.radiusMeters ?: 0.0)) nearest?.name else "None"}", style = MaterialTheme.typography.bodySmall)
                    Text("Nearest Zone: ${nearest?.name} (${distance?.toInt() ?: 0}m)", style = MaterialTheme.typography.bodySmall)
                    Text("Last Event: ${lastEvent.firstOrNull()?.title}", style = MaterialTheme.typography.bodySmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Firebase Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            val isFirebaseConfigured = FirebaseConfig.isFirebaseConfigured(context)
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Firebase Configured: ${if (isFirebaseConfigured) "YES" else "NO"}", style = MaterialTheme.typography.bodySmall)
                    Text("Current Provider: ${FirebaseConfig.currentProviderName(context)}", style = MaterialTheme.typography.bodySmall)
                    
                    if (!isFirebaseConfigured) {
                        Text(
                            "WARNING: google-services.json missing in app/ folder.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    
                    Button(
                        onClick = { 
                            val configured = FirebaseConfig.isFirebaseConfigured(context)
                            android.widget.Toast.makeText(context, "Selection logic check: Use ${if (configured) "Firebase" else "Mock"}", android.widget.Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Test Provider Selection", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            DeveloperActionItem(
                title = "Force KidGuard Lock",
                description = "Immediately activate the lock screen.",
                color = MaterialTheme.colorScheme.error,
                onClick = {
                    prefHelper.isLocked = true
                    onScreenChange(Screen.Locked)
                }
            )
            DeveloperActionItem(
                title = "Force Unlock",
                description = "Immediately deactivate the lock screen.",
                color = Color.Green,
                onClick = {
                    prefHelper.isLocked = false
                    onScreenChange(Screen.Home)
                }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            Button(
                onClick = { showConfirmDialog = "RESET_ALL" },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("Reset Everything (Keep Security Settings)")
            }
        }

        if (showConfirmDialog != null) {
            AlertDialog(
                onDismissRequest = { showConfirmDialog = null },
                title = { Text("Confirm Action") },
                text = { Text("Are you sure you want to proceed? This action cannot be undone.") },
                confirmButton = {
                    Button(
                        onClick = {
                            when (showConfirmDialog) {
                                "RESET_ROLE" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                    onScreenChange(Screen.RoleSelection)
                                }
                                "CLEAR_PAIRING" -> {
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                }
                                "CLEAR_ACTIVITY" -> repository.clearEvents()
                                "CLEAR_LOCATION" -> locationRepository.clearLocationHistory()
                                "CLEAR_SAFEZONES" -> repository.clearAllSafeZones()
                                "RESET_ALL" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                    prefHelper.isLocked = false
                                    repository.clearEvents()
                                    repository.clearAllSafeZones()
                                    locationRepository.clearLocationHistory()
                                    onScreenChange(Screen.RoleSelection)
                                }
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
