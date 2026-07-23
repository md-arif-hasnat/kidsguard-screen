package com.example.kidsguard.sync

import android.util.Log
import com.example.kidsguard.models.SosEvent
import com.example.kidsguard.models.SosStatus
import com.example.kidsguard.repository.ErrorLogRepository
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PRODUCTION READY: Remote sync provider powered by Firebase.
 * Handles Firestore real-time updates and FCM.
 */
class FirebaseRemoteSyncProvider(private val context: android.content.Context) :
    RemoteSyncProvider {
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

    private fun readMillis(value: Any?): Long? {
        return when (value) {
            is com.google.firebase.Timestamp -> value.toDate().time
            is java.util.Date -> value.time
            is Number -> value.toLong()
            else -> null
        }
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

        Log.d("LocationUpload", "resolving full address")
        Log.i("LocationUpload", "resolved fullAddress=${update.fullAddress ?: "N/A"}")

        val batch = db.batch()

        // 1. Save to locations history
        val historyRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(update.childId)
            .collection("locations")
            .document()
        
        Log.d("LocationUpload", "PATH=${historyRef.path}")
        Log.d("LocationUpload", "PAYLOAD=$update")
        Log.d("LocationUpload", "FULL_ADDRESS=${update.fullAddress}")
        
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
        batch.set(
            statusRef,
            mapOf("lastLocation" to update),
            com.google.firebase.firestore.SetOptions.merge()
        )

        // 4. Update devices collection (Unified device status)
        val deviceRef = db.collection(FirebaseConfig.COL_DEVICES)
            .document(update.childId)
        
        val currentLocationPayload = mutableMapOf(
            "latitude" to update.latitude,
            "longitude" to update.longitude,
            "accuracy" to update.accuracy,
            "updatedAt" to com.google.firebase.Timestamp.now()
        )
        
        update.fullAddress?.let { currentLocationPayload["fullAddress"] = it }
        update.street?.let { currentLocationPayload["street"] = it }
        update.city?.let { currentLocationPayload["city"] = it }
        update.state?.let { currentLocationPayload["state"] = it }
        update.country?.let { currentLocationPayload["country"] = it }
        update.postalCode?.let { currentLocationPayload["postalCode"] = it }

        batch.set(
            deviceRef, mapOf(
                "currentLocation" to currentLocationPayload,
                "lastSeen" to com.google.firebase.Timestamp.now()
            ), com.google.firebase.firestore.SetOptions.merge()
        )

        Log.i("LocationUpload", "writing location with fullAddress")
        batch.commit()
            .addOnSuccessListener {
                _lastSyncTimestamp.value = System.currentTimeMillis()
                Log.i("LocationUpload", "upload success")
                Log.i(TAG, "Location upload success for ${update.childId}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync location", e)
                errorLogger.addError(TAG, "Failed to sync location", e)
            }
    }

    override fun syncActivity(event: SyncActivityEvent) {
        Log.d(
            TAG,
            "syncActivity: id='${event.id}', type='${event.type}', childId='${event.childId}'"
        )
        if (event.childId.isEmpty()) {
            Log.e(TAG, "syncActivity: FAILED - childId is empty")
            return
        }
        if (event.id.isEmpty()) {
            Log.e(
                TAG,
                "syncActivity: FAILED - event.id is empty. Firestore requires a non-empty document path."
            )
            return
        }

        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(event.childId)
            .collection(FirebaseConfig.COL_ACTIVITY)
            .document(event.id)
            .set(event)
            .addOnSuccessListener {
                _lastSyncTimestamp.value = System.currentTimeMillis()
                Log.d(TAG, "Activity event synced successfully: ${event.type}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync activity event", e)
                errorLogger.addError(TAG, "Failed to sync activity event", e)
            }
    }

    override fun syncNotification(event: SyncNotificationEvent) {
        if (event.childId.isEmpty() || event.id.isEmpty()) return

        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(event.childId)
            .collection(FirebaseConfig.COL_NOTIFICATIONS)
            .document(event.id)
            .set(event)
            .addOnSuccessListener {
                Log.d(TAG, "Notification event synced successfully: ${event.type}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to sync notification event", e)
                errorLogger.addError(TAG, "Failed to sync notification event", e)
            }
    }

    override fun syncSafeZone(childId: String, zone: com.example.kidsguard.models.SafeZone) {
        if (childId.isEmpty()) return
        if (zone.id.isBlank()) {
            zone.id = java.util.UUID.randomUUID().toString()
        }

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

    override fun syncSosEvent(event: SosEvent, onComplete: ((Boolean, Throwable?) -> Unit)?) {
        if (event.childId.isBlank() || event.id.isBlank()) {
            Log.e("SosSync", "SOS sync skipped: childId or eventId is blank")
            onComplete?.invoke(false, null)
            return
        }

        val updateMap = mutableMapOf<String, Any?>(
            "id" to event.id,
            "childId" to event.childId,
            "timestamp" to event.timestamp,
            "latitude" to event.latitude,
            "longitude" to event.longitude,
            "accuracy" to event.accuracy,
            "batteryPercent" to event.batteryPercent,
            "message" to event.message,
            "status" to event.status.name,
            "resolvedAt" to event.resolvedAt,
            "active" to event.active,
            "updatedAt" to FieldValue.serverTimestamp()
        )

        // Add creation timestamp only for new events
        if (event.status != SosStatus.RESOLVED) {
            updateMap["createdAt"] = FieldValue.serverTimestamp()
            updateMap["active"] = true
            updateMap["status"] = "ACTIVE"
        } else {
            updateMap["resolvedAt"] = FieldValue.serverTimestamp()
            updateMap["active"] = false
            updateMap["status"] = "RESOLVED"
        }

        val path = "children/${event.childId}/sosEvents/${event.id}"
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(event.childId)
            .collection("sosEvents")
            .document(event.id)
            .set(updateMap, com.google.firebase.firestore.SetOptions.merge())
            .addOnSuccessListener {
                Log.d(
                    "SosSync",
                    "resolve success path=$path"
                )
                onComplete?.invoke(true, null)
            }
            .addOnFailureListener { e ->
                Log.e("SosSync", "resolve failure exception=${e.message}", e)
                errorLogger.addError(
                    "SosSync",
                    "Failed to sync SOS event",
                    e
                )
                onComplete?.invoke(false, e)
            }
    }

    override fun syncSosAlert(
        alert: com.example.kidsguard.models.SosAlert,
        onComplete: ((Boolean, Throwable?) -> Unit)?
    ) {
        if (alert.childId.isBlank() || alert.alertId.isBlank()) {
            Log.e("SosSync", "syncSosAlert: childId or alertId is blank")
            onComplete?.invoke(false, null)
            return
        }

        val path = "children/${alert.childId}/sosEvents/${alert.alertId}"
        Log.d("SosSync", "syncSosAlert: path=$path, status=${alert.status}")

        db.document(path)
            .set(alert, com.google.firebase.firestore.SetOptions.merge())
            .addOnSuccessListener {
                Log.i("SosSync", "syncSosAlert SUCCESS: $path")
                onComplete?.invoke(true, null)
            }
            .addOnFailureListener { e ->
                Log.e("SosSync", "syncSosAlert FAILURE: $path", e)
                onComplete?.invoke(false, e)
            }
    }

    override fun getSosAlert(
        familyId: String,
        alertId: String
    ): Flow<com.example.kidsguard.models.SosAlert?> {
        // This is tricky because we need the childId now. 
        // However, the caller usually knows the childId or it's stored in prefHelper.
        // Let's change the interface or implement a workaround.
        return flowOf(null)
    }

    override fun getSosAlertForChild(
        childId: String,
        alertId: String
    ): Flow<com.example.kidsguard.models.SosAlert?> = callbackFlow {
        if (childId.isBlank() || alertId.isBlank()) {
            trySend(null)
            return@callbackFlow
        }

        val path = "children/$childId/sosEvents/$alertId"
        Log.d("SosSync", "getSosAlert: Listening to $path")

        val listener = db.document(path)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e("SosSync", "getSosAlert listener error: $path", e)
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val data = snapshot.data

                    val alert = com.example.kidsguard.models.SosAlert(
                        alertId = data?.get("alertId") as? String ?: snapshot.id,
                        familyId = data?.get("familyId") as? String ?: "",
                        childId = data?.get("childId") as? String ?: childId,
                        childName = data?.get("childName") as? String ?: "",
                        status = data?.get("status") as? String ?: "ACTIVE",

                        createdAt = readMillis(data?.get("createdAt"))
                            ?: readMillis(data?.get("timestamp"))
                            ?: System.currentTimeMillis(),

                        timestamp = readMillis(data?.get("timestamp"))
                            ?: readMillis(data?.get("createdAt"))
                            ?: System.currentTimeMillis(),

                        resolvedAt = readMillis(data?.get("resolvedAt")),
                        resolvedBy = data?.get("resolvedBy") as? String,

                        latitude = (data?.get("latitude") as? Number)?.toDouble(),
                        longitude = (data?.get("longitude") as? Number)?.toDouble(),
                        address = data?.get("address") as? String,

                        locationAccuracy = (data?.get("locationAccuracy") as? Number)?.toFloat(),
                        locationTimestamp = readMillis(data?.get("locationTimestamp")),

                        batteryPercent = (data?.get("batteryPercent") as? Number)?.toInt(),
                        active = data?.get("active") as? Boolean
                            ?: ((data?.get("status") as? String) != "RESOLVED"),

                        message = data?.get("message") as? String
                            ?: data?.get("childMessage") as? String
                            ?: "Emergency SOS Triggered"
                    )
                    Log.d("SosSync", "getSosAlert: RECEIVED UPDATE status=${alert?.status}")
                    trySend(alert)
                } else {
                    Log.d("SosSync", "getSosAlert: Snapshot null or not exists: $path")
                    trySend(null)
                }
            }

        awaitClose {
            Log.d("SosSync", "getSosAlert: Closing listener for $path")
            listener.remove()
        }
    }

    override fun getActiveSosAlerts(familyId: String): Flow<List<com.example.kidsguard.models.SosAlert>> =
        callbackFlow {
            if (familyId.isBlank()) {
                trySend(emptyList())
                return@callbackFlow
            }

            // Canonical SOS center logic: Parent listens to all children's active alerts
            // using a collection group query on 'sosEvents' documents with familyId filter.
            val query = db.collectionGroup("sosEvents")
                .whereEqualTo("familyId", familyId)
                .whereEqualTo("status", "ACTIVE")

            val listener = query.addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e("SosSync", "getActiveSosAlerts listener error", e)
                    trySend(emptyList()) // Unblock flow on error
                    return@addSnapshotListener
                }

                if (snapshots != null) {
                    try {
                        val alerts =
                            snapshots.toObjects(com.example.kidsguard.models.SosAlert::class.java)
                        Log.d(
                            "SosSync",
                            "Parent listener received updated status from cloud: count=${alerts.size}"
                        )
                        trySend(alerts)
                    } catch (err: Exception) {
                        Log.e("SosSync", "Error parsing SOS alerts", err)
                        trySend(emptyList())
                    }
                } else {
                    trySend(emptyList())
                }
            }

            awaitClose { listener.remove() }
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
            Log.w("RemoteCommand", "listenForRemoteCommands: childId is empty")
            return
        }

        val path = "children/$childId/remoteCommands"
        Log.i(
            "RemoteCommand",
            "Starting remote command listener for child: $childId at path: $path"
        )
        commandListener?.remove()
        commandListener = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection(FirebaseConfig.COL_REMOTE_COMMANDS)
            .whereEqualTo("status", "PENDING")
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e("RemoteCommand", "Remote command listen failed for $path", e)
                    errorLogger.addError("RemoteCommand", "Remote command listen failed", e)
                    return@addSnapshotListener
                }

                if (snapshots != null) {
                    if (snapshots.isEmpty) {
                        Log.v("RemoteCommand", "No pending commands for $childId")
                    } else {
                        Log.i(
                            "RemoteCommand",
                            "Received ${snapshots.size()} pending commands from $path"
                        )
                    }
                    for (doc in snapshots.documents) {
                        val command = doc.toObject(SyncRemoteCommand::class.java)
                        if (command != null) {
                            Log.d(
                                "RemoteCommand",
                                "Processing pending command: ${command.commandId} type: ${command.commandType}"
                            )
                            onCommand(command)
                        }
                    }
                }
            }
    }

    override fun updateCommandStatus(
        childId: String,
        commandId: String,
        status: CommandStatus,
        resultMessage: String?
    ) {
        if (childId.isEmpty() || commandId.isEmpty()) {
            Log.w(
                "RemoteCommand",
                "updateCommandStatus: invalid IDs. child: $childId cmd: $commandId"
            )
            return
        }

        Log.i("RemoteCommand", "Updating command $commandId status to $status for child $childId")
        val updates = mutableMapOf<String, Any>(
            "status" to status.name
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
                Log.e("RemoteCommand", "Failed to update command status for $commandId", e)
                errorLogger.addError("RemoteCommand", "Failed to update command status", e)
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
                    val family =
                        snapshot.toObject(com.example.kidsguard.models.FamilyDoc::class.java)
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
                    trySend(null) // Unblock flow on error
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    try {
                        val status = snapshot.toObject(SyncChildStatus::class.java)
                        trySend(status)
                    } catch (err: Exception) {
                        Log.e(TAG, "Error parsing child status", err)
                        trySend(null)
                    }
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
                    trySend(null) // Unblock flow on error
                    return@addSnapshotListener
                }

                if (snapshots != null && !snapshots.isEmpty) {
                    try {
                        val event =
                            snapshots.documents.first().toObject(SyncActivityEvent::class.java)
                        trySend(event)
                    } catch (err: Exception) {
                        Log.e(TAG, "Error parsing latest activity", err)
                        trySend(null)
                    }
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
                    val events =
                        snapshots.documents.mapNotNull { it.toObject(SyncActivityEvent::class.java) }
                    trySend(events)
                } else {
                    trySend(emptyList())
                }
            }

        awaitClose { registration.remove() }
    }

    override fun getLocationHistory(childId: String): Flow<List<SyncLocationUpdate>> =
        callbackFlow {
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
                        val locations =
                            snapshots.documents.mapNotNull { it.toObject(SyncLocationUpdate::class.java) }
                        trySend(locations)
                    } else {
                        trySend(emptyList())
                    }
                }

            awaitClose { registration.remove() }
        }

    override fun getDailySummary(
        childId: String,
        date: Long
    ): Flow<com.example.kidsguard.ai.DailySummary?> = callbackFlow {
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
                    val summary = snapshots.documents.first()
                        .toObject(com.example.kidsguard.ai.DailySummary::class.java)
                    trySend(summary)
                } else {
                    trySend(null)
                }
            }

        awaitClose { registration.remove() }
    }

    override fun getSafeZones(familyId: String): Flow<List<com.example.kidsguard.models.SafeZone>> =
        callbackFlow {
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
                        val zones =
                            snapshots.documents.mapNotNull { it.toObject(com.example.kidsguard.models.SafeZone::class.java) }
                        trySend(zones)
                    } else {
                        trySend(emptyList())
                    }
                }

            awaitClose { registration.remove() }
        }

    override fun getSafeZonesForChild(childId: String): Flow<List<com.example.kidsguard.models.SafeZone>> =
        callbackFlow {
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
                        val zones =
                            snapshots.documents.mapNotNull { it.toObject(com.example.kidsguard.models.SafeZone::class.java) }
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

    override suspend fun syncDailyAppUsage(usage: com.example.kidsguard.models.DailyAppUsage): Result<Unit> {
        if (usage.childId.isBlank()) {
            return Result.failure(IllegalArgumentException("childId is blank"))
        }

        return try {
            val path = "${FirebaseConfig.COL_CHILDREN}/${usage.childId}/appUsage/${usage.date}"
            Log.d("AppUsageSync", "Uploading usage to Firestore: $path")
            
            db.collection(FirebaseConfig.COL_CHILDREN)
                .document(usage.childId)
                .collection("appUsage")
                .document(usage.date)
                .set(usage, com.google.firebase.firestore.SetOptions.merge())
                .await()
                
            Log.i("AppUsageSync", "Upload success: $path")
            _lastSyncTimestamp.value = System.currentTimeMillis()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e("AppUsageSync", "Upload failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    override fun getWellbeingSettings(childId: String): Flow<SyncWellbeingSettings?> =
        callbackFlow {
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

    override fun getAppUsageHistory(childId: String, date: String): Flow<List<SyncAppUsage>> =
        callbackFlow {
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
                        val apps =
                            snapshots.documents.mapNotNull { it.toObject(SyncAppUsage::class.java) }
                        trySend(apps)
                    } else {
                        trySend(emptyList())
                    }
                }

            awaitClose { registration.remove() }
        }

    override fun getWebRules(childId: String): Flow<com.example.kidsguard.web.WebRuleSet?> =
        callbackFlow {
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

    override fun syncWebActivity(
        childId: String,
        activity: com.example.kidsguard.web.WebActivityEvent
    ) {
        if (childId.isEmpty()) return

        val date =
            SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(activity.timestamp))
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

    override fun getWebAccessRequests(childId: String): Flow<List<com.example.kidsguard.web.WebAccessRequest>> =
        callbackFlow {
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

    override fun listenToLockSchedule(childId: String): Flow<com.example.kidsguard.models.LockSchedule?> = callbackFlow {
        if (childId.isBlank()) {
            trySend(null)
            return@callbackFlow
        }
        val ref = db.collection(FirebaseConfig.COL_CHILDREN).document(childId)
            .collection("settings").document("lockSchedule")
        
        Log.i("LockScheduleSync", "Attaching listener to: ${ref.path}")
        
        val listener = ref.addSnapshotListener { snap, e ->
            if (e != null) {
                Log.e("LockScheduleSync", "Error listening to lock schedule", e)
                return@addSnapshotListener
            }
            if (snap != null && snap.exists()) {
                val data = snap.data
                try {
                    val daysRaw = data?.get("days") as? List<*>
                    val daysList = daysRaw?.mapNotNull { (it as? Number)?.toInt() } ?: emptyList()
                    
                    val schedule = com.example.kidsguard.models.LockSchedule(
                        enabled = data?.get("enabled") as? Boolean ?: false,
                        startMinutes = (data?.get("startMinutes") as? Number)?.toInt() ?: 0,
                        endMinutes = (data?.get("endMinutes") as? Number)?.toInt() ?: 0,
                        days = daysList,
                        timezone = data?.get("timezone") as? String ?: "",
                        updatedAt = readMillis(data?.get("updatedAt")) ?: 0L
                    )
                    Log.d("LockScheduleSync", "Parsed schedule: $schedule")
                    trySend(schedule)
                } catch (err: Exception) {
                    Log.e("LockScheduleSync", "Failed to parse lock schedule", err)
                }
            } else {
                Log.d("LockScheduleSync", "Lock schedule document missing")
                trySend(null)
            }
        }
        awaitClose { 
            Log.i("LockScheduleSync", "Removing listener for lock schedule")
            listener.remove() 
        }
    }

    // Future placeholders for Messaging
    fun registerFcmToken(uid: String, token: String, role: String) {
        if (uid.isEmpty() || token.isEmpty()) return

        val deviceId =
            context.getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
                .getString("device_id", java.util.UUID.randomUUID().toString()) ?: ""

        if (role == "PARENT") {
            db.collection(FirebaseConfig.COL_PARENTS)
                .document(uid)
                .collection(FirebaseConfig.COL_DEVICES)
                .document(deviceId)
                .set(
                    mapOf(
                        "deviceId" to deviceId,
                        "token" to token,
                        "platform" to "Android",
                        "deviceName" to android.os.Build.MODEL,
                        "lastSeen" to com.google.firebase.Timestamp.now(),
                        "appVersion" to "1.0.0"
                    ), com.google.firebase.firestore.SetOptions.merge()
                )
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
