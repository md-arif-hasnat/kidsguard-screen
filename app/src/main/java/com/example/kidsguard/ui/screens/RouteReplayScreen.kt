package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.RouteSession
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RouteReplayScreen(
    route: RouteSession,
    onBack: () -> Unit
) {
    val points = route.points
    val latLngs = remember(points) { points.map { LatLng(it.latitude, it.longitude) } }
    
    var currentPointIndex by remember { mutableStateOf(0) }
    var isPlaying by remember { mutableStateOf(false) }
    var replaySpeed by remember { mutableStateOf(1f) }
    
    val cameraPositionState = rememberCameraPositionState {
        if (latLngs.isNotEmpty()) {
            position = CameraPosition.fromLatLngZoom(latLngs.first(), 15f)
        }
    }

    // Auto-fit camera to route
    LaunchedEffect(latLngs) {
        if (latLngs.size > 1) {
            val bounds = LatLngBounds.builder().apply {
                latLngs.forEach { include(it) }
            }.build()
            cameraPositionState.animate(
                com.google.android.gms.maps.CameraUpdateFactory.newLatLngBounds(bounds, 100)
            )
        }
    }

    // Replay logic
    LaunchedEffect(isPlaying, currentPointIndex, replaySpeed) {
        if (isPlaying && currentPointIndex < points.size - 1) {
            val delayMillis = (1000 / replaySpeed).toLong()
            delay(delayMillis)
            currentPointIndex++
            
            // Optionally follow point with camera
            cameraPositionState.animate(
                com.google.android.gms.maps.CameraUpdateFactory.newLatLng(latLngs[currentPointIndex])
            )
        } else if (currentPointIndex >= points.size - 1) {
            isPlaying = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Route Replay") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(zoomControlsEnabled = false)
            ) {
                if (latLngs.isNotEmpty()) {
                    Polyline(
                        points = latLngs,
                        color = Color.Blue,
                        width = 5f
                    )
                    
                    // Start Marker
                    Marker(
                        state = rememberMarkerState(position = latLngs.first()),
                        title = "Start",
                        icon = com.google.android.gms.maps.model.BitmapDescriptorFactory.defaultMarker(
                            com.google.android.gms.maps.model.BitmapDescriptorFactory.HUE_GREEN
                        )
                    )
                    
                    // End Marker
                    Marker(
                        state = rememberMarkerState(position = latLngs.last()),
                        title = "End",
                        icon = com.google.android.gms.maps.model.BitmapDescriptorFactory.defaultMarker(
                            com.google.android.gms.maps.model.BitmapDescriptorFactory.HUE_RED
                        )
                    )
                    
                    // Current Replay Marker
                    Marker(
                        state = rememberMarkerState(position = latLngs[currentPointIndex]),
                        title = "Replay position",
                        icon = com.google.android.gms.maps.model.BitmapDescriptorFactory.defaultMarker(
                            com.google.android.gms.maps.model.BitmapDescriptorFactory.HUE_AZURE
                        )
                    )
                }
            }

            // Controls Overlay
            ReplayControls(
                modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
                isPlaying = isPlaying,
                onTogglePlay = { isPlaying = !isPlaying },
                onRestart = { 
                    currentPointIndex = 0
                    isPlaying = true
                },
                currentSpeed = replaySpeed,
                onSpeedChange = { replaySpeed = it },
                currentPoint = points[currentPointIndex],
                totalPoints = points.size,
                currentIndex = currentPointIndex
            )
        }
    }
}

@Composable
fun ReplayControls(
    modifier: Modifier = Modifier,
    isPlaying: Boolean,
    onTogglePlay: () -> Unit,
    onRestart: () -> Unit,
    currentSpeed: Float,
    onSpeedChange: (Float) -> Unit,
    currentPoint: com.example.kidsguard.models.LocationPoint,
    totalPoints: Int,
    currentIndex: Int
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onRestart) {
                    Icon(Icons.Default.Refresh, contentDescription = "Restart")
                }
                
                Button(onClick = onTogglePlay, shape = CircleShape) {
                    Icon(if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = null)
                    Text(if (isPlaying) "Pause" else "Play")
                }
                
                Row {
                    listOf(1f, 2f, 5f).forEach { speed ->
                        FilterChip(
                            selected = currentSpeed == speed,
                            onClick = { onSpeedChange(speed) },
                            label = { Text("${speed.toInt()}x") },
                            modifier = Modifier.padding(horizontal = 2.dp)
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            LinearProgressIndicator(
                progress = { (currentIndex + 1).toFloat() / totalPoints },
                modifier = Modifier.fillMaxWidth(),
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Time: ${sdf.format(Date(currentPoint.timestamp))}", style = MaterialTheme.typography.bodySmall)
                Text("Speed: ${"%.1f".format(currentPoint.speed * 3.6)} km/h", style = MaterialTheme.typography.bodySmall)
                Text("${currentIndex + 1} / $totalPoints", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
