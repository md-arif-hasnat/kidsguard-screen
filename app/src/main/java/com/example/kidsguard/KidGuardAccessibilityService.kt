package com.example.kidsguard

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class KidGuardAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val prefHelper = PreferenceHelper(applicationContext)
        if (prefHelper.isLocked) {
            // If the user tries to leave the app (recent apps, home, etc.)
            // We can detect window state changes
            if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                val packageName = event.packageName?.toString()
                if (packageName != null && packageName != applicationContext.packageName) {
                    try {
                        val intent = Intent(this, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                        }
                        startActivity(intent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to bring KidsGuard back to foreground", e)
                    }
                }
            }
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    companion object {
        private const val TAG = "KidGuardAccessibility"
    }
}
