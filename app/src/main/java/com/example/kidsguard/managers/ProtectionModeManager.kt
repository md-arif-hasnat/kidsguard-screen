package com.example.kidsguard.managers

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.ProtectionModeDoc
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.*

class ProtectionModeManager(context: Context, private val childId: String) {
    private val db = FirebaseFirestore.getInstance()
    private val TAG = "ProtectionModeManager"
    private val prefHelper = PreferenceHelper(context)

    private val _activeModes = MutableStateFlow<List<ProtectionModeDoc>>(emptyList())
    val activeModes: StateFlow<List<ProtectionModeDoc>> = _activeModes

    private val allModes = mutableListOf<ProtectionModeDoc>()

    init {
        listenToModes()
    }

    private fun listenToModes() {
        if (childId.isEmpty()) return

        db.collection("children").document(childId)
            .collection("protectionModes")
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e(TAG, "Listen failed", e)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    allModes.clear()
                    for (doc in snapshot) {
                        allModes.add(doc.toObject(ProtectionModeDoc::class.java))
                    }
                    evaluateModes()
                }
            }
    }

    fun evaluateModes() {
        val now = Calendar.getInstance()
        val currentDay = now.get(Calendar.DAY_OF_WEEK) - 1 // 0-indexed Sun=0
        val currentTime = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now.time)
        val currentZoneId = prefHelper.currentZoneId

        val active = allModes.filter { mode ->
            if (!mode.enabled) return@filter false

            var scheduleMatch = false
            if (mode.schedule != null) {
                val dayMatch = mode.schedule.days.contains(currentDay)
                val timeMatch = currentTime >= mode.schedule.startTime && currentTime <= mode.schedule.endTime
                scheduleMatch = dayMatch && timeMatch
            }

            val zoneMatch = mode.triggerZoneId != null && mode.triggerZoneId == currentZoneId

            scheduleMatch || zoneMatch
        }

        _activeModes.value = active
        Log.d(TAG, "Evaluated modes. Active count: ${active.size}. Zone: $currentZoneId")
    }

    fun isAppBlocked(packageName: String): Boolean {
        // Evaluate on each check to ensure time-based triggers work without a listener for every minute
        evaluateModes()
        
        val active = _activeModes.value
        
        // Emergency apps never blocked
        if (isEmergencyApp(packageName)) return false

        // If any active mode locks the device, block everything
        if (active.any { it.lockDevice }) return true

        // Check specific app blocks in active modes
        for (mode in active) {
            if (mode.blockedApps.contains(packageName)) return true
            if (mode.allowedApps.isNotEmpty() && !mode.allowedApps.contains(packageName)) return true
        }

        return false
    }

    private fun isEmergencyApp(packageName: String): Boolean {
        val emergencyPackages = listOf(
            "com.android.phone",
            "com.android.contacts",
            "com.example.kidsguard",
            "com.android.settings",
            "com.google.android.dialer",
            "com.google.android.contacts",
            "com.android.server.telecom"
        )
        return emergencyPackages.contains(packageName)
    }
}
