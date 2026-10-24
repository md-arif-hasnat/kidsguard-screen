package com.example.kidsguard.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.security.PinSecurity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun PinEntryDialog(
    title: String = "Enter PIN",
    onDismiss: () -> Unit,
    onCorrectPin: () -> Unit,
    onIncorrectPin: () -> Unit = {},
    prefHelper: PreferenceHelper
) {
    var pin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("Incorrect PIN") }
    var isChecking by remember { mutableStateOf(false) }
    var lockoutRemainingSeconds by remember {
        mutableIntStateOf(prefHelper.pinLockoutRemainingSeconds())
    }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(prefHelper) {
        while (true) {
            lockoutRemainingSeconds = prefHelper.pinLockoutRemainingSeconds()
            delay(1_000L)
        }
    }

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
                    enabled = !isChecking && lockoutRemainingSeconds == 0,
                    modifier = Modifier.fillMaxWidth()
                )
                if (lockoutRemainingSeconds > 0) {
                    Text(
                        text = "Too many attempts. Try again in ${lockoutRemainingSeconds}s.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(start = 16.dp, top = 4.dp)
                    )
                } else if (isError) {
                    Text(
                        text = errorMessage,
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
                    val enteredPin = pin.trim()
                    isChecking = true
                    coroutineScope.launch {
                        val result = withContext(Dispatchers.Default) {
                            prefHelper.verifyPin(enteredPin)
                        }
                        isChecking = false
                        lockoutRemainingSeconds = result.lockoutRemainingSeconds
                        if (result.verified) {
                            onCorrectPin()
                        } else {
                            isError = true
                            errorMessage = when {
                                result.lockedOut ->
                                    "Too many attempts. Try again in ${result.lockoutRemainingSeconds}s."
                                result.remainingAttempts == 1 ->
                                    "Incorrect PIN. 1 attempt remaining."
                                else ->
                                    "Incorrect PIN. ${result.remainingAttempts} attempts remaining."
                            }
                            onIncorrectPin()
                            pin = ""
                        }
                    }
                },
                enabled = !isChecking &&
                    lockoutRemainingSeconds == 0 &&
                    PinSecurity.isValidPin(pin.trim())
            ) {
                Text(if (isChecking) "Checking…" else "Unlock")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
