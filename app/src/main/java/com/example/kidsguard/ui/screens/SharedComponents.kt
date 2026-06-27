package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.tracking.TrackingConfig
import com.example.kidsguard.tracking.TrackingState
import com.example.kidsguard.update.AppUpdateInfo

@Composable
fun ControlRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ActionIconBtn(icon: ImageVector, label: String, color: Color, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clickable { onClick() }
            .padding(8.dp)
    ) {
        Surface(
            modifier = Modifier.size(48.dp),
            shape = RoundedCornerShape(12.dp),
            color = color.copy(alpha = 0.1f)
        ) {
            Icon(icon, contentDescription = label, tint = color, modifier = Modifier.padding(12.dp))
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun UpdateDialog(
    updateInfo: AppUpdateInfo,
    onUpdate: () -> Unit,
    onDismiss: () -> Unit
) {
    val isMandatory = updateInfo.mandatoryUpdate || updateInfo.forceUpdate
    AlertDialog(
        onDismissRequest = { if (!isMandatory) onDismiss() },
        title = { Text(if (isMandatory) "Update Required" else "Update Available") },
        text = {
            Column {
                Text(updateInfo.updateMessage)
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Version: ${updateInfo.latestVersionName}", style = MaterialTheme.typography.labelSmall)
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            updateInfo.releaseChannel.uppercase(),
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
                if (isMandatory) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("This update is mandatory to continue using the app.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                }
                
                if (updateInfo.releaseNotes.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("What's New:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    updateInfo.releaseNotes.forEach { note ->
                        Text("• $note", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onUpdate) {
                Text(if (isMandatory) "Update Now" else "Update Now")
            }
        },
        dismissButton = {
            if (!isMandatory) {
                TextButton(onClick = onDismiss) {
                    Text("Later")
                }
            }
        }
    )
}

@Composable
fun WhatsNewDialog(
    updateInfo: AppUpdateInfo,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Welcome to KidsGuard ${updateInfo.latestVersionName}") },
        text = {
            Column {
                Text("New Features", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                Spacer(modifier = Modifier.height(8.dp))
                updateInfo.releaseNotes.forEach { note ->
                    Text("• $note", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss) {
                Text("Awesome!")
            }
        }
    )
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

@Composable
fun StatusItem(label: String, value: String, active: Boolean = true) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            text = value, 
            style = MaterialTheme.typography.bodySmall, 
            fontWeight = FontWeight.Medium,
            color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
        )
    }
}
