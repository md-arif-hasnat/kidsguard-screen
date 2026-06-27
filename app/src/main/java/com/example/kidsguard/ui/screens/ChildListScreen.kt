package com.example.kidsguard.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncChildStatus

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildListScreen(
    onBack: () -> Unit,
    onAddChild: () -> Unit,
    prefHelper: PreferenceHelper,
    syncProvider: RemoteSyncProvider,
    onSelectChild: (String) -> Unit
) {
    val familyId = prefHelper.familyId ?: ""
    val familyMembers by syncProvider.getFamilyMembers(familyId).collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Family Overview") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onAddChild) {
                        Icon(Icons.Default.PersonAdd, contentDescription = "Add Child")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (familyMembers.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                    Icon(Icons.Default.ChildCare, contentDescription = null, modifier = Modifier.size(80.dp), tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("No children paired yet", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("Open KidsGuard on your child's phone to get a pairing code.", textAlign = androidx.compose.ui.text.style.TextAlign.Center, color = Color.Gray)
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = onAddChild) {
                        Text("Connect First Device")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(familyMembers) { childId ->
                    val status by syncProvider.getChildStatus(childId).collectAsState(initial = null)
                    
                    ChildOverviewCard(
                        childId = childId,
                        status = status,
                        isSelected = childId == prefHelper.selectedChildId,
                        onClick = { onSelectChild(childId) }
                    )
                }
            }
        }
    }
}

@Composable
fun ChildOverviewCard(
    childId: String,
    status: SyncChildStatus?,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Avatar Circle
                Surface(
                    modifier = Modifier.size(56.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                ) {
                    Icon(
                        Icons.Default.Person, 
                        contentDescription = null, 
                        modifier = Modifier.padding(12.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
                
                Spacer(modifier = Modifier.width(16.dp))
                
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        status?.childName ?: "Loading...", 
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(if (status?.online == true) Color.Green else Color.Gray, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            if (status?.online == true) "Online" else "Offline",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (status?.online == true) Color.Green else Color.Gray
                        )
                    }
                }
                
                if (isSelected) {
                    Icon(Icons.Default.CheckCircle, contentDescription = "Selected", tint = MaterialTheme.colorScheme.primary)
                } else {
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                StatusItem(
                    icon = if (status?.charging == true) Icons.Default.BatteryChargingFull else Icons.Default.BatteryFull,
                    value = "${status?.batteryPercent ?: 0}%",
                    label = "Battery",
                    color = if ((status?.batteryPercent ?: 100) < 20) Color.Red else MaterialTheme.colorScheme.primary
                )
                
                StatusItem(
                    icon = Icons.Default.LocationOn,
                    value = status?.currentZone ?: "Outside",
                    label = "Location",
                    color = MaterialTheme.colorScheme.secondary
                )
                
                StatusItem(
                    icon = Icons.Default.AccessTime,
                    value = status?.lastSeen?.let { 
                        val sdf = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
                        sdf.format(java.util.Date(it))
                    } ?: "N/A",
                    label = "Last Seen",
                    color = Color.Gray
                )
            }
        }
    }
}

@Composable
fun StatusItem(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = color)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.Gray)
    }
}
