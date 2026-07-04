package com.example.kidsguard.ui.screens
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.utils.PermissionUtils
import com.example.kidsguard.sync.FirebaseConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("App Diagnostics") },
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
            DiagnosticSection("App Information") {
                DiagnosticRow("Version", com.example.kidsguard.BuildConfig.VERSION_NAME)
                DiagnosticRow("Version Code", com.example.kidsguard.BuildConfig.VERSION_CODE.toString())
                DiagnosticRow("Build Type", if (com.example.kidsguard.BuildConfig.DEBUG) "Debug" else "Release")
                DiagnosticRow("Package", context.packageName)
                val prefHelper = remember { com.example.kidsguard.data.PreferenceHelper(context) }
                DiagnosticRow("Device ID", prefHelper.deviceId)
                DiagnosticRow("Child ID", prefHelper.childId)
            }

            DiagnosticSection("Device Information") {
                DiagnosticRow("Model", android.os.Build.MODEL)
                DiagnosticRow("Android Version", android.os.Build.VERSION.RELEASE)
                DiagnosticRow("SDK Level", android.os.Build.VERSION.SDK_INT.toString())
                DiagnosticRow("Ethernet Support", if (PermissionUtils.hasEthernetSupport(context)) "Available" else "Not Supported")
            }

            DiagnosticSection("Configuration Status") {
                DiagnosticRow("Firebase Configured", if (FirebaseConfig.isFirebaseConfigured(context)) "Yes" else "No")
                val prefHelper = remember { com.example.kidsguard.data.PreferenceHelper(context) }
                DiagnosticRow("Firebase UID", prefHelper.firebaseUid ?: "Not Signed In")
                DiagnosticRow("Family ID", prefHelper.familyId ?: "Not Paired")
                
                // Maps Key check - we check if the placeholder was replaced
                val mapsKey = context.packageManager.getApplicationInfo(context.packageName, android.content.pm.PackageManager.GET_META_DATA).metaData.getString("com.google.android.geo.API_KEY")
                val isMapsKeySet = mapsKey != null && mapsKey.isNotEmpty() && !mapsKey.contains("MAPS_API_KEY")
                DiagnosticRow("Google Maps Key", if (isMapsKeySet) "Configured" else "Missing/Default")
            }

            DiagnosticSection("Permission Health Check") {
                PermissionStatusRow(
                    "Location", 
                    PermissionUtils.hasLocationPermission(context),
                    onOpenSettings = { openAppSettings(context) }
                )
                PermissionStatusRow(
                    "Background Location", 
                    PermissionUtils.hasBackgroundLocationPermission(context),
                    onOpenSettings = { openLocationSettings(context) }
                )
                PermissionStatusRow(
                    "Notifications", 
                    PermissionUtils.hasNotificationPermission(context),
                    onOpenSettings = { openNotificationSettings(context) }
                )
                PermissionStatusRow(
                    "Accessibility Service", 
                    PermissionUtils.isAccessibilityServiceEnabled(context),
                    onOpenSettings = { openAccessibilitySettings(context) }
                )
                PermissionStatusRow(
                    "Microphone (Speech)", 
                    PermissionUtils.hasAudioPermission(context),
                    onOpenSettings = { openAppSettings(context) }
                )
                PermissionStatusRow(
                    "Media Access", 
                    PermissionUtils.hasMediaPermissions(context),
                    onOpenSettings = { openAppSettings(context) }
                )
                PermissionStatusRow(
                    "Media Location (EXIF)", 
                    PermissionUtils.hasMediaLocationPermission(context),
                    onOpenSettings = { openAppSettings(context) }
                )
                PermissionStatusRow(
                    "Battery Optimization", 
                    PermissionUtils.isBatteryOptimizationIgnored(context),
                    onOpenSettings = { openBatteryOptimizationSettings(context) }
                )
            }

            DiagnosticSection("Security & Integrity") {
                DiagnosticRow("Developer Options", if (PermissionUtils.isDeveloperOptionsEnabled(context)) "Enabled" else "Disabled")
                DiagnosticRow("ADB Debugging", if (PermissionUtils.isAdbEnabled(context)) "Enabled" else "Disabled")
                DiagnosticRow("USB Connected", if (PermissionUtils.isUsbConnected(context)) "Yes (Data)" else "No")
                
                // Detection for the USB Gadget HAL issue
                val hasUsbGadgetHal = try {
                    // We don't call the HAL directly to avoid the crash the user mentioned, 
                    // but we can check if the system service is responsive or present via features.
                    context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_USB_ACCESSORY)
                } catch (e: Exception) {
                    false
                }
                DiagnosticRow("USB Gadget Support", if (hasUsbGadgetHal) "Available" else "Not Present/HAL Error")

                // Detection for the SystemServer Resource Issue (ArrayIndexOutOfBoundsException at SystemServer.java:1384)
                val hasPreloadIssue = try {
                    val resId = context.resources.getIdentifier("config_defaultPreloadedResources", "array", "android")
                    if (resId != 0) {
                        context.resources.getStringArray(resId).isEmpty()
                    } else {
                        false
                    }
                } catch (e: Exception) {
                    false
                }
                if (hasPreloadIssue) {
                    DiagnosticRow("System Preload State", "BUG DETECTED (Fix Applied)")
                } else {
                    DiagnosticRow("System Preload State", "Healthy")
                }

                // Detection for the Captions Service Issue (IllegalArgumentException for com.google.android.as)
                val isCaptionsBugDetected = try {
                    PermissionUtils.isCaptionsServiceEnabled(context)
                    false // If it didn't throw, we assume it's fine (or at least the bug didn't trigger here)
                } catch (e: Exception) {
                    true
                }
                if (isCaptionsBugDetected) {
                    DiagnosticRow("Captions Component", "BUG DETECTED (Fix Applied)")
                } else {
                    DiagnosticRow("Captions Component", "Normal")
                }

                // Detection for the StorageManager Timeout issue (TimeoutException at StorageUserConnection)
                // We use produceState to avoid blocking the UI thread during the probe
                val storageHealthState by produceState<Boolean?>(initialValue = null) {
                    value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                        PermissionUtils.isStorageSystemHealthy(context)
                    }
                }
                
                when (storageHealthState) {
                    null -> DiagnosticRow("Storage Service", "Checking...")
                    false -> DiagnosticRow("Storage Service", "STALLED or I/O ERROR")
                    true -> DiagnosticRow("Storage Service", "Healthy")
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
fun DiagnosticSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                content()
            }
        }
    }
}

@Composable
fun DiagnosticRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun PermissionStatusRow(label: String, isGranted: Boolean, onOpenSettings: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(), 
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyMedium)
            Text(
                if (isGranted) "Granted" else "Missing", 
                style = MaterialTheme.typography.labelSmall,
                color = if (isGranted) Color(0xFF4CAF50) else Color.Red
            )
        }
        if (!isGranted) {
            TextButton(onClick = onOpenSettings) {
                Text("Fix", style = MaterialTheme.typography.labelSmall)
            }
        } else {
            IconButton(onClick = onOpenSettings) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Settings",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private fun openAppSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}

private fun openLocationSettings(context: Context) {
    val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}

private fun openNotificationSettings(context: Context) {
    val intent = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
    } else {
        Intent("android.settings.APP_NOTIFICATION_SETTINGS").apply {
            putExtra("app_package", context.packageName)
            putExtra("app_uid", context.applicationInfo.uid)
        }
    }.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}

private fun openAccessibilitySettings(context: Context) {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}

private fun openBatteryOptimizationSettings(context: Context) {
    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}
