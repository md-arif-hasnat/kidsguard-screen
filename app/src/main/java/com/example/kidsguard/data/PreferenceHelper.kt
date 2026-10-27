package com.example.kidsguard.data

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import com.example.kidsguard.security.PinCredential
import com.example.kidsguard.security.PinLockoutPolicy
import com.example.kidsguard.security.PinSecurity
import java.util.Calendar

data class PinVerificationResult(
    val verified: Boolean,
    val lockedOut: Boolean,
    val remainingAttempts: Int,
    val lockoutRemainingSeconds: Int
)

class PreferenceHelper(context: Context) {
    private val prefs = context.getSharedPreferences("kidsguard_prefs", Context.MODE_PRIVATE)

    init {
        migrateLegacyPinIfNeeded()
    }

    @Synchronized
    private fun migrateLegacyPinIfNeeded(): PinCredential {
        readPinCredential()?.let { credential ->
            if (prefs.contains(LEGACY_PIN_KEY)) {
                prefs.edit().remove(LEGACY_PIN_KEY).apply()
            }
            return credential
        }

        val legacyPin = prefs.getString(LEGACY_PIN_KEY, DEFAULT_PIN)
            ?.takeIf(PinSecurity::isValidPin)
            ?: DEFAULT_PIN
        return savePinCredential(PinSecurity.createCredential(legacyPin))
    }

    private fun readPinCredential(): PinCredential? {
        val algorithm = prefs.getString(PIN_ALGORITHM_KEY, null) ?: return null
        val iterations = prefs.getInt(PIN_ITERATIONS_KEY, 0)
        val salt = prefs.getString(PIN_SALT_KEY, null) ?: return null
        val hash = prefs.getString(PIN_HASH_KEY, null) ?: return null
        return PinCredential(algorithm, iterations, salt, hash)
    }

    private fun savePinCredential(credential: PinCredential): PinCredential {
        prefs.edit()
            .putString(PIN_ALGORITHM_KEY, credential.algorithm)
            .putInt(PIN_ITERATIONS_KEY, credential.iterations)
            .putString(PIN_SALT_KEY, credential.saltHex)
            .putString(PIN_HASH_KEY, credential.hashHex)
            .remove(LEGACY_PIN_KEY)
            .commit()
        return credential
    }

    @Synchronized
    fun verifyPin(pinAttempt: String): PinVerificationResult {
        val now = System.currentTimeMillis()
        val lockoutRemaining = pinLockoutRemainingSeconds(now)
        if (lockoutRemaining > 0) {
            return PinVerificationResult(
                verified = false,
                lockedOut = true,
                remainingAttempts = 0,
                lockoutRemainingSeconds = lockoutRemaining
            )
        }

        val verified = PinSecurity.verify(pinAttempt, migrateLegacyPinIfNeeded())
        if (verified) {
            prefs.edit()
                .remove(PIN_FAILED_ATTEMPTS_KEY)
                .remove(PIN_LOCKOUT_END_KEY)
                .apply()
            return PinVerificationResult(
                verified = true,
                lockedOut = false,
                remainingAttempts = PinLockoutPolicy.ATTEMPTS_BEFORE_LOCKOUT,
                lockoutRemainingSeconds = 0
            )
        }

        val failedAttempts = prefs.getInt(PIN_FAILED_ATTEMPTS_KEY, 0) + 1
        val lockoutDuration = PinLockoutPolicy.lockoutDurationMillis(failedAttempts)
        val lockoutEnd = if (lockoutDuration > 0) now + lockoutDuration else 0L
        prefs.edit()
            .putInt(PIN_FAILED_ATTEMPTS_KEY, failedAttempts)
            .putLong(PIN_LOCKOUT_END_KEY, lockoutEnd)
            .commit()

        return PinVerificationResult(
            verified = false,
            lockedOut = lockoutDuration > 0,
            remainingAttempts = PinLockoutPolicy.remainingAttempts(failedAttempts),
            lockoutRemainingSeconds = millisToCeilingSeconds(lockoutDuration)
        )
    }

