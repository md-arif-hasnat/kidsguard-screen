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

    // Auto refresh
    LaunchedEffect(Unit) {
        while(true) {
            locationGranted = PermissionUtils.hasLocationPermission(context)
            bgLocationGranted = PermissionUtils.hasBackgroundLocationPermission(context)
            notificationsGranted = PermissionUtils.hasNotificationPermission(context)
            batteryIgnored = PermissionUtils.isBatteryOptimizationIgnored(context)
            accessibilityEnabled = PermissionUtils.isAccessibilityServiceEnabled(context)
            delay(2000)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Permission Checklist") },
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
                "For KidsGuard to work properly, please grant the following permissions on the child's device.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            PermissionCard(
                title = "Location Access",
                description = "Required to track the device position.",
                icon = Icons.Default.LocationOn,
                status = if (locationGranted) "Granted" else "Missing",
                isGranted = locationGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Background Location",
                description = "Allows tracking even when the app is closed. Select 'Allow all the time'.",
                icon = Icons.Default.MyLocation,
                status = if (bgLocationGranted) "Granted" else "Missing",
                isGranted = bgLocationGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Notifications",
                description = "Required to send safety alerts and keep the service running.",
                icon = Icons.Default.Notifications,
                status = if (notificationsGranted) "Granted" else "Missing",
                isGranted = notificationsGranted,
                onClick = {
                    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    }
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Battery Optimization",
                description = "Disable to prevent the system from killing the tracking service.",
                icon = Icons.Default.BatteryChargingFull,
                status = if (batteryIgnored) "Optimized" else "Restricted",
                isGranted = batteryIgnored,
                onClick = {
                    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    context.startActivity(intent)
                }
            )

            PermissionCard(
                title = "Accessibility Service",
                description = "Required to prevent the child from leaving the app when locked.",
                icon = Icons.Default.Accessibility,
                status = if (accessibilityEnabled) "Enabled" else "Disabled",
                isGranted = accessibilityEnabled,
                onClick = {
                    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    context.startActivity(intent)
                }
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Button(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Done")
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
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (isGranted) Color.Green else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        status,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isGranted) Color.Green else Color.Red,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
                if (!isGranted) {
                    IconButton(onClick = onClick) {
                        Icon(Icons.Default.Settings, contentDescription = "Open Settings")
                    }
                } else {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.Green)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
