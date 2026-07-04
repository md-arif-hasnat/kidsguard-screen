package com.example.kidsguard.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.kidsguard.utils.PermissionUtils
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PermissionChecklistScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    
    var locationGranted by remember { mutableStateOf(PermissionUtils.hasLocationPermission(context)) }
    var bgLocationGranted by remember { mutableStateOf(PermissionUtils.hasBackgroundLocationPermission(context)) }
    var notificationsGranted by remember { mutableStateOf(PermissionUtils.hasNotificationPermission(context)) }
    var batteryIgnored by remember { mutableStateOf(PermissionUtils.isBatteryOptimizationIgnored(context)) }
    var accessibilityEnabled by remember { mutableStateOf(PermissionUtils.isAccessibilityServiceEnabled(context)) }
    var usageStatsGranted by remember { mutableStateOf(PermissionUtils.hasUsageStatsPermission(context)) }
    var overlayGranted by remember { mutableStateOf(Settings.canDrawOverlays(context)) }
    var audioGranted by remember { mutableStateOf(PermissionUtils.hasAudioPermission(context)) }

    val lifecycleOwner = LocalLifecycleOwner.current

    fun refreshPermissions() {
        locationGranted = PermissionUtils.hasLocationPermission(context)
        bgLocationGranted = PermissionUtils.hasBackgroundLocationPermission(context)
        notificationsGranted = PermissionUtils.hasNotificationPermission(context)
        batteryIgnored = PermissionUtils.isBatteryOptimizationIgnored(context)
        accessibilityEnabled = PermissionUtils.isAccessibilityServiceEnabled(context)
        usageStatsGranted = PermissionUtils.hasUsageStatsPermission(context)
        overlayGranted = Settings.canDrawOverlays(context)
        audioGranted = PermissionUtils.hasAudioPermission(context)
    }

    // Refresh when app resumes
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshPermissions()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Auto refresh loop (backup)
    LaunchedEffect(Unit) {
        while(true) {
            refreshPermissions()
            delay(2000)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Setup Checklist") },
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Critical Setup Required",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Black
            )
            Text(
                "For KidsGuard to monitor and protect this device, the following permissions must be active.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            PermissionCard(
                title = "Location Access",
                description = "Required to track the device position in real-time.",
                icon = Icons.Default.LocationOn,
                status = if (locationGranted) "Ready" else "Missing",
                isGranted = locationGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Always-On Location",
                description = "Allows tracking even when the app is closed. Important: Select 'Allow all the time'.",
                icon = Icons.Default.MyLocation,
                status = if (bgLocationGranted) "Ready" else "Missing",
                isGranted = bgLocationGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Usage Statistics",
                description = "Required to monitor app usage and enforce time limits.",
                icon = Icons.Default.BarChart,
                status = if (usageStatsGranted) "Ready" else "Missing",
                isGranted = usageStatsGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Display Over Other Apps",
                description = "Required to show the lock screen when limits are reached.",
                icon = Icons.Default.FlipToFront,
                status = if (overlayGranted) "Ready" else "Missing",
                isGranted = overlayGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Accessibility Service",
                description = "The core engine for app blocking and web filtering.",
                icon = Icons.Default.Accessibility,
                status = if (accessibilityEnabled) "Active" else "Disabled",
                isGranted = accessibilityEnabled,
                onClick = {
                    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Ignore Battery Limits",
                description = "Prevents Android from stopping the app's background protection.",
                icon = Icons.Default.BatteryChargingFull,
                status = if (batteryIgnored) "Unrestricted" else "Optimized",
                isGranted = batteryIgnored,
                onClick = {
                    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Microphone Access",
                description = "Required for voice commands and SOS audio monitoring.",
                icon = Icons.Default.Mic,
                status = if (audioGranted) "Ready" else "Missing",
                isGranted = audioGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                }
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            val allDone = locationGranted && bgLocationGranted && usageStatsGranted && overlayGranted && accessibilityEnabled && audioGranted
            
            Button(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (allDone) MaterialTheme.colorScheme.primary else Color.Gray
                )
            ) {
                if (allDone) {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Complete Setup")
                } else {
                    Text("Grant All to Continue")
                }
            }
        }
    }
}

@Composable
fun PermissionCard(
    title: String,
    description: String,
    icon: ImageVector,
    status: String,
    isGranted: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isGranted) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.1f)
        ),
        border = if (!isGranted) androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)) else null
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    modifier = Modifier.size(40.dp),
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = if (isGranted) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = if (isGranted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(8.dp)
                    )
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        status,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isGranted) Color(0xFF2E7D32) else MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Black
                    )
                }
                if (!isGranted) {
                    Button(
                        onClick = onClick,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Text("Grant", style = MaterialTheme.typography.labelSmall)
                    }
                } else {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32))
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                description, 
                style = MaterialTheme.typography.bodySmall, 
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = androidx.compose.ui.unit.TextUnit.Unspecified
            )
        }
    }
}
