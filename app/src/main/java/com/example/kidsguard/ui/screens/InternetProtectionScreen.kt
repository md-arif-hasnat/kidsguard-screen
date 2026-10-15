package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.web.WebAccessRequest
import com.example.kidsguard.web.WebRuleSet
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InternetProtectionScreen(
    childId: String,
    syncProvider: RemoteSyncProvider,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val webRules by syncProvider.getWebRules(childId).collectAsState(initial = null)
    val accessRequests by syncProvider.getWebAccessRequests(childId)
        .collectAsState(initial = emptyList())
    var activeTab by remember { mutableIntStateOf(0) }
    var workingAction by remember { mutableStateOf<String?>(null) }
    val pendingRequests = accessRequests.filter { it.status == "PENDING" }

    fun showResult(result: Result<Unit>, successMessage: String) {
        scope.launch {
            snackbarHostState.showSnackbar(
                result.fold(
                    onSuccess = { successMessage },
                    onFailure = { it.message ?: "The change could not be saved." }
                )
            )
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                Tab(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    text = { Text("Rules") }
                )
                Tab(
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    text = { Text("Requests (${pendingRequests.size})") }
                )
            }

            if (activeTab == 0) {
                RulesTab(
                    rules = webRules,
                    enabled = workingAction == null,
                    onUpdate = { updatedRules ->
                        workingAction = "rules"
                        scope.launch {
                            val result = syncProvider.updateWebRules(childId, updatedRules)
                            workingAction = null
                            showResult(result, "Web protection updated")
                        }
                    }
                )
            } else {
                RequestsTab(
                    requests = accessRequests,
                    workingRequestId = workingAction,
                    onResolve = { request, status ->
                        workingAction = request.requestId
                        scope.launch {
                            val result = syncProvider.resolveWebAccessRequest(
                                childId = childId,
                                requestId = request.requestId,
                                status = status,
                                domain = request.domain
                            )
                            workingAction = null
                            showResult(
                                result,
                                if (status == "APPROVED") "Website approved" else "Request denied"
                            )
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun RulesTab(
    rules: WebRuleSet?,
    enabled: Boolean,
    onUpdate: (WebRuleSet) -> Unit
) {
    if (rules == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                "Content Filters",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            FilterToggle("Safe Search", rules.safeSearchEnabled, enabled) {
                onUpdate(rules.copy(safeSearchEnabled = it))
            }
            FilterToggle("YouTube Restricted", rules.youtubeRestrictedMode, enabled) {
                onUpdate(rules.copy(youtubeRestrictedMode = it))
            }
            FilterToggle("Block Adult Content", rules.adultContentBlockEnabled, enabled) {
                onUpdate(rules.copy(adultContentBlockEnabled = it))
            }
        }

        if (rules.blockedDomains.isNotEmpty() || rules.allowedDomains.isNotEmpty()) {
            item {
                Text(
                    "Custom Domain Rules",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        items(rules.blockedDomains, key = { "blocked-$it" }) { domain ->
            DomainItem(domain = domain, isBlocked = true, enabled = enabled) {
                onUpdate(rules.copy(blockedDomains = rules.blockedDomains - domain))
            }
        }

        items(rules.allowedDomains, key = { "allowed-$it" }) { domain ->
            DomainItem(domain = domain, isBlocked = false, enabled = enabled) {
                onUpdate(rules.copy(allowedDomains = rules.allowedDomains - domain))
            }
        }
    }
}

@Composable
private fun FilterToggle(
    label: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label)
        Switch(checked = checked, enabled = enabled, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun DomainItem(
    domain: String,
    isBlocked: Boolean,
    enabled: Boolean,
    onRemove: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                if (isBlocked) Icons.Default.Block else Icons.Default.CheckCircle,
                contentDescription = null,
                tint = if (isBlocked) Color.Red else Color(0xFF15803D)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(domain, fontWeight = FontWeight.SemiBold)
                Text(
                    if (isBlocked) "Blocked" else "Allowed",
                    style = MaterialTheme.typography.labelSmall
                )
            }
            IconButton(enabled = enabled, onClick = onRemove) {
                Icon(Icons.Default.Delete, contentDescription = "Remove $domain")
            }
        }
    }
}

@Composable
private fun RequestsTab(
    requests: List<WebAccessRequest>,
    workingRequestId: String?,
    onResolve: (WebAccessRequest, String) -> Unit
) {
    if (requests.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No access requests", color = Color.Gray)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(requests, key = { it.requestId }) { request ->
            RequestCard(
                request = request,
                working = workingRequestId == request.requestId,
                actionsEnabled = workingRequestId == null,
                onResolve = { status -> onResolve(request, status) }
            )
        }
    }
}

@Composable
private fun RequestCard(
    request: WebAccessRequest,
    working: Boolean,
    actionsEnabled: Boolean,
    onResolve: (String) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(request.domain, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "Requested: ${java.text.SimpleDateFormat("MMM dd, HH:mm", java.util.Locale.getDefault()).format(java.util.Date(request.timestamp))}",
                style = MaterialTheme.typography.bodySmall
            )

            Spacer(modifier = Modifier.height(12.dp))
            if (request.status == "PENDING") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        enabled = actionsEnabled,
                        onClick = { onResolve("APPROVED") },
                        modifier = Modifier.weight(1f)
                    ) {
                        if (working) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Approve")
                        }
                    }
                    OutlinedButton(
                        enabled = actionsEnabled,
                        onClick = { onResolve("DENIED") },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Deny")
                    }
                }
            } else {
                AssistChip(
                    onClick = {},
                    enabled = false,
                    label = { Text(request.status.lowercase().replaceFirstChar { it.uppercase() }) }
                )
            }
        }
    }
}
