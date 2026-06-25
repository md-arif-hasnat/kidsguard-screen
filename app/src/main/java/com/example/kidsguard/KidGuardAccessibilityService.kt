package com.example.kidsguard

import android.accessibilityservice.AccessibilityService
import android.app.ActivityOptions
import android.content.Intent
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.wellbeing.WellbeingManager
import com.example.kidsguard.web.WebProtectionManager
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider

class KidGuardAccessibilityService : AccessibilityService() {

    private var wellbeingManager: WellbeingManager? = null
    private var webManager: WebProtectionManager? = null

    override fun onCreate() {
        super.onCreate()
        val prefHelper = PreferenceHelper(applicationContext)
        val sync = FirebaseRemoteSyncProvider(applicationContext)
        wellbeingManager = WellbeingManager(applicationContext, prefHelper, sync)
        webManager = WebProtectionManager(applicationContext, prefHelper, sync)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val prefHelper = PreferenceHelper(applicationContext)
        
        // 1. Global Lock Mode
        if (prefHelper.isLocked) {
            handleGlobalLock(event)
            return
        }

        // 2. Browser Content Filtering
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED || 
            event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            
            val packageName = event.packageName?.toString() ?: return
            if (isBrowser(packageName)) {
                checkBrowserUrl(event, packageName)
            }
        }

        // 3. Individual App Blocking
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return
            if (packageName != applicationContext.packageName && wellbeingManager?.isAppBlocked(packageName) == true) {
                blockApp(packageName)
            }
        }
    }

    private fun isBrowser(packageName: String): Boolean {
        val browsers = listOf(
            "com.android.chrome",
            "com.sec.android.app.sbrowser",
            "org.mozilla.firefox",
            "com.microsoft.emmx",
            "com.brave.browser"
        )
        return browsers.contains(packageName)
    }

    private fun checkBrowserUrl(event: AccessibilityEvent, packageName: String) {
        val source = event.source ?: return
        
        // Find the URL bar
        val url = findUrlInNodes(source, packageName)
        if (url != null && url.isNotEmpty()) {
            if (webManager?.checkUrl(url, packageName) == false) {
                blockWeb(url, packageName)
            }
        }
    }

    private fun findUrlInNodes(node: android.view.accessibility.AccessibilityNodeInfo, packageName: String): String? {
        val nodes = when (packageName) {
            "com.android.chrome" -> node.findAccessibilityNodeInfosByViewId("com.android.chrome:id/url_bar")
            "com.sec.android.app.sbrowser" -> node.findAccessibilityNodeInfosByViewId("com.sec.android.app.sbrowser:id/location_bar_edit_text")
            else -> node.findAccessibilityNodeInfosByText("http")
        }

        if (nodes != null && nodes.isNotEmpty()) {
            val url = nodes[0].text?.toString()
            return url
        }
        
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val res = findUrlInNodes(child, packageName)
            if (res != null) return res
        }
        
        return null
    }

    private fun blockWeb(url: String, packageName: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("action", "WEB_BLOCKED")
            putExtra("blocked_url", url)
            putExtra("browser_package", packageName)
        }
        
        if (Build.VERSION.SDK_INT >= 35) {
            val options = ActivityOptions.makeBasic()
            options.setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
            startActivity(intent, options.toBundle())
        } else {
            startActivity(intent)
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
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("action", "BLOCK_SCREEN")
            putExtra("blocked_package", packageName)
        }
        
        if (Build.VERSION.SDK_INT >= 34) {
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
