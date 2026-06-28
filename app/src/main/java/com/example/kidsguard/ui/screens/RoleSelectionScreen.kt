package com.example.kidsguard.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kidsguard.R

@Composable
fun RoleSelectionScreen(onRoleSelected: (String) -> Unit, onOpenDeveloperMenu: () -> Unit) {
    // Developer Menu hidden access
    var logoTapCount by remember { mutableIntStateOf(0) }
    var lastLogoTapTime by remember { mutableLongStateOf(0L) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.masterlogo),
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
