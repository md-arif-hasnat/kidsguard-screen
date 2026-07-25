package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.WebsiteDecision
import com.example.kidsguard.utils.PolicyEnforcementManager
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveEnforcementScreen(onBack: () -> Unit) {
    var lastEnforcement by remember { mutableStateOf(PolicyEnforcementManager.getLastEnforcement()) }
    val sdf = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    // Auto refresh every second
    LaunchedEffect(Unit) {
        while(true) {
            lastEnforcement = PolicyEnforcementManager.getLastEnforcement()
            kotlinx.coroutines.delay(1000)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Live Policy Enforcement") },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            val (history, result, time) = lastEnforcement

            if (history == null || result == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No enforcement events yet.", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = when (result.decision) {
                            WebsiteDecision.ALLOW -> Color(0xFFE8F5E9)
                            WebsiteDecision.WARN -> Color(0xFFFFF3E0)
                            WebsiteDecision.BLOCK -> Color(0xFFFFEBEE)
                        }
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Real-time Monitor", fontWeight = FontWeight.Bold)
                        Text("Domain: ${history.domain}")
                        Text("Category: ${history.category}")
                        Text("Risk Level: ${history.riskLevel}")
                        
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        
                        Text("Last Decision", fontWeight = FontWeight.Bold)
                        Text(
                            text = result.decision.name,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Black,
                            color = when (result.decision) {
                                WebsiteDecision.ALLOW -> Color(0xFF2E7D32)
                                WebsiteDecision.WARN -> Color(0xFFEF6C00)
                                WebsiteDecision.BLOCK -> Color.Red
                            }
                        )
                        Text("Reason: ${result.reason}")
                        result.matchedDomain?.let { Text("Matched Domain: $it") }
                        result.matchedCategory?.let { Text("Matched Category: $it") }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Enforced at: ${sdf.format(Date(time))}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.Gray
                        )
                    }
                }
                
                Text(
                    "This screen auto-refreshes when the Accessibility Service detects browser activity.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
        }
    }
}
