package com.example.kidsguard.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kidsguard.accessibility.KidsGuardAccessibilityService
import com.example.kidsguard.repository.YouTubeHistoryRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YouTubeDebugScreen(
    repository: YouTubeHistoryRepository,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val history by repository.history.collectAsState()
    val debugLogs by repository.debugLogs.collectAsState()
    val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("YouTube Debug") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { 
                        KidsGuardAccessibilityService.getInstance()?.dumpTree()
                    }) {
                        Icon(Icons.Default.BugReport, contentDescription = "Dump Tree")
                    }
                    IconButton(onClick = { 
                        com.example.kidsguard.sync.YouTubeSyncWorker.runOnce(context)
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Sync Now")
                    }
                    IconButton(onClick = { 
                        if (selectedTab == 0) repository.clear() else repository.clearDebugLogs()
                    }) {
                        Icon(Icons.Default.Delete, contentDescription = "Clear")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            TabRow(selectedTabIndex = selectedTab) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("History") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Trace Logs") })
            }

            if (selectedTab == 0) {
                HistoryTab(repository, history, sdf)
            } else {
                LogsTab(debugLogs)
            }
        }
    }
}

@Composable
fun HistoryTab(repository: YouTubeHistoryRepository, history: List<com.example.kidsguard.models.YouTubeActivity>, sdf: SimpleDateFormat) {
    val pendingCount = history.count { !it.isSynced }
    val syncedCount = history.count { it.isSynced }

    Column {
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
                }
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                
                Text("Monitoring Stats", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Detected: ${repository.sessionCount}", style = MaterialTheme.typography.bodySmall)
                    Text("Saved: ${repository.savedCount}", style = MaterialTheme.typography.bodySmall)
                    Text("Dropped: ${repository.droppedCount}", style = MaterialTheme.typography.bodySmall)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Duplicates: ${repository.duplicateCount}", style = MaterialTheme.typography.bodySmall)
                    Text("Ads Ignored: ${repository.adCount}", style = MaterialTheme.typography.bodySmall)
                    val withThumb = history.count { it.thumbnailUrl != null }
                    Text("Thumbs: $withThumb", style = MaterialTheme.typography.bodySmall, color = Color.Magenta)
                }
            }
        }

        if (history.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No history yet.", style = MaterialTheme.typography.bodyMedium)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(history) { item ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(item.videoTitle, fontWeight = FontWeight.Bold)
                            Text(item.channelName ?: "Unknown Channel", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                            
                            if (item.videoId != null) {
                                Text("ID: ${item.videoId}", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                                Text("Source: ${item.linkSource ?: "N/A"}", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                                if (item.thumbnailUrl != null) {
                                    Text("Thumb: ${item.thumbnailUrl!!.substringAfterLast("/")}", style = MaterialTheme.typography.labelSmall, color = Color.Magenta)
                                }
                            }

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${sdf.format(Date(item.startedAt))} • ${item.watchDurationSeconds}s", style = MaterialTheme.typography.labelSmall)
                                Text(if (item.isSynced) "Synced" else "Pending", color = if (item.isSynced) Color.Green else Color.Gray, fontWeight = FontWeight.Black, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LogsTab(logs: List<String>) {
    if (logs.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No trace logs yet.", style = MaterialTheme.typography.bodyMedium)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentPadding = PaddingValues(8.dp)
        ) {
            items(logs) { log ->
                Text(
                    text = "> $log",
                    color = Color.Green,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
    }
}
