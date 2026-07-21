package com.example.kidsguard.repository

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.InstalledApp
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore

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

    fun handlePackageRemoved(packageName: String) {
        prefs.edit()
            .remove(packageName)
            .apply()

        Log.i(
            TAG,
            "Removed package from install cache: $packageName"
        )
    }

    private fun syncAppInstall(app: InstalledApp) {

        val childId: String? =
            prefHelper.childId
                .takeIf { it.isNotBlank() }
                ?: prefHelper.pairedChildId
                    ?.takeIf { it.isNotBlank() }

        if (childId == null) {
            Log.e(
                TAG,
                "App install sync aborted: childId is missing"
            )
            return
        }

        Log.d(
            TAG,
            "Syncing installed app: childId=$childId, package=${app.packageName}"
        )

        Log.i(
            TAG,
            "New app detected: ${app.appName} (${app.packageName})"
        )

// Firestore path:
// children/{childId}/installedApps/{packageName}
        val appRef = db
            .collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("installedApps")
            .document(app.packageName)

        Log.d(
            TAG,
            "Writing installed app to: ${appRef.path}"
        )

        appRef
            .set(app)
            .addOnSuccessListener {

                Log.i(
                    TAG,
                    "App record synced successfully: " +
                            "${app.appName} (${app.packageName})"
                )

                createInstallNotification(
                    childId = childId,
                    app = app
                )
            }
            .addOnFailureListener { error ->

                Log.e(
                    TAG,
                    "Failed to sync installed app: path=${appRef.path}",
                    error
                )
            }
    }


    private fun createInstallNotification(
        childId: String,
        app: InstalledApp
    ) {

        val familyId = prefHelper.familyId
            ?.takeIf { it.isNotBlank() }
            ?: ""

        val childName = prefHelper.childName
            .takeIf { it.isNotBlank() }
            ?: "Child"

        val notification = hashMapOf<String, Any>(
            "type" to "APP_INSTALLED",
            "childId" to childId,
            "childName" to childName,
            "appName" to app.appName,
            "packageName" to app.packageName,
            "createdAt" to FieldValue.serverTimestamp(),
            "read" to false,
            "familyId" to familyId,
            "clickAction" to
                    "/children/$childId/installed-apps?pkg=${app.packageName}"
        )

        val firebaseUid = prefHelper.firebaseUid

        if (!firebaseUid.isNullOrBlank()) {
            notification["userId"] = firebaseUid
        }

        db
            .collection(FirebaseConfig.COL_NOTIFICATIONS)
            .add(notification)
            .addOnSuccessListener { documentReference ->

                Log.i(
                    TAG,
                    "Install notification created: " +
                            "id=${documentReference.id}, " +
                            "package=${app.packageName}"
                )
            }
            .addOnFailureListener { error ->

                Log.e(
                    TAG,
                    "Install notification creation failed: " +
                            app.packageName,
                    error
                )
            }
    }

    // 2. Create notification record


}
