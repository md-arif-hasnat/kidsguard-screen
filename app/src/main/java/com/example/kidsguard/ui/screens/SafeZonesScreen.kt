package com.example.kidsguard.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.SafeZone
import com.example.kidsguard.repository.SafeZoneRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeZoneListScreen(repository: SafeZoneRepository, onBack: () -> Unit) {
    val safeZones by repository.safeZones.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var zoneToEdit by remember { mutableStateOf<SafeZone?>(null) }
    var zoneToDelete by remember { mutableStateOf<SafeZone?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Safe Zones") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Safe Zone")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(safeZones) { zone ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    ListItem(
                        headlineContent = { Text(zone.name, fontWeight = FontWeight.Bold) },
                        supportingContent = { 
                            Column {
                                Text("Type: ${zone.type}")
                                Text("Radius: ${zone.radiusMeters.toInt()}m")
                            }
                        },
                        leadingContent = {
                            val icon = when (zone.type) {
                                "Home" -> Icons.Default.Home
                                "School" -> Icons.Default.School
                                "Playground" -> Icons.Default.SportsBaseball
                                "Mosque" -> Icons.Default.Place
                                "Grandma" -> Icons.Default.Person
                                else -> Icons.Default.LocationOn
                            }
                            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        },
                        trailingContent = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Switch(
                                    checked = zone.enabled,
                                    onCheckedChange = {
                                        repository.updateSafeZone(zone.copy(enabled = it))
                                    }
                                )
                                IconButton(onClick = { zoneToEdit = zone }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Edit")
                                }
                                IconButton(onClick = { zoneToDelete = zone }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    )
                }
            }
        }

        if (showAddDialog) {
            SafeZoneEditDialog(
                onDismiss = { showAddDialog = false },
                onSave = { newZone ->
                    repository.addSafeZone(newZone)
                    showAddDialog = false
                }
            )
        }

        if (zoneToEdit != null) {
            SafeZoneEditDialog(
                initialZone = zoneToEdit,
                onDismiss = { zoneToEdit = null },
                onSave = { updatedZone ->
                    repository.updateSafeZone(updatedZone)
                    zoneToEdit = null
                }
            )
        }

        if (zoneToDelete != null) {
            AlertDialog(
                onDismissRequest = { zoneToDelete = null },
                title = { Text("Delete Safe Zone") },
                text = { Text("Are you sure you want to delete '${zoneToDelete?.name}'?") },
                confirmButton = {
                    Button(
                        onClick = {
                            zoneToDelete?.id?.let { repository.deleteSafeZone(it) }
                            zoneToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Delete")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { zoneToDelete = null }) { Text("Cancel") }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeZoneEditDialog(
    initialZone: SafeZone? = null,
    onDismiss: () -> Unit,
    onSave: (SafeZone) -> Unit
) {
    var name by remember { mutableStateOf(initialZone?.name ?: "") }
    var type by remember { mutableStateOf(initialZone?.type ?: "Home") }
    var radius by remember { mutableFloatStateOf(initialZone?.radiusMeters?.toFloat() ?: 500f) }
    var notifyOnEnter by remember { mutableStateOf(initialZone?.notifyOnEnter ?: true) }
    var notifyOnExit by remember { mutableStateOf(initialZone?.notifyOnExit ?: true) }
    var enabled by remember { mutableStateOf(initialZone?.enabled ?: true) }
    
    var typeMenuExpanded by remember { mutableStateOf(false) }
    val zoneTypes = listOf("Home", "School", "Playground", "Mosque", "Grandma", "Custom")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialZone == null) "Add Safe Zone" else "Edit Safe Zone") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Map Placeholder
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .background(Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Map, contentDescription = null, tint = Color.White)
                        Text("Map picker will be added later", color = Color.White, style = MaterialTheme.typography.bodySmall)
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Zone Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                ExposedDropdownMenuBox(
                    expanded = typeMenuExpanded,
                    onExpandedChange = { typeMenuExpanded = !typeMenuExpanded }
                ) {
                    OutlinedTextField(
                        value = type,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Zone Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeMenuExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = typeMenuExpanded,
                        onDismissRequest = { typeMenuExpanded = false }
                    ) {
                        zoneTypes.forEach { selectionOption ->
                            DropdownMenuItem(
                                text = { Text(selectionOption) },
                                onClick = {
                                    type = selectionOption
                                    typeMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                Column {
                    Text("Radius: ${radius.toInt()}m", style = MaterialTheme.typography.bodyMedium)
                    Slider(
                        value = radius,
                        onValueChange = { radius = it },
                        valueRange = 50f..5000f,
                        steps = 99
                    )
                }

                ListItem(
                    headlineContent = { Text("Notify on Enter") },
                    trailingContent = {
                        Switch(checked = notifyOnEnter, onCheckedChange = { notifyOnEnter = it })
                    }
                )

                ListItem(
                    headlineContent = { Text("Notify on Exit") },
                    trailingContent = {
                        Switch(checked = notifyOnExit, onCheckedChange = { notifyOnExit = it })
                    }
                )

                ListItem(
                    headlineContent = { Text("Enabled") },
                    trailingContent = {
                        Switch(checked = enabled, onCheckedChange = { enabled = it })
                    }
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val zone = (initialZone ?: SafeZone(name = name, latitude = 0.0, longitude = 0.0, radiusMeters = radius.toDouble())).copy(
                            name = name,
                            type = type,
                            radiusMeters = radius.toDouble(),
                            notifyOnEnter = notifyOnEnter,
                            notifyOnExit = notifyOnExit,
                            enabled = enabled
                        )
                        onSave(zone)
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
