package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kidsguard.repository.BrowserHistoryRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowserDebugScreen(
    repository: BrowserHistoryRepository,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val history by repository.history.collectAsState()
    val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Browser Debug") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { 
                        com.example.kidsguard.sync.BrowserSyncWorker.runOnce(context)
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Sync Now")
                    }
                    IconButton(onClick = { repository.clear() }) {
                        Icon(Icons.Default.Delete, contentDescription = "Clear")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            val pendingCount = history.count { !it.isSynced }
            val syncedCount = history.count { it.isSynced }
            
            Card(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Sync Status", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            Text("$syncedCount Synced / $pendingCount Pending", style = MaterialTheme.typography.titleMedium)
                        }
                        Button(onClick = { com.example.kidsguard.sync.BrowserSyncWorker.runOnce(context) }) {
                            Text("Sync Now", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = { repository.categorizeExistingUnknownRecords() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                    ) {
                        Text("Reclassify Unknown Records", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            if (history.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No browser history detected yet.", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(history.take(20)) { item ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = item.domain ?: "Unknown Domain",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Black
                                    )
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = item.category.name,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = when(item.riskLevel) {
                                                com.example.kidsguard.models.WebsiteRiskLevel.SAFE -> Color.Green
                                                com.example.kidsguard.models.WebsiteRiskLevel.CAUTION -> Color(0xFFFFA500)
                                                com.example.kidsguard.models.WebsiteRiskLevel.RESTRICTED -> Color.Red
                                                else -> Color.Gray
                                            },
                                            fontWeight = FontWeight.Black
                                        )
                                        Text(
                                            text = "${(item.categoryConfidence * 100).toInt()}% | ${item.categorySource ?: "none"}",
                                            style = MaterialTheme.typography.labelSmall,
                                            fontSize = 8.sp,
                                            color = Color.Gray
                                        )
                                    }
                                    Text(
                                        text = if (item.isSynced) "Synced" else "Pending",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (item.isSynced) Color.Green else Color.Gray,
                                        fontWeight = FontWeight.Black
                                    )
                                }
                                
                                Spacer(modifier = Modifier.height(4.dp))
                                
                                Text(
                                    text = item.pageTitle ?: "No Title",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                
                                Text(
                                    text = item.url ?: "No URL",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.Gray,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )

                                Text(
                                    text = "ID: ${item.id}",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontSize = 8.sp,
                                    color = Color.LightGray
                                )

                                Spacer(modifier = Modifier.height(8.dp))
                                
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "Time: ${sdf.format(Date(item.startedAt))}",
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                    Text(
                                        text = "Duration: ${item.durationSeconds}s",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
