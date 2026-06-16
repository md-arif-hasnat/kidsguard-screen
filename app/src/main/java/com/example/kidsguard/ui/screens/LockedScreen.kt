package com.example.kidsguard.ui.screens

import android.util.Log
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.data.findActivity
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.repository.SafeZoneRepository

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
