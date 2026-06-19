package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChildCare
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.RemoteSyncProvider

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildListScreen(
    onBack: () -> Unit,
    onAddChild: () -> Unit,
    prefHelper: PreferenceHelper,
    syncProvider: RemoteSyncProvider,
    onSelectChild: (String) -> Unit
) {
    val familyMembers by syncProvider.getFamilyMembers(prefHelper.familyId ?: "").collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Managed Children") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onAddChild) {
                        Icon(Icons.Default.Add, contentDescription = "Add Child")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (familyMembers.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No children paired yet", style = MaterialTheme.typography.bodyLarge)
                    Button(onClick = onAddChild, modifier = Modifier.padding(top = 16.dp)) {
                        Text("Pair First Child")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(familyMembers) { childId ->
                    val status by syncProvider.getChildStatus(childId).collectAsState(initial = null)
                    
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectChild(childId) }
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.ChildCare, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(status?.childName ?: "Loading...", style = MaterialTheme.typography.titleMedium)
                                Text(childId, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                                status?.let {
                                    Text(
                                        "${if (it.online) "Online" else "Offline"} • Battery: ${it.batteryPercent}%",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                            if (childId == prefHelper.selectedChildId) {
                                Badge(containerColor = MaterialTheme.colorScheme.primary) {
                                    Text("Selected", color = Color.White)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
