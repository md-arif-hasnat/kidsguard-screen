package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.routeintelligence.DeviationSeverity
import com.example.kidsguard.routeintelligence.KnownRouteRepository
import com.example.kidsguard.routeintelligence.RouteDeviationEvent
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RouteDeviationsScreen(
    repository: KnownRouteRepository,
    onBack: () -> Unit
) {
    val deviations by repository.deviationEvents.collectAsState()
    val sdf = remember { SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Route Deviations") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (deviations.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text("No route deviations detected yet.", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(deviations) { event ->
                    DeviationItem(
                        event = event,
                        sdf = sdf,
                        onResolve = { repository.resolveDeviation(event.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun DeviationItem(
    event: RouteDeviationEvent,
    sdf: SimpleDateFormat,
    onResolve: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (event.resolved) MaterialTheme.colorScheme.surface else {
                when(event.severity) {
                    DeviationSeverity.HIGH -> Color(0xFFFFEBEE)
                    DeviationSeverity.MEDIUM -> Color(0xFFFFF3E0)
                    DeviationSeverity.LOW -> Color(0xFFE8F5E9)
                }
            }
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (event.resolved) Icons.Default.Check else Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (event.resolved) Color.Gray else {
                            when(event.severity) {
                                DeviationSeverity.HIGH -> Color.Red
                                DeviationSeverity.MEDIUM -> Color(0xFFEF6C00)
                                DeviationSeverity.LOW -> Color(0xFF2E7D32)
                            }
                        }
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = if (event.resolved) "RESOLVED" else event.severity.name,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (event.resolved) Color.Gray else {
                            when(event.severity) {
                                DeviationSeverity.HIGH -> Color.Red
                                DeviationSeverity.MEDIUM -> Color(0xFFEF6C00)
                                DeviationSeverity.LOW -> Color(0xFF2E7D32)
                            }
                        }
                    )
                }
                Text(sdf.format(Date(event.timestamp)), style = MaterialTheme.typography.labelSmall)
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            Text(event.message, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
            Text("Distance: ${event.distanceFromRouteMeters.toInt()} meters", style = MaterialTheme.typography.bodySmall)
            
            if (!event.resolved) {
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = onResolve, modifier = Modifier.align(Alignment.End)) {
                    Text("Mark as Resolved")
                }
            }
        }
    }
}
