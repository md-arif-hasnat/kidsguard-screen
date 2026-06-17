package com.example.kidsguard.sync

import android.content.Context
import android.util.Log
import android.widget.Toast
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.tracking.BackgroundTrackingManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Handles execution of remote commands received from the sync provider.
 */
class RemoteCommandHandler(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val trackingManager: BackgroundTrackingManager,
    private val syncProvider: RemoteSyncProvider,
    private val onLockRequested: () -> Unit,
    private val onUnlockRequested: () -> Unit,
    private val onRefreshLocationRequested: () -> Unit
) {
    private val TAG = "RemoteCommandHandler"

    private val _lastCommandReceived = MutableStateFlow("None")
    val lastCommandReceived: StateFlow<String> = _lastCommandReceived

    private val _lastExecutionResult = MutableStateFlow("None")
    val lastExecutionResult: StateFlow<String> = _lastExecutionResult

    fun handleCommand(command: SyncRemoteCommand) {
        Log.d(TAG, "Executing command: ${command.commandType}")
        _lastCommandReceived.value = "${command.commandType} (${command.commandId})"
        
        try {
            when (command.commandType) {
                CommandType.LOCK_NOW -> {
                    prefHelper.isLocked = true
                    onLockRequested()
                    showToast("Remote LOCK executed")
                }
                CommandType.UNLOCK_NOW -> {
                    prefHelper.isLocked = false
                    onUnlockRequested()
                    showToast("Remote UNLOCK executed")
                }
                CommandType.START_TRACKING -> {
                    trackingManager.startTracking()
                    showToast("Remote START_TRACKING executed")
                }
                CommandType.STOP_TRACKING -> {
                    trackingManager.stopTracking()
                    showToast("Remote STOP_TRACKING executed")
                }
                CommandType.REFRESH_LOCATION -> {
                    onRefreshLocationRequested()
                    showToast("Remote REFRESH executed")
                }
                CommandType.RING_PHONE -> {
                    showToast("Remote RING executed")
                }
            }
            _lastExecutionResult.value = "SUCCESS: ${command.commandType}"
            syncProvider.updateCommandStatus(command.commandId, CommandStatus.EXECUTED)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to execute command", e)
            _lastExecutionResult.value = "FAILED: ${e.message}"
            syncProvider.updateCommandStatus(command.commandId, CommandStatus.FAILED)
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
}
