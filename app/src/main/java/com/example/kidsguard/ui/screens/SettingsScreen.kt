package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.security.PinSecurity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, prefHelper: PreferenceHelper) {
    var newPin by remember { mutableStateOf("") }
    var confirmPin by remember { mutableStateOf("") }
    var pinMessage by remember { mutableStateOf<String?>(null) }
    var pinMessageIsError by remember { mutableStateOf(false) }
    var isSavingPin by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Settings") },
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
                .imePadding()
                .navigationBarsPadding()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Identity", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            
            OutlinedTextField(
                value = prefHelper.childName,
                onValueChange = { prefHelper.childName = it },
                label = { Text("Child Name") },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Person, null) }
            )

            Text("Security", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)

            OutlinedTextField(
                value = newPin,
                onValueChange = {
                    if (it.length <= PinSecurity.MAX_PIN_LENGTH && it.all(Char::isDigit)) {
                        newPin = it
                        pinMessage = null
                    }
                },
                label = { Text("New parent PIN (4–8 digits)") },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Lock, null) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                singleLine = true,
                enabled = !isSavingPin
            )

            OutlinedTextField(
                value = confirmPin,
                onValueChange = {
                    if (it.length <= PinSecurity.MAX_PIN_LENGTH && it.all(Char::isDigit)) {
                        confirmPin = it
                        pinMessage = null
                    }
                },
                label = { Text("Confirm new PIN") },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Lock, null) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                singleLine = true,
                enabled = !isSavingPin
            )

            pinMessage?.let { message ->
                Text(
                    text = message,
                    color = if (pinMessageIsError) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    },
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Button(
                onClick = {
                    when {
                        !PinSecurity.isValidPin(newPin) -> {
                            pinMessageIsError = true
                            pinMessage = "PIN must contain 4 to 8 digits."
                        }
                        newPin != confirmPin -> {
                            pinMessageIsError = true
                            pinMessage = "PINs do not match."
                        }
                        else -> {
                            isSavingPin = true
                            coroutineScope.launch {
                                val saved = withContext(Dispatchers.Default) {
                                    prefHelper.changePin(newPin)
                                }
                                isSavingPin = false
                                pinMessageIsError = !saved
                                pinMessage = if (saved) {
                                    newPin = ""
                                    confirmPin = ""
                                    "Parent PIN changed securely."
                                } else {
                                    "Could not change the PIN."
                                }
                            }
                        }
                    }
                },
                enabled = !isSavingPin
            ) {
                Text(if (isSavingPin) "Saving…" else "Change PIN")
            }

            ListItem(
                headlineContent = { Text("Volume Up Unlock") },
                supportingContent = { Text("Tap volume up 4 times to emergency unlock") },
                trailingContent = { 
                    Switch(checked = prefHelper.isVolumeUnlockEnabled, onCheckedChange = { prefHelper.isVolumeUnlockEnabled = it }) 
                }
            )

            Text("Protection", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)

            ListItem(
                headlineContent = { Text("Lock Schedule") },
                supportingContent = {
                    Text(
                        if (prefHelper.isScheduleEnabled) {
                            "${prefHelper.scheduleStartTime} – ${prefHelper.scheduleEndTime} · Managed by parent"
                        } else {
                            "Off · Managed by parent"
                        }
                    )
                },
                trailingContent = {
                    Switch(
                        checked = prefHelper.isScheduleEnabled,
                        onCheckedChange = null,
                        enabled = false
                    )
                }
            )
        }
    }
}
