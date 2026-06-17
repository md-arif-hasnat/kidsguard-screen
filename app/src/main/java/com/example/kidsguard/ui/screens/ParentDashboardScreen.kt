package com.example.kidsguard.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingConfig
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.tracking.TrackingState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentDashboardScreen(
    prefHelper: PreferenceHelper, 
    onOpenSettings: () -> Unit,
    onOpenSafeZones: () -> Unit,
    onOpenActivityFeed: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onOpenLiveMap: () -> Unit,
    onBack: () -> Unit,
    locationRepository: LocationRepository,
    safeZoneRepository: SafeZoneRepository,
    locationProvider: LocalLocationProvider,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider
) {
    val context = LocalContext.current
    var showExitDialog by remember { mutableStateOf(false) }
    var isFetchingLocation by remember { mutableStateOf(false) }
    var showPermissionExplanation by remember { mutableStateOf(false) }
    var showBackgroundPermissionExplanation by remember { mutableStateOf(false) }
    var permissionDeniedMessage by remember { mutableStateOf(false) }
    
    val trackingState by trackingRepository.currentState.collectAsState()
    val trackingConfig by trackingRepository.currentConfig.collectAsState()
    
    val isConnected by syncProvider.isConnected.collectAsState()
    val lastSync by syncProvider.lastSyncTimestamp.collectAsState()

    val backgroundPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            trackingManager.startTracking()
        } else {
            permissionDeniedMessage = true
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        
        if (granted) {
            // Check for background location if we want to start tracking
            if (prefHelper.userRole == "CHILD") {
                showBackgroundPermissionExplanation = true
            }
        } else {
            permissionDeniedMessage = true
        }
    }

    fun handleStartTracking() {
        val hasFineLocation = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasBackgroundLocation = if (android.os.Build.VERSION.SDK_INT >= 29) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else true
        val hasNotificationPermission = if (android.os.Build.VERSION.SDK_INT >= 33) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else true

        if (!hasFineLocation) {
            val perms = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            permissionLauncher.launch(perms.toTypedArray())
        } else if (android.os.Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission) {
            permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        } else if (!hasBackgroundLocation && android.os.Build.VERSION.SDK_INT >= 29) {
            showBackgroundPermissionExplanation = true
        } else {
            trackingManager.startTracking()
        }
    }

    fun handleLocationRequest() {
        when {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED -> {
                isFetchingLocation = true
                locationProvider.requestSingleUpdate { point ->
                    isFetchingLocation = false
                    if (point != null) {
                        locationRepository.addLocationPoint(point)
                        safeZoneRepository.addEvent(ActivityEvent(
                            type = "LOCATION_FETCHED",
                            title = "Location Updated",
                            description = "Manual request successful"
                        ))
                    }
                }
            }
            else -> {
                showPermissionExplanation = true
            }
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
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
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
                .verticalScroll(rememberScrollState())
        ) {
            if (permissionDeniedMessage) {
                // ... existing permission denied card ...
            }

            RemoteSyncStatusCard(
                isConnected = isConnected, 
                lastSync = lastSync, 
                providerName = FirebaseConfig.currentProviderName(context),
                isFirebaseConfigured = FirebaseConfig.isFirebaseConfigured(context)
            )
            
            Spacer(modifier = Modifier.height(16.dp))

            TrackingStatusCard(
                state = trackingState, 
                config = trackingConfig,
                onStart = { handleStartTracking() },
                onStop = { trackingManager.stopTracking() },
                onPause = { trackingManager.pauseTracking() },
                onResume = { trackingManager.resumeTracking() }
            )
            
            Spacer(modifier = Modifier.height(16.dp))

            val lastLocation by locationRepository.locationHistory.collectAsState()
            val safeZones by safeZoneRepository.safeZones.collectAsState()
            val notificationEngine = remember { com.example.kidsguard.notifications.LocalNotificationEngine(context) }
            val checker = remember { com.example.kidsguard.tracking.LocalSafeZoneChecker(safeZoneRepository, notificationEngine, prefHelper) }
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
                    Text("Safe Zone Status", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (distance != null && distance <= (nearest?.radiusMeters ?: 0.0)) 
                            "Current Zone: ${nearest?.name}" else "Status: Outside Zones",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    if (distance != null && distance > (nearest?.radiusMeters ?: 0.0)) {
                        Text(
                            text = "Nearest: ${nearest?.name} (${distance.toInt()}m away)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text("Monitored Device", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(16.dp))
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    ListItem(
                        headlineContent = { Text(prefHelper.childName.ifEmpty { "Child's Phone" }) },
                        supportingContent = { Text("Device: ${prefHelper.deviceName}") },
                        trailingContent = {
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = if (prefHelper.isLocked) "LOCKED" else "UNLOCKED",
                                    color = if (prefHelper.isLocked) Color.Red else Color.Green,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Online",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.Green
                                )
                            }
                        }
                    )
                    HorizontalDivider()
                    ListItem(
                        headlineContent = { Text("Battery Level") },
                        trailingContent = { Text("85%") } // Mocked
                    )
                    ListItem(
                        headlineContent = { Text("Last Updated") },
                        trailingContent = { Text("Just now") }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { handleLocationRequest() },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = !isFetchingLocation
            ) {
                if (isFetchingLocation) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Icon(Icons.Default.MyLocation, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Get Current Location")
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenLiveMap() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Map, contentDescription = null)
                        Text("Live Map", style = MaterialTheme.typography.titleMedium)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenSafeZones() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.LocationOn, contentDescription = null)
                        Text("Safe Zones", style = MaterialTheme.typography.titleMedium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenActivityFeed() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.List, contentDescription = null)
                        Text("Activity Feed", style = MaterialTheme.typography.titleMedium)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenLocationHistory() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.LocationOn, contentDescription = null)
                        Text("Location", style = MaterialTheme.typography.titleMedium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth().clickable { 
                    prefHelper.isLocked = !prefHelper.isLocked
                },
                colors = CardDefaults.cardColors(
                    containerColor = if (prefHelper.isLocked) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(if (prefHelper.isLocked) Icons.Default.LockOpen else Icons.Default.Lock, contentDescription = null)
                    Text(if (prefHelper.isLocked) "Remote Unlock" else "Remote Lock", style = MaterialTheme.typography.titleMedium)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            Button(
                onClick = onOpenSettings,
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Icon(Icons.Default.Settings, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Settings")
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

        if (showPermissionExplanation) {
            AlertDialog(
                onDismissRequest = { showPermissionExplanation = false },
                title = { Text("Location Permission") },
                text = { 
                    Text("KidsGuard needs location access to fetch coordinates for monitoring. Please grant access on the next screen.") 
                },
                confirmButton = {
                    Button(onClick = {
                        showPermissionExplanation = false
                        permissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }) {
                        Text("Grant Permission")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showPermissionExplanation = false }) {
                        Text("Later")
                    }
                }
            )
        }
        if (showBackgroundPermissionExplanation) {
            AlertDialog(
                onDismissRequest = { showBackgroundPermissionExplanation = false },
                title = { Text("Background Location") },
                text = { 
                    Text("To track your child even when the app is closed, please select 'Allow all the time' in the next screen settings.") 
                },
                confirmButton = {
                    Button(onClick = {
                        showBackgroundPermissionExplanation = false
                        if (android.os.Build.VERSION.SDK_INT >= 29) {
                            backgroundPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                        }
                    }) {
                        Text("Grant Permission")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showBackgroundPermissionExplanation = false }) {
                        Text("Later")
                    }
                }
            )
        }
    }
}

@Composable
fun RemoteSyncStatusCard(
    isConnected: Boolean, 
    lastSync: Long, 
    providerName: String,
    isFirebaseConfigured: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "Remote Sync",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    color = if (isConnected) Color.Green.copy(alpha = 0.2f) else MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        if (isConnected) "ONLINE" else "OFFLINE",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isConnected) Color.Green else MaterialTheme.colorScheme.error
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            TrackingStatusItem("Sync Provider", providerName)
            TrackingStatusItem("Firebase Configured", if (isFirebaseConfigured) "YES" else "NO")
            val sdf = remember { java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()) }
            TrackingStatusItem("Last Sync", if (lastSync > 0) sdf.format(java.util.Date(lastSync)) else "Never")
            TrackingStatusItem("Pending Commands", "0")
        }
    }
}

