package com.example.kidsguard

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.Manifest
import java.util.Calendar
import com.example.kidsguard.models.*
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.location.LocalLocationProvider
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.core.content.ContextCompat
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.kidsguard.ui.theme.KidsGuardTheme

@OptIn(ExperimentalMaterial3Api::class)
class MainActivity : ComponentActivity() {
    private lateinit var prefHelper: PreferenceHelper
    private lateinit var repository: SafeZoneRepository
    private lateinit var locationRepository: LocationRepository
    private var currentScreenState = mutableStateOf(Screen.Home)
    private var volumeUpTapCount = 0
    private var firstVolumeUpTapTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefHelper = PreferenceHelper(this)
        repository = SafeZoneRepository()
        locationRepository = LocationRepository(this)
        
        // Determine initial screen based on role and pairing status
        val initialScreen = when {
            prefHelper.isLocked -> Screen.Locked
            prefHelper.userRole == "NONE" -> Screen.RoleSelection
            prefHelper.userRole == "PARENT" -> if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
            prefHelper.userRole == "CHILD" -> if (prefHelper.pairedChildId == null) Screen.ChildSetup else Screen.Home
            else -> Screen.Home
        }
        currentScreenState.value = initialScreen

        enableEdgeToEdge()
        setContent {
            KidsGuardTheme(darkTheme = true) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    KidsGuardApp(
                        currentScreen = currentScreenState.value,
                        onScreenChange = { screen ->
                            Log.d("KidsGuard", "Screen changing to: $screen")
                            currentScreenState.value = screen
                            prefHelper.isLocked = (screen == Screen.Locked)
                            
                            // Force portrait in Locked screen for real device realism
                            requestedOrientation = if (screen == Screen.Locked) {
                                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                            } else {
                                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                            }
                        },
                        repository = repository,
                        locationRepository = locationRepository
                    )
                }
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (currentScreenState.value == Screen.Locked && 
            keyCode == KeyEvent.KEYCODE_VOLUME_UP && 
            prefHelper.isVolumeUnlockEnabled) {
            val now = System.currentTimeMillis()
            if (volumeUpTapCount == 0 || now - firstVolumeUpTapTime > 5000) {
                volumeUpTapCount = 1
                firstVolumeUpTapTime = now
            } else {
                volumeUpTapCount++
                if (volumeUpTapCount >= 4) {
                    Log.i("KidsGuard", "Emergency Volume Unlock triggered")
                    repository.addEvent(ActivityEvent(type = "VOLUME_UNLOCK", title = "Volume Unlock", description = "Emergency exit triggered"))
                    currentScreenState.value = Screen.Home
                    prefHelper.isLocked = false
                    volumeUpTapCount = 0
                }
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}

class PreferenceHelper(context: Context) {
    private val prefs = context.getSharedPreferences("kidsguard_prefs", Context.MODE_PRIVATE)

    var pin: String
        get() = prefs.getString("pin", "1234") ?: "1234"
        set(value) = prefs.edit().putString("pin", value).apply()

    var secretTapsCount: Int
        get() = prefs.getInt("secret_taps_count", 5)
        set(value) = prefs.edit().putInt("secret_taps_count", value).apply()

    var isSecretTapsEnabled: Boolean
        get() = prefs.getBoolean("secret_taps_enabled", true)
        set(value) = prefs.edit().putBoolean("secret_taps_enabled", value).apply()

    var isLocked: Boolean
        get() = prefs.getBoolean("is_locked", false)
        set(value) = prefs.edit().putBoolean("is_locked", value).apply()

    var isVolumeUnlockEnabled: Boolean
        get() = prefs.getBoolean("volume_unlock_enabled", true)
        set(value) = prefs.edit().putBoolean("volume_unlock_enabled", value).apply()

    var userRole: String
        get() = prefs.getString("user_role", "NONE") ?: "NONE"
        set(value) = prefs.edit().putString("user_role", value).apply()

    var pairingCode: String
        get() = prefs.getString("pairing_code", (100000..999999).random().toString()) ?: ""
        set(value) = prefs.edit().putString("pairing_code", value).apply()

    var pairedChildId: String?
        get() = prefs.getString("paired_child_id", null)
        set(value) = prefs.edit().putString("paired_child_id", value).apply()

    var childName: String
        get() = prefs.getString("child_name", "") ?: ""
        set(value) = prefs.edit().putString("child_name", value).apply()

    var deviceName: String
        get() = prefs.getString("device_name", android.os.Build.MODEL) ?: android.os.Build.MODEL
        set(value) = prefs.edit().putString("device_name", value).apply()

    var isScheduleEnabled: Boolean
        get() = prefs.getBoolean("schedule_enabled", false)
        set(value) = prefs.edit().putBoolean("schedule_enabled", value).apply()

    var scheduleStartTime: String
        get() = prefs.getString("schedule_start", "20:00") ?: "20:00"
        set(value) = prefs.edit().putString("schedule_start", value).apply()

    var scheduleEndTime: String
        get() = prefs.getString("schedule_end", "08:00") ?: "08:00"
        set(value) = prefs.edit().putString("schedule_end", value).apply()
}

// Phase 6: Mock Firebase-ready structures
object RemoteStatusService {
    fun updateChildStatus(context: Context, prefHelper: PreferenceHelper) {
        val battery = getBatteryLevel(context)
        val lastActive = System.currentTimeMillis()
        // Here we would push to Firebase: 
        // database.ref("devices/${prefHelper.pairingCode}").setValue(Status(battery, lastActive))
    }
    
    fun startRemoteCommandListener(prefHelper: PreferenceHelper) {
        // Here we would listen for Firebase changes:
        // database.ref("devices/${prefHelper.pairingCode}/command").onValue { cmd -> 
        //    if(cmd == "LOCK") prefHelper.isLocked = true 
        // }
    }
}

// Phase 6: Location Sharing Placeholder
data class DeviceLocation(val lat: Double, val lng: Double, val timestamp: Long)

// Phase 7.5: Schedule Check Helper
fun isCurrentTimeInSchedule(prefHelper: PreferenceHelper): Boolean {
    if (!prefHelper.isScheduleEnabled) return false
    
    val now = Calendar.getInstance()
    val currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    
    fun parseToMinutes(time: String): Int {
        val parts = time.split(":")
        if (parts.size != 2) {
            Log.w("KidsGuard", "Invalid schedule time format: '$time', expected HH:mm")
            return 0
        }
        val hours = parts[0].toIntOrNull()
        val minutes = parts[1].toIntOrNull()
        if (hours == null || minutes == null || hours !in 0..23 || minutes !in 0..59) {
            Log.w("KidsGuard", "Invalid schedule time values in: '$time'")
            return 0
        }
        return hours * 60 + minutes
    }
    
    val startMin = parseToMinutes(prefHelper.scheduleStartTime)
    val endMin = parseToMinutes(prefHelper.scheduleEndTime)
    
    return if (startMin <= endMin) {
        currentMinutes in startMin..endMin
    } else {
        // Overnight schedule (e.g., 22:00 to 07:00)
        currentMinutes >= startMin || currentMinutes <= endMin
    }
}

fun getBatteryLevel(context: Context): Int {
    return try {
        val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { ifilter ->
            context.registerReceiver(null, ifilter)
        }
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        if (level == -1) {
            Log.w("KidsGuard", "Could not determine battery level")
        }
        level
    } catch (e: Exception) {
        Log.e("KidsGuard", "Failed to read battery level", e)
        -1
    }
}

enum class Screen {
    RoleSelection, Home, Locked, Settings, ParentDashboard, SafeZoneList, ActivityFeed, ChildSetup, ParentSetup, LocationHistory, DeveloperMenu
}

@Composable
fun KidsGuardApp(
    currentScreen: Screen, 
    onScreenChange: (Screen) -> Unit, 
    repository: SafeZoneRepository,
    locationRepository: LocationRepository
) {
    val context = LocalContext.current
    val prefHelper = remember { PreferenceHelper(context) }
    
    // Initial redirection based on role and pairing status
    val userRole = prefHelper.userRole
    val pairedId = prefHelper.pairedChildId
    val startScreen = remember(currentScreen, userRole, pairedId) {
        if (currentScreen == Screen.Home) {
            when (userRole) {
                "NONE" -> Screen.RoleSelection
                "PARENT" -> if (pairedId == null) Screen.ParentSetup else Screen.ParentDashboard
                "CHILD" -> if (pairedId == null) Screen.ChildSetup else Screen.Home
                else -> currentScreen
            }
        } else {
            currentScreen
        }
    }

    Crossfade(targetState = startScreen, label = "screenTransition") { screen ->
        when (screen) {
            Screen.RoleSelection -> RoleSelectionScreen(
                onRoleSelected = { role: String ->
                    prefHelper.userRole = role
                    val nextScreen = when(role) {
                        "PARENT" -> if (prefHelper.pairedChildId == null) Screen.ParentSetup else Screen.ParentDashboard
                        "CHILD" -> if (prefHelper.pairedChildId == null) Screen.ChildSetup else Screen.Home
                        else -> Screen.RoleSelection
                    }
                    onScreenChange(nextScreen)
                },
                onOpenDeveloperMenu = { onScreenChange(Screen.DeveloperMenu) }
            )
            Screen.ChildSetup -> ChildSetupScreen(
                prefHelper = prefHelper,
                onSetupComplete = { onScreenChange(Screen.Home) },
                onBack = { 
                    prefHelper.userRole = "NONE"
                    onScreenChange(Screen.RoleSelection) 
                }
            )
            Screen.ParentSetup -> ParentSetupScreen(
                prefHelper = prefHelper,
                onSetupComplete = { onScreenChange(Screen.ParentDashboard) },
                onBack = { 
                    prefHelper.userRole = "NONE"
                    onScreenChange(Screen.RoleSelection) 
                }
            )
            Screen.Home -> HomeScreen(
                onActivate = { 
                    repository.addEvent(ActivityEvent(type = "KID_MODE_ENABLED", title = "Kid Mode Enabled", description = "Manual activation"))
                    onScreenChange(Screen.Locked) 
                },
                onOpenSettings = { onScreenChange(Screen.Settings) },
                onOpenDeveloperMenu = { onScreenChange(Screen.DeveloperMenu) },
                prefHelper = prefHelper,
                repository = repository
            )
            Screen.ParentDashboard -> ParentDashboardScreen(
                prefHelper = prefHelper,
                onOpenSettings = { onScreenChange(Screen.Settings) },
                onOpenSafeZones = { onScreenChange(Screen.SafeZoneList) },
                onOpenActivityFeed = { onScreenChange(Screen.ActivityFeed) },
                onOpenLocationHistory = { onScreenChange(Screen.LocationHistory) },
                onBack = { onScreenChange(Screen.RoleSelection) }
            )
            Screen.SafeZoneList -> SafeZoneListScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.ActivityFeed -> ActivityFeedScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.LocationHistory -> LocationHistoryScreen(
                repository = locationRepository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.Locked -> LockedScreen(
                onUnlock = { 
                    repository.addEvent(ActivityEvent(type = "KID_MODE_DISABLED", title = "Kid Mode Disabled", description = "Unlocked by child"))
                    onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home) 
                },
                prefHelper = prefHelper,
                repository = repository
            )
            Screen.Settings -> SettingsScreen(
                onBack = { onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home) },
                prefHelper = prefHelper
            )
            Screen.DeveloperMenu -> DeveloperMenuScreen(
                onBack = { 
                    if (prefHelper.userRole == "NONE") {
                        onScreenChange(Screen.RoleSelection)
                    } else {
                        onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home)
                    }
                },
                prefHelper = prefHelper,
                repository = repository,
                locationRepository = locationRepository,
                onScreenChange = onScreenChange
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onActivate: () -> Unit, 
    onOpenSettings: () -> Unit, 
    onOpenDeveloperMenu: () -> Unit,
    prefHelper: PreferenceHelper, 
    repository: SafeZoneRepository
) {
    val context = LocalContext.current.findActivity()
    var showPinDialog by remember { mutableStateOf(false) }
    
    // Developer Menu hidden access
    var logoTapCount by remember { mutableIntStateOf(0) }
    var lastLogoTapTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(context) {
        context?.window?.let { window ->
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.show(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
        }
    }

    // Phase 6: Sync status if role is child
    LaunchedEffect(Unit) {
        if (prefHelper.userRole == "CHILD") {
            context?.let { RemoteStatusService.updateChildStatus(it, prefHelper) }
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
            kotlinx.coroutines.delay(60000) // Check every minute
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("KidsGuard") },
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Shield,
                contentDescription = null,
                modifier = Modifier
                    .size(120.dp)
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
            Spacer(modifier = Modifier.height(32.dp))
            Text(
                text = "KidsGuard Screen",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Protect your phone from curious little hands",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            
            if (prefHelper.userRole == "CHILD") {
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
                            style = MaterialTheme.typography.displaySmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Enter this code on the Parent's device",
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center
                        )
                    }
                }
                Spacer(modifier = Modifier.height(32.dp))
            }

            if (prefHelper.isScheduleEnabled) {
                val isActive = isCurrentTimeInSchedule(prefHelper)
                Text(
                    text = if (isActive) "Scheduled Lock Active" else "Scheduled Lock Inactive",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (isActive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                Text(
                    text = "${prefHelper.scheduleStartTime} - ${prefHelper.scheduleEndTime}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            Button(
                onClick = onActivate,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                shape = MaterialTheme.shapes.large
            ) {
                Text(
                    text = "Activate KidGuard",
                    style = MaterialTheme.typography.titleLarge
                )
            }
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, prefHelper: PreferenceHelper) {
    var pin by remember { mutableStateOf(prefHelper.pin) }
    var secretTapsCount by remember { mutableFloatStateOf(prefHelper.secretTapsCount.toFloat()) }
    var secretTapsEnabled by remember { mutableStateOf(prefHelper.isSecretTapsEnabled) }
    var volumeUnlockEnabled by remember { mutableStateOf(prefHelper.isVolumeUnlockEnabled) }
    var showPinChangeDialog by remember { mutableStateOf(false) }

    var isScheduleEnabled by remember { mutableStateOf(prefHelper.isScheduleEnabled) }
    var startTime by remember { mutableStateOf(prefHelper.scheduleStartTime) }
    var endTime by remember { mutableStateOf(prefHelper.scheduleEndTime) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Parent Settings") },
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
                .verticalScroll(rememberScrollState())
        ) {
            Text("Security", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            ListItem(
                headlineContent = { Text("Change Unlock PIN") },
                supportingContent = { Text("Current PIN is required to unlock or access settings") },
                trailingContent = {
                    Button(onClick = { showPinChangeDialog = true }) {
                        Text("Change")
                    }
                }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
            
            Text("Unlock Options", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            
            ListItem(
                headlineContent = { Text("Enable Volume Unlock") },
                supportingContent = { Text("Press Volume Up 4 times within 5s to unlock") },
                trailingContent = {
                    Switch(
                        checked = volumeUnlockEnabled,
                        onCheckedChange = { 
                            volumeUnlockEnabled = it
                            prefHelper.isVolumeUnlockEnabled = it
                        }
                    )
                }
            )

            ListItem(
                headlineContent = { Text("Enable Secret Tap Unlock") },
                supportingContent = { Text("Tap top-left corner multiple times to unlock") },
                trailingContent = {
                    Switch(
                        checked = secretTapsEnabled,
                        onCheckedChange = { 
                            secretTapsEnabled = it
                            prefHelper.isSecretTapsEnabled = it
                        }
                    )
                }
            )
            
            if (secretTapsEnabled) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("Secret Unlock Taps: ${secretTapsCount.toInt()}")
                Slider(
                    value = secretTapsCount,
                    onValueChange = { 
                        secretTapsCount = it
                        prefHelper.secretTapsCount = it.toInt()
                    },
                    valueRange = 3f..10f,
                    steps = 6
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

            Text("Schedule", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            
            ListItem(
                headlineContent = { Text("Enable Scheduled Lock") },
                supportingContent = { Text("Auto-lock device between specific times") },
                trailingContent = {
                    Switch(
                        checked = isScheduleEnabled,
                        onCheckedChange = { 
                            isScheduleEnabled = it
                            prefHelper.isScheduleEnabled = it
                        }
                    )
                }
            )

            if (isScheduleEnabled) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Start Time", style = MaterialTheme.typography.labelLarge)
                        OutlinedTextField(
                            value = startTime,
                            onValueChange = { 
                                startTime = it
                                prefHelper.scheduleStartTime = it
                            },
                            placeholder = { Text("22:00") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("End Time", style = MaterialTheme.typography.labelLarge)
                        OutlinedTextField(
                            value = endTime,
                            onValueChange = { 
                                endTime = it
                                prefHelper.scheduleEndTime = it
                            },
                            placeholder = { Text("07:00") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                Text(
                    text = "Use 24h format (HH:mm)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
            
            Text("Privacy Policy", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "KidsGuard Screen locks your device for children. We do not collect, store, or share any personal data or usage information.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

            Text("Account", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            ListItem(
                headlineContent = { Text("Switch Role") },
                supportingContent = { Text("Current role: ${prefHelper.userRole}") },
                trailingContent = {
                    TextButton(onClick = { 
                        prefHelper.userRole = "NONE"
                        onBack() // This will trigger redirection to RoleSelection
                    }) {
                        Text("Reset")
                    }
                }
            )
        }

        if (showPinChangeDialog) {
            var newPin by remember { mutableStateOf("") }
            var confirmPin by remember { mutableStateOf("") }
            var isError by remember { mutableStateOf(false) }

            AlertDialog(
                onDismissRequest = { showPinChangeDialog = false },
                title = { Text("Change PIN") },
                text = {
                    Column {
                        OutlinedTextField(
                            value = newPin,
                            onValueChange = {
                                if (it.length <= 8 && it.all { c -> c.isDigit() }) {
                                    newPin = it
                                    isError = false
                                }
                            },
                            label = { Text("Enter New PIN") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = confirmPin,
                            onValueChange = {
                                if (it.length <= 8 && it.all { c -> c.isDigit() }) {
                                    confirmPin = it
                                    isError = false
                                }
                            },
                            label = { Text("Confirm New PIN") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            visualTransformation = PasswordVisualTransformation(),
                            isError = isError,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (isError) {
                            Text(
                                text = "PINs do not match",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(start = 16.dp, top = 4.dp)
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newPin.isNotEmpty() && newPin == confirmPin) {
                                prefHelper.pin = newPin
                                pin = newPin
                                showPinChangeDialog = false
                            } else {
                                isError = true
                            }
                        }
                    ) {
                        Text("Save")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showPinChangeDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
fun LockedScreen(onUnlock: () -> Unit, prefHelper: PreferenceHelper, repository: SafeZoneRepository) {
    var tapCount by remember { mutableIntStateOf(0) }
    var firstTapTime by remember { mutableLongStateOf(0L) }
    var showPinDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current.findActivity()
    val density = LocalDensity.current
    val tapAreaSizePx = with(density) { 120.dp.toPx() }

    // Pulsing animation for the battery battery icon
    val infiniteTransition = rememberInfiniteTransition(label = "batteryPulse")
    val batteryAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    LaunchedEffect(context) {
        context?.window?.let { window ->
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    BackHandler(enabled = true) { /* Disable back button */ }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black) // OLED Full Black
            .pointerInput(prefHelper.isSecretTapsEnabled, prefHelper.secretTapsCount) {
                if (prefHelper.isSecretTapsEnabled) {
                    detectTapGestures { offset ->
                        val now = System.currentTimeMillis()
                        if (offset.x <= tapAreaSizePx && offset.y <= tapAreaSizePx) {
                            if (tapCount == 0 || now - firstTapTime > 5000) {
                                tapCount = 1
                                firstTapTime = now
                            } else {
                                tapCount++
                                if (tapCount >= prefHelper.secretTapsCount) {
                                    Log.i("KidsGuard", "Secret Tap Unlock triggered")
                                    repository.addEvent(ActivityEvent(type = "SECRET_TAP_UNLOCK", title = "Secret Tap Unlock", description = "Top-left corner pattern"))
                                    onUnlock()
                                }
                            }
                        }
                    }
                }
            }
    ) {
        // iPhone Dead Battery UI (Centered)
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.graphicsLayer { alpha = batteryAlpha }
            ) {
                Box(
                    modifier = Modifier
                        .size(width = 160.dp, height = 74.dp)
                        .border(3.dp, Color.White, RoundedCornerShape(16.dp))
                        .padding(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .width(18.dp)
                            .background(Color.Red, RoundedCornerShape(2.dp))
                    )
                }
                Spacer(modifier = Modifier.width(2.dp))
                Box(
                    modifier = Modifier
                        .size(width = 7.dp, height = 24.dp)
                        .background(Color.White, RoundedCornerShape(topEnd = 4.dp, bottomEnd = 4.dp))
                )
            }
            Spacer(modifier = Modifier.height(60.dp))
            
            // Lightning Bolt and Cable Visual
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.graphicsLayer { alpha = batteryAlpha }
            ) {
                Icon(
                    imageVector = Icons.Default.ElectricBolt,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(20.dp))
                // Cable Connector visual
                Box(
                    modifier = Modifier
                        .size(width = 30.dp, height = 45.dp)
                        .background(Color.White, RoundedCornerShape(8.dp))
                )
                Box(
                    modifier = Modifier
                        .size(width = 6.dp, height = 100.dp)
                        .background(Color.White)
                )
            }
        }

        // Hidden PIN unlock area at the bottom
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .align(Alignment.BottomCenter)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                    showPinDialog = true
                }
        )

        if (showPinDialog) {
            PinEntryDialog(
                onDismiss = { showPinDialog = false },
                onCorrectPin = {
                    showPinDialog = false
                    repository.addEvent(ActivityEvent(type = "PIN_SUCCESS", title = "PIN Unlock Success"))
                    onUnlock()
                },
                onIncorrectPin = {
                    repository.addEvent(ActivityEvent(type = "PIN_FAILED", title = "PIN Unlock Failed", description = "Attempt blocked"))
                },
                correctPin = prefHelper.pin
            )
        }
    }
}

@Composable
fun PinEntryDialog(
    title: String = "Enter PIN",
    onDismiss: () -> Unit,
    onCorrectPin: () -> Unit,
    onIncorrectPin: () -> Unit = {},
    correctPin: String
) {
    var pin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                OutlinedTextField(
                    value = pin,
                    onValueChange = {
                        if (it.length <= 8 && it.all { char -> char.isDigit() }) {
                            pin = it
                            isError = false
                        }
                    },
                    label = { Text("PIN") },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isError = isError,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (isError) {
                    Text(
                        text = "Incorrect PIN",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (pin == correctPin) {
                        onCorrectPin()
                    } else {
                        isError = true
                        onIncorrectPin()
                        pin = ""
                    }
                }
            ) {
                Text("Unlock")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun RoleSelectionScreen(onRoleSelected: (String) -> Unit, onOpenDeveloperMenu: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Shield,
            contentDescription = null,
            modifier = Modifier.size(100.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(32.dp))
        Text(
            text = "Welcome to KidsGuard",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Select your role to continue",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(48.dp))
        
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onRoleSelected("PARENT") },
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text("I am a Parent", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Monitor and protect your child's device remotely.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onRoleSelected("CHILD") },
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text("I am a Child", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Set up protection on this device.", style = MaterialTheme.typography.bodyMedium)
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
        
        TextButton(onClick = onOpenDeveloperMenu) {
            Icon(Icons.Default.BugReport, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Developer Tools")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentDashboardScreen(
    prefHelper: PreferenceHelper, 
    onOpenSettings: () -> Unit,
    onOpenSafeZones: () -> Unit,
    onOpenActivityFeed: () -> Unit,
    onOpenLocationHistory: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var showExitDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Parent Dashboard") },
                navigationIcon = {
                    IconButton(onClick = { showExitDialog = true }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Change Role")
                    }
                },
                actions = {
                    IconButton(onClick = onOpenSettings) {
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
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text("Monitored Device", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(16.dp))
            
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    ListItem(
                        headlineContent = { Text(prefHelper.childName.ifEmpty { "Child's Phone" }) },
                        supportingContent = { Text("Device: ${prefHelper.deviceName}") },
                        trailingContent = {
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = if (prefHelper.isLocked) "LOCKED" else "UNLOCKED",
                                    color = if (prefHelper.isLocked) Color.Red else Color.Green,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Online",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.Green
                                )
                            }
                        }
                    )
                    HorizontalDivider()
                    ListItem(
                        headlineContent = { Text("Battery Level") },
                        trailingContent = { Text("85%") } // Mocked
                    )
                    ListItem(
                        headlineContent = { Text("Last Updated") },
                        trailingContent = { Text("Just now") }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(
                    modifier = Modifier.weight(1f).clickable { /* Live Map Placeholder */ },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Map, contentDescription = null)
                        Text("Live Map", style = MaterialTheme.typography.titleMedium)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenSafeZones() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.LocationOn, contentDescription = null)
                        Text("Safe Zones", style = MaterialTheme.typography.titleMedium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenActivityFeed() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.List, contentDescription = null)
                        Text("Activity Feed", style = MaterialTheme.typography.titleMedium)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f).clickable { onOpenLocationHistory() },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.LocationOn, contentDescription = null)
                        Text("Location", style = MaterialTheme.typography.titleMedium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth().clickable { 
                    prefHelper.isLocked = !prefHelper.isLocked
                },
                colors = CardDefaults.cardColors(
                    containerColor = if (prefHelper.isLocked) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(if (prefHelper.isLocked) Icons.Default.LockOpen else Icons.Default.Lock, contentDescription = null)
                    Text(if (prefHelper.isLocked) "Remote Unlock" else "Remote Lock", style = MaterialTheme.typography.titleMedium)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            Button(
                onClick = onOpenSettings,
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Icon(Icons.Default.Settings, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Settings")
            }
        }

        if (showExitDialog) {
            AlertDialog(
                onDismissRequest = { showExitDialog = false },
                title = { Text("Change Role") },
                text = { Text("Are you sure you want to go back to role selection? This will logout of the parent dashboard.") },
                confirmButton = {
                    Button(onClick = {
                        showExitDialog = false
                        prefHelper.userRole = "NONE"
                        onBack()
                    }) {
                        Text("Confirm")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showExitDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildSetupScreen(prefHelper: PreferenceHelper, onSetupComplete: () -> Unit, onBack: () -> Unit) {
    var name by remember { mutableStateOf(prefHelper.childName) }
    var code by remember { mutableStateOf("") }
    var isGenerating by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Child Setup") },
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
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.ChildCare,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Child Device Setup",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(32.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Child's Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Device Info", style = MaterialTheme.typography.labelLarge)
                    Text(text = prefHelper.deviceName, style = MaterialTheme.typography.bodyLarge)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            if (code.isEmpty()) {
                Button(
                    onClick = {
                        if (name.isNotBlank()) {
                            prefHelper.childName = name
                            code = "KDG-${(100000..999999).random()}"
                            prefHelper.pairingCode = code
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    enabled = name.isNotBlank()
                ) {
                    Text("Generate Pairing Code")
                }
            } else {
                Text("Your Pairing Code", style = MaterialTheme.typography.labelLarge)
                Text(
                    text = code,
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(24.dp))
                
                // QR Placeholder
                Box(
                    modifier = Modifier
                        .size(200.dp)
                        .background(Color.White, RoundedCornerShape(8.dp))
                        .border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                imageVector = Icons.Default.QrCode,
                contentDescription = null,
                modifier = Modifier.size(150.dp),
                tint = Color.Black
            )
                }
                
                Spacer(modifier = Modifier.height(32.dp))
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                Text(
                    text = "Waiting for parent to connect...",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 8.dp)
                )

                Spacer(modifier = Modifier.height(32.dp))
                TextButton(onClick = onSetupComplete) {
                    Text("Skip to Dashboard (Mock Connect)")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentSetupScreen(prefHelper: PreferenceHelper, onSetupComplete: () -> Unit, onBack: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var isConnecting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Parent Setup") },
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.SupervisorAccount,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Connect to Child Device",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Enter the KDG code shown on your child's phone",
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(32.dp))

            OutlinedTextField(
                value = code,
                onValueChange = { 
                    code = it.uppercase()
                    error = ""
                },
                label = { Text("Pairing Code (e.g., KDG-123456)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = error.isNotEmpty(),
                supportingText = { if (error.isNotEmpty()) Text(error) }
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    if (code.startsWith("KDG-") && code.length == 10) {
                        isConnecting = true
                        // Mock connection delay
                        prefHelper.pairedChildId = "MOCK_CHILD_ID"
                        prefHelper.childName = "Alex" // Mock name
                        onSetupComplete()
                    } else {
                        error = "Invalid code format. Use KDG-123456"
                    }
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = code.isNotBlank()
            ) {
                if (isConnecting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Text("Connect")
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "OR",
                style = MaterialTheme.typography.labelMedium
            )
            Spacer(modifier = Modifier.height(24.dp))
            
            OutlinedButton(
                onClick = { /* Scan QR Mock */ },
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Scan QR Code")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeZoneListScreen(repository: SafeZoneRepository, onBack: () -> Unit) {
    val safeZones by repository.safeZones.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var zoneToEdit by remember { mutableStateOf<SafeZone?>(null) }
    var zoneToDelete by remember { mutableStateOf<SafeZone?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Safe Zones") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add Safe Zone")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(safeZones) { zone ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    ListItem(
                        headlineContent = { Text(zone.name, fontWeight = FontWeight.Bold) },
                        supportingContent = { 
                            Column {
                                Text("Type: ${zone.type}")
                                Text("Radius: ${zone.radiusMeters.toInt()}m")
                            }
                        },
                        leadingContent = {
                            val icon = when (zone.type) {
                                "Home" -> Icons.Default.Home
                                "School" -> Icons.Default.School
                                "Playground" -> Icons.Default.SportsBaseball
                                "Mosque" -> Icons.Default.Place
                                "Grandma" -> Icons.Default.Person
                                else -> Icons.Default.LocationOn
                            }
                            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        },
                        trailingContent = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Switch(
                                    checked = zone.enabled,
                                    onCheckedChange = {
                                        repository.updateSafeZone(zone.copy(enabled = it))
                                    }
                                )
                                IconButton(onClick = { zoneToEdit = zone }) {
                                    Icon(Icons.Default.Edit, contentDescription = "Edit")
                                }
                                IconButton(onClick = { zoneToDelete = zone }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    )
                }
            }
        }

        if (showAddDialog) {
            SafeZoneEditDialog(
                onDismiss = { showAddDialog = false },
                onSave = { newZone ->
                    repository.addSafeZone(newZone)
                    showAddDialog = false
                }
            )
        }

        if (zoneToEdit != null) {
            SafeZoneEditDialog(
                initialZone = zoneToEdit,
                onDismiss = { zoneToEdit = null },
                onSave = { updatedZone ->
                    repository.updateSafeZone(updatedZone)
                    zoneToEdit = null
                }
            )
        }

        if (zoneToDelete != null) {
            AlertDialog(
                onDismissRequest = { zoneToDelete = null },
                title = { Text("Delete Safe Zone") },
                text = { Text("Are you sure you want to delete '${zoneToDelete?.name}'?") },
                confirmButton = {
                    Button(
                        onClick = {
                            zoneToDelete?.id?.let { repository.deleteSafeZone(it) }
                            zoneToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Delete")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { zoneToDelete = null }) { Text("Cancel") }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeZoneEditDialog(
    initialZone: SafeZone? = null,
    onDismiss: () -> Unit,
    onSave: (SafeZone) -> Unit
) {
    var name by remember { mutableStateOf(initialZone?.name ?: "") }
    var type by remember { mutableStateOf(initialZone?.type ?: "Home") }
    var radius by remember { mutableFloatStateOf(initialZone?.radiusMeters?.toFloat() ?: 500f) }
    var notifyOnEnter by remember { mutableStateOf(initialZone?.notifyOnEnter ?: true) }
    var notifyOnExit by remember { mutableStateOf(initialZone?.notifyOnExit ?: true) }
    var enabled by remember { mutableStateOf(initialZone?.enabled ?: true) }
    
    var typeMenuExpanded by remember { mutableStateOf(false) }
    val zoneTypes = listOf("Home", "School", "Playground", "Mosque", "Grandma", "Custom")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialZone == null) "Add Safe Zone" else "Edit Safe Zone") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Map Placeholder
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                        .background(Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Map, contentDescription = null, tint = Color.White)
                        Text("Map picker will be added later", color = Color.White, style = MaterialTheme.typography.bodySmall)
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Zone Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                ExposedDropdownMenuBox(
                    expanded = typeMenuExpanded,
                    onExpandedChange = { typeMenuExpanded = !typeMenuExpanded }
                ) {
                    OutlinedTextField(
                        value = type,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Zone Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeMenuExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = typeMenuExpanded,
                        onDismissRequest = { typeMenuExpanded = false }
                    ) {
                        zoneTypes.forEach { selectionOption ->
                            DropdownMenuItem(
                                text = { Text(selectionOption) },
                                onClick = {
                                    type = selectionOption
                                    typeMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                Column {
                    Text("Radius: ${radius.toInt()}m", style = MaterialTheme.typography.bodyMedium)
                    Slider(
                        value = radius,
                        onValueChange = { radius = it },
                        valueRange = 50f..5000f,
                        steps = 99
                    )
                }

                ListItem(
                    headlineContent = { Text("Notify on Enter") },
                    trailingContent = {
                        Switch(checked = notifyOnEnter, onCheckedChange = { notifyOnEnter = it })
                    }
                )

                ListItem(
                    headlineContent = { Text("Notify on Exit") },
                    trailingContent = {
                        Switch(checked = notifyOnExit, onCheckedChange = { notifyOnExit = it })
                    }
                )

                ListItem(
                    headlineContent = { Text("Enabled") },
                    trailingContent = {
                        Switch(checked = enabled, onCheckedChange = { enabled = it })
                    }
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val zone = (initialZone ?: SafeZone(name = name, latitude = 0.0, longitude = 0.0, radiusMeters = radius.toDouble())).copy(
                            name = name,
                            type = type,
                            radiusMeters = radius.toDouble(),
                            notifyOnEnter = notifyOnEnter,
                            notifyOnExit = notifyOnExit,
                            enabled = enabled
                        )
                        onSave(zone)
                    }
                },
                enabled = name.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityFeedScreen(repository: SafeZoneRepository, onBack: () -> Unit) {
    val events by repository.activityEvents.collectAsState()
    var showClearDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Activity Feed") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showClearDialog = true }) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Clear History")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (events.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No recent activity", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(events) { event ->
                    val sdf = remember { java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()) }
                    val timeString = sdf.format(java.util.Date(event.timestamp))
                    
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = timeString,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val icon = when (event.type) {
                                "KID_MODE_ENABLED", "APP_LOCKED" -> Icons.Default.Lock
                                "KID_MODE_DISABLED", "APP_UNLOCKED", "PIN_SUCCESS", "SECRET_TAP_UNLOCK", "VOLUME_UNLOCK" -> Icons.Default.LockOpen
                                "PIN_FAILED" -> Icons.Default.GppBad
                                "SAFE_ZONE_ENTER" -> Icons.Default.LocationOn
                                "SAFE_ZONE_EXIT" -> Icons.Default.Logout
                                "BATTERY_LOW" -> Icons.Default.BatteryAlert
                                else -> Icons.Default.Info
                            }
                            val tint = when (event.type) {
                                "KID_MODE_ENABLED", "APP_LOCKED" -> Color.Red
                                "KID_MODE_DISABLED", "APP_UNLOCKED", "PIN_SUCCESS" -> Color.Green
                                "PIN_FAILED" -> MaterialTheme.colorScheme.error
                                else -> MaterialTheme.colorScheme.primary
                            }
                            
                            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = event.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (event.description.isNotEmpty()) {
                            Text(
                                text = event.description,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(start = 32.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(modifier = Modifier.padding(start = 32.dp))
                    }
                }
            }
        }

        if (showClearDialog) {
            AlertDialog(
                onDismissRequest = { showClearDialog = false },
                title = { Text("Clear History") },
                text = { Text("Are you sure you want to delete all activity events?") },
                confirmButton = {
                    Button(
                        onClick = {
                            repository.clearEvents()
                            showClearDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Clear")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationHistoryScreen(repository: LocationRepository, onBack: () -> Unit) {
    val history by repository.locationHistory.collectAsState()
    var showClearDialog by remember { mutableStateOf(false) }
    var showPermissionExplanation by remember { mutableStateOf(false) }
    var permissionDeniedMessage by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val locationProvider = remember { LocalLocationProvider(context) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            locationProvider.requestSingleUpdate { point ->
                if (point != null) {
                    repository.addLocationPoint(point)
                } else {
                    Log.w("KidsGuard", "Location permission granted but no location available")
                }
            }
        } else {
            permissionDeniedMessage = true
        }
    }

    fun handleLocationRequest() {
        when {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED -> {
                locationProvider.requestSingleUpdate { point ->
                    if (point != null) {
                        repository.addLocationPoint(point)
                    } else {
                        Log.w("KidsGuard", "Location request returned null despite permission granted")
                    }
                }
            }
            else -> {
                showPermissionExplanation = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Location History") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showClearDialog = true }) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Clear History")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { handleLocationRequest() },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "Get Current Location")
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            if (permissionDeniedMessage) {
                Card(
                    modifier = Modifier.padding(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Error, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Permission Denied", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.error)
                            Text("Location permission is required to fetch current GPS coordinates.", style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = { 
                            permissionDeniedMessage = false
                            showPermissionExplanation = true 
                        }) {
                            Text("Retry")
                        }
                    }
                }
            }

            if (history.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No location history recorded", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(history) { point ->
                        val sdf = remember { java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()) }
                        val timeString = sdf.format(java.util.Date(point.timestamp))
                        
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = timeString,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Text(
                                        text = "Accuracy: ${point.accuracy.toInt()}m",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(modifier = Modifier.fillMaxWidth()) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Lat:", style = MaterialTheme.typography.labelSmall)
                                        Text(point.latitude.toString(), style = MaterialTheme.typography.bodyMedium)
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Lng:", style = MaterialTheme.typography.labelSmall)
                                        Text(point.longitude.toString(), style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Speed, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.secondary)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Speed: ${"%.1f".format(point.speed * 3.6)} km/h",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (showClearDialog) {
            AlertDialog(
                onDismissRequest = { showClearDialog = false },
                title = { Text("Clear History") },
                text = { Text("Delete all recorded location points?") },
                confirmButton = {
                    Button(
                        onClick = {
                            repository.clearLocationHistory()
                            showClearDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Clear")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearDialog = false }) { Text("Cancel") }
                }
            )
        }

        if (showPermissionExplanation) {
            AlertDialog(
                onDismissRequest = { showPermissionExplanation = false },
                title = { Text("Location Permission") },
                text = { 
                    Text("KidsGuard needs your location to provide accurate safety monitoring and history. Please grant location access on the next screen.") 
                },
                confirmButton = {
                    Button(onClick = {
                        showPermissionExplanation = false
                        permissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }) {
                        Text("Grant Permission")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showPermissionExplanation = false }) {
                        Text("Later")
                    }
                }
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun HomePreview() {
    KidsGuardTheme(darkTheme = true) {
        val repository = SafeZoneRepository()
        val locationRepository = LocationRepository(LocalContext.current)
        KidsGuardApp(
            currentScreen = Screen.Home, 
            onScreenChange = {}, 
            repository = repository,
            locationRepository = locationRepository
        )
    }
}

fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeveloperMenuScreen(
    onBack: () -> Unit,
    prefHelper: PreferenceHelper,
    repository: SafeZoneRepository,
    locationRepository: LocationRepository,
    onScreenChange: (Screen) -> Unit
) {
    var showConfirmDialog by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Developer Tools") },
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
            DeveloperActionItem(
                title = "Reset Role Selection",
                description = "Resets user role to NONE and clears pairing data.",
                onClick = { showConfirmDialog = "RESET_ROLE" }
            )
            DeveloperActionItem(
                title = "Clear Pairing Data",
                description = "Clears child ID, name, and pairing code.",
                onClick = { showConfirmDialog = "CLEAR_PAIRING" }
            )
            DeveloperActionItem(
                title = "Clear Activity History",
                description = "Deletes all events from the activity feed.",
                onClick = { showConfirmDialog = "CLEAR_ACTIVITY" }
            )
            DeveloperActionItem(
                title = "Clear Location History",
                description = "Deletes all recorded location points.",
                onClick = { showConfirmDialog = "CLEAR_LOCATION" }
            )
            DeveloperActionItem(
                title = "Clear Safe Zones",
                description = "Removes all defined safe zones.",
                onClick = { showConfirmDialog = "CLEAR_SAFEZONES" }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            DeveloperActionItem(
                title = "Force KidGuard Lock",
                description = "Immediately activate the lock screen.",
                color = MaterialTheme.colorScheme.error,
                onClick = {
                    prefHelper.isLocked = true
                    onScreenChange(Screen.Locked)
                }
            )
            DeveloperActionItem(
                title = "Force Unlock",
                description = "Immediately deactivate the lock screen.",
                color = Color.Green,
                onClick = {
                    prefHelper.isLocked = false
                    onScreenChange(Screen.Home)
                }
            )
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            Button(
                onClick = { showConfirmDialog = "RESET_ALL" },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("Reset Everything (Keep Security Settings)")
            }
        }

        if (showConfirmDialog != null) {
            AlertDialog(
                onDismissRequest = { showConfirmDialog = null },
                title = { Text("Confirm Action") },
                text = { Text("Are you sure you want to proceed? This action cannot be undone.") },
                confirmButton = {
                    Button(
                        onClick = {
                            when (showConfirmDialog) {
                                "RESET_ROLE" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                    onScreenChange(Screen.RoleSelection)
                                }
                                "CLEAR_PAIRING" -> {
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                }
                                "CLEAR_ACTIVITY" -> repository.clearEvents()
                                "CLEAR_LOCATION" -> locationRepository.clearLocationHistory()
                                "CLEAR_SAFEZONES" -> repository.clearAllSafeZones()
                                "RESET_ALL" -> {
                                    prefHelper.userRole = "NONE"
                                    prefHelper.pairedChildId = null
                                    prefHelper.childName = ""
                                    prefHelper.pairingCode = ""
                                    prefHelper.isLocked = false
                                    repository.clearEvents()
                                    repository.clearAllSafeZones()
                                    locationRepository.clearLocationHistory()
                                    onScreenChange(Screen.RoleSelection)
                                }
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
            Text(text = title, style = MaterialTheme.typography.titleMedium, color = color, fontWeight = FontWeight.Bold)
            Text(text = description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
