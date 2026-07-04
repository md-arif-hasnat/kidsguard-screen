package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, prefHelper: PreferenceHelper) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Settings") },
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
                .imePadding()
                .navigationBarsPadding()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Identity", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            
            OutlinedTextField(
                value = prefHelper.childName,
                onValueChange = { prefHelper.childName = it },
                label = { Text("Child Name") },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Person, null) }
            )

            Text("Security", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)

            OutlinedTextField(
                value = prefHelper.pin,
                onValueChange = { if (it.length <= 4) prefHelper.pin = it },
                label = { Text("Parent PIN (4 digits)") },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Lock, null) }
            )

            ListItem(
                headlineContent = { Text("Volume Up Unlock") },
                supportingContent = { Text("Tap volume up 4 times to emergency unlock") },
                trailingContent = { 
                    Switch(checked = prefHelper.isVolumeUnlockEnabled, onCheckedChange = { prefHelper.isVolumeUnlockEnabled = it }) 
                }
            )

            Text("Protection", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)

            ListItem(
                headlineContent = { Text("Lock Schedule") },
                supportingContent = { Text("Automatically lock device during hours") },
                trailingContent = { 
                    Switch(checked = prefHelper.isScheduleEnabled, onCheckedChange = { prefHelper.isScheduleEnabled = it }) 
                }
            )
            
            if (prefHelper.isScheduleEnabled) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    OutlinedTextField(
                        value = prefHelper.scheduleStartTime,
                        onValueChange = { prefHelper.scheduleStartTime = it },
                        label = { Text("Start") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = prefHelper.scheduleEndTime,
                        onValueChange = { prefHelper.scheduleEndTime = it },
                        label = { Text("End") },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}
