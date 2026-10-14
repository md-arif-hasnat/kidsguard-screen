package com.example.kidsguard.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.managers.LockScheduleManager

/** Re-evaluates the parent-managed schedule after restart or clock changes. */
class LockScheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = PreferenceHelper(context.applicationContext)
        if (prefs.userRole != "CHILD") return

        Log.i(TAG, "Re-evaluating schedule after ${intent?.action}")
        LockScheduleManager(context.applicationContext, prefs).evaluateNow()
    }

    companion object {
        private const val TAG = "LockScheduleReceiver"
    }
}
