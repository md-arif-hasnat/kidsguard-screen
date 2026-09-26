package com.example.kidsguard.repository

import com.example.kidsguard.sync.SyncRemoteCommand
import com.example.kidsguard.sync.CommandType
import com.example.kidsguard.sync.RemoteSyncProvider

class RemoteCommandRepository(private val syncProvider: RemoteSyncProvider) {
    
    fun sendRefreshLocation(childId: String) {
        sendCommand(childId, CommandType.REFRESH_LOCATION)
    }

    fun sendRingDevice(childId: String) {
        sendCommand(childId, CommandType.RING_DEVICE)
    }

    fun sendLockDevice(childId: String) {
        sendCommand(childId, CommandType.LOCK_DEVICE)
    }

    fun sendUnlockDevice(childId: String) {
        sendCommand(childId, CommandType.UNLOCK_DEVICE)
    }

    fun sendVibrateDevice(childId: String) {
        sendCommand(childId, CommandType.VIBRATE_DEVICE)
    }

    fun sendShowMessage(childId: String, message: String) {
        sendCommand(childId, CommandType.SHOW_MESSAGE, payload = message)
    }

    private fun sendCommand(childId: String, type: CommandType, payload: String? = null) {
        if (childId.isEmpty()) return
        val now = System.currentTimeMillis()
        val expiryDuration = when (type) {
            CommandType.REFRESH_LOCATION,
            CommandType.RING_DEVICE,
            CommandType.VIBRATE_DEVICE -> 2 * 60 * 1000L
            CommandType.SHOW_MESSAGE -> 10 * 60 * 1000L
            else -> 5 * 60 * 1000L
        }
        val command = SyncRemoteCommand(
            commandId = java.util.UUID.randomUUID().toString(),
            childId = childId,
            commandType = type,
            payload = payload,
            status = com.example.kidsguard.sync.CommandStatus.PENDING,
            createdAt = now,
            expiresAt = now + expiryDuration
        )
        syncProvider.sendCommand(command)
    }
}
