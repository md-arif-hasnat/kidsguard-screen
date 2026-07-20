package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.models.SosAlert
import com.example.kidsguard.models.SosEvent
import com.example.kidsguard.sync.SyncActivityEvent
import com.example.kidsguard.sync.SyncNotificationEvent
import com.example.kidsguard.models.SosStatus
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class SosRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("sos_prefs", Context.MODE_PRIVATE)
    private val prefHelper = com.example.kidsguard.data.PreferenceHelper(context)
    private var syncProvider: com.example.kidsguard.sync.RemoteSyncProvider? = null
    private val geocoder = com.example.kidsguard.geocoding.ReverseGeocoder(context)
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    private val repositoryScope = CoroutineScope(Dispatchers.IO)

    private val _sosHistory = MutableStateFlow<List<SosEvent>>(loadHistory())
    val sosHistory: StateFlow<List<SosEvent>> = _sosHistory

    private val _activeSos = MutableStateFlow<SosEvent?>(determineActiveSos())
    val activeSos: StateFlow<SosEvent?> = _activeSos

    private val _activeSosAlert = MutableStateFlow<SosAlert?>(null)
    val activeSosAlert: StateFlow<SosAlert?> = _activeSosAlert

    private var alertListenerJob: kotlinx.coroutines.Job? = null

    fun setSyncProvider(provider: com.example.kidsguard.sync.RemoteSyncProvider) {
        this.syncProvider = provider
        startActiveAlertListener()
    }

    fun refreshActiveAlertListener() {
        startActiveAlertListener()
    }

    private fun startActiveAlertListener() {
        val familyId = prefHelper.familyId ?: return
        val childId = prefHelper.childId
        
        Log.d("SosSync", "Starting active alert listener. familyId=$familyId, childId=$childId, role=${prefHelper.userRole}")
        
        alertListenerJob?.cancel()
        alertListenerJob = repositoryScope.launch {
            if (prefHelper.userRole == "PARENT") {
                // Parent listens to ALL active alerts in family using standardized path
                syncProvider?.getActiveSosAlerts(familyId)?.collect { alerts ->
                    Log.d("SosSync", "Parent listener received active alerts: count=${alerts.size}")
                    
                    val alert = alerts.firstOrNull()
                    _activeSosAlert.value = alert
                    
                    if (alert != null) {
                        _activeSos.value = SosEvent(
                            id = alert.alertId,
                            childId = alert.childId,
                            timestamp = alert.timestamp,
                            latitude = alert.latitude,
                            longitude = alert.longitude,
                            accuracy = alert.locationAccuracy,
                            message = alert.message,
                            status = SosStatus.ACTIVE,
                            active = true,
                            address = alert.address
                        )
                    } else {
                        // Only clear display if the cloud reports ZERO active alerts for this family
                        _activeSos.value = null
                        _activeSosAlert.value = null
                    }
                }
            } else {
                // Child listens to their own specific active alert
                // We use a local variable to track if we should still be listening
                var currentActiveId = prefHelper.activeSosId
                
                while (currentActiveId != null) {
                    val activeId = currentActiveId // Snapshot for this iteration
                    Log.d("SosSync", "Child listener starting for alert: $activeId")
                    
                    // Listen to this specific alert until it's resolved or dismissed
                    syncProvider?.getSosAlertForChild(childId, activeId)?.collect { alert ->
                        Log.d("SosSync", "Child listener update for $activeId: status=${alert?.status}")
                        
                        if (alert != null) {
                            _activeSosAlert.value = alert
                            if (alert.status == "RESOLVED") {
                                Log.i("SosSync", "SOS marked as RESOLVED in cloud. Ending active state.")
                                // Stop the active tracking but keep _activeSosAlert for the "Resolved" card
                                _activeSos.value = null
                                // We don't set prefHelper.activeSosId = null here because we need it to stay RESOLVED 
                                // until the user dismisses it. 
                            } else {
                                // Update local state with latest from cloud
                                _activeSos.value = SosEvent(
                                    id = alert.alertId,
                                    childId = alert.childId,
                                    timestamp = alert.timestamp,
                                    latitude = alert.latitude,
                                    longitude = alert.longitude,
                                    accuracy = alert.locationAccuracy,
                                    message = alert.message,
                                    status = SosStatus.ACTIVE,
                                    active = true,
                                    address = alert.address
                                )
                            }
                        } else {
                            Log.w("SosSync", "SOS alert $activeId not found in cloud snapshot.")
                            // If document is missing, it might have been deleted. 
                            // We should probably clear local state to be safe.
                            if (prefHelper.activeSosId == null) {
                                _activeSos.value = null
                                _activeSosAlert.value = null
                                currentActiveId = null
                            }
                        }
                    }
                    
                    // Re-check if activeSosId changed while we were collecting
                    currentActiveId = prefHelper.activeSosId
                    if (currentActiveId == activeId) break // Still the same, or collect finished naturally
                }
            }
        }
    }

    fun triggerSos(event: SosEvent) {
        repositoryScope.launch {
            val familyId = prefHelper.familyId ?: ""
            val childId = prefHelper.childId
            val childName = prefHelper.childName
            val alertId = java.util.UUID.randomUUID().toString()
            val now = System.currentTimeMillis()
            
            Log.i("SosFlow", "Triggering SOS for child $childName (alertId: $alertId, familyId: $familyId)")

            // A. Save a complete SOS location snapshot
            var latitude = event.latitude
            var longitude = event.longitude
            var accuracy = event.accuracy
            var locationTimestamp = event.timestamp
            var locationSource = "LAST_KNOWN"

            try {
                if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.d("SosLocation", "Requesting high accuracy fresh location for SOS...")
                    
                    // Request the latest available child location (fresh)
                    val cancellationTokenSource = CancellationTokenSource()
                    val freshLocation = withContext(Dispatchers.IO) {
                        try {
                            // Apply a 5-second timeout for fresh GPS acquisition
                            val task = fusedLocationClient.getCurrentLocation(
                                Priority.PRIORITY_HIGH_ACCURACY,
                                cancellationTokenSource.token
                            )
                            
                            // Using Tasks.await with timeout is tricky in coroutines, 
                            // but getCurrentLocation is generally fast if GPS is on.
                            // We'll use a simple coroutine timeout.
                            kotlinx.coroutines.withTimeoutOrNull(5000) {
                                com.google.android.gms.tasks.Tasks.await(task)
                            }
                        } catch (e: Exception) {
                            Log.w("SosLocation", "Fresh location acquisition failed", e)
                            null
                        }
                    }

                    if (freshLocation != null) {
                        latitude = freshLocation.latitude
                        longitude = freshLocation.longitude
                        accuracy = freshLocation.accuracy
                        locationTimestamp = freshLocation.time
                        locationSource = "FRESH_GPS"
                        Log.i("SosLocation", "Fresh GPS location acquired: ($latitude, $longitude)")
                    } else {
                        Log.w("SosLocation", "Fresh location timeout or failure. Falling back to last known.")
                        // Fallback to last known if fresh failed
                        val lastKnown = try {
                            com.google.android.gms.tasks.Tasks.await(fusedLocationClient.lastLocation)
                        } catch (e: Exception) { null }
                        
                        if (lastKnown != null) {
                            latitude = lastKnown.latitude
                            longitude = lastKnown.longitude
                            accuracy = lastKnown.accuracy
                            locationTimestamp = lastKnown.time
                            locationSource = "LAST_KNOWN_FALLBACK"
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w("SosLocation", "Location subsystem error during SOS", e)
            }

            // B. Resolve address from coordinates
            var address: String? = "Address unavailable"
            if (latitude != null && longitude != null) {
                Log.d("SosLocation", "Resolving address for ($latitude, $longitude)")
                val addressInfo = withContext(Dispatchers.IO) {
                    geocoder.getAddress(latitude, longitude)
                }
                address = addressInfo?.fullAddress ?: "Address unavailable"
                Log.i("SosLocation", "Address resolved: $address")
            }

            val alert = SosAlert(
                alertId = alertId,
                familyId = familyId,
                childId = childId,
                childName = childName,
                status = "ACTIVE",
                createdAt = now,
                timestamp = now,
                latitude = latitude,
                longitude = longitude,
                address = address,
                locationAccuracy = accuracy,
                locationTimestamp = locationTimestamp,
                batteryPercent = event.batteryPercent,
                message = event.message, // This carries the optional child message
                active = true
            )

            prefHelper.activeSosId = alertId
            _activeSosAlert.value = alert
            
            // C. Use one shared Firebase SOS document: children/{childId}/sosEvents/{alertId}
            val sosPath = "children/$childId/sosEvents/$alertId"
            Log.d("SosSync", "Writing canonical SOS alert to: $sosPath")
            
            syncProvider?.syncSosAlert(alert) { success, exception ->
                if (!success) {
                    val errorCode = (exception as? com.google.firebase.firestore.FirebaseFirestoreException)?.code?.name ?: "UNKNOWN"
                    Log.e("SosSync", "SOS Alert cloud sync FAILURE: $errorCode - ${exception?.message}")
                } else {
                    Log.i("SosSync", "SOS Alert cloud sync SUCCESS: $sosPath")
                }
            }
            
            // Start listening for status updates (e.g. parent resolving)
            startActiveAlertListener()

            // Update local history
            val historyEvent = event.copy(
                id = alertId,
                status = SosStatus.ACTIVE,
                latitude = latitude,
                longitude = longitude,
                accuracy = accuracy,
                address = address
            )
            val currentList = _sosHistory.value.toMutableList()
            currentList.add(0, historyEvent)
            _sosHistory.value = currentList
            _activeSos.value = historyEvent
            saveHistory(currentList)

            // Fan-out: Activity History
            syncProvider?.syncActivity(SyncActivityEvent(
                id = alertId,
                childId = childId,
                type = "SOS",
                title = "Emergency SOS Triggered",
                description = address ?: alert.message,
                latitude = latitude,
                longitude = longitude,
                timestamp = alert.createdAt,
                severity = "critical"
            ))

            // Fan-out: Notification Record
            syncProvider?.syncNotification(SyncNotificationEvent(
                id = alertId,
                childId = event.childId,
                type = "SOS",
                title = "🆘 SOS ACTIVATED",
                body = "Location: $address",
                sentAt = alert.createdAt,
                read = false
            ))
        }
    }

    fun resolveSos(id: String) {
        val alertId = id.ifBlank {
            prefHelper.activeSosId.orEmpty()
        }
        val childId = prefHelper.childId
        val resolvedBy = if (prefHelper.userRole == "CHILD") "CHILD" else "PARENT"

        if (alertId.isBlank() || childId.isBlank()) {
            Log.e("SosSync", "RESOLVE STOPPED: alertId or childId is blank")
            return
        }

        val sosPath = "children/$childId/sosEvents/$alertId"
        Log.d("SosSync", "$resolvedBy resolve requested: $sosPath")

        val documentRef = com.google.firebase.firestore.FirebaseFirestore.getInstance()
            .document(sosPath)

        val updates = mapOf<String, Any?>(
            "status" to "RESOLVED",
            "resolvedAt" to System.currentTimeMillis(),
            "resolvedBy" to resolvedBy,
            "active" to false
        )

        documentRef.update(updates)
            .addOnSuccessListener {
                Log.i("SosSync", "Firebase status changed to RESOLVED for $alertId")
                if (resolvedBy == "CHILD") {
                    prefHelper.activeSosId = null
                    _activeSos.value = null
                    _activeSosAlert.value = _activeSosAlert.value?.copy(status = "RESOLVED", active = false)
                }
            }
            .addOnFailureListener { exception ->
                Log.e("SosSync", "Resolve failed", exception)
            }
    }

    fun clearSosHistory() {
        // Fix BUG #3: Cancel the listener job so it stops re-populating state from Firestore
        alertListenerJob?.cancel()
        alertListenerJob = null
        
        _sosHistory.value = emptyList()
        _activeSos.value = null
        _activeSosAlert.value = null
        prefHelper.activeSosId = null
        prefs.edit().clear().apply()
    }

    private fun determineActiveSos(): SosEvent? {
        val activeId = prefHelper.activeSosId
        return _sosHistory.value.firstOrNull { it.status == SosStatus.ACTIVE || it.id == activeId }
    }

    private fun saveHistory(history: List<SosEvent>) {
        val jsonArray = JSONArray()
        history.take(50).forEach { event ->
            val obj = JSONObject().apply {
                put("id", event.id)
                put("childId", event.childId)
                put("timestamp", event.timestamp)
                put("lat", event.latitude ?: JSONObject.NULL)
                put("lng", event.longitude ?: JSONObject.NULL)
                put("accuracy", event.accuracy?.toDouble() ?: JSONObject.NULL)
                put("battery", event.batteryPercent ?: JSONObject.NULL)
                put("message", event.message)
                put("status", event.status.name)
                put("resolvedAt", event.resolvedAt ?: JSONObject.NULL)
                put("active", event.active)
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString("sos_json", jsonArray.toString()).apply()
    }

    private fun loadHistory(): List<SosEvent> {
        val jsonStr = prefs.getString("sos_json", null) ?: return emptyList()
        val list = mutableListOf<SosEvent>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(SosEvent(
                    id = obj.getString("id"),
                    childId = obj.getString("childId"),
                    timestamp = obj.getLong("timestamp"),
                    latitude = if (obj.isNull("lat")) null else obj.getDouble("lat"),
                    longitude = if (obj.isNull("lng")) null else obj.getDouble("lng"),
                    accuracy = if (obj.isNull("accuracy")) null else obj.getDouble("accuracy").toFloat(),
                    batteryPercent = if (obj.isNull("battery")) null else obj.getInt("battery"),
                    message = obj.getString("message"),
                    status = SosStatus.valueOf(obj.getString("status")),
                    resolvedAt = if (obj.isNull("resolvedAt")) null else obj.getLong("resolvedAt"),
                    active = obj.optBoolean("active", true)
                ))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }
}
