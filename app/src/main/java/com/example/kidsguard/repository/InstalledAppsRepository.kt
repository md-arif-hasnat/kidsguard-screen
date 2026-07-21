package com.example.kidsguard.repository

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.InstalledApp
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue

class InstalledAppsRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("installed_apps_cache", Context.MODE_PRIVATE)
    private val prefHelper = PreferenceHelper(context)
    private val db = FirebaseFirestore.getInstance()
    private val pm = context.packageManager

    companion object {
        private const val TAG = "AppInstallMonitor"
    }

    /**
     * Scans all installed apps and updates the local cache without notifying.
     * Use this during initialization to avoid notifying for existing apps.
     */
    fun initialScan() {
        val installedPackages = pm.getInstalledPackages(0)
        val editor = prefs.edit()
        installedPackages.forEach { pkg ->
            editor.putBoolean(pkg.packageName, true)
        }
        editor.apply()
        Log.i(TAG, "Initial scan completed. Cached ${installedPackages.size} packages.")
    }

    /**
     * Checks if a package is new and handles syncing/notification if it is.
     */
    fun handlePackageAdded(packageName: String) {
        if (packageName == context.packageName) return
        if (prefs.contains(packageName)) return

        try {
            val info = pm.getPackageInfo(packageName, 0)
            val appInfo = info.applicationInfo ?: return

            // Ignore system apps
            if ((appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0) {
                return
            }

            // Ignore common manufacturer/system prefixes
            val ignorePrefixes = listOf(
                "com.android.", "com.google.android.", "com.huawei.", 
                "com.samsung.", "com.sec.android.", "com.oppo.", "com.vivo.", "com.xiaomi."
            )
            if (ignorePrefixes.any { packageName.startsWith(it) }) {
                return
            }

            val appName = pm.getApplicationLabel(appInfo).toString()
            val installedApp = InstalledApp(
                packageName = packageName,
                appName = appName,
                installedAt = System.currentTimeMillis(),
                firstInstallTime = info.firstInstallTime,
                versionName = info.versionName ?: "1.0",
                versionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    info.longVersionCode
                } else {
                    @Suppress("DEPRECATION")
                    info.versionCode.toLong()
                }
            )

            syncAppInstall(installedApp)
            
            // Add to cache
            prefs.edit().putBoolean(packageName, true).apply()
            
        } catch (e: Exception) {
            Log.e(TAG, "Error handling package added: $packageName", e)
        }
    }

    private fun syncAppInstall(app: InstalledApp) {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        Log.i(TAG, "New app detected: ${app.appName} (${app.packageName})")

        // 1. Save to children/{childId}/installedApps/{packageName}
        db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("installedApps")
            .document(app.packageName)
            .set(app)
            .addOnSuccessListener {
                Log.d(TAG, "App record synced: ${app.packageName}")
            }

        // 2. Create notification record
        val notification = mapOf(
            "type" to "APP_INSTALLED",
            "childId" to childId,
            "childName" to prefHelper.childName,
            "appName" to app.appName,
            "packageName" to app.packageName,
            "createdAt" to FieldValue.serverTimestamp(),
            "read" to false,
            "userId" to (prefHelper.firebaseUid ?: ""), // Assuming parent UID is stored or resolved via familyId
            "familyId" to (prefHelper.familyId ?: ""),
            "clickAction" to "/children/$childId/installed-apps?pkg=${app.packageName}"
        )

        db.collection(FirebaseConfig.COL_NOTIFICATIONS)
            .add(notification)
            .addOnSuccessListener {
                Log.d(TAG, "Install notification created")
            }
    }
}
