package com.example.kidsguard.managers

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.LockReason
import com.example.kidsguard.models.LockSchedule
import com.example.kidsguard.models.LockScheduleWindow
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

class LockScheduleManager(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val onLockRequested: (() -> Unit)? = null,
    private val onUnlockRequested: (() -> Unit)? = null
) {

    fun updateSchedule(schedule: LockSchedule?) {
        Log.d(TAG, "Snapshot received: $schedule")

        // Keep the previous state so an old schedule lock can be cleared when
        // the parent disables/deletes the schedule. Builds released before
        // lockReason was persisted can have isLocked=true with reason=NONE.
        val wasScheduleEnabled =
            getSavedSchedule()?.enabled == true || prefHelper.isScheduleEnabled

        if (schedule == null) {
            prefHelper.lockScheduleJson = null
            prefHelper.isScheduleEnabled = false
            clearDisabledScheduleLock(wasScheduleEnabled)
            return
        }

        val windows = normalizedWindows(schedule)
        val windowsJson = JSONArray().apply {
            windows.forEach { window ->
                put(JSONObject().apply {
                    put("id", window.id)
                    put("name", window.name)
                    put("enabled", window.enabled)
                    put("startMinutes", window.startMinutes)
                    put("endMinutes", window.endMinutes)
                    put("days", JSONArray(window.days))
                })
            }
        }

        val obj = JSONObject().apply {
            put("enabled", schedule.enabled)
            put("startMinutes", schedule.startMinutes)
            put("endMinutes", schedule.endMinutes)
            put("days", JSONArray(schedule.days))
            put("timezone", schedule.timezone)
            put("updatedAt", schedule.updatedAt)
            put("windows", windowsJson)
        }

        val primaryWindow = windows.firstOrNull()
        prefHelper.isScheduleEnabled = schedule.enabled
        prefHelper.scheduleStartTime = minutesToTime(
            primaryWindow?.startMinutes ?: schedule.startMinutes
        )
        prefHelper.scheduleEndTime = minutesToTime(
            primaryWindow?.endMinutes ?: schedule.endMinutes
        )
        prefHelper.lockScheduleJson = obj.toString()

        Log.d(
            TAG,
            "Schedule applied: enabled=${schedule.enabled}, " +
                "windows=${windows.size}, timezone=${schedule.timezone}"
        )

        if (!schedule.enabled) {
            clearDisabledScheduleLock(wasScheduleEnabled)
        } else {
            evaluateNow()
        }
    }

    private fun clearDisabledScheduleLock(wasScheduleEnabled: Boolean) {
        prefHelper.scheduleUnlockOverrideUntil = 0L

        val isKnownScheduleLock =
            prefHelper.lockReason == LockReason.SCHEDULE
        val isLegacyScheduleLock =
            prefHelper.isLocked &&
                prefHelper.lockReason == LockReason.NONE

        if (isKnownScheduleLock || isLegacyScheduleLock) {
            Log.i(
                TAG,
                "Clearing disabled schedule lock " +
                    "(reason=${prefHelper.lockReason}, legacy=$isLegacyScheduleLock, " +
                    "wasEnabled=$wasScheduleEnabled)"
            )
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
            onUnlockRequested?.invoke()
        }
    }

    fun evaluateNow() {
        checkAndApply(getSavedSchedule())
    }

    fun checkAndApply(schedule: LockSchedule?) {
        val currentSchedule = schedule ?: getSavedSchedule()

        if (currentSchedule == null || !currentSchedule.enabled) {
            Log.d(TAG, "Schedule disabled or null")
            prefHelper.scheduleUnlockOverrideUntil = 0L
            if (prefHelper.lockReason == LockReason.SCHEDULE) {
                unlockDevice()
            }
            return
        }

        val activeWindow = findActiveWindow(currentSchedule)
        val now = System.currentTimeMillis()

        Log.d(
            TAG,
            "Re-evaluating schedule: activeWindow=${activeWindow?.id ?: "none"}"
        )

        if (activeWindow != null) {
            prefHelper.scheduleEndTime =
                minutesToTime(activeWindow.endMinutes)

            if (now < prefHelper.scheduleUnlockOverrideUntil) {
                Log.d(
                    TAG,
                    "Schedule active but parent unlock override remains until " +
                        prefHelper.scheduleUnlockOverrideUntil
                )
                if (prefHelper.lockReason == LockReason.SCHEDULE) {
                    unlockDevice()
                }
                return
            }
            lockDevice()
        } else {
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
            val windows = mutableListOf<LockScheduleWindow>()
            val windowsArray = obj.optJSONArray("windows")
            if (windowsArray != null) {
                for (index in 0 until windowsArray.length()) {
                    val item = windowsArray.getJSONObject(index)
                    windows.add(
                        LockScheduleWindow(
                            id = item.optString("id", "window_$index"),
                            name = item.optString("name", "Schedule"),
                            enabled = item.optBoolean("enabled", true),
                            startMinutes = item.optInt("startMinutes", 0),
                            endMinutes = item.optInt("endMinutes", 0),
                            days = jsonDays(item.optJSONArray("days"))
                        )
                    )
                }
            }

            LockSchedule(
                enabled = obj.optBoolean("enabled", false),
                startMinutes = obj.optInt("startMinutes", 0),
                endMinutes = obj.optInt("endMinutes", 0),
                days = jsonDays(obj.optJSONArray("days")),
                timezone = obj.optString("timezone", ""),
                updatedAt = obj.optLong("updatedAt", 0L),
                windows = windows
            )
        } catch (error: Exception) {
            Log.e(TAG, "Failed to read saved schedule", error)
            null
        }
    }

    private fun jsonDays(array: JSONArray?): List<Int> {
        if (array == null) return emptyList()
        return buildList {
            for (index in 0 until array.length()) {
                add(array.optInt(index))
            }
        }.filter { it in 1..7 }
    }

    private fun normalizedWindows(
        schedule: LockSchedule
    ): List<LockScheduleWindow> {
        if (schedule.windows.isNotEmpty()) {
            return schedule.windows.filter { it.enabled && it.days.isNotEmpty() }
        }

        if (schedule.days.isEmpty()) return emptyList()
        return listOf(
            LockScheduleWindow(
                id = "legacy",
                name = "Lock Schedule",
                enabled = true,
                startMinutes = schedule.startMinutes,
                endMinutes = schedule.endMinutes,
                days = schedule.days
            )
        )
    }

    private fun findActiveWindow(
        schedule: LockSchedule
    ): LockScheduleWindow? {
        val calendar = scheduleCalendar(schedule)
        return normalizedWindows(schedule).firstOrNull { window ->
            isWindowActive(window, calendar)
        }
    }

    private fun isWindowActive(
        window: LockScheduleWindow,
        now: Calendar
    ): Boolean {
        val currentDay = calendarDayToMondayFirst(
            now.get(Calendar.DAY_OF_WEEK)
        )
        val yesterday = if (currentDay == 1) 7 else currentDay - 1
        val currentMinutes =
            now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val start = window.startMinutes.coerceIn(0, 1439)
        val end = window.endMinutes.coerceIn(0, 1439)

        if (start == end) return false

        if (start < end) {
            return currentDay in window.days &&
                currentMinutes in start until end
        }

        val startedToday =
            currentDay in window.days && currentMinutes >= start
        val continuedFromYesterday =
            yesterday in window.days && currentMinutes < end
        return startedToday || continuedFromYesterday
    }

    private fun scheduleCalendar(schedule: LockSchedule): Calendar {
        val timezone = schedule.timezone
            .takeIf { it.isNotBlank() }
            ?.let(TimeZone::getTimeZone)
            ?: TimeZone.getDefault()
        return Calendar.getInstance(timezone)
    }

    private fun calendarDayToMondayFirst(day: Int): Int {
        return when (day) {
            Calendar.MONDAY -> 1
            Calendar.TUESDAY -> 2
            Calendar.WEDNESDAY -> 3
            Calendar.THURSDAY -> 4
            Calendar.FRIDAY -> 5
            Calendar.SATURDAY -> 6
            Calendar.SUNDAY -> 7
            else -> 1
        }
    }

    private fun lockDevice() {
        if (!prefHelper.isLocked) {
            Log.i(TAG, "Applying SCHEDULE lock")
            prefHelper.isLocked = true
            prefHelper.lockReason = LockReason.SCHEDULE
            onLockRequested?.invoke()
        }
    }

    private fun unlockDevice() {
        if (
            prefHelper.isLocked &&
            prefHelper.lockReason == LockReason.SCHEDULE
        ) {
            Log.i(TAG, "Clearing SCHEDULE lock")
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
            onUnlockRequested?.invoke()
        }
    }

    fun handleManualUnlock() {
        val schedule = getSavedSchedule()
        val activeWindow = schedule?.let(::findActiveWindow)

        if (schedule != null && activeWindow != null) {
            val now = scheduleCalendar(schedule)
            val endCalendar = scheduleCalendar(schedule).apply {
                set(
                    Calendar.HOUR_OF_DAY,
                    activeWindow.endMinutes.coerceIn(0, 1439) / 60
                )
                set(
                    Calendar.MINUTE,
                    activeWindow.endMinutes.coerceIn(0, 1439) % 60
                )
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val currentMinutes =
                now.get(Calendar.HOUR_OF_DAY) * 60 +
                    now.get(Calendar.MINUTE)
            val isOvernight =
                activeWindow.startMinutes > activeWindow.endMinutes

            if (isOvernight && currentMinutes >= activeWindow.startMinutes) {
                endCalendar.add(Calendar.DAY_OF_MONTH, 1)
            }

            prefHelper.scheduleUnlockOverrideUntil =
                endCalendar.timeInMillis
            Log.i(
                TAG,
                "Parent unlock override until=${endCalendar.timeInMillis}"
            )
        }

        if (
            prefHelper.lockReason == LockReason.SCHEDULE ||
            prefHelper.lockReason == LockReason.REMOTE
        ) {
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
            onUnlockRequested?.invoke()
        }
    }

    fun handleManualLock() {
        prefHelper.isLocked = true
        prefHelper.lockReason = LockReason.REMOTE
        prefHelper.scheduleUnlockOverrideUntil = 0L
        onLockRequested?.invoke()
    }

    private fun minutesToTime(totalMinutes: Int): String {
        val safeMinutes = totalMinutes.coerceIn(0, 1439)
        return String.format(
            java.util.Locale.getDefault(),
            "%02d:%02d",
            safeMinutes / 60,
            safeMinutes % 60
        )
    }

    companion object {
        private const val TAG = "LockScheduleSync"
    }
}
