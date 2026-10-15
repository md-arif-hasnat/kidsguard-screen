package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncWellbeingSettings
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenTimeScreen(
    childId: String,
    syncProvider: RemoteSyncProvider,
    onBack: () -> Unit
) {
    val settings by syncProvider.getWellbeingSettings(childId).collectAsState(initial = null)
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    var enabled by remember { mutableStateOf(false) }
    var minutes by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(settings) {
        settings?.let {
            enabled = it.totalLimitEnabled
            minutes = it.dailyTotalLimitMinutes?.toString().orEmpty()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Screen Time") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (settings == null) {
            Box(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Icon(
                        Icons.Default.Schedule,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Daily total limit",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "When the child reaches this total app-usage limit, non-emergency apps are blocked for the rest of the day.",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    Spacer(modifier = Modifier.height(18.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Enable daily limit", fontWeight = FontWeight.SemiBold)
                        Switch(checked = enabled, enabled = !saving, onCheckedChange = { enabled = it })
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = minutes,
                        onValueChange = {
                            minutes = it.filter(Char::isDigit)
                            validationError = null
                        },
                        enabled = enabled && !saving,
                        label = { Text("Minutes per day") },
                        supportingText = { Text("Example: 120 minutes = 2 hours") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    validationError?.let {
                        Text(
                            it,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            Button(
                enabled = !saving,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val parsedMinutes = minutes.toIntOrNull()
                    if (enabled && (parsedMinutes == null || parsedMinutes !in 1..1440)) {
                        validationError = "Enter a daily limit between 1 and 1440 minutes."
                        return@Button
                    }

                    saving = true
                    scope.launch {
                        val current = settings ?: SyncWellbeingSettings()
                        val result = syncProvider.updateWellbeingSettings(
                            childId,
                            current.copy(
                                dailyTotalLimitMinutes = if (enabled) parsedMinutes else null,
                                totalLimitEnabled = enabled
                            )
                        )
                        saving = false
                        snackbarHostState.showSnackbar(
                            result.fold(
                                onSuccess = { "Screen time settings saved" },
                                onFailure = { it.message ?: "Screen time settings could not be saved." }
                            )
                        )
                    }
                }
            ) {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Save Screen Time")
            }
        }
    }
}
