package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Emergency
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.SosEvent
import com.example.kidsguard.models.SosStatus
import com.example.kidsguard.repository.SosRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SosHistoryScreen(
    repository: SosRepository,
    onBack: () -> Unit
) {
    val history by repository.sosHistory.collectAsState()
    val sdf = remember { SimpleDateFormat("MMM dd, HH:mm:ss", Locale.getDefault()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SOS History") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (history.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text("No SOS history found", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(history) { event ->
                    SosHistoryItem(event, sdf)
                }
            }
        }
    }
}

@Composable
fun SosHistoryItem(event: SosEvent, sdf: SimpleDateFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (event.status == SosStatus.ACTIVE) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = sdf.format(Date(event.timestamp)),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                StatusBadge(event.status)
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            if (event.latitude != null) {
                Text("Location: ${"%.5f".format(event.latitude)}, ${"%.5f".format(event.longitude)}", style = MaterialTheme.typography.bodySmall)
                Text("Accuracy: ±${event.accuracy?.toInt() ?: 0}m", style = MaterialTheme.typography.bodySmall)
            } else {
                Text("Location: Unknown", style = MaterialTheme.typography.bodySmall)
            }
            
            Text("Battery: ${event.batteryPercent ?: "Unknown"}%", style = MaterialTheme.typography.bodySmall)
            
            if (event.message.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text("Message: ${event.message}", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
fun StatusBadge(status: SosStatus) {
    Surface(
        color = when(status) {
            SosStatus.ACTIVE -> Color.Red
            SosStatus.RESOLVED -> Color.Green
            SosStatus.CREATED -> Color.Gray
        }.copy(alpha = 0.2f),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(4.dp)
    ) {
        Text(
            text = status.name,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = when(status) {
                SosStatus.ACTIVE -> Color.Red
                SosStatus.RESOLVED -> Color.Green
                SosStatus.CREATED -> Color.Gray
            },
            fontWeight = FontWeight.Bold
        )
    }
}
