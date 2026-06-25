package com.example.kidsguard.sync

import android.content.Context
import android.util.Log
import android.widget.Toast
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.SafeZoneRepository
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
    private val safeZoneRepository: SafeZoneRepository,
    private val notificationEngine: LocalNotificationEngine,
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
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "REMOTE_LOCK",
                        title = "Remote Lock Executed",
                        description = "Command from parent executed successfully"
                    ))
                    showToast("Remote LOCK executed")
                }
                CommandType.UNLOCK_NOW -> {
                    prefHelper.isLocked = false
                    onUnlockRequested()
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "REMOTE_UNLOCK",
                        title = "Remote Unlock Executed",
                        description = "Command from parent executed successfully"
                    ))
                    showToast("Remote UNLOCK executed")
                }
                CommandType.START_TRACKING -> {
                    trackingManager.startTracking()
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "REMOTE_TRACKING_START",
                        title = "Remote Tracking Started",
                        description = "Command from parent executed successfully"
                    ))
                    showToast("Remote START_TRACKING executed")
                }
                CommandType.STOP_TRACKING -> {
                    trackingManager.stopTracking()
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "REMOTE_TRACKING_STOP",
                        title = "Remote Tracking Stopped",
                        description = "Command from parent executed successfully"
                    ))
                    showToast("Remote STOP_TRACKING executed")
                }
                CommandType.REFRESH_LOCATION -> {
                    onRefreshLocationRequested()
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "REMOTE_REFRESH",
                        title = "Remote Location Refresh Requested",
                        description = "Command from parent executed successfully"
                    ))
                    showToast("Remote REFRESH executed")
                }
                CommandType.RING_PHONE -> {
                    notificationEngine.sendSafetyAlert("Find My Phone", "Parent is ringing your phone!")
                    showToast("Remote RING executed")
                }
                CommandType.SOUND_SIREN -> {
                    notificationEngine.triggerSiren()
                    safeZoneRepository.addEvent(ActivityEvent(
                        type = "REMOTE_SIREN",
                        title = "Emergency Siren Triggered",
                        description = "Command from parent executed successfully"
                    ))
                    showToast("Remote SIREN executed")
                }
            }
            _lastExecutionResult.value = "SUCCESS: ${command.commandType}"
            syncProvider.updateCommandStatus(command.childId, command.commandId, CommandStatus.EXECUTED)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to execute command", e)
            _lastExecutionResult.value = "FAILED: ${e.message}"
            syncProvider.updateCommandStatus(command.childId, command.commandId, CommandStatus.FAILED)
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
}
