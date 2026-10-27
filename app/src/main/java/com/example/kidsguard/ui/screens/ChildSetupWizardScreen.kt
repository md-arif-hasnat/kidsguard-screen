package com.example.kidsguard.ui.screens

import android.Manifest
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.example.kidsguard.admin.KidsGuardAdminReceiver
import com.example.kidsguard.accessibility.KidsGuardAccessibilityService
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.InstalledAppsRepository
import com.example.kidsguard.utils.NotificationAccessHelper
import com.example.kidsguard.utils.PermissionUtils
import kotlinx.coroutines.delay

private val AppleBackground = Color(0xFFF5F5F7)
private val AppleCard = Color(0xFFFFFFFF)
private val AppleText = Color(0xFF1D1D1F)
private val AppleSecondaryText = Color(0xFF6E6E73)
private val AppleBorder = Color(0xFFD2D2D7)
private val AppleButton = Color(0xFF1D1D1F)
private val AppleBlue = Color(0xFF0071E3)
private val AppleGreen = Color(0xFF34C759)
private val AppleLightGreen = Color(0xFFEAF8EE)

private enum class SetupStepId {
    LOCATION,
    BACKGROUND_LOCATION,
    ACCESSIBILITY,
    OVERLAY,
    DEVICE_ADMIN,
    NOTIFICATIONS,
    NOTIFICATION_ACCESS,
    BATTERY_OPTIMIZATION,
    USAGE_ACCESS,
    APP_INVENTORY
}

