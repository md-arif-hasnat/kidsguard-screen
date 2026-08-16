package com.example.kidsguard.data

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import java.util.Calendar

class PreferenceHelper(context: Context) {
    private val prefs = context.getSharedPreferences("kidsguard_prefs", Context.MODE_PRIVATE)

    var pin: String
        get() = prefs.getString("pin", "1234") ?: "1234"
        set(value) = prefs.edit().putString("pin", value).apply()

    var secretTapsCount: Int
        get() = prefs.getInt("secret_taps_count", 5)
        set(value) = prefs.edit().putInt("secret_taps_count", value).apply()

    var isSecretTapsEnabled: Boolean
        get() = prefs.getBoolean("secret_taps_enabled", true)
        set(value) = prefs.edit().putBoolean("secret_taps_enabled", value).apply()

    var isLocked: Boolean
        get() = prefs.getBoolean("is_locked", false)
        set(value) = prefs.edit().putBoolean("is_locked", value).apply()

    var isVolumeUnlockEnabled: Boolean
        get() = prefs.getBoolean("volume_unlock_enabled", true)
        set(value) = prefs.edit().putBoolean("volume_unlock_enabled", value).apply()

    var deviceId: String
        get() {
            var id = prefs.getString("device_id", null)
            if (id == null) {
                id = java.util.UUID.randomUUID().toString()
                prefs.edit().putString("device_id", id).apply()
                android.util.Log.d("PreferenceHelper", "New stable deviceId generated: $id")
            }
            return id
        }
        private set(value) = prefs.edit().putString("device_id", value).apply()


    var childId: String
        get() {
            // Priority: 1. pairedChildId, 2. existing saved child_id, 3. deviceId
            val paired = pairedChildId
            if (!paired.isNullOrEmpty()) return paired

            val saved = prefs.getString("child_id", null)
            if (!saved.isNullOrEmpty()) return saved

            val fallback = deviceId
            prefs.edit().putString("child_id", fallback).apply()
            return fallback
        }
        set(value) = prefs.edit().putString("child_id", value).apply()

    var authorizedDeviceAdminSetupExpiresAt: Long
        get() = prefs.getLong(
            "authorized_device_admin_setup_expires_at",
            0L
        )
        set(value) {
            prefs.edit()
                .putLong(
                    "authorized_device_admin_setup_expires_at",
                    value
                )
                .apply()
        }

    fun resetIdentity() {
        val newId = java.util.UUID.randomUUID().toString()
        prefs.edit()
            .putString("device_id", newId)
            .putString("child_id", newId)
            .apply()
        android.util.Log.i("PreferenceHelper", "Device identity reset. New ID: $newId")
    }

    var firebaseUid: String?
        get() = prefs.getString("firebase_uid", null)
        set(value) = prefs.edit().putString("firebase_uid", value).apply()

    var familyId: String?
        get() = prefs.getString("family_id", null)
        set(value) = prefs.edit().putString("family_id", value).apply()

    var lastFirestoreWrite: Long
        get() = prefs.getLong("last_firestore_write", 0L)
        set(value) = prefs.edit().putLong("last_firestore_write", value).apply()

    var userRole: String
        get() = prefs.getString("user_role", "NONE") ?: "NONE"
        set(value) = prefs.edit().putString("user_role", value).apply()

    var pairingCode: String
        get() = prefs.getString("pairing_code", "") ?: ""
        set(value) = prefs.edit().putString("pairing_code", value).apply()

    var pairedChildId: String?
        get() = prefs.getString("paired_child_id", null)
        set(value) = prefs.edit().putString("paired_child_id", value).apply()

    var selectedChildId: String?
        get() = prefs.getString("selected_child_id", pairedChildId)
        set(value) = prefs.edit().putString("selected_child_id", value).apply()

    var childName: String
        get() = prefs.getString("child_name", "") ?: ""
        set(value) = prefs.edit().putString("child_name", value).apply()

    var avatarId: String
        get() = prefs.getString("avatar_id", "avatar_1") ?: "avatar_1"
        set(value) = prefs.edit().putString("avatar_id", value).apply()

    var deviceName: String
        get() = prefs.getString("device_name", android.os.Build.MODEL) ?: android.os.Build.MODEL
        set(value) = prefs.edit().putString("device_name", value).apply()

    var isScheduleEnabled: Boolean
        get() = prefs.getBoolean("schedule_enabled", false)
        set(value) = prefs.edit().putBoolean("schedule_enabled", value).apply()

    var scheduleStartTime: String
        get() = prefs.getString("schedule_start", "20:00") ?: "20:00"
        set(value) = prefs.edit().putString("schedule_start", value).apply()

    var scheduleEndTime: String
        get() = prefs.getString("schedule_end", "05:00") ?: "08:00"
        set(value) = prefs.edit().putString("schedule_end", value).apply()

    var isSafeZoneNotificationsEnabled: Boolean
        get() = prefs.getBoolean("safe_zone_notifications", true)
        set(value) = prefs.edit().putBoolean("safe_zone_notifications", value).apply()

