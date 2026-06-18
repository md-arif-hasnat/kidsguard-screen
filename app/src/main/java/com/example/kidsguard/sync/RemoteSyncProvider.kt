package com.example.kidsguard.sync

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

interface RemoteSyncProvider {
    fun connect()
    fun disconnect()
    fun syncChildStatus(status: SyncChildStatus)
    fun syncLocation(update: SyncLocationUpdate)
    fun syncActivity(event: SyncActivityEvent)
    fun listenForRemoteCommands(childId: String, onCommand: (SyncRemoteCommand) -> Unit)
    fun updateCommandStatus(commandId: String, status: CommandStatus)
    fun getChildStatus(childId: String): kotlinx.coroutines.flow.Flow<SyncChildStatus?>
    
    val isConnected: StateFlow<Boolean>
    val lastSyncTimestamp: StateFlow<Long>
}

class LocalMockSyncProvider : RemoteSyncProvider {
    private val _isConnected = MutableStateFlow(false)
    override val isConnected: StateFlow<Boolean> = _isConnected

    private val _lastSyncTimestamp = MutableStateFlow(0L)
    override val lastSyncTimestamp: StateFlow<Long> = _lastSyncTimestamp

    private var commandListener: ((SyncRemoteCommand) -> Unit)? = null

    override fun connect() {
        _isConnected.value = true
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun disconnect() {
        _isConnected.value = false
    }

    override fun syncChildStatus(status: SyncChildStatus) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
        // Mock: Log to console or store locally
    }

    override fun syncLocation(update: SyncLocationUpdate) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun syncActivity(event: SyncActivityEvent) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun listenForRemoteCommands(childId: String, onCommand: (SyncRemoteCommand) -> Unit) {
        this.commandListener = onCommand
    }

    override fun updateCommandStatus(commandId: String, status: CommandStatus) {
        // Mock: Update local state
    }

    override fun getChildStatus(childId: String): kotlinx.coroutines.flow.Flow<SyncChildStatus?> {
        return kotlinx.coroutines.flow.flowOf(
            SyncChildStatus(
                childId = childId,
                childName = "Mock Child",
                batteryPercent = 85,
                charging = false,
                trackingEnabled = true,
                kidGuardActive = false,
                currentZone = "Home",
                lastSeen = System.currentTimeMillis(),
                online = true,
                deviceId = "mock-device-id",
                deviceName = "Mock Phone",
                appVersion = "1.0.0",
                androidVersion = "13"
            )
        )
    }

    // Testing helper to simulate a remote command
    fun simulateRemoteCommand(command: SyncRemoteCommand) {
        commandListener?.invoke(command)
    }

    fun clearMockSyncData() {
        _lastSyncTimestamp.value = 0L
    }
}
