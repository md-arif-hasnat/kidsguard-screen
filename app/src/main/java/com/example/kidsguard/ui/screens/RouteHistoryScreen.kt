package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.RouteSession
import com.example.kidsguard.repository.RouteRepository
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RouteHistoryScreen(
    repository: RouteRepository,
    onRouteSelected: (String) -> Unit,
    onBack: () -> Unit
) {
    val routes by repository.routeSessions.collectAsState()
    val sdfDate = remember { SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()) }
    val sdfTime = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    LaunchedEffect(Unit) {
        repository.generateRouteSessions()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Route History") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { repository.generateRouteSessions() }) {
                        Icon(Icons.Default.History, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (routes.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text("No routes recorded yet", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(routes) { route ->
                    RouteItem(route, sdfDate, sdfTime, onRouteSelected)
                }
            }
        }
    }
}

@Composable
fun RouteItem(
    route: RouteSession,
    sdfDate: SimpleDateFormat,
    sdfTime: SimpleDateFormat,
    onRouteSelected: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onRouteSelected(route.id) }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = sdfDate.format(Date(route.startTime)),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${"%.1f".format(route.totalDistanceMeters / 1000)} km",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = "${sdfTime.format(Date(route.startTime))} - ${sdfTime.format(Date(route.endTime))}",
                    style = MaterialTheme.typography.bodySmall
                )
                val durationMin = (route.endTime - route.startTime) / (1000 * 60)
                Text(
                    text = "$durationMin min",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Points: ${route.totalPoints}", style = MaterialTheme.typography.labelSmall)
                    Text("Avg Speed: ${"%.1f".format(route.averageSpeed * 3.6)} km/h", style = MaterialTheme.typography.labelSmall)
                }
                
                Button(onClick = { onRouteSelected(route.id) }) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Replay")
                }
            }
        }
    }
}
