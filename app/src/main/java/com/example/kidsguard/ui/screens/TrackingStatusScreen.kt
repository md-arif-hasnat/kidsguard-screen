package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackingStatusScreen(
    onBack: () -> Unit,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    locationRepository: LocationRepository
) {
    val trackingState by trackingRepository.currentState.collectAsState()
    val trackingConfig by trackingRepository.currentConfig.collectAsState()
    val lastLocation by locationRepository.locationHistory.collectAsState()
    
    val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tracking Status") },
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.GpsFixed,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Background Monitoring",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            TrackingStatusCard(
                state = trackingState,
                config = trackingConfig,
                onStart = { trackingManager.startTracking() },
                onStop = { trackingManager.stopTracking() },
                onPause = { trackingManager.pauseTracking() },
                onResume = { trackingManager.resumeTracking() }
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Last GPS Signal", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    val location = lastLocation.firstOrNull()
                    if (location != null) {
                        Text("Time: ${sdf.format(Date(location.timestamp))}", style = MaterialTheme.typography.bodyMedium)
                        Text("Coords: ${"%.5f".format(location.latitude)}, ${"%.5f".format(location.longitude)}", style = MaterialTheme.typography.bodyMedium)
                        Text("Accuracy: ±${location.accuracy.toInt()}m", style = MaterialTheme.typography.bodyMedium)
                    } else {
                        Text("No location captured yet", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            Text(
                text = "Tracking allows your parent to see your location for safety.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }
    }
}
