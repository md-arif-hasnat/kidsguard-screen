package com.example.kidsguard.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.data.RemoteStatusService
import com.example.kidsguard.data.findActivity
import com.example.kidsguard.data.isCurrentTimeInSchedule
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.utils.PermissionUtils
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onActivate: () -> Unit, 
    onOpenSettings: () -> Unit, 
    onOpenDeveloperMenu: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onOpenTrackingStatus: () -> Unit,
    onOpenPermissionChecklist: () -> Unit,
    prefHelper: PreferenceHelper, 
    repository: SafeZoneRepository
) {
    val context = LocalContext.current
    val activity = context.findActivity()
    var showPinDialog by remember { mutableStateOf(false) }
    
    // Developer Menu hidden access
    var logoTapCount by remember { mutableIntStateOf(0) }
    var lastLogoTapTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(activity) {
        activity?.window?.let { window ->
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.show(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
        }
    }

    // Permission states for small preview
    var allGranted by remember { mutableStateOf(false) }

    // Periodically refresh permissions
    LaunchedEffect(Unit) {
        while(true) {
            allGranted = PermissionUtils.hasLocationPermission(context) &&
                        PermissionUtils.hasBackgroundLocationPermission(context) &&
                        PermissionUtils.hasNotificationPermission(context) &&
                        PermissionUtils.isBatteryOptimizationIgnored(context) &&
                        PermissionUtils.isAccessibilityServiceEnabled(context)
            delay(5000)
        }
    }

    // Phase 6: Sync status if role is child
    LaunchedEffect(Unit) {
        if (prefHelper.userRole == "CHILD") {
            context.let { RemoteStatusService.updateChildStatus(it, prefHelper) }
            RemoteStatusService.startRemoteCommandListener(prefHelper)
        }
    }

    // Phase 7.5: Periodically check schedule
    LaunchedEffect(Unit) {
        while(true) {
            val shouldBeLocked = isCurrentTimeInSchedule(prefHelper)
            if (shouldBeLocked && !prefHelper.isLocked) {
                repository.addEvent(ActivityEvent(type = "KID_MODE_ENABLED", title = "Kid Mode Enabled", description = "Scheduled lock active"))
                onActivate()
            }
            delay(60000) // Check every minute
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("KidsGuard Child Mode") },
                actions = {
                    IconButton(onClick = { showPinDialog = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.Shield,
                contentDescription = null,
                modifier = Modifier
                    .size(100.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) {
                        val now = System.currentTimeMillis()
                        if (now - lastLogoTapTime > 2000) {
                            logoTapCount = 1
                        } else {
                            logoTapCount++
                        }
                        lastLogoTapTime = now
                        if (logoTapCount >= 7) {
                            logoTapCount = 0
                            onOpenDeveloperMenu()
                        }
                    },
                tint = MaterialTheme.colorScheme.primary
            )
            
            Text(
                text = "Child: ${prefHelper.childName.ifEmpty { "Unnamed Child" }}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Device: ${prefHelper.deviceName}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Pairing Code", style = MaterialTheme.typography.labelLarge)
                    Text(
                        text = prefHelper.pairingCode,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Enter this code on the Parent device",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Permission Quick Check
            Card(
                onClick = onOpenPermissionChecklist,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (allGranted) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (allGranted) Color.Green else Color.Red
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Permission Checklist", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(
                            if (allGranted) "All permissions granted" else "Some permissions missing",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onActivate,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                Icon(Icons.Default.Lock, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Activate KidGuard Lock")
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = onOpenLocationHistory,
                    modifier = Modifier.weight(1f),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Icon(Icons.Default.History, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("History", maxLines = 1)
                }
                OutlinedButton(
                    onClick = onOpenTrackingStatus,
                    modifier = Modifier.weight(1f),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Icon(Icons.Default.GpsFixed, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Tracking", maxLines = 1)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "Application Status",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Start
            )
            
            Card(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    StatusItem(label = "Lock Engine", value = if (prefHelper.isLocked) "LOCKED" else "READY", active = !prefHelper.isLocked)
                    StatusItem(label = "Tracking Service", value = "ACTIVE", active = true) 
                    if (prefHelper.isScheduleEnabled) {
                        StatusItem(
                            label = "Schedule", 
                            value = "${prefHelper.scheduleStartTime} - ${prefHelper.scheduleEndTime}", 
                            active = isCurrentTimeInSchedule(prefHelper)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = "v1.0.0 (Debug) - ${android.os.Build.MODEL}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 24.dp, bottom = 16.dp)
            )
        }

        if (showPinDialog) {
            PinEntryDialog(
                title = "Access Settings",
                onDismiss = { showPinDialog = false },
                onCorrectPin = {
                    showPinDialog = false
                    onOpenSettings()
                },
                correctPin = prefHelper.pin
            )
        }
    }
}
