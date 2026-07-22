package com.example.kidsguard.managers

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.LockReason
import com.example.kidsguard.models.LockSchedule
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class LockScheduleManager(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val onLockRequested: (() -> Unit)? = null,
    private val onUnlockRequested: (() -> Unit)? = null
) {

    fun updateSchedule(schedule: LockSchedule?) {
        Log.d("LockScheduleSync", "Snapshot received: $schedule")

        if (schedule == null) {
            Log.d(
                "LockScheduleSync",
                "Schedule doc missing, using defaults (disabled)"
            )

            prefHelper.lockScheduleJson = null
            prefHelper.isScheduleEnabled = false
            evaluateNow()
            return
        }

        val obj = JSONObject().apply {
            put("enabled", schedule.enabled)
            put("startMinutes", schedule.startMinutes)
            put("endMinutes", schedule.endMinutes)
            put("days", JSONArray(schedule.days))
            put("timezone", schedule.timezone)
            put("updatedAt", schedule.updatedAt)
        }

        val startTime = minutesToTime(schedule.startMinutes)
        val endTime = minutesToTime(schedule.endMinutes)

// একই values manual App Settings-এও save হবে
        prefHelper.isScheduleEnabled = schedule.enabled
        prefHelper.scheduleStartTime = startTime
        prefHelper.scheduleEndTime = endTime

// Existing cloud schedule JSON
        prefHelper.lockScheduleJson = obj.toString()

        Log.d(
            "LockScheduleSync",
            "Schedule applied: enabled=${schedule.enabled}, " +
                    "start=$startTime, end=$endTime, days=${schedule.days}"
        )

        evaluateNow()
    }


    fun evaluateNow() {
        val currentSchedule = getSavedSchedule()
        checkAndApply(currentSchedule)
    }

    fun checkAndApply(schedule: LockSchedule?) {
        val currentSchedule = schedule ?: getSavedSchedule()

        if (currentSchedule == null || !currentSchedule.enabled) {
            Log.d("LockScheduleSync", "Schedule disabled or null")
            prefHelper.scheduleUnlockOverrideUntil = 0L
            if (prefHelper.lockReason == LockReason.SCHEDULE) {
                unlockDevice()
            }
            return
        }

        val isActive = isInsideSchedule(currentSchedule)
        val now = System.currentTimeMillis()

        Log.d(
            "LockScheduleSync",
            "Re-evaluating: enabled=true start=${currentSchedule.startMinutes} end=${currentSchedule.endMinutes} current window active=$isActive"
        )

        if (isActive) {
            if (now < prefHelper.scheduleUnlockOverrideUntil) {
                Log.d(
                    "LockScheduleSync",
                    "Active window but UNLOCK OVERRIDE is active until ${prefHelper.scheduleUnlockOverrideUntil}"
                )
                if (prefHelper.lockReason == LockReason.SCHEDULE) {
                    unlockDevice()
                }
                return
            }
            lockDevice()
        } else {
            // Outside schedule window
            Log.d("LockScheduleSync", "Outside schedule window, clearing override if any")
            prefHelper.scheduleUnlockOverrideUntil = 0L
            if (prefHelper.lockReason == LockReason.SCHEDULE) {
                unlockDevice()
            }
        }
    }

    private fun getSavedSchedule(): LockSchedule? {
        val json = prefHelper.lockScheduleJson ?: return null
        return try {
            val obj = JSONObject(json)
            val daysArray = obj.getJSONArray("days")
            val daysList = mutableListOf<Int>()
            for (i in 0 until daysArray.length()) {
                daysList.add(daysArray.getInt(i))
            }
            LockSchedule(
                enabled = obj.getBoolean("enabled"),
                startMinutes = obj.getInt("startMinutes"),
                endMinutes = obj.getInt("endMinutes"),
                days = daysList,
                timezone = obj.optString("timezone", ""),
                updatedAt = obj.optLong("updatedAt", 0L)
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun isInsideSchedule(schedule: LockSchedule): Boolean {
        val now = Calendar.getInstance()

        // Mapping: 1 = Monday ... 7 = Sunday
        val currentDay = when (now.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> 1
            Calendar.TUESDAY -> 2
            Calendar.WEDNESDAY -> 3
            Calendar.THURSDAY -> 4
            Calendar.FRIDAY -> 5
            Calendar.SATURDAY -> 6
            Calendar.SUNDAY -> 7
            else -> 1
        }

        val yesterdayDay = if (currentDay == 1) 7 else currentDay - 1
        val currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

        val start = schedule.startMinutes
        val end = schedule.endMinutes

        // 1. Check if we are in today's scheduled window (starting today)
        if (schedule.days.contains(currentDay)) {
            if (start <= end) {
                // Same-day window
                if (currentMinutes in start until end) return true
            } else {
                // Overnight window starting today
                if (currentMinutes >= start) return true
            }
        }

        // 2. Check if we are in yesterday's scheduled window (tail end of overnight)
        if (schedule.days.contains(yesterdayDay)) {
            if (start > end) {
                // It was an overnight window
                if (currentMinutes < end) return true
            }
        }

        return false
    }

    private fun lockDevice() {
        if (!prefHelper.isLocked) {
            Log.i("LockScheduleSync", "Applying SCHEDULE lock")
            prefHelper.isLocked = true
            prefHelper.lockReason = LockReason.SCHEDULE
            onLockRequested?.invoke()
        }
    }

    private fun minutesToTime(totalMinutes: Int): String {
        val safeMinutes = totalMinutes.coerceIn(0, 1439)
        val hours = safeMinutes / 60
        val minutes = safeMinutes % 60

        return String.format(
            java.util.Locale.getDefault(),
            "%02d:%02d",
            hours,
            minutes
        )
    }

    private fun unlockDevice() {
        if (prefHelper.isLocked && prefHelper.lockReason == LockReason.SCHEDULE) {
            Log.i("LockScheduleSync", "Clearing SCHEDULE lock")
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
            onUnlockRequested?.invoke()
        }
    }

    fun handleManualUnlock() {
        val currentSchedule = getSavedSchedule()

        if (currentSchedule != null && currentSchedule.enabled && isInsideSchedule(currentSchedule)) {
            val now = Calendar.getInstance()
            val endCalendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, currentSchedule.endMinutes / 60)
                set(Calendar.MINUTE, currentSchedule.endMinutes % 60)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

            if (currentSchedule.startMinutes > currentSchedule.endMinutes && currentMinutes >= currentSchedule.startMinutes) {
                // If it's overnight and we are currently before midnight
                endCalendar.add(Calendar.DAY_OF_MONTH, 1)
            }

            prefHelper.scheduleUnlockOverrideUntil = endCalendar.timeInMillis
            Log.i(
                "LockScheduleSync",
                "Parent manual UNLOCK during active schedule. Override until=${endCalendar.timeInMillis}"
            )
        }

        if (prefHelper.lockReason == LockReason.SCHEDULE || prefHelper.lockReason == LockReason.REMOTE) {
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
            onUnlockRequested?.invoke()
        }
    }

    fun handleManualLock() {
        prefHelper.isLocked = true
        prefHelper.lockReason = LockReason.REMOTE
        prefHelper.scheduleUnlockOverrideUntil = 0L // Clear override if manually locked
        onLockRequested?.invoke()
    }
}
