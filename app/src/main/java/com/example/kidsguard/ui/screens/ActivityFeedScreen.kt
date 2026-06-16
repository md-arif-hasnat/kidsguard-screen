package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.example.kidsguard.repository.SafeZoneRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityFeedScreen(repository: SafeZoneRepository, onBack: () -> Unit) {
    val events by repository.activityEvents.collectAsState()
    var showClearDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Activity Feed") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showClearDialog = true }) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Clear History")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (events.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text("No recent activity", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(events) { event ->
                    val sdf = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
                    val timeString = sdf.format(Date(event.timestamp))
                    
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = timeString,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val icon = when (event.type) {
                                "KID_MODE_ENABLED", "APP_LOCKED" -> Icons.Default.Lock
                                "KID_MODE_DISABLED", "APP_UNLOCKED", "PIN_SUCCESS", "SECRET_TAP_UNLOCK", "VOLUME_UNLOCK" -> Icons.Default.LockOpen
                                "PIN_FAILED" -> Icons.Default.GppBad
                                "SAFE_ZONE_ENTER" -> Icons.Default.LocationOn
                                "SAFE_ZONE_EXIT" -> Icons.Default.Logout
                                "BATTERY_LOW" -> Icons.Default.BatteryAlert
                                else -> Icons.Default.Info
                            }
                            val tint = when (event.type) {
                                "KID_MODE_ENABLED", "APP_LOCKED" -> Color.Red
                                "KID_MODE_DISABLED", "APP_UNLOCKED", "PIN_SUCCESS" -> Color.Green
                                "PIN_FAILED" -> MaterialTheme.colorScheme.error
                                else -> MaterialTheme.colorScheme.primary
                            }
                            
                            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = event.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (event.description.isNotEmpty()) {
                            Text(
                                text = event.description,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(start = 32.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(modifier = Modifier.padding(start = 32.dp))
                    }
                }
            }
        }

        if (showClearDialog) {
            AlertDialog(
                onDismissRequest = { showClearDialog = false },
                title = { Text("Clear History") },
                text = { Text("Are you sure you want to delete all activity events?") },
                confirmButton = {
                    Button(
                        onClick = {
                            repository.clearEvents()
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
    }
}