    @Synchronized
    fun changePin(newPin: String): Boolean {
        if (!PinSecurity.isValidPin(newPin)) return false
        savePinCredential(PinSecurity.createCredential(newPin))
        prefs.edit()
            .remove(PIN_FAILED_ATTEMPTS_KEY)
            .remove(PIN_LOCKOUT_END_KEY)
            .apply()
        return true
    }

    fun pinLockoutRemainingSeconds(now: Long = System.currentTimeMillis()): Int {
        val remaining = (prefs.getLong(PIN_LOCKOUT_END_KEY, 0L) - now).coerceAtLeast(0L)
        return millisToCeilingSeconds(remaining)
    }

    private fun millisToCeilingSeconds(millis: Long): Int =
        if (millis <= 0L) 0 else ((millis + 999L) / 1_000L).toInt()

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

    var authorizedPermissionChangeType: String?
        get() = prefs.getString("authorized_permission_change_type", null)
        set(value) = prefs.edit()
            .putString("authorized_permission_change_type", value)
            .apply()

    var authorizedPermissionChangeExpiresAt: Long
        get() = prefs.getLong("authorized_permission_change_expires_at", 0L)
        set(value) = prefs.edit()
            .putLong("authorized_permission_change_expires_at", value)
            .apply()

    fun isPermissionChangeAuthorized(): Boolean {
        return !authorizedPermissionChangeType.isNullOrBlank() &&
            authorizedPermissionChangeExpiresAt > System.currentTimeMillis()
    }

    fun clearPermissionChangeAuthorization() {
        prefs.edit()
            .remove("authorized_permission_change_type")
            .remove("authorized_permission_change_expires_at")
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

    var backgroundLocationDisclosureAccepted: Boolean
        get() = prefs.getBoolean(
            "background_location_disclosure_accepted",
            false
        )
        set(value) = prefs.edit()
            .putBoolean("background_location_disclosure_accepted", value)
            .apply()

    var accessibilityDisclosureAccepted: Boolean
        get() = prefs.getBoolean(
            "accessibility_disclosure_accepted",
            false
        )
        set(value) = prefs.edit()
            .putBoolean("accessibility_disclosure_accepted", value)
            .apply()

    var notificationAccessDisclosureAccepted: Boolean
        get() = prefs.getBoolean(
            "notification_access_disclosure_accepted",
            false
        )
        set(value) = prefs.edit()
            .putBoolean("notification_access_disclosure_accepted", value)
            .apply()

    var appInventoryDisclosureAccepted: Boolean
        get() = prefs.getBoolean(
            "app_inventory_disclosure_accepted",
            false
        )
        set(value) = prefs.edit()
            .putBoolean("app_inventory_disclosure_accepted", value)
            .apply()

    fun hasRequiredMonitoringConsents(): Boolean =
        backgroundLocationDisclosureAccepted &&
            accessibilityDisclosureAccepted &&
            notificationAccessDisclosureAccepted &&
            appInventoryDisclosureAccepted

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

    var isScheduleWindowActive: Boolean
        get() = prefs.getBoolean("schedule_window_active", false)
        set(value) = prefs.edit()
            .putBoolean("schedule_window_active", value)
            .apply()

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

    fun getSafeZoneInsideState(zoneId: String): Boolean? {
        val key = "safe_zone_inside_$zoneId"
        return if (prefs.contains(key)) prefs.getBoolean(key, false) else null
    }

    fun setSafeZoneInsideState(zoneId: String, inside: Boolean) {
        prefs.edit()
            .putBoolean("safe_zone_inside_$zoneId", inside)
            .apply()
    }

    fun clearSafeZoneInsideState(zoneId: String) {
        prefs.edit()
            .remove("safe_zone_inside_$zoneId")
            .apply()
    }

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

private const val DEFAULT_PIN = "1234"
private const val LEGACY_PIN_KEY = "pin"
private const val PIN_ALGORITHM_KEY = "pin_algorithm_v2"
private const val PIN_ITERATIONS_KEY = "pin_iterations_v2"
private const val PIN_SALT_KEY = "pin_salt_v2"
private const val PIN_HASH_KEY = "pin_hash_v2"
private const val PIN_FAILED_ATTEMPTS_KEY = "pin_failed_attempts_v2"
private const val PIN_LOCKOUT_END_KEY = "pin_lockout_end_v2"

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
