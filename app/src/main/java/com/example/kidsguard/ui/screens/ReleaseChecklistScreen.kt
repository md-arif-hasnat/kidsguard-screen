package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReleaseChecklistScreen(onBack: () -> Unit) {
    val checklistItems = remember {
        mutableStateListOf(
            "Build passes" to true,
            "Git committed" to false,
            "API key not hardcoded" to true,
            "local.properties ignored" to true,
            "Developer Tools hidden" to false,
            "Permissions tested" to false,
            "GPS tested" to false,
            "Map tested" to false,
            "Notifications tested" to false,
            "Lock engine tested" to false,
            "APK signed" to false
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Release Checklist") },
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
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                "Phase N.1 - Pre-release Verification", 
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            checklistItems.forEachIndexed { index, item ->
                var checked by remember { mutableStateOf(item.second) }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = checked,
                        onCheckedChange = { 
                            checked = it
                            checklistItems[index] = checklistItems[index].first to it
                        }
                    )
                    Text(item.first, style = MaterialTheme.typography.bodyLarge)
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Button(
                onClick = { /* Save state if needed */ },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Progress")
            }
        }
    }
}
