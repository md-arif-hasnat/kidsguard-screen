package com.example.kidsguard

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.app.ActivityOptions
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.wellbeing.WellbeingManager
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider

class KidGuardAccessibilityService : AccessibilityService() {

    private var wellbeingManager: WellbeingManager? = null

    override fun onCreate() {
        super.onCreate()
        val prefHelper = PreferenceHelper(applicationContext)
        wellbeingManager = WellbeingManager(
            applicationContext,
            prefHelper,
            FirebaseRemoteSyncProvider(applicationContext)
        )
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val prefHelper = PreferenceHelper(applicationContext)
        
        // 1. Global Lock Mode (Legacy)
        if (prefHelper.isLocked) {
            handleGlobalLock(event)
            return
        }

        // 2. Individual App Blocking / Limits
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            if (packageName != applicationContext.packageName && wellbeingManager?.isAppBlocked(packageName) == true) {
                // Block this app!
                blockApp(packageName)
            }
        }
    }

    private fun handleGlobalLock(event: AccessibilityEvent) {
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString()
            if (packageName != null && packageName != applicationContext.packageName) {
                bringOurAppToFront()
            }
        }
    }

    private fun blockApp(packageName: String) {
        // Redirect to our "Blocked" screen in MainActivity
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("action", "BLOCK_SCREEN")
            putExtra("blocked_package", packageName)
        }
        
        if (Build.VERSION.SDK_INT >= 34) { // Android 14+ (and 15)
            try {
                val options = ActivityOptions.makeBasic()
                if (Build.VERSION.SDK_INT >= 35) {
                    options.setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                }
                startActivity(intent, options.toBundle())
            } catch (e: Exception) {
                startActivity(intent)
            }
        } else {
            startActivity(intent)
        }
    }

    private fun bringOurAppToFront() {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        
        if (Build.VERSION.SDK_INT >= 35) {
            val options = ActivityOptions.makeBasic()
            options.setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
            startActivity(intent, options.toBundle())
        } else {
            startActivity(intent)
        }
    }

    override fun onInterrupt() {}
}
