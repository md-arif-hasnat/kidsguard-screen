package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, prefHelper: PreferenceHelper) {
    var pin by remember { mutableStateOf(prefHelper.pin) }
    var secretTapsCount by remember { mutableFloatStateOf(prefHelper.secretTapsCount.toFloat()) }
    var secretTapsEnabled by remember { mutableStateOf(prefHelper.isSecretTapsEnabled) }
    var volumeUnlockEnabled by remember { mutableStateOf(prefHelper.isVolumeUnlockEnabled) }
    var showPinChangeDialog by remember { mutableStateOf(false) }

    var isScheduleEnabled by remember { mutableStateOf(prefHelper.isScheduleEnabled) }
    var startTime by remember { mutableStateOf(prefHelper.scheduleStartTime) }
    var endTime by remember { mutableStateOf(prefHelper.scheduleEndTime) }

    var isSafeZoneNotify by remember { mutableStateOf(prefHelper.isSafeZoneNotificationsEnabled) }
    var isTrackingNotify by remember { mutableStateOf(prefHelper.isTrackingNotificationsEnabled) }
    var isBatteryNotify by remember { mutableStateOf(prefHelper.isBatteryNotificationsEnabled) }
    var isSosNotify by remember { mutableStateOf(prefHelper.isSosNotificationsEnabled) }

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
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text("Security", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            ListItem(
                headlineContent = { Text("Change Unlock PIN") },
                supportingContent = { Text("Current PIN is required to unlock or access settings") },
                trailingContent = {
                    Button(onClick = { showPinChangeDialog = true }) {
                        Text("Change")
                    }
                }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
            
            Text("Unlock Options", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            
            ListItem(
                headlineContent = { Text("Enable Volume Unlock") },
                supportingContent = { Text("Press Volume Up 4 times within 5s to unlock") },
                trailingContent = {
                    Switch(
                        checked = volumeUnlockEnabled,
                        onCheckedChange = { 
                            volumeUnlockEnabled = it
                            prefHelper.isVolumeUnlockEnabled = it
                        }
                    )
                }
            )

            ListItem(
                headlineContent = { Text("Enable Secret Tap Unlock") },
                supportingContent = { Text("Tap top-left corner multiple times to unlock") },
                trailingContent = {
                    Switch(
                        checked = secretTapsEnabled,
                        onCheckedChange = { 
                            secretTapsEnabled = it
                            prefHelper.isSecretTapsEnabled = it
                        }
                    )
                }
            )
            
            if (secretTapsEnabled) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("Secret Unlock Taps: ${secretTapsCount.toInt()}")
                Slider(
                    value = secretTapsCount,
                    onValueChange = { 
                        secretTapsCount = it
                        prefHelper.secretTapsCount = it.toInt()
                    },
                    valueRange = 3f..10f,
                    steps = 6
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

            Text("Schedule", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            
            ListItem(
                headlineContent = { Text("Enable Scheduled Lock") },
                supportingContent = { Text("Auto-lock device between specific times") },
                trailingContent = {
                    Switch(
                        checked = isScheduleEnabled,
                        onCheckedChange = { 
                            isScheduleEnabled = it
                            prefHelper.isScheduleEnabled = it
                        }
                    )
                }
            )

            if (isScheduleEnabled) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Start Time", style = MaterialTheme.typography.labelLarge)
                        OutlinedTextField(
                            value = startTime,
                            onValueChange = { 
                                startTime = it
                                prefHelper.scheduleStartTime = it
                            },
                            placeholder = { Text("22:00") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("End Time", style = MaterialTheme.typography.labelLarge)
                        OutlinedTextField(
                            value = endTime,
                            onValueChange = { 
                                endTime = it
                                prefHelper.scheduleEndTime = it
                            },
                            placeholder = { Text("07:00") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                Text(
                    text = "Use 24h format (HH:mm)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

            Text("Notifications", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))

            ListItem(
                headlineContent = { Text("Safe Zone Alerts") },
                supportingContent = { Text("Notify when child enters or leaves safe zones") },
                trailingContent = {
                    Switch(
                        checked = isSafeZoneNotify,
                        onCheckedChange = {
                            isSafeZoneNotify = it
                            prefHelper.isSafeZoneNotificationsEnabled = it
                        }
                    )
                }
            )

            ListItem(
                headlineContent = { Text("Tracking Status") },
                supportingContent = { Text("Notify when tracking starts or stops") },
                trailingContent = {
                    Switch(
                        checked = isTrackingNotify,
                        onCheckedChange = {
                            isTrackingNotify = it
                            prefHelper.isTrackingNotificationsEnabled = it
                        }
                    )
                }
            )

            ListItem(
                headlineContent = { Text("Battery Alerts") },
                supportingContent = { Text("Notify when child device battery is low") },
                trailingContent = {
                    Switch(
                        checked = isBatteryNotify,
                        onCheckedChange = {
                            isBatteryNotify = it
                            prefHelper.isBatteryNotificationsEnabled = it
                        }
                    )
                }
            )

            ListItem(
                headlineContent = { Text("SOS Alerts") },
                supportingContent = { Text("Notify during emergency events") },
                trailingContent = {
                    Switch(
                        checked = isSosNotify,
                        onCheckedChange = {
                            isSosNotify = it
                            prefHelper.isSosNotificationsEnabled = it
                        }
                    )
                }
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
            
            Text("Privacy Policy", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "KidsGuard Screen locks your device for children. We do not collect, store, or share any personal data or usage information.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

            Text("Account", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            ListItem(
                headlineContent = { Text("Switch Role") },
                supportingContent = { Text("Current role: ${prefHelper.userRole}") },
                trailingContent = {
                    TextButton(onClick = { 
                        prefHelper.userRole = "NONE"
                        onBack() // This will trigger redirection to RoleSelection
                    }) {
                        Text("Reset")
                    }
                }
            )
        }

        if (showPinChangeDialog) {
            var newPin by remember { mutableStateOf("") }
            var confirmPin by remember { mutableStateOf("") }
            var isError by remember { mutableStateOf(false) }

            AlertDialog(
                onDismissRequest = { showPinChangeDialog = false },
                title = { Text("Change PIN") },
                text = {
                    Column {
                        OutlinedTextField(
                            value = newPin,
                            onValueChange = {
                                if (it.length <= 8 && it.all { c -> c.isDigit() }) {
                                    newPin = it
                                    isError = false
                                }
                            },
                            label = { Text("Enter New PIN") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = confirmPin,
                            onValueChange = {
                                if (it.length <= 8 && it.all { c -> c.isDigit() }) {
                                    confirmPin = it
                                    isError = false
                                }
                            },
                            label = { Text("Confirm New PIN") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            visualTransformation = PasswordVisualTransformation(),
                            isError = isError,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (isError) {
                            Text(
                                text = "PINs do not match",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(start = 16.dp, top = 4.dp)
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newPin.isNotEmpty() && newPin == confirmPin) {
                                prefHelper.pin = newPin
                                pin = newPin
                                showPinChangeDialog = false
                            } else {
                                isError = true
                            }
                        }
                    ) {
                        Text("Save")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showPinChangeDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
