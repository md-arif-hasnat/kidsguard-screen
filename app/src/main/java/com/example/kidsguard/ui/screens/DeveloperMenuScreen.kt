package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeveloperMenuScreen(
    onBack: () -> Unit,
    prefHelper: PreferenceHelper,
    repository: SafeZoneRepository,
    locationRepository: LocationRepository,
    onScreenChange: (Screen) -> Unit
) {
    var showConfirmDialog by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Developer Tools") },
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
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DeveloperActionItem(
                title = "Reset Role Selection",
                description = "Resets user role to NONE and clears pairing data.",
                onClick = { showConfirmDialog = "RESET_ROLE" }
            )
            DeveloperActionItem(
                title = "Clear Pairing Data",
                description = "Clears child ID, name, and pairing code.",
                onClick = { showConfirmDialog = "CLEAR_PAIRING" }
            )
            DeveloperActionItem(
                title = "Clear Activity History",
                description = "Deletes all events from the activity feed.",
                onClick = { showConfirmDialog = "CLEAR_ACTIVITY" }
            )
            DeveloperActionItem(
                title = "Clear Location History",
                description = "Deletes all recorded location points.",
                onClick = { showConfirmDialog = "CLEAR_LOCATION" }
            )
            DeveloperActionItem(
                title = "Clear Safe Zones",
                description = "Removes all defined safe zones.",
                onClick = { showConfirmDialog = "CLEAR_SAFEZONES" }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            DeveloperActionItem(
                title = "Force KidGuard Lock",
                description = "Immediately activate the lock screen.",
                color = MaterialTheme.colorScheme.error,
                onClick = {
                    prefHelper.isLocked = true
                    onScreenChange(Screen.Locked)
                }
            )
            DeveloperActionItem(
                title = "Force Unlock",
                description = "Immediately deactivate the lock screen.",
                color = Color.Green,
                onClick = {
                    prefHelper.isLocked = false
                    onScreenChange(Screen.Home)
                }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            Button(
                onClick = { showConfirmDialog = "RESET_ALL" },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("Reset Everything (Keep Security Settings)")
            }
        }

        if (showConfirmDialog != null) {
            AlertDialog(
                onDismissRequest = { showConfirmDialog = null },
                title = { Text("Confirm Action") },
                text = { Text("Are you sure you want to proceed? This action cannot be undone.") },
                confirmButton = {
                    Button(
                        onClick = {
                            when (showConfirmDialog) {
                                "RESET_ROLE" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                    onScreenChange(Screen.RoleSelection)
                                }
                                "CLEAR_PAIRING" -> {
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                }
                                "CLEAR_ACTIVITY" -> repository.clearEvents()
                                "CLEAR_LOCATION" -> locationRepository.clearLocationHistory()
                                "CLEAR_SAFEZONES" -> repository.clearAllSafeZones()
                                "RESET_ALL" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                    prefHelper.isLocked = false
                                    repository.clearEvents()
                                    repository.clearAllSafeZones()
                                    locationRepository.clearLocationHistory()
                                    onScreenChange(Screen.RoleSelection)
                                }
                            }
                            showConfirmDialog = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Confirm")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showConfirmDialog = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun DeveloperActionItem(
    title: String,
    description: String,
    color: Color = MaterialTheme.colorScheme.primary,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
            Text(text = description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
