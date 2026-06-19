package com.example.kidsguard.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationHistoryScreen(
    repository: LocationRepository, 
    onBack: () -> Unit,
    locationProvider: LocalLocationProvider,
    safeZoneRepository: SafeZoneRepository,
    prefHelper: com.example.kidsguard.data.PreferenceHelper,
    syncProvider: com.example.kidsguard.sync.RemoteSyncProvider
) {
    val isParent = prefHelper.userRole == "PARENT"
    val selectedChildId = prefHelper.selectedChildId
    
    val localHistory by repository.locationHistory.collectAsState()
    val remoteHistory by (if (isParent && selectedChildId != null) {
        syncProvider.getLocationHistory(selectedChildId)
    } else {
        kotlinx.coroutines.flow.flowOf(emptyList())
    }).collectAsState(initial = emptyList())
    
    val history = if (isParent && selectedChildId != null) {
        remoteHistory.map { 
            com.example.kidsguard.models.LocationPoint(
                latitude = it.latitude,
                longitude = it.longitude,
                accuracy = it.accuracy,
                speed = it.speed,
                bearing = it.bearing,
                timestamp = it.timestamp,
                address = "Remote"
            )
        }
    } else {
        localHistory
    }

    var showClearDialog by remember { mutableStateOf(false) }
    var showPermissionExplanation by remember { mutableStateOf(false) }
    var permissionDeniedMessage by remember { mutableStateOf(false) }
    var isFetchingLocation by remember { mutableStateOf(false) }
    
    val context = LocalContext.current

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
                    repository.addLocationPoint(point)
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "LOCATION_FETCHED",
                        title = "Location Updated",
                        description = "GPS coordinates captured"
                    ))
                }
            }
        } else {
            permissionDeniedMessage = true
        }
    }

    fun handleLocationRequest() {
        if (isParent) return // Parent doesn't capture their own location here
        
        when {
            androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED -> {
                isFetchingLocation = true
                locationProvider.requestSingleUpdate { point ->
                    isFetchingLocation = false
                    if (point != null) {
                        repository.addLocationPoint(point)
                        safeZoneRepository.addEvent(ActivityEvent(
                            type = "LOCATION_FETCHED",
                            title = "Location Updated",
                            description = "GPS coordinates captured"
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
            TopAppBar(
                title = { 
                    Column {
                        Text("Location History")
                        if (isParent && selectedChildId != null) {
                            Text(
                                "Child ID: $selectedChildId", 
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (!isParent) {
                        IconButton(
                            onClick = { handleLocationRequest() },
                            enabled = !isFetchingLocation
                        ) {
                            if (isFetchingLocation) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                            } else {
                                Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                            }
                        }
                        IconButton(onClick = { showClearDialog = true }) {
                            Icon(Icons.Default.DeleteSweep, contentDescription = "Clear History")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { handleLocationRequest() },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                if (isFetchingLocation) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Icon(Icons.Default.MyLocation, contentDescription = "Get Current Location")
                }
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
            if (permissionDeniedMessage) {
                Card(
                    modifier = Modifier.padding(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Error, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Permission Denied", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.error)
                            Text("Location permission is required to fetch current GPS coordinates.", style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = { 
                            permissionDeniedMessage = false
                            showPermissionExplanation = true 
                        }) {
                            Text("Retry")
                        }
                    }
                }
            }

            if (history.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.LocationOff, 
                            contentDescription = null, 
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("No location history recorded", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(history) { point ->
                        val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }
                        val timeString = sdf.format(Date(point.timestamp))
                        
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = timeString,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Surface(
                                        color = MaterialTheme.colorScheme.secondaryContainer,
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Text(
                                            text = "±${point.accuracy.toInt()}m",
                                            style = MaterialTheme.typography.labelSmall,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            color = MaterialTheme.colorScheme.onSecondaryContainer
                                        )
                                    }
                                }
                                
                                if (point.address != null) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = point.address,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold
                                    )
                                    if (point.city != null || point.country != null) {
                                        Text(
                                            text = "${point.city ?: ""} ${point.country ?: ""}".trim(),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(12.dp))
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("LATITUDE", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text("%.6f".format(point.latitude), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("LONGITUDE", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text("%.6f".format(point.longitude), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                                    }
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Speed, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.secondary)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Speed: ${"%.1f".format(point.speed * 3.6)} km/h",
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    Spacer(modifier = Modifier.weight(1f))
                                    Icon(Icons.Default.Explore, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.secondary)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "${point.bearing.toInt()}°",
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (showClearDialog) {
            AlertDialog(
                onDismissRequest = { showClearDialog = false },
                title = { Text("Clear History") },
                text = { Text("Delete all recorded location points?") },
                confirmButton = {
                    Button(
                        onClick = {
                            repository.clearLocationHistory()
                            showClearDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Clear")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearDialog = false }) { Text("Cancel") }
                }
            )
        }

        if (showPermissionExplanation) {
            AlertDialog(
                onDismissRequest = { showPermissionExplanation = false },
                title = { Text("Location Permission") },
                text = { 
                    Text("KidsGuard needs your location to provide accurate safety monitoring and history. Please grant location access on the next screen.") 
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
