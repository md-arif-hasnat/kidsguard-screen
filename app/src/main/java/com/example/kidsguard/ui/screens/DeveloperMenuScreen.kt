package com.example.kidsguard.ui.screens

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.admin.KidsGuardAdminReceiver
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.navigation.Screen
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.RouteRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.CommandType
import com.example.kidsguard.sync.LocalMockSyncProvider
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncRemoteCommand
import com.example.kidsguard.tracking.BackgroundTrackingManager
import com.example.kidsguard.tracking.TrackingRepository
import com.example.kidsguard.update.UpdateRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeveloperMenuScreen(
    onBack: () -> Unit,
    prefHelper: PreferenceHelper,
    repository: SafeZoneRepository,
    locationRepository: LocationRepository,
    onScreenChange: (Screen) -> Unit,
    trackingRepository: TrackingRepository,
    trackingManager: BackgroundTrackingManager,
    syncProvider: RemoteSyncProvider,
    commandHandler: com.example.kidsguard.sync.RemoteCommandHandler,
    sosRepository: com.example.kidsguard.repository.SosRepository,
    routeRepository: RouteRepository,
    locationProvider: com.example.kidsguard.location.LocationProvider,
    updateRepository: UpdateRepository,
    dailySummaryRepository: com.example.kidsguard.ai.DailySummaryRepository,
    knownRouteRepository: com.example.kidsguard.routeintelligence.KnownRouteRepository,
    reverseGeocoder: com.example.kidsguard.geocoding.ReverseGeocoder,
    errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository,
    authRepository: AuthRepository,
    youtubeHistoryRepository: com.example.kidsguard.repository.YouTubeHistoryRepository,
    browserHistoryRepository: com.example.kidsguard.repository.BrowserHistoryRepository,
    websitePolicyRepository: com.example.kidsguard.repository.WebsitePolicyRepository
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val notificationEngine = remember {
        com.example.kidsguard.notifications.LocalNotificationEngine(
            context,
            errorLogRepository
        )
    }
    var showConfirmDialog by remember { mutableStateOf<String?>(null) }

    val trackingState by trackingRepository.currentState.collectAsState()
    val activeSos by sosRepository.activeSos.collectAsState()

    val lastRemoteCommand by commandHandler.lastCommandReceived.collectAsState()
    val lastExecutionResult by commandHandler.lastExecutionResult.collectAsState()

    val mockProvider = syncProvider as? LocalMockSyncProvider
    val isSyncConnected by syncProvider.isConnected.collectAsState()

    val remoteStatus by (prefHelper.pairedChildId?.let { syncProvider.getChildStatus(it) }
        ?: kotlinx.coroutines.flow.flowOf(null)).collectAsState(null)

    val locationHistory by locationRepository.locationHistory.collectAsState()
    val lastGps = locationHistory.firstOrNull()

    val updateState by updateRepository.updateState.collectAsState()

    val recentCommandsList = remember { mutableStateListOf<SyncRemoteCommand>() }

    LaunchedEffect(prefHelper.pairingCode) {
        if (prefHelper.pairingCode.isNotEmpty()) {
            syncProvider.listenForRemoteCommands(prefHelper.pairingCode) { cmd ->
                if (recentCommandsList.none { it.commandId == cmd.commandId }) {
                    recentCommandsList.add(0, cmd)
                    if (recentCommandsList.size > 5) recentCommandsList.removeAt(5)
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Developer Tools", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = "Phase AF - Remote Control Ready",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
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
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Update System Debug",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        "Current Version: ${updateState.currentVersionName} (${updateState.currentVersionCode})",
                        style = MaterialTheme.typography.bodySmall
                    )
                    val latest = updateState.updateInfo
                    if (latest != null) {
                        Text(
                            "Latest Version: ${latest.latestVersionName} (${latest.latestVersionCode})",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Mandatory Status: ${if (latest.mandatoryUpdate || latest.forceUpdate) "REQUIRED" else "OPTIONAL"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (latest.mandatoryUpdate || latest.forceUpdate) MaterialTheme.colorScheme.error else Color.Gray
                        )
                    } else {
                        Text(
                            "Latest Version: Not fetched",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )
                        Text(
                            "Mandatory Status: N/A",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { updateRepository.simulateUpdate(force = false) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                "Simulate Optional Update",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                        Button(
                            onClick = { updateRepository.simulateUpdate(force = true) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                "Simulate Mandatory Update",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                    Button(
                        onClick = { updateRepository.clearUpdateState() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                    ) {
                        Text("Reset Update State", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            Text(
                "Remote Control Debug",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "Execute Local Simulation",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelSmall
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(onClick = {
                            commandHandler.handleCommand(
                                SyncRemoteCommand(
                                    childId = prefHelper.pairingCode,
                                    commandType = CommandType.SHOW_MESSAGE,
                                    payload = "Test message from developer tools"
                                )
                            )
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Message", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = {
                            commandHandler.handleCommand(
                                SyncRemoteCommand(
                                    childId = prefHelper.pairingCode,
                                    commandType = CommandType.RING_DEVICE
                                )
                            )
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Ring", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(onClick = {
                            commandHandler.handleCommand(
                                SyncRemoteCommand(
                                    childId = prefHelper.pairingCode,
                                    commandType = CommandType.VIBRATE_DEVICE
                                )
                            )
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Vibrate", style = MaterialTheme.typography.labelSmall)
                        }
                        Button(onClick = {
                            commandHandler.handleCommand(
                                SyncRemoteCommand(
                                    childId = prefHelper.pairingCode,
                                    commandType = CommandType.REFRESH_LOCATION
                                )
                            )
                        }, modifier = Modifier.weight(1f)) {
                            Text("Sim Refresh", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "Live Command Feed (Last 5)",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelSmall
                    )
                    if (recentCommandsList.isEmpty()) {
                        Text(
                            "No commands in queue",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )
                    }
                    recentCommandsList.forEach { cmd ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("${cmd.commandType}", style = MaterialTheme.typography.bodySmall)
                            Text(
                                "${cmd.status}",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                    HorizontalDivider()
                    Text(
                        "Last Execution: $lastExecutionResult",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text(
                "QA Test Utilities",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.secondary
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(onClick = {
                    val baseLat = 51.1912
                    val baseLng = 6.4422
                    val now = System.currentTimeMillis()
                    repeat(10) { i ->
                        locationRepository.addLocationPoint(
                            com.example.kidsguard.models.LocationPoint(
                                baseLat + (0.001 * i),
                                baseLng + (0.001 * i),
                                10f, 2.0f, 0f,
                                now - (i * 60000)
                            )
                        )
                    }
                }, modifier = Modifier.weight(1f)) {
                    Text("Mock 10 GPS", style = MaterialTheme.typography.labelSmall)
                }
                Button(onClick = {
                    prefHelper.isLocked = !prefHelper.isLocked
                    onScreenChange(if (prefHelper.isLocked) Screen.Locked else Screen.Home)
                }, modifier = Modifier.weight(1f)) {
                    Text(
                        if (prefHelper.isLocked) "Unlock" else "Lock",
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            DeveloperActionItem(
                title = "Sync App Usage Now",
                description = "Collect and upload today's app usage statistics to Firestore.",
                onClick = {
                    scope.launch {
                        val repository =
                            com.example.kidsguard.repository.AppUsageRepository(context)
                        val usage = repository.getTodayUsage()
                        if (usage != null) {
                            val result = syncProvider.syncDailyAppUsage(usage)
                            if (result.isSuccess) {
                                android.widget.Toast.makeText(
                                    context,
                                    "Usage synced: ${usage.apps.size} apps",
                                    android.widget.Toast.LENGTH_SHORT
                                ).show()
                            } else {
                                android.widget.Toast.makeText(
                                    context,
                                    "Sync failed: ${result.exceptionOrNull()?.message}",
                                    android.widget.Toast.LENGTH_LONG
                                ).show()
                            }
                        } else {
                            android.widget.Toast.makeText(
                                context,
                                "No usage data or permission missing",
                                android.widget.Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }
            )

            DeveloperActionItem(
                title = "YouTube Debug",
                description = "View locally captured YouTube watch history.",
                onClick = { onScreenChange(Screen.YouTubeDebug) }
            )

            DeveloperActionItem(
                title = "Authorized Uninstall",
                description = "Temporarily disables KidsGuard protection for parent-approved removal.",
                color = Color.Red,
                onClick = { showConfirmDialog = "AUTHORIZED_UNINSTALL" }
            )

            DeveloperActionItem(
                title = "Browser Debug",
                description = "View locally captured browser history (Chrome, Firefox, etc).",
                onClick = { onScreenChange(Screen.BrowserDebug) }
            )

            DeveloperActionItem(
                title = "Policy Engine Tester",
                description = "Test website blocking policies against URLs and categories.",
                onClick = { onScreenChange(Screen.PolicyTester) }
            )

            DeveloperActionItem(
                title = "Live Policy Enforcement",
                description = "View real-time blocking decisions and enforcement actions.",
                onClick = { onScreenChange(Screen.LiveEnforcement) }
            )

            DeveloperActionItem(
                title = "Rescan Installed Apps",
                description = "Scan all launchable apps and sync to Firestore (includes system apps like Chrome/YouTube).",
                onClick = {
                    scope.launch(Dispatchers.IO) {
                        try {
                            val repo =
                                com.example.kidsguard.repository.InstalledAppsRepository(context)
                            repo.fullRescan()
                            scope.launch(Dispatchers.Main) {
                                android.widget.Toast.makeText(
                                    context,
                                    "Rescan completed",
                                    android.widget.Toast.LENGTH_SHORT
                                ).show()
                            }
                        } catch (e: Exception) {
                            scope.launch(Dispatchers.Main) {
                                android.widget.Toast.makeText(
                                    context,
                                    "Rescan failed: ${e.message}",
                                    android.widget.Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                }
            )

            DeveloperActionItem(
                title = "Reset Role Selection",
                description = "Resets user role to NONE and clears pairing data.",
                onClick = { showConfirmDialog = "RESET_ROLE" }
            )
            DeveloperActionItem(
                title = "Clear Activity History",
                description = "Deletes all events from the activity feed.",
                onClick = { showConfirmDialog = "CLEAR_ACTIVITY" }
            )
            DeveloperActionItem(
                title = "Reset Firebase Identity",
                description = "Generates new deviceId.",
                color = Color.Red,
                onClick = { showConfirmDialog = "RESET_IDENTITY" }
            )
        }

        if (showConfirmDialog != null) {
            AlertDialog(
                onDismissRequest = { showConfirmDialog = null },
                title = { Text("Confirm Action") },
                text = { Text("Are you sure you want to proceed?") },
                confirmButton = {
                    Button(
                        onClick = {
                            when (showConfirmDialog) {
                                "RESET_ROLE" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.familyId = null
                                    prefHelper.parentUid = null
                                    prefHelper.parentName = null
                                    prefHelper.pairedAt = 0L
                                    onScreenChange(Screen.RoleSelection)
                                }

                                "AUTHORIZED_UNINSTALL" -> {

                                    // Tell Accessibility protection this removal is parent-approved
                                    prefHelper.authorizedUninstall = true
                                    prefHelper.authorizedUninstallExpiresAt =
                                        System.currentTimeMillis() + 2 * 60 * 1000L


                                    val dpm = context.getSystemService(
                                        Context.DEVICE_POLICY_SERVICE
                                    ) as DevicePolicyManager

                                    val adminComponent =
                                        KidsGuardAdminReceiver.getComponentName(context)

                                    if (dpm.isAdminActive(adminComponent)) {
                                        dpm.removeActiveAdmin(adminComponent)
                                    }

                                    val uninstallIntent = Intent(
                                        Intent.ACTION_DELETE,
                                        Uri.parse("package:${context.packageName}")
                                    ).apply {
                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    }

                                    context.startActivity(uninstallIntent)
                                }

                                "CLEAR_ACTIVITY" -> repository.clearEvents()
                                "RESET_IDENTITY" -> prefHelper.resetIdentity()

                            }
                            showConfirmDialog = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Confirm")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showConfirmDialog = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun DeveloperActionItem(
    title: String,
    description: String,
    color: Color = MaterialTheme.colorScheme.primary,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = color,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
