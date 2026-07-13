package com.example.kidsguard.sync

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

interface RemoteSyncProvider {
    fun connect()
    fun disconnect()
    fun syncChildStatus(status: SyncChildStatus)
    fun syncLocation(update: SyncLocationUpdate)
    fun syncActivity(event: SyncActivityEvent)
    fun syncNotification(event: SyncNotificationEvent)
    fun syncSafeZone(childId: String, zone: com.example.kidsguard.models.SafeZone)
    fun deleteSafeZone(childId: String, zoneId: String)
    fun syncSosEvent(event: com.example.kidsguard.models.SosEvent)
    fun syncDailySummary(summary: com.example.kidsguard.ai.DailySummary)
    fun listenForRemoteCommands(childId: String, onCommand: (SyncRemoteCommand) -> Unit)
    fun updateCommandStatus(childId: String, commandId: String, status: CommandStatus, resultMessage: String? = null)
    fun getChildStatus(childId: String): kotlinx.coroutines.flow.Flow<SyncChildStatus?>
    fun getLatestActivity(childId: String): kotlinx.coroutines.flow.Flow<SyncActivityEvent?>
    fun getActivityHistory(childId: String): kotlinx.coroutines.flow.Flow<List<SyncActivityEvent>>
    fun getLocationHistory(childId: String): kotlinx.coroutines.flow.Flow<List<SyncLocationUpdate>>
    fun getDailySummary(childId: String, date: Long): kotlinx.coroutines.flow.Flow<com.example.kidsguard.ai.DailySummary?>
    fun sendCommand(command: SyncRemoteCommand)
    fun getFamilyMembers(familyId: String): kotlinx.coroutines.flow.Flow<List<String>>
    fun getSafeZones(familyId: String): kotlinx.coroutines.flow.Flow<List<com.example.kidsguard.models.SafeZone>>
    fun getSafeZonesForChild(childId: String): kotlinx.coroutines.flow.Flow<List<com.example.kidsguard.models.SafeZone>>
    
    // Wellbeing sync
    fun syncAppUsage(childId: String, usage: List<SyncAppUsage>)
    fun getWellbeingSettings(childId: String): kotlinx.coroutines.flow.Flow<SyncWellbeingSettings?>
    fun updateWellbeingSettings(childId: String, settings: SyncWellbeingSettings)
    fun getAppUsageHistory(childId: String, date: String): kotlinx.coroutines.flow.Flow<List<SyncAppUsage>>

    // Web protection sync
    fun getWebRules(childId: String): kotlinx.coroutines.flow.Flow<com.example.kidsguard.web.WebRuleSet?>
    fun syncWebActivity(childId: String, activity: com.example.kidsguard.web.WebActivityEvent)
    fun createWebAccessRequest(request: com.example.kidsguard.web.WebAccessRequest)
    fun getWebAccessRequests(childId: String): kotlinx.coroutines.flow.Flow<List<com.example.kidsguard.web.WebAccessRequest>>

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

    override fun syncNotification(event: SyncNotificationEvent) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun syncSafeZone(childId: String, zone: com.example.kidsguard.models.SafeZone) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun deleteSafeZone(childId: String, zoneId: String) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun syncSosEvent(event: com.example.kidsguard.models.SosEvent) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun syncDailySummary(summary: com.example.kidsguard.ai.DailySummary) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun listenForRemoteCommands(childId: String, onCommand: (SyncRemoteCommand) -> Unit) {
        this.commandListener = onCommand
    }

