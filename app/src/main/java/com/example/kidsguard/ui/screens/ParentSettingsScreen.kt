package com.example.kidsguard.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.sync.RemoteSyncProvider

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentSettingsScreen(
    onBack: () -> Unit,
    prefHelper: PreferenceHelper,
    authRepository: AuthRepository,
    onLogout: () -> Unit
) {
    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Parent Settings") },
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Profile Section
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Parent Profile", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Email: ${com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email ?: "N/A"}")
                    Text("Family ID: ${prefHelper.familyId ?: "None"}", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                }
            }

            // App Settings
            Text("General", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            
            ListItem(
                headlineContent = { Text("Push Notifications") },
                supportingContent = { Text("Alerts for SOS and Safe Zones") },
                trailingContent = { Switch(checked = true, onCheckedChange = {}) }
            )

            ListItem(
                headlineContent = { Text("Biometric Lock") },
                supportingContent = { Text("Require fingerprint to open parent app") },
                trailingContent = { Switch(checked = false, onCheckedChange = {}) }
            )

            // Privacy
            Text("Privacy \u0026 Compliance", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            
            ControlRow(
                icon = Icons.Default.Download,
                title = "Export Family Data",
                subtitle = "Download all telemetry and logs",
                onClick = { /* TODO */ }
            )

            ControlRow(
                icon = Icons.Default.DeleteForever,
                title = "Delete Account",
                subtitle = "Permanently remove your profile",
                onClick = { /* TODO */ }
            )

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = { showLogoutDialog = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Icon(Icons.Default.Logout, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Logout")
            }
        }

        if (showLogoutDialog) {
            AlertDialog(
                onDismissRequest = { showLogoutDialog = false },
                title = { Text("Logout") },
                text = { Text("Are you sure you want to logout from KidsGuard Parent?") },
                confirmButton = {
                    Button(onClick = {
                        showLogoutDialog = false
                        onLogout()
                    }) {
                        Text("Logout")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showLogoutDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
