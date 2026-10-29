package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.SupervisorAccount
import androidx.compose.material3.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AuthRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentSetupScreen(
    prefHelper: PreferenceHelper, 
    authRepository: AuthRepository,
    onSetupComplete: () -> Unit, 
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var isConnecting by remember { mutableStateOf(false) }
    var consentAccepted by remember { mutableStateOf(false) }
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
                text = "Enter the 6-digit code shown on your child's phone",
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(32.dp))

            OutlinedTextField(
                value = code,
                onValueChange = { 
                    code = it.filter { ch -> ch.isDigit() }.take(6)
                    error = ""
                },
                label = { Text("6-digit pairing code") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = error.isNotEmpty(),
                supportingText = { if (error.isNotEmpty()) Text(error) }
            )

            Spacer(modifier = Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = consentAccepted,
                    onCheckedChange = { consentAccepted = it; error = "" }
                )
                Text(
                    "I confirm that I am the parent or authorized guardian and consent to linking this child device for parental controls, activity monitoring, location and safety alerts.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    if (code.length == 6 && consentAccepted) {
                        isConnecting = true
                        error = ""
                        scope.launch {
                            try {
                                authRepository.validateAndPair(code, consentAccepted)
                                    .onSuccess { onSetupComplete() }
                                    .onFailure { cause ->
                                        error = cause.message ?: "Unable to connect this child device."
                                    }
                            } finally {
                                isConnecting = false
                            }
                        }
                    } else {
                        error = if (!consentAccepted) "Parental consent is required."
                            else "Enter a valid 6-digit pairing code."
                    }
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = code.length == 6 && consentAccepted && !isConnecting
            ) {
                if (isConnecting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Text("Connect")
                }
            }
            
            if (com.example.kidsguard.BuildConfig.DEBUG) {
                Spacer(modifier = Modifier.height(24.dp))
                TextButton(
                    onClick = {
                        prefHelper.userRole = "PARENT"
                        prefHelper.pairedChildId = "mock_child_001"
                        prefHelper.childName = "Test Child"
                        prefHelper.deviceName = "Android Emulator"
                        onSetupComplete()
                    }
                ) {
                    Text("Use Mock Child for Testing", color = MaterialTheme.colorScheme.secondary)
                }
            }
        }
    }
}