@Composable
fun TrackingStatusCard(
    state: TrackingState, 
    config: TrackingConfig,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "Background Tracking",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    color = when(state) {
                        TrackingState.RUNNING -> Color.Green.copy(alpha = 0.2f)
                        TrackingState.STOPPED -> MaterialTheme.colorScheme.errorContainer
                        else -> MaterialTheme.colorScheme.secondaryContainer
                    },
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        state.name,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = when(state) {
                            TrackingState.RUNNING -> Color.Green
                            TrackingState.STOPPED -> MaterialTheme.colorScheme.error
                            else -> MaterialTheme.colorScheme.onSecondaryContainer
                        }
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            TrackingStatusItem("Tracking Enabled", if (config.trackingEnabled) "YES" else "NO")
            TrackingStatusItem("Update Interval", "${config.updateIntervalSeconds}s")
            TrackingStatusItem("History Enabled", if (config.saveHistory) "YES" else "NO")
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                if (state == TrackingState.RUNNING) {
                    TextButton(onClick = onPause) {
                        Text("Pause", color = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = onStop) {
                        Text("Stop Tracking", color = MaterialTheme.colorScheme.error)
                    }
                } else if (state == TrackingState.PAUSED) {
                    Button(onClick = onResume) {
                        Text("Resume")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(onClick = onStop) {
                        Text("Stop", color = MaterialTheme.colorScheme.error)
                    }
                } else {
                    Button(onClick = onStart) {
                        Text("Start Tracking")
                    }
                }
            }
        }
    }
}

@Composable
fun TrackingStatusItem(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
    }
}
