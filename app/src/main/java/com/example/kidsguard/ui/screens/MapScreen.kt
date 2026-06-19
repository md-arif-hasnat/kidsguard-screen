package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncChildStatus
import com.example.kidsguard.sync.SyncLocationUpdate
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.tracking.LocalSafeZoneChecker
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    locationRepository: LocationRepository,
    safeZoneRepository: SafeZoneRepository,
    trackingRepository: TrackingRepository,
    knownRouteRepository: com.example.kidsguard.routeintelligence.KnownRouteRepository,
    syncProvider: RemoteSyncProvider,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val prefHelper = remember { PreferenceHelper(context) }
    
    val locationHistory by locationRepository.locationHistory.collectAsState()
    val safeZones by safeZoneRepository.safeZones.collectAsState()
    val knownRoutes by knownRouteRepository.knownRoutes.collectAsState()
    val deviations by knownRouteRepository.deviationEvents.collectAsState()
    val trackingState by trackingRepository.currentState.collectAsState()
    
    val isSyncConnected by syncProvider.isConnected.collectAsState()
    val remoteStatus by (prefHelper.selectedChildId?.let { syncProvider.getChildStatus(it) } ?: kotlinx.coroutines.flow.flowOf(null)).collectAsState(null)

    val notificationEngine = remember { LocalNotificationEngine(context) }
    val checker = remember { LocalSafeZoneChecker(safeZoneRepository, notificationEngine, prefHelper) }
    
    // Determine the source of truth for location
    val isParent = prefHelper.userRole == "PARENT"
    val useRemote = isParent && isSyncConnected && remoteStatus?.lastLocation != null
    
    val effectiveLocation: LocationPoint? = if (useRemote) {
        val lastLoc = remoteStatus!!.lastLocation!!
        LocationPoint(
            latitude = lastLoc.latitude,
            longitude = lastLoc.longitude,
            accuracy = lastLoc.accuracy,
            speed = lastLoc.speed,
            bearing = lastLoc.bearing,
            timestamp = lastLoc.timestamp,
            address = "Remote Location"
        )
    } else {
        locationHistory.firstOrNull()
    }
    
    val currentLatLng = effectiveLocation?.let { LatLng(it.latitude, it.longitude) } ?: LatLng(0.0, 0.0)
    
    var isFollowMode by remember { mutableStateOf(true) }
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(currentLatLng, 15f)
    }

    // Auto-follow logic
    LaunchedEffect(effectiveLocation) {
        if (isFollowMode && effectiveLocation != null) {
            cameraPositionState.animate(
                com.google.android.gms.maps.CameraUpdateFactory.newLatLng(
                    LatLng(effectiveLocation.latitude, effectiveLocation.longitude)
                )
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("Live Map")
                        if (useRemote) {
                            Text(
                                "Live: ${remoteStatus?.childName ?: "Child"}", 
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
                    FilterChip(
                        selected = isFollowMode,
                        onClick = { isFollowMode = !isFollowMode },
                        label = { Text("Follow") },
                        leadingIcon = if (isFollowMode) {
                            { Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(18.dp)) }
                        } else null,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                }
            )
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                properties = MapProperties(
                    isMyLocationEnabled = !isParent, // Only show my location if not in parent mode watching child
                    mapType = MapType.NORMAL
                ),
                uiSettings = MapUiSettings(
                    myLocationButtonEnabled = true,
                    zoomControlsEnabled = false
                )
            ) {
                // Main Marker
                effectiveLocation?.let {
                    Marker(
                        state = MarkerState(position = LatLng(it.latitude, it.longitude)),
                        title = if (useRemote) (remoteStatus?.childName ?: "Child") else "My Position",
                        snippet = "Accuracy: ${it.accuracy.toInt()}m",
                        icon = if (useRemote) {
                            com.google.android.gms.maps.model.BitmapDescriptorFactory.defaultMarker(
                                com.google.android.gms.maps.model.BitmapDescriptorFactory.HUE_VIOLET
                            )
                        } else null
                    )
                }

                // Safe Zones
                safeZones.forEach { zone ->
                    val zoneLatLng = LatLng(zone.latitude, zone.longitude)
                    val distance = effectiveLocation?.let { 
                        checker.calculateDistance(it.latitude, it.longitude, zone.latitude, zone.longitude) 
                    }
                    val isInside = distance != null && distance <= zone.radiusMeters

                    Circle(
                        center = zoneLatLng,
                        radius = zone.radiusMeters,
                        fillColor = if (isInside) Color.Green.copy(alpha = 0.1f) else Color.Blue.copy(alpha = 0.1f),
                        strokeColor = if (isInside) Color.Green.copy(alpha = 0.5f) else Color.Blue.copy(alpha = 0.5f),
                        strokeWidth = 2f
                    )
                }

                // Known Routes
                knownRoutes.filter { it.enabled }.forEach { route ->
                    Polyline(
                        points = route.routePoints.map { LatLng(it.latitude, it.longitude) },
                        color = Color.Gray.copy(alpha = 0.5f),
                        width = 8f,
                        pattern = listOf(com.google.android.gms.maps.model.Dash(20f), com.google.android.gms.maps.model.Gap(10f))
                    )
                }

                // Active Deviations
                deviations.filter { !it.resolved }.forEach { deviation ->
                    Marker(
                        state = MarkerState(position = LatLng(deviation.latitude, deviation.longitude)),
                        title = "DEVIATION DETECTED",
                        snippet = deviation.message,
                        icon = com.google.android.gms.maps.model.BitmapDescriptorFactory.defaultMarker(
                            com.google.android.gms.maps.model.BitmapDescriptorFactory.HUE_ORANGE
                        )
                    )
                }
            }

            // Bottom Info Card
            effectiveLocation?.let {
                PositionInfoCard(
                    modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
                    location = it,
                    trackingStateName = if (useRemote) (if (remoteStatus?.trackingEnabled == true) "REMOTE_RUNNING" else "REMOTE_STOPPED") else trackingState.name
                )
            }
        }
    }
}

@Composable
fun PositionInfoCard(
    modifier: Modifier = Modifier,
    location: LocationPoint,
    trackingStateName: String
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Device Telemetry",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }
                    Text(
                        text = "Updated: ${sdf.format(Date(location.timestamp))}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = trackingStateName,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))

            if (location.address != null) {
                Text(
                    text = location.address,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 2
                )
                if (location.city != null || location.country != null) {
                    Text(
                        text = "${location.city ?: ""} ${location.country ?: ""}".trim(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                InfoItem(label = "LATITUDE", value = "%.6f".format(location.latitude))
                InfoItem(label = "LONGITUDE", value = "%.6f".format(location.longitude))
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                InfoItem(label = "ACCURACY", value = "±${location.accuracy.toInt()}m")
                InfoItem(label = "SPEED", value = "${"%.1f".format(location.speed * 3.6)} km/h")
                InfoItem(label = "BEARING", value = "${location.bearing.toInt()}°")
            }
        }
    }
}

@Composable
fun InfoItem(label: String, value: String) {
    Column {
        Text(text = label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
