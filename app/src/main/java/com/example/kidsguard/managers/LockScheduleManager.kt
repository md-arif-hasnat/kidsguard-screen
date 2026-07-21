package com.example.kidsguard.managers

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.LockReason
import com.example.kidsguard.models.LockSchedule
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class LockScheduleManager(private val context: Context, private val prefHelper: PreferenceHelper) {

    fun updateSchedule(schedule: LockSchedule?) {
        Log.d("LockScheduleSync", "schedule received: $schedule")
        if (schedule == null) {
            prefHelper.lockScheduleJson = null
            checkAndApply(null)
            return
        }
        
        // Use JSONObject to avoid Gson dependency issues
        val obj = JSONObject().apply {
            put("enabled", schedule.enabled)
            put("startMinutes", schedule.startMinutes)
            put("endMinutes", schedule.endMinutes)
            put("days", JSONArray(schedule.days))
            put("timezone", schedule.timezone)
            put("updatedAt", schedule.updatedAt)
        }
        
        prefHelper.lockScheduleJson = obj.toString()
        checkAndApply(schedule)
    }

    fun checkAndApply(schedule: LockSchedule?) {
        val currentSchedule = schedule ?: getSavedSchedule()

        if (currentSchedule == null || !currentSchedule.enabled) {
            Log.d("LockScheduleSync", "schedule disabled")
            if (prefHelper.lockReason == LockReason.SCHEDULE) {
                unlockDevice()
            }
            return
        }

        val isActive = isInsideSchedule(currentSchedule)
        Log.d("LockScheduleSync", "enabled=true start=${currentSchedule.startMinutes} end=${currentSchedule.endMinutes} current window active=$isActive")

        if (isActive) {
            if (System.currentTimeMillis() < prefHelper.scheduleUnlockOverrideUntil) {
                Log.d("LockScheduleSync", "schedule relock skipped due to override until ${prefHelper.scheduleUnlockOverrideUntil}")
                return
            }
            lockDevice()
        } else {
            // Outside schedule, clear override and reason if it was schedule
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
        // Calendar.DAY_OF_WEEK: SUNDAY=1, MONDAY=2, ... SATURDAY=7
        // Requirement: 1 = Monday ... 7 = Sunday
        val dayOfWeek = when (now.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> 1
            Calendar.TUESDAY -> 2
            Calendar.WEDNESDAY -> 3
            Calendar.THURSDAY -> 4
            Calendar.FRIDAY -> 5
            Calendar.SATURDAY -> 6
            Calendar.SUNDAY -> 7
            else -> 1
        }

        if (!schedule.days.contains(dayOfWeek)) return false

        val currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        
        return if (schedule.startMinutes <= schedule.endMinutes) {
            currentMinutes >= schedule.startMinutes && currentMinutes < schedule.endMinutes
        } else {
            // Overnight
            currentMinutes >= schedule.startMinutes || currentMinutes < schedule.endMinutes
        }
    }

    private fun lockDevice() {
        if (!prefHelper.isLocked) {
            Log.i("LockScheduleSync", "Applying SCHEDULE lock")
            prefHelper.isLocked = true
            prefHelper.lockReason = LockReason.SCHEDULE
            // In a real app, this would trigger an intent to the LockActivity or update a state that the LockEngine observes.
            // Based on previous contexts, prefHelper.isLocked being true should be enough if the LockActivity/Service is watching it.
        }
    }

    private fun unlockDevice() {
        if (prefHelper.isLocked && prefHelper.lockReason == LockReason.SCHEDULE) {
            Log.i("LockScheduleSync", "Clearing SCHEDULE lock")
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
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
            } else if (currentSchedule.startMinutes > currentSchedule.endMinutes && currentMinutes < currentSchedule.endMinutes) {
                 // If it's overnight and we are currently after midnight, endCalendar is already today morning
            }

            prefHelper.scheduleUnlockOverrideUntil = endCalendar.timeInMillis
            Log.i("LockScheduleSync", "parent unlock override until=${endCalendar.timeInMillis}")
        }
        
        if (prefHelper.lockReason == LockReason.SCHEDULE || prefHelper.lockReason == LockReason.REMOTE) {
            prefHelper.isLocked = false
            prefHelper.lockReason = LockReason.NONE
        }
    }
    
    fun handleManualLock() {
        prefHelper.isLocked = true
        prefHelper.lockReason = LockReason.REMOTE
        prefHelper.scheduleUnlockOverrideUntil = 0L // Clear override if manually locked
    }
}
