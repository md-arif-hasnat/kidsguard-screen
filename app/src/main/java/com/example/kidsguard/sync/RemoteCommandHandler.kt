package com.example.kidsguard.sync

import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.tracking.BackgroundTrackingManager

/**
 * Handles execution of remote commands received from the sync provider.
 */
class RemoteCommandHandler(
    private val prefHelper: PreferenceHelper,
    private val trackingManager: BackgroundTrackingManager,
    private val syncProvider: RemoteSyncProvider
) {
    private val TAG = "RemoteCommandHandler"

    fun handleCommand(command: SyncRemoteCommand) {
        Log.d(TAG, "Executing command: ${command.commandType}")
        
        try {
            when (command.commandType) {
                CommandType.LOCK_NOW -> {
                    prefHelper.isLocked = true
                    // Navigation will be handled by observing prefHelper in UI
                }
                CommandType.UNLOCK_NOW -> {
                    prefHelper.isLocked = false
                }
                CommandType.START_TRACKING -> {
                    trackingManager.startTracking()
                }
                CommandType.STOP_TRACKING -> {
                    trackingManager.stopTracking()
                }
                CommandType.REFRESH_LOCATION -> {
                    // Logic to trigger a single location update
                }
                CommandType.RING_PHONE -> {
                    // Logic to play alert sound
                }
            }
            syncProvider.updateCommandStatus(command.commandId, CommandStatus.EXECUTED)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to execute command", e)
            syncProvider.updateCommandStatus(command.commandId, CommandStatus.FAILED)
        }
    }
}
