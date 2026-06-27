package com.example.kidsguard.repository

import com.example.kidsguard.sync.SyncRemoteCommand
import com.example.kidsguard.sync.CommandType
import com.example.kidsguard.sync.RemoteSyncProvider

class RemoteCommandRepository(private val syncProvider: RemoteSyncProvider) {
    
    fun sendRefreshLocation(childId: String) {
        sendCommand(childId, CommandType.REFRESH_LOCATION)
    }

    fun sendRingDevice(childId: String) {
        sendCommand(childId, CommandType.RING_PHONE)
    }

    fun sendLockDevice(childId: String) {
        sendCommand(childId, CommandType.LOCK_NOW)
    }

    fun sendUnlockDevice(childId: String) {
        sendCommand(childId, CommandType.UNLOCK_NOW)
    }

    fun sendVibrateDevice(childId: String) {
        sendCommand(childId, CommandType.SOUND_SIREN) // Mapping to siren for vibrate in mock/MVP
    }

    fun sendShowMessage(childId: String, message: String) {
        sendCommand(childId, CommandType.SHOW_MESSAGE, payload = message)
    }

    private fun sendCommand(childId: String, type: CommandType, payload: String? = null) {
        if (childId.isEmpty()) return
        val command = SyncRemoteCommand(
            commandId = java.util.UUID.randomUUID().toString(),
            childId = childId,
            commandType = type,
            payload = payload,
            status = com.example.kidsguard.sync.CommandStatus.PENDING,
            createdAt = System.currentTimeMillis()
        )
        syncProvider.sendCommand(command)
    }
}
