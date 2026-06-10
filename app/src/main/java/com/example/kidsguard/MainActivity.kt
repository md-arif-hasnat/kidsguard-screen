package com.example.kidsguard

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.os.BatteryManager
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import java.util.Calendar
import com.example.kidsguard.models.*
import com.example.kidsguard.repository.SafeZoneRepository
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
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
    private var currentScreenState = mutableStateOf(Screen.Home)
    private var volumeUpTapCount = 0
    private var firstVolumeUpTapTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefHelper = PreferenceHelper(this)
        
        // Auto Re-lock: If it was locked, start locked
        if (prefHelper.isLocked) {
            currentScreenState.value = Screen.Locked
        }

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
                        }
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
        if (parts.size != 2) return 0
        return (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
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
    val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { ifilter ->
        context.registerReceiver(null, ifilter)
    }
    return batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
}

enum class Screen {
    RoleSelection, Home, Locked, Settings, ParentDashboard, SafeZoneList, ActivityFeed
}

@Composable
fun KidsGuardApp(currentScreen: Screen, onScreenChange: (Screen) -> Unit) {
    val context = LocalContext.current
    val prefHelper = remember { PreferenceHelper(context) }
    val repository = remember { SafeZoneRepository() }
    
    // Initial redirection based on role
    val startScreen = remember(currentScreen) {
        if (currentScreen == Screen.Home && prefHelper.userRole == "NONE") {
            Screen.RoleSelection
        } else if (currentScreen == Screen.Home && prefHelper.userRole == "PARENT") {
            Screen.ParentDashboard
        } else {
            currentScreen
        }
    }

    Crossfade(targetState = startScreen, label = "screenTransition") { screen ->
        when (screen) {
            Screen.RoleSelection -> RoleSelectionScreen(
                onRoleSelected = { role: String ->
                    prefHelper.userRole = role
                    onScreenChange(if (role == "PARENT") Screen.ParentDashboard else Screen.Home)
                }
            )
            Screen.Home -> HomeScreen(
                onActivate = { onScreenChange(Screen.Locked) },
                onOpenSettings = { onScreenChange(Screen.Settings) },
                prefHelper = prefHelper
            )
            Screen.ParentDashboard -> ParentDashboardScreen(
                prefHelper = prefHelper,
                onOpenSettings = { onScreenChange(Screen.Settings) },
                onOpenSafeZones = { onScreenChange(Screen.SafeZoneList) },
                onOpenActivityFeed = { onScreenChange(Screen.ActivityFeed) }
            )
            Screen.SafeZoneList -> SafeZoneListScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.ActivityFeed -> ActivityFeedScreen(
                repository = repository,
                onBack = { onScreenChange(Screen.ParentDashboard) }
            )
            Screen.Locked -> LockedScreen(
                onUnlock = { onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home) },
                prefHelper = prefHelper
            )
            Screen.Settings -> SettingsScreen(
                onBack = { onScreenChange(if (prefHelper.userRole == "PARENT") Screen.ParentDashboard else Screen.Home) },
                prefHelper = prefHelper
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onActivate: () -> Unit, onOpenSettings: () -> Unit, prefHelper: PreferenceHelper) {
    val context = LocalContext.current.findActivity()
    var showPinDialog by remember { mutableStateOf(false) }
    
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
                modifier = Modifier.size(120.dp),
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
fun LockedScreen(onUnlock: () -> Unit, prefHelper: PreferenceHelper) {
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
                    onUnlock()
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
fun RoleSelectionScreen(onRoleSelected: (String) -> Unit) {
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
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentDashboardScreen(
    prefHelper: PreferenceHelper, 
    onOpenSettings: () -> Unit,
    onOpenSafeZones: () -> Unit,
    onOpenActivityFeed: () -> Unit
) {
    var showPairDialog by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Parent Dashboard") },
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
            if (prefHelper.pairedChildId == null) {
                Box(modifier = Modifier.fillMaxWidth().height(300.dp), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = null,
                            modifier = Modifier.size(80.dp),
                            tint = MaterialTheme.colorScheme.outline
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No child device paired",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Pair a device to monitor status and remote lock.",
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { showPairDialog = true },
                            modifier = Modifier.fillMaxWidth().height(56.dp)
                        ) {
                            Text("Pair Child Device")
                        }
                    }
                }
            } else {
                Text("Monitored Device", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        ListItem(
                            headlineContent = { Text("Child's Phone") },
                            supportingContent = { Text("ID: ${prefHelper.pairedChildId}") },
                            trailingContent = {
                                Text(
                                    text = if (prefHelper.isLocked) "LOCKED" else "UNLOCKED",
                                    color = if (prefHelper.isLocked) Color.Red else Color.Green,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        )
                        HorizontalDivider()
                        ListItem(
                            headlineContent = { Text("Battery Level") },
                            trailingContent = { Text("85%") } // Mocked
                        )
                        ListItem(
                            headlineContent = { Text("Last Active") },
                            trailingContent = { Text("Just now") }
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        modifier = Modifier.weight(1f).clickable { onOpenSafeZones() },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.LocationOn, contentDescription = null)
                            Text("Safe Zones", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                    Card(
                        modifier = Modifier.weight(1f).clickable { onOpenActivityFeed() },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.List, contentDescription = null)
                            Text("Activity Feed", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
                
                Button(
                    onClick = { 
                        // Mock Remote Lock Command
                        prefHelper.isLocked = true 
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Activate Remote KidGuard Lock")
                }
            }
        }

        if (showPairDialog) {
            var code by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { showPairDialog = false },
                title = { Text("Pair Child Device") },
                text = {
                    Column {
                        Text("Enter the pairing code shown on the child's device.")
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = code,
                            onValueChange = { if (it.length <= 6) code = it },
                            label = { Text("Pairing Code") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (code.length == 6) {
                            prefHelper.pairedChildId = "DEVICE_$code"
                            showPairDialog = false
                        }
                    }) {
                        Text("Pair")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showPairDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeZoneListScreen(repository: SafeZoneRepository, onBack: () -> Unit) {
    val safeZones by repository.safeZones.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

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
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(safeZones) { zone ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    ListItem(
                        headlineContent = { Text(zone.name, fontWeight = FontWeight.Bold) },
                        supportingContent = { Text("Radius: ${zone.radiusMeters.toInt()}m") },
                        leadingContent = {
                            val icon = when {
                                zone.name.contains("Home", ignoreCase = true) -> Icons.Default.Home
                                zone.name.contains("School", ignoreCase = true) -> Icons.Default.School
                                else -> Icons.Default.LocationOn
                            }
                            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        },
                        trailingContent = {
                            Switch(checked = zone.enabled, onCheckedChange = {
                                repository.updateSafeZone(zone.copy(enabled = it))
                            })
                        }
                    )
                }
            }
        }

        if (showAddDialog) {
            var name by remember { mutableStateOf("") }
            var radius by remember { mutableFloatStateOf(500f) }
            
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Add Safe Zone") },
                text = {
                    Column {
                        // Map Placeholder
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(150.dp)
                                .background(Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Map Picker Placeholder", color = Color.White)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Zone Name (e.g., Home)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Radius: ${radius.toInt()}m")
                        Slider(
                            value = radius,
                            onValueChange = { radius = it },
                            valueRange = 50f..5000f,
                            steps = 99
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (name.isNotBlank()) {
                            repository.addSafeZone(SafeZone(name = name, latitude = 0.0, longitude = 0.0, radiusMeters = radius.toDouble()))
                            showAddDialog = false
                        }
                    }) {
                        Text("Save")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityFeedScreen(repository: SafeZoneRepository, onBack: () -> Unit) {
    val events by repository.activityEvents.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Activity Feed") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(events) { event ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier.size(12.dp).background(
                            if (event.type == "Arrived" || event.type == "Entered") Color.Green else Color.Red,
                            CircleShape
                        )
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${event.type} ${event.zoneName}", fontWeight = FontWeight.Bold)
                        Text(event.details, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                HorizontalDivider(modifier = Modifier.padding(start = 28.dp))
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun HomePreview() {
    KidsGuardTheme(darkTheme = true) {
        KidsGuardApp(currentScreen = Screen.Home, onScreenChange = {})
    }
}

fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
