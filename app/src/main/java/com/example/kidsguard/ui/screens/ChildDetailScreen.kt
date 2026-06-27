package com.example.kidsguard.ui.screens

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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncChildStatus
import com.example.kidsguard.repository.RemoteCommandRepository
import kotlinx.coroutines.flow.collectLatest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildDetailScreen(
    childId: String,
    syncProvider: RemoteSyncProvider,
    remoteCommandRepository: RemoteCommandRepository,
    onBack: () -> Unit,
    onOpenProtectionModes: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onOpenInternetProtection: () -> Unit
) {
    val statusState = remember { mutableStateOf<SyncChildStatus?>(null) }
    
    LaunchedEffect(childId) {
        syncProvider.getChildStatus(childId).collectLatest {
            statusState.value = it
        }
    }

    val status = statusState.value

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(status?.childName ?: "Child Detail") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (status == null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header Card
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Avatar placeholder
                        Surface(
                            modifier = Modifier.size(64.dp),
                            shape = androidx.compose.foundation.shape.CircleShape,
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Icon(
                                Icons.Default.Person, 
                                contentDescription = null, 
                                modifier = Modifier.padding(12.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(status.childName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Text(if (status.online) "Online Now" else "Offline", color = if (status.online) Color.Green else Color.Gray)
                        }
                    }
                }

                // Stats Row
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DetailStatCard(
                        label = "Battery",
                        value = "${status.batteryPercent}%",
                        icon = if (status.charging) Icons.Default.BatteryChargingFull else Icons.Default.BatteryFull,
                        modifier = Modifier.weight(1f)
                    )
                    DetailStatCard(
                        label = "Zone",
                        value = status.currentZone ?: "Outside",
                        icon = Icons.Default.LocationOn,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Quick Controls
                Text("Remote Actions", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionIconBtn(Icons.Default.Refresh, "Locate", MaterialTheme.colorScheme.primary) { 
                        remoteCommandRepository.sendRefreshLocation(childId)
                    }
                    ActionIconBtn(Icons.Default.VolumeUp, "Ring", MaterialTheme.colorScheme.secondary) {
                        remoteCommandRepository.sendRingDevice(childId)
                    }
                    ActionIconBtn(if (status.kidGuardActive) Icons.Default.LockOpen else Icons.Default.Lock, if (status.kidGuardActive) "Unlock" else "Lock", if (status.kidGuardActive) Color.Green else Color.Red) { 
                        if (status.kidGuardActive) remoteCommandRepository.sendUnlockDevice(childId) else remoteCommandRepository.sendLockDevice(childId)
                    }
                    ActionIconBtn(Icons.Default.Vibration, "Vibrate", Color.Gray) { 
                        remoteCommandRepository.sendVibrateDevice(childId)
                    }
                }

                Text("Protection Controls", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                
                ControlRow(
                    icon = Icons.Default.Shield,
                    title = "Automation Modes",
                    subtitle = "Manage School, Sleep, and Focus modes",
                    onClick = onOpenProtectionModes
                )

                ControlRow(
                    icon = Icons.Default.History,
                    title = "Location History",
                    subtitle = "View where they've been today",
                    onClick = onOpenLocationHistory
                )

                ControlRow(
                    icon = Icons.Default.PhonelinkLock,
                    title = "Screen Time",
                    subtitle = "App limits and usage reports",
                    onClick = { /* TODO */ }
                )

                ControlRow(
                    icon = Icons.Default.Public,
                    title = "Web Protection",
                    subtitle = "Content filtering and safe search",
                    onClick = onOpenInternetProtection
                )
                
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun DetailStatCard(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
    }
}
