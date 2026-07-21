package com.example.kidsguard.wellbeing

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import com.example.kidsguard.admin.KidsGuardAdminReceiver
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AppControlRepository
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.RemoteSyncProvider
import com.example.kidsguard.sync.SyncAppUsage
import com.example.kidsguard.sync.SyncWellbeingSettings
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import android.content.Intent
import android.content.pm.PackageManager
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
    private val appControlRepository = AppControlRepository(context)
    private val db = FirebaseFirestore.getInstance()

    private val _settings = MutableStateFlow(WellbeingSettings())
    val settings: StateFlow<WellbeingSettings> = _settings

    companion object {
        private const val TAG = "WellbeingManager"
    }

    init {
        appControlRepository.startListening()
        startSettingsListener()
        startUsageSync()
        applySystemRestrictions()
    }

    private fun applySystemRestrictions() {
        if (dpm.isAdminActive(adminComponent)) {
            try {
                if (Build.VERSION.SDK_INT >= 35) {
                    dpm.addUserRestriction(adminComponent, "no_add_private_profile")
                    Log.i(TAG, "Restriction applied: no_add_private_profile")
                }
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
                Log.w(TAG, "Limit reached for ${app.appName}: ${app.totalTimeVisibleMs}ms >= ${limit.dailyLimitMs}ms")
            }
        }
    }

    fun getAppBlockReason(packageName: String): AppBlockReason {
        if (isEmergencyApp(packageName)) return AppBlockReason.NONE
        
        val control = appControlRepository.getControl(packageName)
        if (control != null) {
            if (control.blocked) {
                Log.i("AppBlock", "Blocking $packageName: Static block from appControls")
                return AppBlockReason.STATIC_BLOCK
            }
            
            if (control.dailyLimitMinutes != null) {
                val usage = tracker.getDailyUsage().find { it.packageName == packageName }
                val usageMins = (usage?.totalTimeVisibleMs ?: 0L) / 60000
                if (usageMins >= control.dailyLimitMinutes!!) {
                    Log.i("AppLimit", "Blocking $packageName: Limit reached (${usageMins}m >= ${control.dailyLimitMinutes}m)")
                    return AppBlockReason.LIMIT_REACHED
                }
            }
        }

        val currentSettings = _settings.value
        if (currentSettings.blockRules.any { it.packageName == packageName && it.isBlocked }) {
            return AppBlockReason.STATIC_BLOCK
        }
        
        val usage = tracker.getDailyUsage()
        val appUsage = usage.find { it.packageName == packageName }
        val legacyLimit = currentSettings.appLimits.find { it.packageName == packageName && it.enabled }
        if (appUsage != null && legacyLimit != null && appUsage.totalTimeVisibleMs >= legacyLimit.dailyLimitMs) {
            return AppBlockReason.LIMIT_REACHED
        }

        if (isInsideBlockedSchedule(packageName, currentSettings)) {
            return AppBlockReason.SCHEDULE
        }

        return AppBlockReason.NONE
    }

    fun isAppBlocked(packageName: String): Boolean {
        return getAppBlockReason(packageName) != AppBlockReason.NONE
    }

    fun getAppName(packageName: String): String {
        val control = appControlRepository.getControl(packageName)
        if (control != null && control.appName.isNotEmpty()) {
            return control.appName
        }

        return try {
            val pm = context.packageManager
            val info = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            packageName
        }
    }

    fun requestAccess(packageName: String, reason: String) {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        val appName = getAppName(packageName)
        Log.i("RequestAccess", "Requesting access for $packageName ($reason)")
        
        val requestId = UUID.randomUUID().toString()
        val request = mapOf(
            "childId" to childId,
            "childName" to prefHelper.childName,
            "packageName" to packageName,
            "appName" to appName,
            "reason" to reason,
            "status" to "PENDING",
            "requestedAt" to FieldValue.serverTimestamp()
        )

        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("appAccessRequests")
            .document(requestId)
            .set(request)

        val notification = mapOf(
            "type" to "APP_ACCESS_REQUEST",
            "childId" to childId,
            "childName" to prefHelper.childName,
            "appName" to appName,
            "packageName" to packageName,
            "reason" to reason,
            "createdAt" to FieldValue.serverTimestamp(),
            "read" to false,
            "familyId" to (prefHelper.familyId ?: ""),
            "clickAction" to "/children/$childId/installed-apps?pkg=$packageName"
        )

        db.collection(FirebaseConfig.COL_NOTIFICATIONS)
            .add(notification)
    }

    private fun isInsideBlockedSchedule(packageName: String, settings: WellbeingSettings): Boolean {
        val now = Calendar.getInstance()
        val currentDay = now.get(Calendar.DAY_OF_WEEK)
        val currentTime = String.format("%02d:%02d", now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE))
        
        settings.globalSchedules.filter { it.enabled && it.daysOfWeek.contains(currentDay) }.forEach { schedule ->
            if (currentTime >= schedule.startTime && currentTime <= schedule.endTime) {
                if (schedule.blockedPackages.contains(packageName)) return true
            }
        }
        
        return false
    }

    private fun isEmergencyApp(packageName: String): Boolean {
        val emergency = listOf(
            context.packageName,
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.contacts",
            "com.android.settings",
            "com.android.camera",
            "com.google.android.apps.maps",
            "com.android.systemui",
            "com.google.android.packageinstaller",
            "com.android.packageinstaller"
        )
        // Also don't block launchers
        if (isLauncher(packageName)) return true
        
        return emergency.contains(packageName) || packageName.startsWith("com.android.settings")
    }

    private fun isLauncher(packageName: String): Boolean {
        val intent = Intent(Intent.ACTION_MAIN)
        intent.addCategory(Intent.CATEGORY_HOME)
        val resolveInfo = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        return resolveInfo?.activityInfo?.packageName == packageName
    }
}
