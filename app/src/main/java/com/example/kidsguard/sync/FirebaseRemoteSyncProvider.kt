package com.example.kidsguard.sync

import android.util.Log
import com.example.kidsguard.repository.ErrorLogRepository
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PRODUCTION READY: Remote sync provider powered by Firebase.
 * Handles Firestore real-time updates and FCM.
 */
class FirebaseRemoteSyncProvider(private val context: android.content.Context) : RemoteSyncProvider {
    private val db = FirebaseFirestore.getInstance()
    private val errorLogger = ErrorLogRepository(context)
    
    private val _isConnected = MutableStateFlow(false)
    override val isConnected: StateFlow<Boolean> = _isConnected

    private val _lastSyncTimestamp = MutableStateFlow(0L)
    override val lastSyncTimestamp: StateFlow<Long> = _lastSyncTimestamp

    private var commandListener: ListenerRegistration? = null

    companion object {
        private const val TAG = "FirebaseRemoteSync"
    }

    override fun connect() {
        // Assume connected if we can reach Firebase (simplified for this phase)
        _isConnected.value = true
        _lastSyncTimestamp.value = System.currentTimeMillis()
    }

    override fun disconnect() {
        _isConnected.value = false
        commandListener?.remove()
        commandListener = null
    }

    override fun syncChildStatus(status: SyncChildStatus) {
        if (status.childId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(status.childId)
            .collection("status")
            .document("current")
            .set(status)
            .addOnSuccessListener {
                _lastSyncTimestamp.value = System.currentTimeMillis()
                Log.d(TAG, "Child status synced successfully")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync child status", e)
                errorLogger.addError(TAG, "Failed to sync child status", e)
            }
    }

    override fun syncLocation(update: SyncLocationUpdate) {
        if (update.childId.isEmpty()) {
            Log.w(TAG, "syncLocation skipped: childId is empty")
            return
        }

        Log.d(TAG, "GPS Acquired: lat=${update.latitude}, lng=${update.longitude}, accuracy=${update.accuracy}")
        Log.i(TAG, "Uploading to Firestore: children/${update.childId}/locations/latest and devices/${update.childId}")

        val batch = db.batch()
        
        // 1. Save to locations history
        val historyRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(update.childId)
            .collection("locations")
            .document()
        batch.set(historyRef, update)

        // 2. Update latest location in children collection
        val latestRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(update.childId)
            .collection("locations")
            .document("latest")
        batch.set(latestRef, update)

        // 3. Update current status lastLocation
        val statusRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(update.childId)
            .collection("status")
            .document("current")
        batch.update(statusRef, "lastLocation", update)
        
        // 4. Update devices collection (Unified device status)
        val deviceRef = db.collection(FirebaseConfig.COL_DEVICES)
            .document(update.childId)
        batch.update(deviceRef, mapOf(
            "currentLocation" to mapOf(
                "latitude" to update.latitude,
                "longitude" to update.longitude,
                "accuracy" to update.accuracy,
                "updatedAt" to com.google.firebase.Timestamp.now()
            ),
            "lastSeen" to com.google.firebase.Timestamp.now()
        ))

        batch.commit()
            .addOnSuccessListener {
                _lastSyncTimestamp.value = System.currentTimeMillis()
                Log.i(TAG, "Location upload success for ${update.childId}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync location", e)
                errorLogger.addError(TAG, "Failed to sync location", e)
            }
    }

    override fun syncActivity(event: SyncActivityEvent) {
        if (event.childId.isEmpty()) return

        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(event.childId)
            .collection(FirebaseConfig.COL_ACTIVITY)
            .document(event.id)
            .set(event)
            .addOnSuccessListener {
                _lastSyncTimestamp.value = System.currentTimeMillis()
                Log.d(TAG, "Activity event synced successfully to ${FirebaseConfig.COL_ACTIVITY}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync activity event", e)
                errorLogger.addError(TAG, "Failed to sync activity event", e)
            }
    }

    override fun syncSafeZone(childId: String, zone: com.example.kidsguard.models.SafeZone) {
        if (childId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_SAFE_ZONES)
            .document(zone.id)
            .set(zone)
            .addOnSuccessListener {
                Log.d(TAG, "Safe zone synced successfully to child $childId: ${zone.name}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync safe zone to child $childId", e)
                errorLogger.addError(TAG, "Failed to sync safe zone", e)
            }
    }

    override fun deleteSafeZone(childId: String, zoneId: String) {
        if (childId.isEmpty() || zoneId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_SAFE_ZONES)
            .document(zoneId)
            .delete()
            .addOnSuccessListener {
                Log.d(TAG, "Safe zone deleted successfully from child $childId: $zoneId")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to delete safe zone from child $childId", e)
                errorLogger.addError(TAG, "Failed to delete safe zone", e)
            }
    }

    override fun syncSosEvent(event: com.example.kidsguard.models.SosEvent) {
        if (event.childId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(event.childId)
            .collection("sosEvents")
            .document(event.id)
            .set(event)
            .addOnSuccessListener {
                Log.d(TAG, "SOS event synced successfully")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync SOS event", e)
                errorLogger.addError(TAG, "Failed to sync SOS event", e)
            }
    }

    override fun syncDailySummary(summary: com.example.kidsguard.ai.DailySummary) {
        if (summary.childId.isEmpty()) {
            Log.w(TAG, "DailySummary sync skipped: childId is empty")
            return
        }
        
        Log.d(TAG, "Syncing DailySummary to Firebase for child ${summary.childId}")
        
        val summaryId = summary.id
        val summaryRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(summary.childId)
            .collection("dailySummaries")
            .document(summaryId)
            
        val latestRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(summary.childId)
            .collection("dailySummaries")
            .document("latest")

        val batch = db.batch()
        batch.set(summaryRef, summary)
        batch.set(latestRef, summary)

        batch.commit()
            .addOnSuccessListener {
                Log.i(TAG, "DailySummary Firebase sync success. Summary ID: $summaryId")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "DailySummary Firebase sync failed: ${e.message}", e)
                errorLogger.addError(TAG, "DailySummary sync failed", e)
            }
    }

    override fun listenForRemoteCommands(childId: String, onCommand: (SyncRemoteCommand) -> Unit) {
        if (childId.isEmpty()) {
            Log.w(TAG, "listenForRemoteCommands: childId is empty")
            return
        }
        
        Log.i(TAG, "Starting remote command listener for child: $childId")
        commandListener?.remove()
        commandListener = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_REMOTE_COMMANDS)
            .whereEqualTo("status", "PENDING")
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Remote command listen failed.", e)
                    errorLogger.addError(TAG, "Remote command listen failed", e)
                    return@addSnapshotListener
                }

