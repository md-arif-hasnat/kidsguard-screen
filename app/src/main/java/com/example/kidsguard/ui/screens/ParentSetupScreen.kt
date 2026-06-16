package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.SupervisorAccount
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper

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
