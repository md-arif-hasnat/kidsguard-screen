package com.example.kidsguard.ui.screens

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.example.kidsguard.admin.KidsGuardAdminReceiver
import com.example.kidsguard.utils.PermissionUtils
import kotlinx.coroutines.delay

private enum class SetupStepId {
    LOCATION,
    BACKGROUND_LOCATION,
    ACCESSIBILITY,
    OVERLAY,
    DEVICE_ADMIN,
    NOTIFICATIONS,
    BATTERY_OPTIMIZATION,
    USAGE_ACCESS,
    MICROPHONE
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
                required = true
            ),
            SetupStep(
                id = SetupStepId.USAGE_ACCESS,
                title = "Usage Access",
                description = "Optional: allows app usage and screen-time monitoring.",
                required = false
            ),
            SetupStep(
                id = SetupStepId.MICROPHONE,
                title = "Microphone Access",
                description = "Optional: required only for supported audio features.",
                required = false
            )
        )
    }

    var currentStep by remember {
        mutableIntStateOf(0)
    }

    var permissionRefreshKey by remember {
        mutableIntStateOf(0)
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
                Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
                        PermissionUtils.hasBackgroundLocationPermission(context)
            }

            SetupStepId.ACCESSIBILITY -> {
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

            SetupStepId.BATTERY_OPTIMIZATION -> {
                PermissionUtils.isBatteryOptimizationIgnored(context)
            }

            SetupStepId.USAGE_ACCESS -> {
                hasUsageAccess(context)
            }

            SetupStepId.MICROPHONE -> {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.RECORD_AUDIO
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            }
        }
    }

    val locationPermissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestMultiplePermissions()
        ) {
            permissionRefreshKey++

            if (
                currentStep == 0 &&
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
                currentStep == 1 &&
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
                currentStep == 2 &&
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
                currentStep == 3 &&
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
                currentStep == 4 &&
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
                currentStep == 5 &&
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
                currentStep == 6 &&
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
                currentStep == 7 &&
                hasUsageAccess(context)
            ) {
                goToNextStep()
            }
        }

    val microphonePermissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestPermission()
        ) {
            permissionRefreshKey++

            if (
                currentStep == 8 &&
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.RECORD_AUDIO
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                goToNextStep()
            }
        }

    fun requestCurrentStep() {
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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    backgroundLocationLauncher.launch(
                        Manifest.permission.ACCESS_BACKGROUND_LOCATION
                    )
                } else {
                    goToNextStep()
                }
            }

            SetupStepId.ACCESSIBILITY -> {
                accessibilityLauncher.launch(
                    Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                )
            }

            SetupStepId.OVERLAY -> {
                overlayLauncher.launch(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    )
                )
            }

            SetupStepId.DEVICE_ADMIN -> {
                val prefHelper =
                    com.example.kidsguard.data.PreferenceHelper(context)

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
                batteryOptimizationLauncher.launch(
                    Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:${context.packageName}")
                    )
                )
            }

            SetupStepId.USAGE_ACCESS -> {
                usageAccessLauncher.launch(
                    Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                )
            }

            SetupStepId.MICROPHONE -> {
                microphonePermissionLauncher.launch(
                    Manifest.permission.RECORD_AUDIO
                )
            }
        }
    }

    val stepGranted = remember(
        currentStep,
        permissionRefreshKey
    ) {
        isStepGranted(step.id)
    }

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
        topBar = {
            TopAppBar(
                title = {
                    Text("Child Device Setup")
                },
                navigationIcon = {
                    OutlinedButton(
                        onClick = onBack,
                        modifier = Modifier.padding(start = 8.dp)
                    ) {
                        Text("Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (step.required) {
                    "Required Setup"
                } else {
                    "Optional Setup"
                },
                style = MaterialTheme.typography.labelLarge,
                color = if (step.required) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.secondary
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Step ${currentStep + 1} of ${steps.size}",
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "$progressPercent% completed",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(32.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(
                    defaultElevation = 4.dp
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = step.title,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = step.description,
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = if (stepGranted) {
                            "✓ Enabled"
                        } else {
                            "Waiting for permission"
                        },
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (stepGranted) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
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
                        enabled = !stepGranted,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text(
                            text = if (stepGranted) {
                                "Enabled"
                            } else {
                                "Enable"
                            }
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
                                .height(54.dp),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Text(
                                if (isLastStep) {
                                    "Skip & Finish"
                                } else {
                                    "Skip"
                                }
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
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
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