    var isTrackingNotificationsEnabled: Boolean
        get() = prefs.getBoolean("tracking_notifications", true)
        set(value) = prefs.edit().putBoolean("tracking_notifications", value).apply()

    var isBatteryNotificationsEnabled: Boolean
        get() = prefs.getBoolean("battery_notifications", true)
        set(value) = prefs.edit().putBoolean("battery_notifications", value).apply()

    var isSosNotificationsEnabled: Boolean
        get() = prefs.getBoolean("sos_notifications", true)
        set(value) = prefs.edit().putBoolean("sos_notifications", value).apply()

    var activeSosId: String?
        get() = prefs.getString("active_sos_id", null)
        set(value) = prefs.edit().putString("active_sos_id", value).apply()

    var lastSeenVersionCode: Int
        get() = prefs.getInt("last_seen_version_code", 0)
        set(value) = prefs.edit().putInt("last_seen_version_code", value).apply()

    var currentZoneId: String?
        get() = prefs.getString("current_zone_id", null)
        set(value) = prefs.edit().putString("current_zone_id", value).apply()

    var isSetupCompleted: Boolean
        get() = prefs.getBoolean("setup_completed", false)
        set(value) = prefs.edit().putBoolean("setup_completed", value).apply()

    var authorizedUninstall: Boolean
        get() = prefs.getBoolean("authorized_uninstall", false)
        set(value) = prefs.edit()
            .putBoolean("authorized_uninstall", value)
            .apply()

    var authorizedUninstallExpiresAt: Long
        get() = prefs.getLong("authorized_uninstall_expires_at", 0L)
        set(value) {
            prefs.edit()
                .putLong("authorized_uninstall_expires_at", value)
                .apply()
        }

    var lastTamperAlertAt: Long
        get() = prefs.getLong("last_tamper_alert_at", 0L)
        set(value) {
            prefs.edit()
                .putLong("last_tamper_alert_at", value)
                .apply()
        }

    var removedByParent: Boolean
        get() = prefs.getBoolean("removed_by_parent", false)
        set(value) = prefs.edit().putBoolean("removed_by_parent", value).apply()

    var parentName: String?
        get() = prefs.getString("parent_name", null)
        set(value) = prefs.edit().putString("parent_name", value).apply()

    var parentUid: String?
        get() = prefs.getString("parent_uid", null)
        set(value) = prefs.edit().putString("parent_uid", value).apply()

    var pairedAt: Long
        get() = prefs.getLong("paired_at", 0L)
        set(value) = prefs.edit().putLong("paired_at", value).apply()

    var lockReason: com.example.kidsguard.models.LockReason
        get() = com.example.kidsguard.models.LockReason.valueOf(
            prefs.getString(
                "lock_reason",
                "NONE"
            ) ?: "NONE"
        )
        set(value) = prefs.edit().putString("lock_reason", value.name).apply()

    var scheduleUnlockOverrideUntil: Long
        get() = prefs.getLong("schedule_unlock_override_until", 0L)
        set(value) = prefs.edit().putLong("schedule_unlock_override_until", value).apply()

    var lockScheduleJson: String?
        get() = prefs.getString("lock_schedule_json", null)
        set(value) = prefs.edit().putString("lock_schedule_json", value).apply()

    fun clearPairing() {
        prefs.edit()
            .remove("family_id")
            .remove("child_id")
            .remove("pairing_code")
            .remove("paired_child_id")
            .remove("setup_completed")
            .remove("parent_name")
            .remove("paired_at")
            //.remove("user_role")
            .remove("is_locked")
            .putBoolean("removed_by_parent", true)
            .apply()
        android.util.Log.i("PreferenceHelper", "Local pairing data cleared.")
    }
}

object RemoteStatusService {
    fun updateChildStatus(context: Context, prefHelper: PreferenceHelper) {
        val battery = getBatteryLevel(context)
        val lastActive = System.currentTimeMillis()
    }

    fun startRemoteCommandListener(prefHelper: PreferenceHelper) {
    }
}

data class DeviceLocation(val lat: Double, val lng: Double, val timestamp: Long)

fun isCurrentTimeInSchedule(prefHelper: PreferenceHelper): Boolean {
    if (!prefHelper.isScheduleEnabled) return false

    val now = Calendar.getInstance()
    val currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

    fun parseToMinutes(time: String): Int {
        val parts = time.split(":")
        if (parts.size != 2) return 0
        return (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
    }

    val startMin = parseToMinutes(prefHelper.scheduleStartTime)
    val endMin = parseToMinutes(prefHelper.scheduleEndTime)

    return if (startMin <= endMin) {
        currentMinutes in startMin..endMin
    } else {
        // Overnight schedule (e.g., 22:00 to 07:00)
        currentMinutes >= startMin || currentMinutes <= endMin
    }
}

fun getBatteryLevel(context: Context): Int {
    val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { ifilter ->
        context.registerReceiver(null, ifilter)
    }
    return batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
}

fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
