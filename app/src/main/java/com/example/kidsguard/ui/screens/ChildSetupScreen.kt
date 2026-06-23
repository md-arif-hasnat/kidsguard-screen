package com.example.kidsguard.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChildCare
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.RemoteSyncProvider
import kotlinx.coroutines.launch

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.filled.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChildSetupScreen(
    prefHelper: PreferenceHelper, 
    authRepository: AuthRepository,
    repository: SafeZoneRepository,
    syncProvider: RemoteSyncProvider,
    onSetupComplete: () -> Unit, 
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(prefHelper.childName) }
    var code by remember { mutableStateOf(prefHelper.pairingCode) }
    var avatarId by remember { mutableStateOf(prefHelper.avatarId) }
    var isGenerating by remember { mutableStateOf(false) }
    var isPaired by remember { mutableStateOf(false) }

    val avatars = listOf("avatar_1", "avatar_2", "avatar_3", "avatar_4", "avatar_5", "avatar_6")

    // Listen for pairing completion
    DisposableEffect(code) {
        var listener: ListenerRegistration? = null
        if (code.isNotEmpty() && !code.startsWith("MOCK-")) {
            val db = FirebaseFirestore.getInstance()
            listener = db.collection("pairingCodes").document(code)
                .addSnapshotListener { snapshot, e ->
                    if (snapshot != null && snapshot.exists()) {
                        val used = snapshot.getBoolean("used") ?: false
                        if (used) {
                            isPaired = true
                            prefHelper.familyId = snapshot.getString("familyId")
                            prefHelper.pairedChildId = snapshot.getString("childId")
                        }
                    }
                }
        }
        onDispose {
            listener?.remove()
        }
    }

    val trimmedName = name.trim()
    val isNameValid = trimmedName.length in 2..30
    val nameErrorMessage = when {
        name.isEmpty() -> null
        trimmedName.isEmpty() -> "Child name is required."
        trimmedName.length < 2 -> "Name is too short (min 2 characters)."
        trimmedName.length > 30 -> "Name is too long (max 30 characters)."
        else -> null
    }

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
            Spacer(modifier = Modifier.height(24.dp))

            Text("Select Avatar", style = MaterialTheme.typography.labelLarge)
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                avatars.forEach { id ->
                    val isSelected = avatarId == id
                    Surface(
                        modifier = Modifier
                            .size(56.dp)
                            .clickable { 
                                avatarId = id
                                prefHelper.avatarId = id
                            },
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                        border = if (isSelected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = id.replace("avatar_", ""),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 35) name = it },
                label = { Text("Child's Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = nameErrorMessage != null,
                supportingText = {
                    if (nameErrorMessage != null) {
                        Text(text = nameErrorMessage, color = MaterialTheme.colorScheme.error)
                    }
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Device Info", style = MaterialTheme.typography.labelLarge)
                    Text(text = prefHelper.deviceName, style = MaterialTheme.typography.bodyLarge)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            if (isPaired) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    modifier = Modifier.size(100.dp),
                    tint = Color.Green
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Connected Successfully!",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.Green
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Your device is now linked to your parent's dashboard.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 32.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = onSetupComplete,
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    Text("Go to Dashboard")
                }
            } else if (code.isEmpty() || code.startsWith("KDG-")) { // Keep legacy check or allow regenerate
                Button(
                    onClick = {
                        if (isNameValid) {
                            prefHelper.childName = trimmedName
                            scope.launch {
                                isGenerating = true
                                val newCode = authRepository.generatePairingCode()
                                if (newCode != null) {
                                    code = newCode
                                    prefHelper.pairingCode = newCode
                                    // Enable sync immediately using the stable childId, NOT the pairing code
                                    repository.setSyncProvider(syncProvider, prefHelper.childId)
                                } else {
                                    // Fallback to mock if Firebase fails
                                    val mockCode = "MOCK-${(100000..999999).random()}"
                                    code = mockCode
                                    prefHelper.pairingCode = mockCode
                                }
                                isGenerating = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    enabled = isNameValid && !isGenerating
                ) {
                    if (isGenerating) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                    } else {
                        Text("Generate Pairing Code")
                    }
                }
            } else {
                Text("Your Pairing Code", style = MaterialTheme.typography.labelLarge)
                Text(
                    text = code,
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                TextButton(
                    onClick = {
                        if (isNameValid) {
                            prefHelper.childName = trimmedName
                            scope.launch {
                                isGenerating = true
                                val newCode = authRepository.generatePairingCode()
                                if (newCode != null) {
                                    code = newCode
                                    prefHelper.pairingCode = newCode
                                }
                                isGenerating = false
                            }
                        }
                    },
                    enabled = isNameValid && !isGenerating
                ) {
                    Text("Regenerate Code")
                }
                Spacer(modifier = Modifier.height(16.dp))
                
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
                TextButton(
                    onClick = onSetupComplete,
                    enabled = isNameValid
                ) {
                    Text("Skip to Dashboard (Mock Connect)")
                }
            }
        }
    }
}
