package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.ai.DailySummary
import com.example.kidsguard.ai.DailySummaryRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DailySummaryScreen(
    repository: DailySummaryRepository,
    onBack: () -> Unit,
    prefHelper: com.example.kidsguard.data.PreferenceHelper,
    syncProvider: com.example.kidsguard.sync.RemoteSyncProvider
) {
    val isParent = prefHelper.userRole == "PARENT"
    val selectedChildId = prefHelper.selectedChildId
    
    val localSummary by repository.latestSummary.collectAsState()
    val remoteSummary by (if (isParent && selectedChildId != null) {
        syncProvider.getDailySummary(selectedChildId, System.currentTimeMillis())
    } else {
        kotlinx.coroutines.flow.flowOf(null)
    }).collectAsState(initial = null)
    
    val summary = if (isParent && selectedChildId != null) remoteSummary else localSummary
    
    val sdf = remember { SimpleDateFormat("EEEE, MMM dd", Locale.getDefault()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("AI Daily Summary")
                        if (isParent && selectedChildId != null) {
                            Text(
                                "Child ID: $selectedChildId", 
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                },
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
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            summary?.let { data ->
                Text(
                    text = sdf.format(Date(data.date)),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                SafetyScoreCard(data.safetyScore)

                SummaryTextCard(data.summaryText)

                Text("Day Analytics", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        AnalyticsRow("Total Distance", "${"%.2f".format(data.totalDistanceMeters / 1000.0)} km")
                        AnalyticsRow("Home Time", "${data.totalTimeAtHomeMinutes} min")
                        AnalyticsRow("School Time", "${data.totalTimeAtSchoolMinutes} min")
                        AnalyticsRow("Playground Time", "${data.totalTimeAtPlaygroundMinutes} min")
                        AnalyticsRow("Monitoring", "${data.totalTrackingMinutes} min")
                        AnalyticsRow("Locked Duration", "${data.totalLockMinutes} min")
                        AnalyticsRow("Unlock Attempts", "${data.totalUnlockAttempts}")
                        AnalyticsRow("Safe Zone Alerts", "${data.totalSafeZoneEvents}")
                        AnalyticsRow("SOS Triggered", "${data.totalSosEvents}")
                        AnalyticsRow("Lowest Battery", "${data.lowestBatteryPercent}%")
                        AnalyticsRow("Peak Speed", "${"%.1f".format(data.highestSpeed * 3.6)} km/h")
                    }
                }
                
                Text(
                    text = "Generated at ${SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(data.generatedAt))}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            } ?: run {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color.Gray)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("No summary available for today yet.", style = MaterialTheme.typography.bodyLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = { /* In developer menu we can force generate */ }) {
                            Text("Go to Developer Menu")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SafetyScoreCard(score: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when {
                score >= 80 -> Color(0xFFE8F5E9)
                score >= 50 -> Color(0xFFFFF3E0)
                else -> Color(0xFFFFEBEE)
            }
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Safety Score", style = MaterialTheme.typography.titleMedium)
                Text(
                    text = when {
                        score >= 80 -> "EXCELLENT"
                        score >= 50 -> "CAUTION"
                        else -> "CRITICAL"
                    },
                    style = MaterialTheme.typography.labelLarge,
                    color = when {
                        score >= 80 -> Color(0xFF2E7D32)
                        score >= 50 -> Color(0xFFEF6C00)
                        else -> Color(0xFFC62828)
                    }
                )
            }
            Text(
                text = "$score",
                style = MaterialTheme.typography.displayMedium,
                fontWeight = FontWeight.Bold,
                color = when {
                    score >= 80 -> Color(0xFF2E7D32)
                    score >= 50 -> Color(0xFFEF6C00)
                    else -> Color(0xFFC62828)
                }
            )
        }
    }
}

@Composable
fun SummaryTextCard(text: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("AI Insights", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun AnalyticsRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
    }
}