    override fun updateCommandStatus(childId: String, commandId: String, status: CommandStatus, resultMessage: String?) {
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
                androidVersion = "13",
                lastLocation = SyncLocationUpdate(childId, 51.5074, -0.1278, 10f, 0f, 0f, System.currentTimeMillis())
            )
        )
    }

    override fun getLatestActivity(childId: String): kotlinx.coroutines.flow.Flow<SyncActivityEvent?> {
        return kotlinx.coroutines.flow.flowOf(
            SyncActivityEvent(
                childId = childId,
                type = "MOCK",
                title = "Mock Activity",
                description = "This is a mock activity event"
            )
        )
    }

    override fun getActivityHistory(childId: String): kotlinx.coroutines.flow.Flow<List<SyncActivityEvent>> {
        return kotlinx.coroutines.flow.flowOf(
            listOf(
                SyncActivityEvent(childId = childId, type = "SAFE_ZONE_ENTER", title = "Entered Home", description = "Mock Child arrived home"),
                SyncActivityEvent(childId = childId, type = "SAFE_ZONE_EXIT", title = "Left School", description = "Mock Child left school")
            )
        )
    }

    override fun getLocationHistory(childId: String): kotlinx.coroutines.flow.Flow<List<SyncLocationUpdate>> {
        return kotlinx.coroutines.flow.flowOf(
            listOf(
                SyncLocationUpdate(childId, 51.5074, -0.1278, 10f, 0f, 0f, System.currentTimeMillis()),
                SyncLocationUpdate(childId, 51.5080, -0.1285, 10f, 0f, 0f, System.currentTimeMillis() - 300000)
            )
        )
    }

    override fun getDailySummary(childId: String, date: Long): kotlinx.coroutines.flow.Flow<com.example.kidsguard.ai.DailySummary?> {
        return kotlinx.coroutines.flow.flowOf(
            com.example.kidsguard.ai.DailySummary(
                date = date,
                childId = childId,
                totalDistanceMeters = 5400.0,
                totalTimeAtHomeMinutes = 720,
                totalTimeAtSchoolMinutes = 360,
                totalTimeAtPlaygroundMinutes = 60,
                totalTrackingMinutes = 1440,
                totalLockMinutes = 120,
                totalUnlockAttempts = 3,
                totalSafeZoneEvents = 2,
                totalSosEvents = 0,
                lowestBatteryPercent = 42,
                highestSpeed = 5.2f,
                summaryText = "Mock summary for $childId. Everything looks safe.",
                safetyScore = 95
            )
        )
    }

    override fun sendCommand(command: SyncRemoteCommand) {
        simulateRemoteCommand(command)
    }

    override fun getFamilyMembers(familyId: String): kotlinx.coroutines.flow.Flow<List<String>> {
        return kotlinx.coroutines.flow.flowOf(listOf("mock_child_001", "mock_child_002"))
    }

    override fun getSafeZones(familyId: String): kotlinx.coroutines.flow.Flow<List<com.example.kidsguard.models.SafeZone>> {
        return kotlinx.coroutines.flow.flowOf(
            listOf(
                com.example.kidsguard.models.SafeZone(id = "zone_1", name = "Home", type = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 500.0),
                com.example.kidsguard.models.SafeZone(id = "zone_2", name = "School", type = "School", latitude = 37.7849, longitude = -122.4294, radiusMeters = 200.0)
            )
        )
    }

    override fun getSafeZonesForChild(childId: String): kotlinx.coroutines.flow.Flow<List<com.example.kidsguard.models.SafeZone>> {
        return kotlinx.coroutines.flow.flowOf(
            listOf(
                com.example.kidsguard.models.SafeZone(id = "zone_child_1", name = "Home (Child)", type = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 300.0)
            )
        )
    }

    override fun syncAppUsage(childId: String, usage: List<SyncAppUsage>) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun getWellbeingSettings(childId: String): kotlinx.coroutines.flow.Flow<SyncWellbeingSettings?> {
        return kotlinx.coroutines.flow.flowOf(SyncWellbeingSettings())
    }

    override fun updateWellbeingSettings(childId: String, settings: SyncWellbeingSettings) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun getAppUsageHistory(childId: String, date: String): kotlinx.coroutines.flow.Flow<List<SyncAppUsage>> {
        return kotlinx.coroutines.flow.flowOf(emptyList())
    }

    override fun getWebRules(childId: String): kotlinx.coroutines.flow.Flow<com.example.kidsguard.web.WebRuleSet?> {
        return kotlinx.coroutines.flow.flowOf(com.example.kidsguard.web.WebRuleSet())
    }

    override fun syncWebActivity(childId: String, activity: com.example.kidsguard.web.WebActivityEvent) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun createWebAccessRequest(request: com.example.kidsguard.web.WebAccessRequest) {
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun getWebAccessRequests(childId: String): kotlinx.coroutines.flow.Flow<List<com.example.kidsguard.web.WebAccessRequest>> {
        return kotlinx.coroutines.flow.flowOf(emptyList())
    }

    // Testing helper to simulate a remote command
    fun simulateRemoteCommand(command: SyncRemoteCommand) {
        commandListener?.invoke(command)
    }

    fun clearMockSyncData() {
        _lastSyncTimestamp.value = 0L
    }
}