private data class SetupStep(
    val id: SetupStepId,
    val title: String,
    val description: String,
    val required: Boolean
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildSetupWizardScreen(
    onSetupComplete: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val prefHelper = remember(context.applicationContext) {
        PreferenceHelper(context.applicationContext)
    }

    val steps = remember {
        listOf(
            SetupStep(
                id = SetupStepId.LOCATION,
                title = "Share Live Location",
                description = "Allow KidsGuard to access this device's precise current location.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.BACKGROUND_LOCATION,
                title = "Allow Background Location",
                description = "Allow location tracking even when KidsGuard is not open.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.ACCESSIBILITY,
                title = "Enable Accessibility Service",
                description = "Required for protection, monitoring and tamper detection.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.OVERLAY,
                title = "Display Over Other Apps",
                description = "Required for remote lock and full-screen protection.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.NOTIFICATION_ACCESS,
                title = "Enable Notification Access",
                description = "Required for YouTube thumbnails, channel details and media monitoring.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.DEVICE_ADMIN,
                title = "Enable Device Admin",
                description = "Required for device protection and secure screen locking.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.NOTIFICATIONS,
                title = "Allow Notifications",
                description = "Required for protection status and safety notifications.",
                required = true
            ),
            SetupStep(
                id = SetupStepId.BATTERY_OPTIMIZATION,
                title = "Disable Battery Optimization",
                description = "Keeps KidsGuard running reliably in the background.",
                required = false
            ),
            SetupStep(
                id = SetupStepId.USAGE_ACCESS,
                title = "Usage Access",
                description = "Optional: allows app usage and screen-time monitoring.",
                required = false
            ),
            SetupStep(
                id = SetupStepId.APP_INVENTORY,
                title = "Installed App Protection",
                description = "Allow KidsGuard to identify installed apps so the linked parent can manage app access and screen time.",
                required = true
            )
        )
    }

    var currentStep by remember {
        mutableIntStateOf(0)
    }

    var permissionRefreshKey by remember {
        mutableIntStateOf(0)
    }
    var pendingDisclosure by remember {
        mutableStateOf<SetupStepId?>(null)
    }

    val step = steps[currentStep]
    val isLastStep = currentStep == steps.lastIndex
    val progress = (currentStep + 1).toFloat() / steps.size.toFloat()
    val progressPercent = (progress * 100).toInt()

    fun goToNextStep() {
        if (currentStep >= steps.lastIndex) {
            onSetupComplete()
        } else {
            currentStep++
        }
    }

    fun isStepGranted(stepId: SetupStepId): Boolean {
        return when (stepId) {
            SetupStepId.LOCATION -> {
                PermissionUtils.hasLocationPermission(context)
            }

            SetupStepId.BACKGROUND_LOCATION -> {
                prefHelper.backgroundLocationDisclosureAccepted &&
                    (
                        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
                            PermissionUtils.hasBackgroundLocationPermission(context)
                    )
            }

            SetupStepId.ACCESSIBILITY -> {
                prefHelper.accessibilityDisclosureAccepted &&
                    PermissionUtils.isAccessibilityServiceEnabled(context)
            }

            SetupStepId.OVERLAY -> {
                Settings.canDrawOverlays(context)
            }

            SetupStepId.DEVICE_ADMIN -> {
                KidsGuardAdminReceiver.isAdminActive(context)
            }

            SetupStepId.NOTIFICATIONS -> {
                Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                        PermissionUtils.hasNotificationPermission(context)
            }

            SetupStepId.NOTIFICATION_ACCESS -> {
                prefHelper.notificationAccessDisclosureAccepted &&
                    NotificationAccessHelper.isEnabled(context)
            }

            SetupStepId.BATTERY_OPTIMIZATION -> {
                PermissionUtils.isBatteryOptimizationIgnored(context)
            }

            SetupStepId.USAGE_ACCESS -> {
                hasUsageAccess(context)
            }

            SetupStepId.APP_INVENTORY -> {
                prefHelper.appInventoryDisclosureAccepted
            }
        }
    }

    val locationPermissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestMultiplePermissions()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.LOCATION &&
                PermissionUtils.hasLocationPermission(context)
            ) {
                goToNextStep()
            }
        }

    val backgroundLocationLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestPermission()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.BACKGROUND_LOCATION &&
                PermissionUtils.hasBackgroundLocationPermission(context)
            ) {
                goToNextStep()
            }
        }

    val accessibilityLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.ACCESSIBILITY &&
                PermissionUtils.isAccessibilityServiceEnabled(context)
            ) {
                goToNextStep()
            }
        }

    val overlayLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.OVERLAY &&
                Settings.canDrawOverlays(context)
            ) {
                goToNextStep()
            }
        }

    val deviceAdminLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.DEVICE_ADMIN &&
                KidsGuardAdminReceiver.isAdminActive(context)
            ) {
                goToNextStep()
            }
        }

    val notificationPermissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestPermission()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.NOTIFICATIONS &&
                (
                        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                                PermissionUtils.hasNotificationPermission(context)
                        )
            ) {
                goToNextStep()
            }
        }

    val batteryOptimizationLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.BATTERY_OPTIMIZATION &&
                PermissionUtils.isBatteryOptimizationIgnored(context)
            ) {
                goToNextStep()
            }
        }

    val usageAccessLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) {
            permissionRefreshKey++

            if (
                steps.getOrNull(currentStep)?.id == SetupStepId.USAGE_ACCESS &&
                hasUsageAccess(context)
            ) {
                goToNextStep()
            }
        }

    val backgroundLocationSettingsLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.StartActivityForResult()
        ) {
            permissionRefreshKey++
        }

    fun requestCurrentStep() {
        val disclosureAlreadyAccepted = when (step.id) {
            SetupStepId.BACKGROUND_LOCATION ->
                prefHelper.backgroundLocationDisclosureAccepted
            SetupStepId.ACCESSIBILITY ->
                prefHelper.accessibilityDisclosureAccepted
            SetupStepId.NOTIFICATION_ACCESS ->
                prefHelper.notificationAccessDisclosureAccepted
            SetupStepId.APP_INVENTORY ->
                prefHelper.appInventoryDisclosureAccepted
            else -> true
        }
        if (!disclosureAlreadyAccepted) {
            pendingDisclosure = step.id
            return
        }

        when (step.id) {
            SetupStepId.LOCATION -> {
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }

            SetupStepId.BACKGROUND_LOCATION -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    backgroundLocationSettingsLauncher.launch(
                        Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:${context.packageName}")
                        )
                    )
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    backgroundLocationLauncher.launch(
                        Manifest.permission.ACCESS_BACKGROUND_LOCATION
                    )
                } else {
                    goToNextStep()
                }
            }

            SetupStepId.ACCESSIBILITY -> {
                val componentName = ComponentName(
                    context,
                    KidsGuardAccessibilityService::class.java
                )

                val directIntent = Intent(
                    "android.settings.ACCESSIBILITY_DETAILS_SETTINGS"
                ).apply {
                    putExtra(
                        Intent.EXTRA_COMPONENT_NAME,
                        componentName.flattenToString()
                    )
                }

                val fallbackIntent = Intent(
                    Settings.ACTION_ACCESSIBILITY_SETTINGS
                )

                try {
                    if (directIntent.resolveActivity(context.packageManager) != null) {
                        accessibilityLauncher.launch(directIntent)
                    } else {
                        accessibilityLauncher.launch(fallbackIntent)
                    }
                } catch (e: Exception) {
                    accessibilityLauncher.launch(fallbackIntent)
                }
            }

            SetupStepId.OVERLAY -> {
                overlayLauncher.launch(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    )
                )
            }

            SetupStepId.NOTIFICATION_ACCESS -> {
                NotificationAccessHelper.openSettings(context)
            }

            SetupStepId.DEVICE_ADMIN -> {
                val prefHelper = PreferenceHelper(context)

                prefHelper.authorizedDeviceAdminSetupExpiresAt =
                    System.currentTimeMillis() + 2 * 60 * 1000L

                deviceAdminLauncher.launch(
                    KidsGuardAdminReceiver.getRequestIntent(context)
                )
            }

            SetupStepId.NOTIFICATIONS -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    notificationPermissionLauncher.launch(
                        Manifest.permission.POST_NOTIFICATIONS
                    )
                } else {
                    goToNextStep()
                }
            }

            SetupStepId.BATTERY_OPTIMIZATION -> {
                val intent = Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:${context.packageName}")
                )

                try {
                    batteryOptimizationLauncher.launch(intent)
                } catch (e: Exception) {
                    val fallbackIntent = Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:${context.packageName}")
                    )
                    batteryOptimizationLauncher.launch(fallbackIntent)
                }
            }

            SetupStepId.USAGE_ACCESS -> {
                usageAccessLauncher.launch(
                    Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                )
            }

            SetupStepId.APP_INVENTORY -> {
                InstalledAppsRepository(context.applicationContext)
                    .initialScan()
                permissionRefreshKey++
            }
        }
    }

    // permissionRefreshKey read করলে settings থেকে ফিরে এসে state refresh হবে।
    permissionRefreshKey

    val stepGranted = isStepGranted(step.id)

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                permissionRefreshKey++
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(
        currentStep,
        stepGranted
    ) {
        if (stepGranted) {
            delay(700)

            if (currentStep >= steps.lastIndex) {
                onSetupComplete()
            } else {
                currentStep++
            }
        }
    }

    Scaffold(
        containerColor = AppleBackground,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppleBackground,
                    titleContentColor = AppleText,
                    navigationIconContentColor = AppleText
                ),
                title = {
                    Text(
                        text = "Child Device Setup",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    OutlinedButton(
                        onClick = onBack,
                        modifier = Modifier.padding(start = 12.dp),
                        shape = RoundedCornerShape(50),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = AppleText,
                            containerColor = Color.Transparent
                        ),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 1.dp,
                            color = AppleBorder
                        )
                    ) {
                        Text(
                            text = "Back",
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppleBackground)
                .padding(innerPadding)
                .padding(horizontal = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(22.dp))

            Text(
                text = if (step.required) {
                    "REQUIRED SETUP"
                } else {
                    "OPTIONAL SETUP"
                },
                color = AppleSecondaryText,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Step ${currentStep + 1} of ${steps.size}",
                    color = AppleText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )

                Text(
                    text = "$progressPercent%",
                    color = AppleSecondaryText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(5.dp),
                color = AppleText,
                trackColor = AppleBorder
            )

            Spacer(modifier = Modifier.height(34.dp))

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = 1.dp,
                        color = AppleBorder,
                        shape = RoundedCornerShape(28.dp)
                    ),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(
                    containerColor = AppleCard
                ),
                elevation = CardDefaults.cardElevation(
                    defaultElevation = 0.dp
                )
            ) {
                Column(
                    modifier = Modifier.padding(
                        horizontal = 24.dp,
                        vertical = 30.dp
                    ),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(
                                color = if (stepGranted) {
                                    AppleLightGreen
                                } else {
                                    AppleBackground
                                },
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (stepGranted) "✓" else "${currentStep + 1}",
                            color = if (stepGranted) {
                                AppleGreen
                            } else {
                                AppleText
                            },
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(22.dp))

                    Text(
                        text = step.title,
                        color = AppleText,
                        fontSize = 26.sp,
                        lineHeight = 32.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = step.description,
                        color = AppleSecondaryText,
                        fontSize = 16.sp,
                        lineHeight = 23.sp,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(26.dp))

                    Text(
                        text = if (stepGranted) {
                            "Enabled"
                        } else {
                            "Waiting for permission"
                        },
                        color = if (stepGranted) {
                            AppleGreen
                        } else {
                            AppleSecondaryText
                        },
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = {
                            if (stepGranted) {
                                goToNextStep()
                            } else {
                                requestCurrentStep()
                            }
                        },
                        enabled = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AppleButton,
                            contentColor = Color.White,
                            disabledContainerColor = AppleLightGreen,
                            disabledContentColor = AppleGreen
                        ),
                        elevation = ButtonDefaults.buttonElevation(
                            defaultElevation = 0.dp,
                            pressedElevation = 0.dp,
                            disabledElevation = 0.dp
                        )
                    ) {
                        Text(
                            text = if (stepGranted) {
                                "Enabled"
                            } else {
                                "Enable"
                            },
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    if (!step.required) {
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedButton(
                            onClick = {
                                if (isLastStep) {
                                    onSetupComplete()
                                } else {
                                    currentStep++
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color.White,
                                contentColor = AppleText
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                width = 1.dp,
                                color = AppleBorder
                            )
                        ) {
                            Text(
                                text = if (isLastStep) {
                                    "Skip & Finish"
                                } else {
                                    "Skip"
                                },
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = if (step.required) {
                    "This permission is required to continue."
                } else {
                    "This feature is optional and can be enabled later."
                },
                modifier = Modifier.padding(
                    horizontal = 16.dp,
                    vertical = 24.dp
                ),
                color = AppleSecondaryText,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center
            )
        }
    }

    pendingDisclosure?.let { disclosureStep ->
        val disclosure = disclosureCopy(disclosureStep)
        AlertDialog(
            onDismissRequest = { pendingDisclosure = null },
            title = {
                Text(
                    text = disclosure.title,
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Text(
                    text = disclosure.message,
                    lineHeight = 21.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        when (disclosureStep) {
                            SetupStepId.BACKGROUND_LOCATION ->
                                prefHelper.backgroundLocationDisclosureAccepted = true
                            SetupStepId.ACCESSIBILITY ->
                                prefHelper.accessibilityDisclosureAccepted = true
                            SetupStepId.NOTIFICATION_ACCESS ->
                                prefHelper.notificationAccessDisclosureAccepted = true
                            SetupStepId.APP_INVENTORY ->
                                prefHelper.appInventoryDisclosureAccepted = true
                            else -> Unit
                        }
                        pendingDisclosure = null
                        permissionRefreshKey++
                        requestCurrentStep()
                    }
                ) {
                    Text("Agree and continue")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDisclosure = null }) {
                    Text("Not now")
                }
            }
        )
    }
}

private data class DisclosureCopy(
    val title: String,
    val message: String
)

private fun disclosureCopy(step: SetupStepId): DisclosureCopy = when (step) {
    SetupStepId.BACKGROUND_LOCATION -> DisclosureCopy(
        title = "Background location disclosure",
        message = "KidsGuard collects this child device's precise location in the background, including when the app is closed or not in use. Location is used for live location, route history and parent-defined safe-zone alerts, and is sent securely to the linked parent account. It is not sold or used for advertising."
    )
    SetupStepId.ACCESSIBILITY -> DisclosureCopy(
        title = "Accessibility Service disclosure",
        message = "KidsGuard uses Android Accessibility Service on this child device to identify the active app and read relevant on-screen browser or YouTube content. It uses this access to enforce parent-selected app, website and screen-time rules and to detect attempts to disable protection. Relevant activity may be sent securely to the linked parent account. It is not sold or used for advertising."
    )
    SetupStepId.NOTIFICATION_ACCESS -> DisclosureCopy(
        title = "Notification access disclosure",
        message = "KidsGuard reads notifications on this child device to identify supported YouTube and media titles, channel details and playback activity for the linked parent's safety dashboard. Relevant details may be sent securely to the linked parent account. Notification data is not sold or used for advertising."
    )
    SetupStepId.APP_INVENTORY -> DisclosureCopy(
        title = "Installed apps disclosure",
        message = "KidsGuard collects installed app names, package identifiers, versions and install status from this child device. This inventory is sent securely to the linked parent account so the parent can manage app access, screen time and new-install alerts. It is not sold or used for advertising."
    )
    else -> DisclosureCopy(
        title = "Permission disclosure",
        message = "Review and agree before continuing."
    )
}

private fun hasUsageAccess(
    context: Context
): Boolean {
    val appOpsManager =
        context.getSystemService(
            Context.APP_OPS_SERVICE
        ) as AppOpsManager

    val mode = if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    ) {
        appOpsManager.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
    } else {
        @Suppress("DEPRECATION")
        appOpsManager.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
    }

    return mode == AppOpsManager.MODE_ALLOWED
}
