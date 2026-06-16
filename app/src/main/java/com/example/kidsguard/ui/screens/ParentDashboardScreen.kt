package com.example.kidsguard.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentDashboardScreen(
    prefHelper: PreferenceHelper, 
    onOpenSettings: () -> Unit,
    onOpenSafeZones: () -> Unit,
    onOpenActivityFeed: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onBack: () -> Unit,
    locationRepository: LocationRepository,
    safeZoneRepository: SafeZoneRepository,
    locationProvider: LocalLocationProvider
) {
    val context = LocalContext.current
    var showExitDialog by remember { mutableStateOf(false) }
    var isFetchingLocation by remember { mutableStateOf(false) }
    var showPermissionExplanation by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
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
                    modifier = Modifier.weight(1f).clickable { /* Live Map Placeholder */ },
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
    }
}
