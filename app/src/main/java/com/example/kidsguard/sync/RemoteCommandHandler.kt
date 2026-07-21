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
    private val androidContext: Context,
    private val prefHelper: PreferenceHelper,
    private val trackingManager: BackgroundTrackingManager,
    private val syncProvider: RemoteSyncProvider,
    private val safeZoneRepository: SafeZoneRepository,
    private val notificationEngine: LocalNotificationEngine,
    private val onLockRequested: () -> Unit,
    private val onUnlockRequested: () -> Unit,
    private val onRefreshLocationRequested: () -> Unit,
    private val onShowMessageRequested: (String) -> Unit,
    private val onRingRequested: () -> Unit,
    private val onVibrateRequested: () -> Unit,
    private val lockScheduleManager: com.example.kidsguard.managers.LockScheduleManager? = null
) {
    private val TAG = "RemoteCommandHandler"

    private val _lastCommandReceived = MutableStateFlow("None")
    val lastCommandReceived: StateFlow<String> = _lastCommandReceived

    private val _lastExecutionResult = MutableStateFlow("None")
    val lastExecutionResult: StateFlow<String> = _lastExecutionResult

    fun handleCommand(command: SyncRemoteCommand) {
        Log.d(TAG, "Executing command: ${command.commandType}")
        
        // Expiry Check
        val now = System.currentTimeMillis()
        val expiresAt = command.expiresAt ?: (command.createdAt + getExpiryForType(command.commandType))
        
        if (now > expiresAt) {
            Log.w(TAG, "Command ${command.commandId} expired. skipping.")
            syncProvider.updateCommandStatus(command.childId, command.commandId, CommandStatus.EXPIRED)
            return
        }

        // Update status to EXECUTING
        syncProvider.updateCommandStatus(command.childId, command.commandId, CommandStatus.EXECUTING)
        _lastCommandReceived.value = "${command.commandType} (${command.commandId})"
        
        try {
            when (command.commandType) {
                CommandType.LOCK_NOW, CommandType.LOCK_DEVICE -> {
                    prefHelper.isLocked = true
                    lockScheduleManager?.handleManualLock()
                    onLockRequested()
                    logActivity("REMOTE_LOCK", "Remote Lock Executed", "Parent locked the device")
                    showToast("Remote LOCK executed")
                }
                CommandType.UNLOCK_NOW, CommandType.UNLOCK_DEVICE -> {
                    prefHelper.isLocked = false
                    lockScheduleManager?.handleManualUnlock()
                    onUnlockRequested()
                    logActivity("REMOTE_UNLOCK", "Remote Unlock Executed", "Parent unlocked the device")
                    showToast("Remote UNLOCK executed")
                }
                CommandType.START_TRACKING -> {
                    trackingManager.startTracking()
                    logActivity("REMOTE_TRACKING_START", "Remote Tracking Started", "Tracking enabled by parent")
                    showToast("Remote START_TRACKING executed")
                }
                CommandType.STOP_TRACKING -> {
                    trackingManager.stopTracking()
                    logActivity("REMOTE_TRACKING_STOP", "Remote Tracking Stopped", "Tracking disabled by parent")
                    showToast("Remote STOP_TRACKING executed")
                }
                CommandType.REFRESH_LOCATION -> {
                    onRefreshLocationRequested()
                    logActivity("REMOTE_REFRESH", "Location Refreshed", "Parent requested live location update")
                    showToast("Remote REFRESH executed")
                }
                CommandType.RING_PHONE, CommandType.RING_DEVICE -> {
                    onRingRequested()
                    logActivity("REMOTE_RING", "Device Rang", "Parent triggered device ring")
                    showToast("Remote RING executed")
                }
                CommandType.SOUND_SIREN -> {
                    notificationEngine.triggerSiren()
                    logActivity("REMOTE_SIREN", "Emergency Siren Triggered", "Siren activated by parent")
                    showToast("Remote SIREN executed")
                }
                CommandType.SHOW_MESSAGE -> {
                    val msg = command.payload ?: "No message from parent"
                    onShowMessageRequested(msg)
                    logActivity("REMOTE_MESSAGE", "Message Received", "Parent sent a remote message")
                }
                CommandType.VIBRATE_DEVICE -> {
                    onVibrateRequested()
                    logActivity("REMOTE_VIBRATE", "Device Vibrated", "Parent triggered vibration")
                }
                else -> {
                    Log.w(TAG, "Unhandled command type: ${command.commandType}")
                }
            }
            _lastExecutionResult.value = "SUCCESS: ${command.commandType}"
            Log.d(TAG, "Command completed successfully: ${command.commandId}")
            syncProvider.updateCommandStatus(command.childId, command.commandId, CommandStatus.SUCCESS)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to execute command", e)
            _lastExecutionResult.value = "FAILED: ${e.message}"
            syncProvider.updateCommandStatus(command.childId, command.commandId, CommandStatus.FAILED, e.message)
        }
    }

    private fun logActivity(type: String, title: String, desc: String) {
        safeZoneRepository.addEvent(ActivityEvent(
            type = type,
            title = title,
            description = desc
        ))
    }

    private fun getExpiryForType(type: CommandType): Long {
        return when (type) {
            CommandType.REFRESH_LOCATION -> 2 * 60 * 1000L
            CommandType.RING_DEVICE, CommandType.RING_PHONE -> 2 * 60 * 1000L
            CommandType.LOCK_DEVICE, CommandType.LOCK_NOW -> 5 * 60 * 1000L
            CommandType.UNLOCK_DEVICE, CommandType.UNLOCK_NOW -> 5 * 60 * 1000L
            CommandType.SHOW_MESSAGE -> 10 * 60 * 1000L
            CommandType.VIBRATE_DEVICE -> 2 * 60 * 1000L
            else -> 5 * 60 * 1000L
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(androidContext, message, Toast.LENGTH_SHORT).show()
    }
}
