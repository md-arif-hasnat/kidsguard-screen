package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.SafeZoneRepository
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeZoneEditorScreen(
    zone: SafeZone?,
    repository: SafeZoneRepository,
    onBack: () -> Unit
) {
    var name by remember { mutableStateOf(zone?.name ?: "") }
    var type by remember { mutableStateOf(zone?.type ?: "Home") }
    var radius by remember { mutableFloatStateOf(zone?.radiusMeters?.toFloat() ?: 300f) }
    var location by remember { mutableStateOf(LatLng(zone?.latitude ?: 51.5074, zone?.longitude ?: -0.1278)) }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(location, 15f)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (zone == null) "New Safe Zone" else "Edit Safe Zone") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val newZone = SafeZone(
                            id = zone?.id ?: java.util.UUID.randomUUID().toString(),
                            name = name,
                            type = type,
                            latitude = location.latitude,
                            longitude = location.longitude,
                            radiusMeters = radius.toDouble(),
                            enabled = true
                        )
                        if (zone == null) repository.addSafeZone(newZone) else repository.updateSafeZone(newZone)
                        onBack()
                    }) {
                        Icon(Icons.Default.Save, contentDescription = "Save")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding).verticalScroll(rememberScrollState())) {
            Box(modifier = Modifier.fillMaxWidth().height(300.dp)) {
                GoogleMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = cameraPositionState,
                    onMapClick = { location = it }
                ) {
                    val markerState = rememberMarkerState(position = location)
                    LaunchedEffect(location) {
                        markerState.position = location
                    }
                    Marker(state = markerState)
                    Circle(
                        center = location,
                        radius = radius.toDouble(),
                        fillColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f),
                        strokeColor = MaterialTheme.colorScheme.primary,
                        strokeWidth = 2f
                    )
                }
            }

            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Zone Name") },
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Radius: ${radius.toInt()}m", style = MaterialTheme.typography.labelMedium)
                Slider(
                    value = radius,
                    onValueChange = { radius = it },
                    valueRange = 100f..1000f,
                    steps = 9
                )

                Text("Type", style = MaterialTheme.typography.labelMedium)
                val types = listOf("Home", "School", "Playground", "Custom")
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    types.forEach { t ->
                        FilterChip(
                            selected = type == t,
                            onClick = { type = t },
                            label = { Text(t) }
                        )
                    }
                }
            }
        }
    }
}