                if (snapshots != null) {
                    if (snapshots.isEmpty) {
                        Log.v(TAG, "No pending commands for $childId")
                    } else {
                        Log.i(TAG, "Received ${snapshots.size()} pending commands")
                    }
                    for (doc in snapshots.documents) {
                        val command = doc.toObject(SyncRemoteCommand::class.java)
                        if (command != null) {
                            Log.d(TAG, "Processing pending command: ${command.commandId} type: ${command.commandType}")
                            onCommand(command)
                        }
                    }
                }
            }
    }

    override fun updateCommandStatus(childId: String, commandId: String, status: CommandStatus, resultMessage: String?) {
        if (childId.isEmpty() || commandId.isEmpty()) {
            Log.w(TAG, "updateCommandStatus: invalid IDs. child: $childId cmd: $commandId")
            return
        }
        
        Log.i(TAG, "Updating command $commandId status to $status")
        val updates = mutableMapOf<String, Any>(
            "status" to status
        )
        
        val now = System.currentTimeMillis()
        when (status) {
            CommandStatus.EXECUTING -> updates["receivedAt"] = now
            CommandStatus.SUCCESS, CommandStatus.FAILED -> updates["executedAt"] = now
            else -> {}
        }
        
        resultMessage?.let { updates["resultMessage"] = it }

        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_REMOTE_COMMANDS)
            .document(commandId)
            .update(updates)
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to update command status", e)
                errorLogger.addError(TAG, "Failed to update command status", e)
            }
    }

    override fun sendCommand(command: SyncRemoteCommand) {
        if (command.childId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(command.childId)
            .collection(FirebaseConfig.COL_REMOTE_COMMANDS)
            .document(command.commandId)
            .set(command)
            .addOnSuccessListener {
                _lastSyncTimestamp.value = System.currentTimeMillis()
                Log.d(TAG, "Command sent successfully: ${command.commandType}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to send command", e)
                errorLogger.addError(TAG, "Failed to send command", e)
            }
    }

    override fun getFamilyMembers(familyId: String): Flow<List<String>> = callbackFlow {
        if (familyId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_FAMILIES)
            .document(familyId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for family members", e)
                    return@addSnapshotListener
                }
                
                if (snapshot != null && snapshot.exists()) {
                    val family = snapshot.toObject(com.example.kidsguard.models.FamilyDoc::class.java)
                    trySend(family?.childDeviceIds ?: emptyList())
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getChildStatus(childId: String): Flow<SyncChildStatus?> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(null)
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("status")
            .document("current")
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for child status", e)
                    errorLogger.addError(TAG, "Child status listen failed", e)
                    return@addSnapshotListener
                }
                
                if (snapshot != null && snapshot.exists()) {
                    val status = snapshot.toObject(SyncChildStatus::class.java)
                    trySend(status)
                } else {
                    trySend(null)
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getLatestActivity(childId: String): Flow<SyncActivityEvent?> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(null)
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_ACTIVITY)
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(1)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for latest activity", e)
                    errorLogger.addError(TAG, "Latest activity listen failed", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null && !snapshots.isEmpty) {
                    val event = snapshots.documents.first().toObject(SyncActivityEvent::class.java)
                    trySend(event)
                } else {
                    trySend(null)
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getActivityHistory(childId: String): Flow<List<SyncActivityEvent>> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_ACTIVITY)
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for activity history", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null) {
                    val events = snapshots.documents.mapNotNull { it.toObject(SyncActivityEvent::class.java) }
                    trySend(events)
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getLocationHistory(childId: String): Flow<List<SyncLocationUpdate>> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("locations")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(100)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for location history", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null) {
                    val locations = snapshots.documents.mapNotNull { it.toObject(SyncLocationUpdate::class.java) }
                    trySend(locations)
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getDailySummary(childId: String, date: Long): Flow<com.example.kidsguard.ai.DailySummary?> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(null)
            return@callbackFlow
        }

        // Round date to start of day for lookup
        val calendar = java.util.Calendar.getInstance().apply {
            timeInMillis = date
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        val startTime = calendar.timeInMillis

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("dailySummaries")
            .whereEqualTo("date", startTime)
            .limit(1)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for daily summary", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null && !snapshots.isEmpty) {
                    val summary = snapshots.documents.first().toObject(com.example.kidsguard.ai.DailySummary::class.java)
                    trySend(summary)
                } else {
                    trySend(null)
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getSafeZones(familyId: String): Flow<List<com.example.kidsguard.models.SafeZone>> = callbackFlow {
        if (familyId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_FAMILIES)
            .document(familyId)
            .collection(FirebaseConfig.COL_SAFE_ZONES)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for family safe zones", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null) {
                    val zones = snapshots.documents.mapNotNull { it.toObject(com.example.kidsguard.models.SafeZone::class.java) }
                    trySend(zones)
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getSafeZonesForChild(childId: String): Flow<List<com.example.kidsguard.models.SafeZone>> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_SAFE_ZONES)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for child safe zones", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null) {
                    val zones = snapshots.documents.mapNotNull { it.toObject(com.example.kidsguard.models.SafeZone::class.java) }
                    trySend(zones)
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun syncAppUsage(childId: String, usage: List<SyncAppUsage>) {
        if (childId.isEmpty() || usage.isEmpty()) return
        
        val date = usage.first().date
        val batch = db.batch()
        
        usage.forEach { app ->
            val ref = db.collection(FirebaseConfig.COL_CHILDREN)
                .document(childId)
                .collection("appUsage")
                .document(date)
                .collection("apps")
                .document(app.packageName.replace(".", "_"))
            batch.set(ref, app)
        }
        
        batch.commit().addOnSuccessListener {
            Log.d(TAG, "App usage synced successfully for $date")
        }
    }

    override fun getWellbeingSettings(childId: String): Flow<SyncWellbeingSettings?> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(null)
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("settings")
            .document("wellbeing")
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for wellbeing settings", e)
                    return@addSnapshotListener
                }
                
                if (snapshot != null && snapshot.exists()) {
                    trySend(snapshot.toObject(SyncWellbeingSettings::class.java))
                } else {
                    trySend(SyncWellbeingSettings())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun updateWellbeingSettings(childId: String, settings: SyncWellbeingSettings) {
        if (childId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("settings")
            .document("wellbeing")
            .set(settings)
            .addOnSuccessListener {
                Log.d(TAG, "Wellbeing settings updated")
            }
    }

    override fun getAppUsageHistory(childId: String, date: String): Flow<List<SyncAppUsage>> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("appUsage")
            .document(date)
            .collection("apps")
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for app usage history", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null) {
                    val apps = snapshots.documents.mapNotNull { it.toObject(SyncAppUsage::class.java) }
                    trySend(apps)
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun getWebRules(childId: String): Flow<com.example.kidsguard.web.WebRuleSet?> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(null)
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("webRules")
            .document("current")
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for web rules", e)
                    return@addSnapshotListener
                }
                
                if (snapshot != null && snapshot.exists()) {
                    trySend(snapshot.toObject(com.example.kidsguard.web.WebRuleSet::class.java))
                } else {
                    trySend(com.example.kidsguard.web.WebRuleSet())
                }
            }
            
        awaitClose { registration.remove() }
    }

    override fun syncWebActivity(childId: String, activity: com.example.kidsguard.web.WebActivityEvent) {
        if (childId.isEmpty()) return
        
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(activity.timestamp))
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("webActivity")
            .document(date)
            .collection("events")
            .document()
            .set(activity)
    }

    override fun createWebAccessRequest(request: com.example.kidsguard.web.WebAccessRequest) {
        if (request.childId.isEmpty()) return
        
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(request.childId)
            .collection("accessRequests")
            .document(request.requestId)
            .set(request)
    }

    override fun getWebAccessRequests(childId: String): Flow<List<com.example.kidsguard.web.WebAccessRequest>> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val registration = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("accessRequests")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Error listening for access requests", e)
                    return@addSnapshotListener
                }
                
                if (snapshots != null) {
                    trySend(snapshots.toObjects(com.example.kidsguard.web.WebAccessRequest::class.java))
                } else {
                    trySend(emptyList())
                }
            }
            
        awaitClose { registration.remove() }
    }
    
    // Future placeholders for Messaging
    fun registerFcmToken(uid: String, token: String, role: String) {
        if (uid.isEmpty() || token.isEmpty()) return
        
        val deviceId = context.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
            .getString("device_id", java.util.UUID.randomUUID().toString()) ?: ""
            
        if (role == "PARENT") {
            db.collection(FirebaseConfig.COL_PARENTS)
                .document(uid)
                .collection(FirebaseConfig.COL_DEVICES)
                .document(deviceId)
                .set(mapOf(
                    "deviceId" to deviceId,
                    "token" to token,
                    "platform" to "Android",
                    "deviceName" to android.os.Build.MODEL,
                    "lastSeen" to com.google.firebase.Timestamp.now(),
                    "appVersion" to "1.0.0"
                ), com.google.firebase.firestore.SetOptions.merge())
                .addOnSuccessListener {
                    Log.d(TAG, "Parent FCM token registered successfully")
                }
        } else {
            // Register child token for remote commands
            db.collection(FirebaseConfig.COL_CHILDREN)
                .document(uid)
                .update("fcmToken", token)
                .addOnSuccessListener {
                    Log.d(TAG, "Child FCM token registered successfully")
                }
        }
    }
}
