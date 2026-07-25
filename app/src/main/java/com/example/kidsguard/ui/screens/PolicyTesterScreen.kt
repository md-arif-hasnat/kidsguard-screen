package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.models.WebsiteDecision
import com.example.kidsguard.models.WebsiteDecisionResult
import com.example.kidsguard.repository.WebsitePolicyRepository
import com.example.kidsguard.utils.DomainNormalizer
import com.example.kidsguard.utils.WebsiteCategoryClassifier
import com.example.kidsguard.utils.WebsitePolicyEngine

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PolicyTesterScreen(
    policyRepository: WebsitePolicyRepository,
    classifier: WebsiteCategoryClassifier,
    onBack: () -> Unit
) {
    var urlInput by remember { mutableStateOf("") }
    var testResult by remember { mutableStateOf<Pair<BrowserHistory, WebsiteDecisionResult>?>(null) }
    val currentPolicy by policyRepository.policy.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Policy Engine Tester") },
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
            OutlinedTextField(
                value = urlInput,
                onValueChange = { urlInput = it },
                label = { Text("Enter URL or Domain") },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("e.g. google.com") }
            )

            Button(
                onClick = {
                    val normalized = DomainNormalizer.normalize(urlInput)
                    val classification = classifier.classify(urlInput, normalized, null)
                    val history = BrowserHistory(
                        url = urlInput,
                        domain = normalized,
                        pageTitle = null,
                        browserPackage = "tester",
                        category = classification.category,
                        categoryConfidence = classification.confidence,
                        categorySource = classification.source,
                        riskLevel = classification.riskLevel
                    )
                    val decision = WebsitePolicyEngine.evaluate(history, currentPolicy)
                    testResult = Pair(history, decision)
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Evaluate Policy")
            }

            testResult?.let { (history, result) ->
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
                        Text("Classification", fontWeight = FontWeight.Bold)
                        Text("Category: ${history.category}")
                        Text("Risk Level: ${history.riskLevel}")
                        Text("Confidence: ${(history.categoryConfidence * 100).toInt()}%")

                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                        Text("Decision", fontWeight = FontWeight.Bold)
                        Text(
                            text = result.decision.name,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Black,
                            color = when (result.decision) {
                                WebsiteDecision.ALLOW -> Color.DarkGray
                                WebsiteDecision.WARN -> Color(0xFFEF6C00)
                                WebsiteDecision.BLOCK -> Color.Red
                            }
                        )
                        Text("Reason: ${result.reason}")
                        result.matchedDomain?.let { Text("Matched Domain: $it") }
                        result.matchedCategory?.let { Text("Matched Category: $it") }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Policy Info", fontWeight = FontWeight.Bold)
                    Text("Policy Enabled: ${currentPolicy.enabled}")
                    Text("Blocked Domains: ${currentPolicy.blockedDomains.size}")
                    Text("Blocked Categories: ${currentPolicy.blockedCategories.size}")
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            policyRepository.updatePolicy { 
                                it.copy(
                                    blockedDomains = it.blockedDomains + setOf("facebook.com", "instagram.com"),
                                    blockedCategories = it.blockedCategories + setOf(com.example.kidsguard.models.WebsiteCategory.GAMBLING)
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                    ) {
                        Text("Apply Sample Blocks", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}
