package com.example.kidsguard.repository

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.InstalledApp
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions

class InstalledAppsRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences("installed_apps_cache", Context.MODE_PRIVATE)
    private val prefHelper = PreferenceHelper(context)
    private val db = FirebaseFirestore.getInstance()
    private val pm = context.packageManager

    companion object {
        private const val TAG = "AppInstallMonitor"
    }

    private fun getChildId(): String? {
        val cid = prefHelper.childId
        if (cid.isNotBlank()) return cid

        val pcid = prefHelper.pairedChildId
        if (pcid != null && pcid.isNotBlank()) return pcid

        return null
    }

    /**
     * Scans all installed apps and updates Firestore.
     * Use this during initialization to populate the installedApps collection.
     */
    fun initialScan() {
        val childId = getChildId() ?: run {
            Log.e(TAG, "Initial scan aborted: childId is missing")
            return
        }

        val installedPackages = try {
            pm.getInstalledPackages(0)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get installed packages", e)
            return
        }

        var uploaded = 0
        var skipped = 0
        var failed = 0

        Log.i(TAG, "Starting initial scan for child: $childId. Found ${installedPackages.size} total packages.")

        installedPackages.forEach { pkg ->
            val packageName = pkg.packageName
            
            // Ignore KidsGuard itself
            if (packageName == context.packageName) {
                skipped++
                return@forEach
            }
            
            try {
                val appInfo = pkg.applicationInfo ?: return@forEach

                // Ignore system apps
                if ((appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0) {
                    skipped++
                    return@forEach
                }

                val appName = pm.getApplicationLabel(appInfo).toString()
                val installedApp = InstalledApp(
                    packageName = packageName,
                    appName = appName,
                    installedAt = System.currentTimeMillis(),
                    firstInstallTime = pkg.firstInstallTime,
                    versionName = pkg.versionName ?: "1.0",
                    versionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                        pkg.longVersionCode
                    } else {
                        @Suppress("DEPRECATION")
                        pkg.versionCode.toLong()
                    }
                )

                syncAppInstall(installedApp, createNotification = false)
                uploaded++
                
                // Add to local cache to prevent future new-install notifications for these old apps
                prefs.edit().putBoolean(packageName, true).apply()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to process $packageName during initial scan", e)
                failed++
            }
        }
        Log.i(TAG, "Initial scan completed. Uploaded: $uploaded, Skipped: $skipped, Failed: $failed")
    }

    /**
     * Checks if a package is new and handles syncing/notification.
     */
    fun handlePackageAdded(packageName: String) {
        if (packageName == context.packageName) return

        val isNewInstall = !prefs.contains(packageName)

        try {
            val info = pm.getPackageInfo(packageName, 0)
            val appInfo = info.applicationInfo ?: return

            // Ignore system apps
            if ((appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0) {
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

            syncAppInstall(installedApp, createNotification = isNewInstall)
            
            // Mark as known in cache
            prefs.edit().putBoolean(packageName, true).apply()

        } catch (e: Exception) {
            Log.e(TAG, "Error handling package added: $packageName", e)
        }
    }

    fun handlePackageRemoved(packageName: String) {
        prefs.edit().remove(packageName).apply()
        Log.i(TAG, "Removed package from install cache: $packageName")
        
        // Optional: Mark as uninstalled in Firestore if needed in future
    }

    private fun syncAppInstall(app: InstalledApp, createNotification: Boolean) {
        val childId = getChildId() ?: return

        val appRef = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("installedApps")
            .document(app.packageName)

        appRef.set(app, SetOptions.merge())
            .addOnSuccessListener {
                Log.i(TAG, "App metadata synced: ${app.packageName} (notify=$createNotification)")
                if (createNotification) {
                    createInstallNotification(childId, app)
                }
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "Failed to sync app record: ${app.packageName}", error)
            }
    }

    private fun createInstallNotification(childId: String, app: InstalledApp) {
        val familyId = prefHelper.familyId ?: ""
        val childName = prefHelper.childName.ifBlank { "Your child" }

        val notification = hashMapOf<String, Any>(
            "type" to "APP_INSTALLED",
            "childId" to childId,
            "childName" to childName,
            "appName" to app.appName,
            "packageName" to app.packageName,
            "createdAt" to FieldValue.serverTimestamp(),
            "read" to false,
            "familyId" to familyId,
            "clickAction" to "/children/$childId/installed-apps?pkg=${app.packageName}"
        )

        prefHelper.firebaseUid?.let { uid ->
            if (uid.isNotBlank()) notification["userId"] = uid
        }

        db.collection(FirebaseConfig.COL_NOTIFICATIONS)
            .add(notification)
            .addOnSuccessListener { doc ->
                Log.i(TAG, "Install notification created: ${doc.id}")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to create install notification", e)
            }
    }
}
