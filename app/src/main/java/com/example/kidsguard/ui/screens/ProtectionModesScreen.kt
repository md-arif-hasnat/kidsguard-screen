package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.ProtectionModeDoc
import com.example.kidsguard.repository.ProtectionModeRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProtectionModesScreen(
    childId: String,
    repository: ProtectionModeRepository,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val modes by repository.listenToModes(childId).collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Protection Modes") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Add new mode */ }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Mode")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (modes.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No protection modes configured.", color = Color.Gray)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(modes) { mode ->
                    ModeCard(mode) {
                        scope.launch {
                            repository.saveMode(childId, mode.copy(enabled = !mode.enabled))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ModeCard(mode: ProtectionModeDoc, onToggle: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (mode.enabled) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Shield,
                contentDescription = null,
                tint = if (mode.enabled) MaterialTheme.colorScheme.primary else Color.Gray,
                modifier = Modifier.alpha(if (mode.enabled) 1f else 0.5f)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(mode.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(mode.type, style = MaterialTheme.typography.labelSmall)
                val schedule = mode.schedule
                if (schedule != null) {
                    Text("${schedule.startTime} - ${schedule.endTime}", style = MaterialTheme.typography.bodySmall)
                }
            }
            Switch(checked = mode.enabled, onCheckedChange = { onToggle() })
        }
    }
}
