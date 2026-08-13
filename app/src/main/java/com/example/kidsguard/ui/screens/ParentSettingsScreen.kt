package com.example.kidsguard.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AuthRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentSettingsScreen(
    onBack: () -> Unit,
    prefHelper: PreferenceHelper,
    authRepository: AuthRepository,
    onLogout: () -> Unit
) {
    var showLogoutDialog by remember {
        mutableStateOf(false)
    }
    var showExportDataDialog by remember {
        mutableStateOf(false)
    }

    var showDeleteAccountDialog by remember {
        mutableStateOf(false)
    }
    var isExportingData by remember {
        mutableStateOf(false)
    }

    var exportDataError by remember {
        mutableStateOf<String?>(null)
    }

    var isDeletingAccount by remember {
        mutableStateOf(false)
    }

    var deleteAccountError by remember {
        mutableStateOf<String?>(null)
    }

    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

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
                    Text(
                        "Parent Profile",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Email: ${com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email ?: "N/A"}")
                    Text(
                        "Family ID: ${prefHelper.familyId ?: "None"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                }
            }

            // App Settings
            Text(
                "General",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

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
            Text(
                "Privacy \u0026 Compliance",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            ControlRow(
                icon = Icons.Default.Download,
                title = "Export Family Data",
                subtitle = "Download all telemetry and logs",
                onClick = {
                    showExportDataDialog = true
                }
            )

            ControlRow(
                icon = Icons.Default.DeleteForever,
                title = "Delete Account",
                subtitle = "Permanently remove your profile",
                onClick = {
                    showDeleteAccountDialog = true
                }
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
        if (showExportDataDialog) {
            AlertDialog(
                onDismissRequest = {
                    if (!isExportingData) {
                        showExportDataDialog = false
                        exportDataError = null
                    }
                },
                icon = {
                    Icon(
                        Icons.Default.Download,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                },
                title = {
                    Text("Export Family Data?")
                },
                text = {
                    Column(
                        verticalArrangement =
                            Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            "KidsGuard will prepare a copy of your family data, including child profiles, devices, locations, alerts and activity records."
                        )

                        Text(
                            "Only the Family Owner can request this export.",
                            fontWeight = FontWeight.Bold
                        )

                        exportDataError?.let { message ->
                            Text(
                                text = message,
                                color =
                                    MaterialTheme.colorScheme.error
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        enabled = !isExportingData,
                        onClick = {
                            coroutineScope.launch {
                                isExportingData = true
                                exportDataError = null

                                authRepository
                                    .requestFamilyDataExport()
                                    .onSuccess { exportResult ->
                                        try {
                                            val downloadIntent = Intent(
                                                Intent.ACTION_VIEW,
                                                Uri.parse(
                                                    exportResult.downloadUrl
                                                )
                                            )

                                            context.startActivity(
                                                downloadIntent
                                            )

                                            showExportDataDialog = false
                                        } catch (e: Exception) {
                                            exportDataError =
                                                "The download link could not be opened."
                                        }
                                    }
                                    .onFailure { error ->
                                        exportDataError =
                                            error.message
                                                ?: "Family data export failed."
                                    }

                                isExportingData = false
                            }
                        }
                    ) {
                        if (isExportingData) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Prepare Export")
                        }
                    }
                },
                dismissButton = {
                    TextButton(
                        enabled = !isExportingData,
                        onClick = {
                            showExportDataDialog = false
                            exportDataError = null
                        }
                    ) {
                        Text("Cancel")
                    }
                }
            )
        }

        if (showDeleteAccountDialog) {
            AlertDialog(
                onDismissRequest = {
                    if (!isDeletingAccount) {
                        showDeleteAccountDialog = false
                        deleteAccountError = null
                    }
                },
                icon = {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                },
                title = {
                    Text("Schedule Account Deletion?")
                },
                text = {
                    Column(
                        verticalArrangement =
                            Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            "Your family account and all connected child data will be permanently deleted after 30 days."
                        )
                        Text(
                            "Sign in again within 30 days to cancel the deletion."
                        )
                        Text(
                            "Only the family owner can request this action.",
                            fontWeight = FontWeight.Bold
                        )

                        deleteAccountError?.let { message ->
                            Text(
                                text = message,
                                color =
                                    MaterialTheme.colorScheme.error
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        enabled = !isDeletingAccount,
                        colors = ButtonDefaults.buttonColors(
                            containerColor =
                                MaterialTheme.colorScheme.error
                        ),
                        onClick = {
                            coroutineScope.launch {
                                isDeletingAccount = true
                                deleteAccountError = null

                                val result =
                                    authRepository
                                        .requestFamilyDeletion()

                                result.fold(
                                    onSuccess = {
                                        isDeletingAccount = false
                                        showDeleteAccountDialog =
                                            false
                                        onLogout()
                                    },
                                    onFailure = { error ->
                                        isDeletingAccount = false
                                        deleteAccountError =
                                            error.message
                                                ?: "Deletion request failed."
                                    }
                                )
                            }
                        }
                    ) {
                        if (isDeletingAccount) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onError
                            )
                            Spacer(
                                modifier = Modifier.width(8.dp)
                            )
                        }
                        Text("Schedule Deletion")
                    }
                },
                dismissButton = {
                    TextButton(
                        enabled = !isDeletingAccount,
                        onClick = {
                            showDeleteAccountDialog = false
                            deleteAccountError = null
                        }
                    ) {
                        Text("Cancel")
                    }
                }
            )
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
