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
import com.example.kidsguard.update.UpdateRepository
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
    commandHandler: com.example.kidsguard.sync.RemoteCommandHandler,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: RouteRepository,
    locationProvider: com.example.kidsguard.location.LocationProvider,
    updateRepository: com.example.kidsguard.update.UpdateRepository
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val notificationEngine = remember { LocalNotificationEngine(context) }
    var showConfirmDialog by remember { mutableStateOf<String?>(null) }
    
    val activeSos by sosRepository.activeSos.collectAsState()
    val trackingState by trackingRepository.currentState.collectAsState()
    val trackingConfig by trackingRepository.currentConfig.collectAsState()

    val lastRemoteCommand by commandHandler.lastCommandReceived.collectAsState()
    val lastExecutionResult by commandHandler.lastExecutionResult.collectAsState()

    val mockProvider = syncProvider as? LocalMockSyncProvider
    val isSyncConnected by syncProvider.isConnected.collectAsState()
    
    val locationHistory by locationRepository.locationHistory.collectAsState()
    val lastGps = locationHistory.firstOrNull()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("Developer Tools", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = "v1.0.0 (Debug) - ${android.os.Build.MODEL}", 
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
            Text("QA Test Utilities", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            
            // QA Mode Status Card
            val allEvents by repository.activityEvents.collectAsState()
            val allSos by sosRepository.sosHistory.collectAsState()
            val allRoutes by routeRepository.routeSessions.collectAsState()
            val isMockActive = prefHelper.pairedChildId == "mock_child_001"
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("QA Mode: ${if (isMockActive) "ENABLED" else "DISABLED"}", fontWeight = FontWeight.Bold, color = if (isMockActive) Color.Green else Color.Gray)
                    Text("Mock Child: ${if (isMockActive) "Active" else "Inactive"}", style = MaterialTheme.typography.bodySmall)
                    Text("Total mock GPS: ${locationHistory.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Total activities: ${allEvents.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Total routes: ${allRoutes.size}", style = MaterialTheme.typography.bodySmall)
                }
            }

            // QA Action Buttons
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
                    android.widget.Toast.makeText(context, "Generated 10 mock points", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f)) {
                    Text("Mock 10 GPS", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    val baseLat = 50.9375
                    val baseLng = 6.9603
                    val now = System.currentTimeMillis()
                    repeat(20) { i ->
                        locationRepository.addLocationPoint(com.example.kidsguard.models.LocationPoint(
                            baseLat + (0.002 * i), 
                            baseLng + (0.0015 * i), 
                            5f, 4.5f, 45f, 
                            now - (i * 30000)
                        ))
                    }
                    routeRepository.generateRouteSessions()
                    android.widget.Toast.makeText(context, "Generated mock route", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f)) {
                    Text("Mock Route", style = MaterialTheme.typography.labelSmall)
                }
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    repository.addEvent(ActivityEvent(
                        type = "SAFE_ZONE_ENTER",
                        title = "Entered School",
                        description = "Mock child entered safe zone"
                    ))
                    android.widget.Toast.makeText(context, "Mock: Entered School", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f)) {
                    Text("Enter Zone", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    repository.addEvent(ActivityEvent(
                        type = "SAFE_ZONE_EXIT",
                        title = "Left School",
                        description = "Mock child left safe zone"
                    ))
                    android.widget.Toast.makeText(context, "Mock: Left School", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f)) {
                    Text("Exit Zone", style = MaterialTheme.typography.labelSmall)
                }
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    repository.addEvent(ActivityEvent(
                        type = "BATTERY_LOW",
                        title = "Battery Low",
                        description = "Mock child battery at 12%"
                    ))
                    notificationEngine.sendSafetyAlert("Battery Low", "Test Child battery is at 12%")
                    android.widget.Toast.makeText(context, "Mock: Battery Low", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f)) {
                    Text("Battery Low", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    val event = com.example.kidsguard.models.SosEvent(
                        childId = prefHelper.pairingCode,
                        message = "QA TEST EMERGENCY SOS"
                    )
                    sosRepository.triggerSos(event)
                    repository.addEvent(ActivityEvent(
                        type = "SOS_TRIGGERED",
                        title = "SOS Alert",
                        description = "QA test emergency trigger"
                    ))
                    notificationEngine.sendSafetyAlert("SOS Alert", "Emergency SOS triggered by Test Child")
                    android.widget.Toast.makeText(context, "Mock: SOS Triggered", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) {
                    Text("SOS Event", style = MaterialTheme.typography.labelSmall)
                }
            }

            Button(
                onClick = { 
                    locationRepository.clearLocationHistory()
                    repository.clearEvents()
                    sosRepository.clearSosHistory()
                    routeRepository.generateRouteSessions()
                    android.widget.Toast.makeText(context, "All test data cleared", android.widget.Toast.LENGTH_SHORT).show()
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary)
            ) {
                Text("Clear All Test Data", style = MaterialTheme.typography.labelSmall)
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Real Device Test Mode", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    prefHelper.isLocked = true
                    onScreenChange(Screen.Locked)
                }, modifier = Modifier.weight(1f)) {
                    Text("Force Lock", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    prefHelper.isLocked = false
                    onScreenChange(Screen.Home)
                }, modifier = Modifier.weight(1f)) {
                    Text("Force Unlock", style = MaterialTheme.typography.labelSmall)
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    android.util.Log.d("DeveloperMenu", "Test GPS button clicked")
                    android.widget.Toast.makeText(context, "GPS test started", android.widget.Toast.LENGTH_SHORT).show()
                    
                    if (com.example.kidsguard.utils.PermissionUtils.hasLocationPermission(context)) {
                        locationProvider.requestSingleUpdate { point ->
                            if (point != null) {
                                locationRepository.addLocationPoint(point)
                                repository.addEvent(ActivityEvent(
                                    type = "GPS_TEST_CAPTURE",
                                    title = "GPS Test Capture",
                                    description = "Location captured from Developer Tools"
                                ))
                                android.widget.Toast.makeText(context, "GPS captured successfully", android.widget.Toast.LENGTH_SHORT).show()
                                notificationEngine.sendSafetyAlert("GPS Test Completed", "GPS captured successfully. Open Location History to view details.")
                            } else {
                                android.util.Log.e("DeveloperMenu", "GPS capture failed - null result")
                                android.widget.Toast.makeText(context, "GPS capture failed", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    } else {
                        showConfirmDialog = "PERMISSION_REQUIRED"
                    }
                }, modifier = Modifier.weight(1f)) {
                    Text("Test GPS", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    trackingManager.startTracking()
                }, modifier = Modifier.weight(1f)) {
                    Text("Test Background", style = MaterialTheme.typography.labelSmall)
                }
            }
            
            // Debug display for last capture
            lastGps?.let { point ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("Last GPS Test Result", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        val sdf = remember { java.text.SimpleDateFormat("MMM dd, HH:mm:ss", java.util.Locale.getDefault()) }
                        Text("Time: ${sdf.format(java.util.Date(point.timestamp))}", style = MaterialTheme.typography.bodySmall)
                        Text("Latitude: ${point.latitude}", style = MaterialTheme.typography.bodySmall)
                        Text("Longitude: ${point.longitude}", style = MaterialTheme.typography.bodySmall)
                        Text("Accuracy: ±${point.accuracy.toInt()}m", style = MaterialTheme.typography.bodySmall)
                        Text("Speed: ${"%.1f".format(point.speed * 3.6)} km/h", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Remote Sync Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            val lastSync by syncProvider.lastSyncTimestamp.collectAsState()
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Sync Provider: Local Mock", style = MaterialTheme.typography.bodySmall)
                    Text("Status: ${if (isSyncConnected) "CONNECTED" else "DISCONNECTED"}", style = MaterialTheme.typography.bodySmall)
                    val sdf = remember { java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()) }
                    Text("Last Sync: ${if (lastSync > 0) sdf.format(java.util.Date(lastSync)) else "Never"}", style = MaterialTheme.typography.bodySmall)
                    
                    Text("Last Received: $lastRemoteCommand", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                    Text("Last Result: $lastExecutionResult", style = MaterialTheme.typography.bodySmall)
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { 
                            android.util.Log.d("DeveloperMenu", "LOCK button clicked")
                            val cmd = SyncRemoteCommand(childId = prefHelper.pairingCode, commandType = CommandType.LOCK_NOW)
                            commandHandler.handleCommand(cmd)
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
            DeveloperActionItem(
                title = "Create Mock Child Pairing",
                description = "Instantly pairs with a dummy child device for testing.",
                onClick = {
                    prefHelper.userRole = "PARENT"
                    prefHelper.pairedChildId = "mock_child_001"
                    prefHelper.childName = "Test Child"
                    prefHelper.deviceName = "Android Emulator"
                    onScreenChange(Screen.ParentDashboard)
                }
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
                    val event = com.example.kidsguard.models.SosEvent(
                        childId = prefHelper.pairingCode,
                        message = "QA TEST EMERGENCY SOS"
                    )
                    sosRepository.triggerSos(event)
                    repository.addEvent(ActivityEvent(
                        type = "SOS_TRIGGERED",
                        title = "SOS Alert",
                        description = "QA test emergency trigger"
                    ))
                    notificationEngine.sendSafetyAlert("SOS Alert", "Emergency SOS triggered by Test Child")
                    android.widget.Toast.makeText(context, "Mock: SOS Triggered", android.widget.Toast.LENGTH_SHORT).show()
                }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) {
                    Text("SOS", style = MaterialTheme.typography.labelSmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Tracking Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
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

            Text("SOS Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { 
                    sosRepository.triggerSos(com.example.kidsguard.models.SosEvent(
                        childId = prefHelper.pairingCode,
                        message = "DEBUG TEST SOS"
                    ))
                }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color.Red)) {
                    Text("Trigger SOS", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    activeSos?.let { sosRepository.resolveSos(it.id) }
                }, modifier = Modifier.weight(1f), enabled = activeSos != null) {
                    Text("Resolve Active", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = { 
                    sosRepository.clearSosHistory()
                }, modifier = Modifier.weight(1f)) {
                    Text("Clear SOS", style = MaterialTheme.typography.labelSmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Route Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Total Routes: ${routeSessions.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Total GPS Points: ${lastLocation.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Last Route Distance: ${"%.1f".format((routeSessions.firstOrNull()?.totalDistanceMeters ?: 0.0) / 1000)} km", style = MaterialTheme.typography.bodySmall)
                    Button(onClick = { routeRepository.generateRouteSessions() }, modifier = Modifier.fillMaxWidth()) {
                        Text("Regenerate Routes", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("Dashboard Debug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Total GPS Points: ${lastLocation.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Total Activities: ${allEvents.size}", style = MaterialTheme.typography.bodySmall)
                    Text("Total Notifications: ${allEvents.count { it.type.contains("ALERT") || it.type.contains("ENTER") || it.type.contains("EXIT") }}", style = MaterialTheme.typography.bodySmall)
                    Text("Total Safe Zones: ${safeZones.size}", style = MaterialTheme.typography.bodySmall)
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text("App Update", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
            val updateInfo by updateRepository.updateInfo.collectAsState()
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Current Version: ${updateRepository.getCurrentVersion()} (${updateRepository.getVersionCode()})", style = MaterialTheme.typography.bodySmall)
                    Text("Latest Version: ${updateInfo?.latestVersion ?: "N/A"}", style = MaterialTheme.typography.bodySmall)
                    Text("Update Available: ${if (updateInfo != null) "YES" else "NO"}", style = MaterialTheme.typography.bodySmall)
                    
                    if (updateInfo != null) {
                        Text("Release Notes:", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        Text(updateInfo!!.releaseNotes, style = MaterialTheme.typography.bodySmall)
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { updateRepository.checkForUpdates() }, modifier = Modifier.weight(1f)) {
                            Text("Check", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = { updateInfo?.apkUrl?.let { updateRepository.openUpdateUrl(it) } }, modifier = Modifier.weight(1f), enabled = updateInfo != null) {
                            Text("Download", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { updateRepository.simulateNewVersionAvailable() }, modifier = Modifier.weight(1f)) {
                            Text("Simulate New", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = { updateRepository.clearUpdateState() }, modifier = Modifier.weight(1f)) {
                            Text("Clear State", style = MaterialTheme.typography.labelSmall)
                        }
                    }
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
                text = { 
                    if (showConfirmDialog == "PERMISSION_REQUIRED") {
                        Text("Location permission is required for this test. Please grant it in app settings.")
                    } else {
                        Text("Are you sure you want to proceed? This action cannot be undone.") 
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            when (showConfirmDialog) {
                                "PERMISSION_REQUIRED" -> {
                                    // Just close
                                }
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
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (showConfirmDialog == "PERMISSION_REQUIRED") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text(if (showConfirmDialog == "PERMISSION_REQUIRED") "OK" else "Confirm")
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
