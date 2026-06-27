package com.example.kidsguard.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.web.WebRuleSet
import com.example.kidsguard.web.WebAccessRequest
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InternetProtectionScreen(
    childId: String,
    syncProvider: RemoteSyncProvider,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val webRules by syncProvider.getWebRules(childId).collectAsState(initial = null)
    val accessRequests by syncProvider.getWebAccessRequests(childId).collectAsState(initial = emptyList())
    
    var activeTab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Internet Protection") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            TabRow(selectedTabIndex = activeTab) {
                Tab(selected = activeTab == 0, onClick = { activeTab = 0 }, text = { Text("Rules") })
                Tab(selected = activeTab == 1, onClick = { activeTab = 1 }, text = { Text("Requests (${accessRequests.size})") })
            }

            if (activeTab == 0) {
                RulesTab(webRules)
            } else {
                RequestsTab(accessRequests)
            }
        }
    }
}

@Composable
fun RulesTab(rules: WebRuleSet?) {
    if (rules == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text("Content Filters", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            FilterToggle("Safe Search", rules.safeSearchEnabled)
            FilterToggle("YouTube Restricted", rules.youtubeRestrictedMode)
            FilterToggle("Block Adult Content", rules.adultContentBlockEnabled)
        }

        item {
            Text("Custom Domain Rules", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }

        items(rules.blockedDomains) { domain ->
            DomainItem(domain, isBlocked = true)
        }

        items(rules.allowedDomains) { domain ->
            DomainItem(domain, isBlocked = false)
        }
    }
}

@Composable
fun FilterToggle(label: String, enabled: Boolean) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label)
        Switch(checked = enabled, onCheckedChange = { /* TODO */ })
    }
}

@Composable
fun DomainItem(domain: String, isBlocked: Boolean) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                if (isBlocked) Icons.Default.Block else Icons.Default.CheckCircle, 
                contentDescription = null, 
                tint = if (isBlocked) Color.Red else Color.Green
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(domain, modifier = Modifier.weight(1f))
            IconButton(onClick = { /* TODO */ }) {
                Icon(Icons.Default.Delete, contentDescription = "Remove")
            }
        }
    }
}

@Composable
fun RequestsTab(requests: List<WebAccessRequest>) {
    if (requests.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No pending access requests", color = Color.Gray)
        }
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(requests) { request ->
            RequestCard(request)
        }
    }
}

@Composable
fun RequestCard(request: WebAccessRequest) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(request.domain, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Requested: ${java.text.SimpleDateFormat("MMM dd, HH:mm").format(java.util.Date(request.timestamp))}", style = MaterialTheme.typography.bodySmall)
            
            Spacer(modifier = Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { /* TODO */ }, modifier = Modifier.weight(1f)) {
                    Text("Approve")
                }
                OutlinedButton(onClick = { /* TODO */ }, modifier = Modifier.weight(1f)) {
                    Text("Deny")
                }
            }
        }
    }
}
