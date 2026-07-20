package com.example.kidsguard.ui.screens

import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChildCare
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AuthRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.RemoteSyncProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(prefHelper.childName) }
    var code by remember { mutableStateOf(prefHelper.pairingCode) }
    var avatarId by remember { mutableStateOf(prefHelper.avatarId) }
    var isGenerating by remember { mutableStateOf(false) }
    var isPaired by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }

    val avatars = listOf("avatar_1", "avatar_2", "avatar_3", "avatar_4", "avatar_5", "avatar_6")

    // Listen for pairing completion
    DisposableEffect(code) {
        var listener: ListenerRegistration? = null
        if (code.isNotEmpty() && !code.startsWith("MOCK-") && code.any { it.isDigit() }) {
            val db = FirebaseFirestore.getInstance()
            listener = db.collection("pairingCodes").document(code)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        Log.e("ChildSetup", "Pairing listener error", e)
                        return@addSnapshotListener
                    }
                    if (snapshot != null && snapshot.exists()) {
                        val used = snapshot.getBoolean("used") ?: false
                        if (used) {
                            Log.i("ChildSetup", "Pairing detected for code: $code")
                            scope.launch {
                                isSaving = true
                                try {
                                    val familyId = snapshot.getString("familyId")
                                    val childId = snapshot.getString("childId")
                                    val parentName = snapshot.getString("parentName")
                                    Log.d(
                                        "Pairing",
                                        "Firebase parent name=${parentName}"
                                    )
                                    val pairedAt = snapshot.getTimestamp("pairedAt")?.toDate()?.time
                                        ?: System.currentTimeMillis()

                                    prefHelper.familyId = familyId
                                    prefHelper.pairedChildId = childId
                                    prefHelper.parentName = parentName
                                    prefHelper.pairedAt = pairedAt
                                    prefHelper.userRole = "CHILD"
                                    prefHelper.isSetupCompleted = true

                                    repository.setSyncProvider(
                                        syncProvider,
                                        prefHelper.childId,
                                        prefHelper.familyId
                                    )
                                    Log.d(
                                        "SafeZoneRepo",
                                        "Repository initialized after pairing: childId=${prefHelper.childId}, familyId=${prefHelper.familyId}"
                                    )

                                    Log.i(
                                        "ChildSetup",
                                        "Pairing saved: familyId=$familyId, childId=$childId, role=CHILD"
                                    )
                                    isPaired = true

                                    // Automatic navigation after success
                                    delay(2000)
                                    Log.i(
                                        "ChildSetup",
                                        "Navigating to next screen after successful pairing"
                                    )
                                    onSetupComplete()
                                } catch (err: Exception) {
                                    Log.e("ChildSetup", "Failed to save pairing data", err)
                                    saveError = "Failed to finalize setup: ${err.message}"
                                } finally {
                                    isSaving = false
                                }
                            }
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
                        border = if (isSelected) BorderStroke(
                            2.dp,
                            MaterialTheme.colorScheme.primary
                        ) else null
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

            if (isSaving) {
                CircularProgressIndicator()
                Text("Finalizing setup...", modifier = Modifier.padding(top = 16.dp))
            } else if (saveError != null) {
                Text(saveError!!, color = MaterialTheme.colorScheme.error)
                Button(onClick = { saveError = null }) {
                    Text("Retry")
                }
            } else if (isPaired) {
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
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = onSetupComplete,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Text("Continue to Permissions")
                }
            } else if (code.isEmpty() || code.startsWith("KDG-") || code.startsWith("MOCK-")) { // Allow regenerate if mock
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
                                    saveError =
                                        "Failed to create pairing code in the cloud. Please check your internet connection and try again."
                                }
                                isGenerating = false
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    enabled = isNameValid && !isGenerating
                ) {
                    if (isGenerating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White
                        )
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
                                } else {
                                    saveError =
                                        "Failed to regenerate pairing code. Please try again."
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
