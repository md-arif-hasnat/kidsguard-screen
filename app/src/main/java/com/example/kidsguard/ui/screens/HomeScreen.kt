package com.example.kidsguard.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Emergency
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.kidsguard.R
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.data.RemoteStatusService
import com.example.kidsguard.data.findActivity
import com.example.kidsguard.data.isCurrentTimeInSchedule
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.utils.PermissionUtils
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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
    repository: SafeZoneRepository,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    locationRepository: com.example.kidsguard.repository.LocationRepository
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val activity = context.findActivity()
    var showPinDialog by remember { mutableStateOf(false) }
    var showSosConfirm by remember { mutableStateOf(false) }

    val activeSos by sosRepository.activeSos.collectAsState()
    val activeSosAlert by sosRepository.activeSosAlert.collectAsState()

    var sosMessage by remember { mutableStateOf("") }
    var isSendingSos by remember { mutableStateOf(false) }

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
        while (true) {
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
        while (true) {
            val shouldBeLocked = isCurrentTimeInSchedule(prefHelper)
            if (shouldBeLocked && !prefHelper.isLocked) {
                repository.addEvent(
                    ActivityEvent(
                        type = "KID_MODE_ENABLED",
                        title = "Kid Mode Enabled",
                        description = "Scheduled lock active"
                    )
                )
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
            Image(
                painter = painterResource(R.drawable.kidsguard_logo),
                contentDescription = "KidsGuard Logo",
                modifier = Modifier
                    .size(120.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) {
                        if (com.example.kidsguard.BuildConfig.DEBUG) {
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
                        }
                    },

                )

            Text(
                text = "KidsGuard Protection",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "PROTECT • GUIDE • GROW",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 2.dp),
                letterSpacing = 1.5.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Text(
            // text = "Child: ${prefHelper.childName.ifEmpty { "Unnamed Child" }}",
            // style = MaterialTheme.typography.bodyMedium,
            // fontWeight = FontWeight.Bold
            // )

            Spacer(modifier = Modifier.height(16.dp))

            if (prefHelper.familyId.isNullOrEmpty()) {
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
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .background(Color.Green.copy(alpha = 0.1f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color.Green,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column {
                            Text(
                                text = "Connected to Parent",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = "This device is protected by KidsGuard.",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            // ConnectedInfoRow("Child", prefHelper.childName)


                            ConnectedInfoRow(
                                label = "Parent",
                                value = prefHelper.parentName
                                    ?.takeIf { it.isNotBlank() }
                                    ?: "Parent not found"
                            )

                            if (prefHelper.pairedAt > 0) {
                                val sdf = java.text.SimpleDateFormat(
                                    "MMM dd, yyyy",
                                    java.util.Locale.getDefault()
                                )
                                ConnectedInfoRow(
                                    "Connected since",
                                    sdf.format(java.util.Date(prefHelper.pairedAt))
                                )
                            }
                        }
                    }
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
                        Text(
                            "Permission Checklist",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            if (allGranted) "All permissions granted" else "Some permissions missing",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (activeSosAlert != null && activeSosAlert!!.status == "ACTIVE") {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "SOS ACTIVE",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.error
                                )
                                Text(
                                    "Emergency alerts sent to parent",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            Button(
                                onClick = { sosRepository.resolveSos(activeSosAlert!!.alertId) },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                            ) {
                                Text("Resolve", style = MaterialTheme.typography.labelSmall)
                            }
                        }

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 8.dp),
                            color = MaterialTheme.colorScheme.error.copy(alpha = 0.2f)
                        )

                        Text(
                            "Current Location",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Address: ${activeSosAlert!!.address ?: "Address unavailable"}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        if (activeSosAlert!!.latitude != null && activeSosAlert!!.longitude != null) {
                            Text(
                                "Latitude: ${activeSosAlert!!.latitude}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "Longitude: ${activeSosAlert!!.longitude}",
                                style = MaterialTheme.typography.bodySmall
                            )
                        } else {
                            Text(
                                "Location unavailable",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            } else if (activeSosAlert != null && activeSosAlert!!.status == "RESOLVED") {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.Green.copy(alpha = 0.1f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color.Green
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                "SOS Resolved",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.Green
                            )
                        }
                        Text(
                            "Resolved by: ${activeSosAlert!!.resolvedBy ?: "System"}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        activeSosAlert!!.resolvedAt?.let {
                            val sdf = java.text.SimpleDateFormat(
                                "HH:mm:ss",
                                java.util.Locale.getDefault()
                            )
                            Text(
                                "Resolved at: ${sdf.format(java.util.Date(it))}",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = { sosRepository.clearSosHistory() }, // This is a bit extreme, maybe just clear active state
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Text("Dismiss")
                        }
                    }
                }
            } else {
                Button(
                    onClick = { showSosConfirm = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp),
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Icon(Icons.Default.Emergency, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Emergency SOS", style = MaterialTheme.typography.titleLarge)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
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

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    StatusItem(
                        label = "Lock Engine",
                        value = if (prefHelper.isLocked) "LOCKED" else "READY",
                        active = !prefHelper.isLocked
                    )
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
                text = if (com.example.kidsguard.BuildConfig.DEBUG) "v${com.example.kidsguard.BuildConfig.VERSION_NAME} (Debug) - ${android.os.Build.MODEL}" else "v${com.example.kidsguard.BuildConfig.VERSION_NAME}",
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

        if (showSosConfirm) {
            AlertDialog(
                onDismissRequest = { if (!isSendingSos) showSosConfirm = false },
                title = { Text("Send Emergency SOS?") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Your current location will be sent to your parent.")

                        OutlinedTextField(
                            value = sosMessage,
                            onValueChange = { if (it.length <= 300) sosMessage = it },
                            label = { Text("Do you want to add or say anything?") },
                            placeholder = { Text("Type a message for your parent...") },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 4,
                            enabled = !isSendingSos,
                            supportingText = {
                                Text(
                                    text = "${sosMessage.length} / 300",
                                    modifier = Modifier.fillMaxWidth(),
                                    textAlign = TextAlign.End
                                )
                            }
                        )

                        if (isSendingSos) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp
                                )
                                Text(
                                    "Obtaining location and sending SOS...",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            isSendingSos = true
                            scope.launch {
                                try {
                                    val battery =
                                        com.example.kidsguard.data.getBatteryLevel(context)
                                    val event = com.example.kidsguard.models.SosEvent(
                                        childId = prefHelper.childId,
                                        batteryPercent = battery,
                                        message = if (sosMessage.isNotBlank()) sosMessage else "Emergency SOS Triggered"
                                    )

                                    // Trigger SOS in repository (which now handles location)
                                    sosRepository.triggerSos(event)

                                    repository.addEvent(
                                        com.example.kidsguard.models.ActivityEvent(
                                            type = "SOS_TRIGGERED",
                                            title = "SOS Emergency Triggered",
                                            description = sosMessage.ifBlank { "Manual trigger from device" }
                                        ))

                                    com.example.kidsguard.notifications.LocalNotificationEngine(
                                        context
                                    ).sendSafetyAlert(
                                        "KidsGuard SOS Alert",
                                        "Emergency SOS triggered"
                                    )

                                    // Success
                                    sosMessage = ""
                                    showSosConfirm = false
                                } catch (e: Exception) {
                                    android.util.Log.e("SosFlow", "Failed to initiate SOS", e)
                                } finally {
                                    isSendingSos = false
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                        enabled = !isSendingSos
                    ) {
                        Text("SEND SOS")
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { showSosConfirm = false },
                        enabled = !isSendingSos
                    ) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun ConnectedInfoRow(label: String, value: String) {
    Row(modifier = Modifier.padding(vertical = 1.dp)) {
        Text(
            text = "$label: ",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.6f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSecondaryContainer
        )
    }
}
