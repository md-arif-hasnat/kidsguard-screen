package com.example.kidsguard.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kidsguard.R
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import com.example.kidsguard.data.PreferenceHelper
import androidx.compose.ui.platform.LocalContext

import androidx.compose.runtime.saveable.rememberSaveable
import android.util.Log

@Composable
fun RoleSelectionScreen(onRoleSelected: (String) -> Unit, onOpenDeveloperMenu: () -> Unit) {
    val context = LocalContext.current
    val prefHelper = remember { PreferenceHelper(context) }
    
    // Developer Menu hidden access
    var logoTapCount by rememberSaveable { mutableIntStateOf(0) }
    var lastLogoTapTime by rememberSaveable { mutableLongStateOf(0L) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
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
                    val now = System.currentTimeMillis()
                    Log.d("DeveloperMenu", "RoleSelection: Logo tapped! Current count: $logoTapCount, Delta: ${now - lastLogoTapTime}ms")

                    if (now - lastLogoTapTime > 2000) {
                        logoTapCount = 1
                        Log.d("DeveloperMenu", "RoleSelection: Timeout, resetting to 1")
                    } else {
                        logoTapCount++
                        Log.d("DeveloperMenu", "RoleSelection: Progressing to $logoTapCount")
                    }
                    
                    lastLogoTapTime = now
                    
                    if (logoTapCount >= 7) {
                        Log.i("DeveloperMenu", "RoleSelection: 7-tap complete. Opening Developer Menu.")
                        logoTapCount = 0
                        onOpenDeveloperMenu()
                    }
                }
        )
        Spacer(modifier = Modifier.height(32.dp))
        Text(
            text = "Welcome to KidsGuard",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "PROTECT • GUIDE • GROW",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(top = 4.dp),
            letterSpacing = 2.sp
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Select your role to continue",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (prefHelper.removedByParent) {
            Spacer(modifier = Modifier.height(16.dp))
            Surface(
                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "This device was removed by the parent. Pair it again to continue.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(12.dp),
                    textAlign = TextAlign.Center,
                    fontWeight = FontWeight.Bold
                )
            }
        }

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
