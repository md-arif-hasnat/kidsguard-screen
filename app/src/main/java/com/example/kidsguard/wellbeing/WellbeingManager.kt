package com.example.kidsguard.wellbeing

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncAppUsage
import com.example.kidsguard.sync.SyncWellbeingSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.os.Build
import android.os.UserManager
import androidx.annotation.RequiresApi
import com.example.kidsguard.admin.KidsGuardAdminReceiver
import java.text.SimpleDateFormat
import java.util.*

class WellbeingManager(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val syncProvider: RemoteSyncProvider
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private val tracker = AppUsageTracker(context)
    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = ComponentName(context, KidsGuardAdminReceiver::class.java)

    private val _settings = MutableStateFlow(WellbeingSettings())
    val settings: StateFlow<WellbeingSettings> = _settings

    companion object {
        private const val TAG = "WellbeingManager"
    }

    init {
        startSettingsListener()
        startUsageSync()
        applySystemRestrictions()
    }

    private fun applySystemRestrictions() {
        if (dpm.isAdminActive(adminComponent)) {
            try {
                // Android 15+: Prevent creating Private Space to bypass parental controls
                if (Build.VERSION.SDK_INT >= 35) { // Android 15
                    // UserManager.DISALLOW_ADD_PRIVATE_PROFILE is "no_add_private_profile"
                    dpm.addUserRestriction(adminComponent, "no_add_private_profile")
                    Log.i(TAG, "Restriction applied: no_add_private_profile")
                }
                
                // Prevent uninstalling KidsGuard if it's a device admin
                // Note: Standard Admin cannot set itself as uninstall protected easily 
                // but we can monitor it.
            } catch (e: Exception) {
                Log.e(TAG, "Failed to apply system restrictions", e)
            }
        }
    }

    private fun startSettingsListener() {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        scope.launch {
            syncProvider.getWellbeingSettings(childId).collectLatest { syncSettings ->
                if (syncSettings != null) {
                    _settings.value = WellbeingSettings(
                        appLimits = syncSettings.appLimits.map { AppLimit(it.packageName, it.dailyLimitMs, it.enabled) },
                        blockRules = syncSettings.blockRules.map { AppBlockRule(it.packageName, it.isBlocked) }
                    )
                }
            }
        }
    }

    private fun startUsageSync() {
        scope.launch {
            while (true) {
                try {
                    syncUsage()
                } catch (e: Exception) {
                    Log.e(TAG, "Usage sync failed", e)
                }
                delay(15 * 60 * 1000) // Every 15 minutes
            }
        }
    }

    private fun syncUsage() {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        val usage = tracker.getDailyUsage()
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        
        val syncUsage = usage.map { 
            SyncAppUsage(
                packageName = it.packageName,
                appName = it.appName,
                category = it.category.name,
                totalTimeMs = it.totalTimeVisibleMs,
                lastUsed = it.lastTimeUsed,
                date = date
            )
        }
        
        syncProvider.syncAppUsage(childId, syncUsage)
        checkLimits(usage)
    }

    private fun checkLimits(usage: List<AppUsageInfo>) {
        val currentLimits = _settings.value.appLimits
        usage.forEach { app ->
            val limit = currentLimits.find { it.packageName == app.packageName && it.enabled }
            if (limit != null && app.totalTimeVisibleMs >= limit.dailyLimitMs) {
                // Limit reached!
                // Trigger notification or local block
                Log.w(TAG, "Limit reached for ${app.appName}: ${app.totalTimeVisibleMs}ms >= ${limit.dailyLimitMs}ms")
            }
        }
    }

    fun isAppBlocked(packageName: String): Boolean {
        // Emergency apps never blocked
        if (isEmergencyApp(packageName)) return false
        
        val currentSettings = _settings.value
        
        // 1. Static Block Rules
        if (currentSettings.blockRules.any { it.packageName == packageName && it.isBlocked }) {
            return true
        }
        
        // 2. Daily Limits
        val usage = tracker.getDailyUsage()
        val appUsage = usage.find { it.packageName == packageName }
        val limit = currentSettings.appLimits.find { it.packageName == packageName && it.enabled }
        if (appUsage != null && limit != null && appUsage.totalTimeVisibleMs >= limit.dailyLimitMs) {
            return true
        }

        // 3. Schedules
        if (isInsideBlockedSchedule(packageName, currentSettings)) {
            return true
        }

        return false
    }

    private fun isInsideBlockedSchedule(packageName: String, settings: WellbeingSettings): Boolean {
        val now = Calendar.getInstance()
        val currentDay = now.get(Calendar.DAY_OF_WEEK)
        val currentTime = String.format("%02d:%02d", now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE))
        
        // We could classify app on the fly or use cached category
        // For now, let's just check package-based schedules if any
        
        settings.globalSchedules.filter { it.enabled && it.daysOfWeek.contains(currentDay) }.forEach { schedule ->
            if (currentTime >= schedule.startTime && currentTime <= schedule.endTime) {
                if (schedule.blockedPackages.contains(packageName)) return true
                // We'd also check categories here
            }
        }
        
        return false
    }

    private fun isEmergencyApp(packageName: String): Boolean {
        val emergency = listOf(
            context.packageName, // Our own app
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.contacts",
            "com.android.settings",
            "com.android.camera",
            "com.google.android.apps.maps"
        )
        return emergency.contains(packageName)
    }
}
