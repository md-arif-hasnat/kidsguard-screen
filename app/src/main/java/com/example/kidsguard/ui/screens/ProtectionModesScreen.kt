package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.ProtectionModeDoc
import com.example.kidsguard.models.ProtectionModeSchedule
import com.example.kidsguard.repository.ProtectionModeRepository
import kotlinx.coroutines.launch

private val protectionModeTypes = listOf(
    "SCHOOL",
    "HOMEWORK",
    "SLEEP",
    "FOCUS",
    "FREE_TIME",
    "EMERGENCY"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProtectionModesScreen(
    childId: String,
    repository: ProtectionModeRepository,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val modes by repository.listenToModes(childId).collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var modeToDelete by remember { mutableStateOf<ProtectionModeDoc?>(null) }
    var working by remember { mutableStateOf(false) }

    fun save(mode: ProtectionModeDoc, message: String) {
        working = true
        scope.launch {
            try {
                repository.saveMode(childId, mode)
                snackbarHostState.showSnackbar(message)
            } catch (error: Exception) {
                snackbarHostState.showSnackbar(error.message ?: "The protection mode could not be saved.")
            } finally {
                working = false
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Protection Modes") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(enabled = !working, onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add protection mode")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (modes.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No protection modes configured.", color = Color.Gray)
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Create Mode")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(modes, key = { it.id }) { mode ->
                    ModeCard(
                        mode = mode,
                        enabled = !working,
                        onToggle = {
                            save(mode.copy(enabled = !mode.enabled), "Protection mode updated")
                        },
                        onDelete = { modeToDelete = mode }
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        AddProtectionModeDialog(
            onDismiss = { showAddDialog = false },
            onCreate = { mode ->
                showAddDialog = false
                save(mode, "Protection mode created")
            }
        )
    }

    modeToDelete?.let { mode ->
        AlertDialog(
            onDismissRequest = { modeToDelete = null },
            title = { Text("Delete ${mode.name}?") },
            text = { Text("This protection mode and its schedule will be removed.") },
            confirmButton = {
                TextButton(
                    enabled = !working,
                    onClick = {
                        modeToDelete = null
                        working = true
                        scope.launch {
                            try {
                                repository.deleteMode(childId, mode.id)
                                snackbarHostState.showSnackbar("Protection mode deleted")
                            } catch (error: Exception) {
                                snackbarHostState.showSnackbar(
                                    error.message ?: "The protection mode could not be deleted."
                                )
                            } finally {
                                working = false
                            }
                        }
                    }
                ) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { modeToDelete = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun ModeCard(
    mode: ProtectionModeDoc,
    enabled: Boolean,
    onToggle: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (mode.enabled) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Default.Shield,
                contentDescription = null,
                tint = if (mode.enabled) MaterialTheme.colorScheme.primary else Color.Gray,
                modifier = Modifier.alpha(if (mode.enabled) 1f else 0.5f)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(mode.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(mode.type.replace('_', ' '), style = MaterialTheme.typography.labelSmall)
                mode.schedule?.let { schedule ->
                    Text(
                        "${schedule.startTime} - ${schedule.endTime}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                if (mode.lockDevice) {
                    Text("Locks device", style = MaterialTheme.typography.bodySmall)
                }
            }
            IconButton(enabled = enabled, onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete ${mode.name}")
            }
            Switch(checked = mode.enabled, enabled = enabled, onCheckedChange = { onToggle() })
        }
    }
}

@Composable
private fun AddProtectionModeDialog(
    onDismiss: () -> Unit,
    onCreate: (ProtectionModeDoc) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("SCHOOL") }
    var startTime by remember { mutableStateOf("08:00") }
    var endTime by remember { mutableStateOf("15:00") }
    var enabled by remember { mutableStateOf(true) }
    var lockDevice by remember { mutableStateOf(false) }
    var limitMinutes by remember { mutableStateOf("") }
    var typeMenuOpen by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Protection Mode") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Mode name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Box {
                    OutlinedButton(onClick = { typeMenuOpen = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Type: ${type.replace('_', ' ')}")
                    }
                    DropdownMenu(expanded = typeMenuOpen, onDismissRequest = { typeMenuOpen = false }) {
                        protectionModeTypes.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option.replace('_', ' ')) },
                                onClick = {
                                    type = option
                                    typeMenuOpen = false
                                }
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = startTime,
                        onValueChange = { startTime = it },
                        label = { Text("Start (HH:mm)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = endTime,
                        onValueChange = { endTime = it },
                        label = { Text("End (HH:mm)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = limitMinutes,
                    onValueChange = { limitMinutes = it.filter(Char::isDigit) },
                    label = { Text("Screen limit minutes (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                SettingSwitch("Enable immediately", enabled) { enabled = it }
                SettingSwitch("Lock device during this mode", lockDevice) { lockDevice = it }

                validationError?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val timePattern = Regex("^(?:[01]\\d|2[0-3]):[0-5]\\d$")
                val parsedLimit = limitMinutes.toIntOrNull()
                validationError = when {
                    name.isBlank() -> "Enter a mode name."
                    !timePattern.matches(startTime) || !timePattern.matches(endTime) ->
                        "Use 24-hour HH:mm time, for example 08:30."
                    limitMinutes.isNotBlank() && (parsedLimit == null || parsedLimit <= 0) ->
                        "Screen limit must be greater than zero."
                    else -> null
                }

                if (validationError == null) {
                    onCreate(
                        ProtectionModeDoc(
                            name = name.trim(),
                            type = type,
                            enabled = enabled,
                            schedule = ProtectionModeSchedule(
                                days = listOf(0, 1, 2, 3, 4, 5, 6),
                                startTime = startTime,
                                endTime = endTime
                            ),
                            screenTimeLimitMinutes = parsedLimit,
                            lockDevice = lockDevice
                        )
                    )
                }
            }) { Text("Create") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun SettingSwitch(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
