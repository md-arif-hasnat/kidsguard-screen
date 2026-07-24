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
        performScan(isFullRescan = false)
    }

    /**
     * Complete rescan that synchronizes local state and Firestore with current device reality.
     */
    fun fullRescan() {
        performScan(isFullRescan = true)
    }

    private fun performScan(isFullRescan: Boolean) {
        val childId = getChildId() ?: run {
            Log.e(TAG, "Scan aborted: childId is missing")
            return
        }

        val allPackages = try {
            pm.getInstalledPackages(0)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get installed packages", e)
            return
        }

        var launchableCount = 0
        var internalExcludedCount = 0
        var uploaded = 0
        var failed = 0

        Log.i(TAG, "InstalledAppsScan: Starting scan. total packages returned=${allPackages.size}")

        val currentLaunchablePackages = mutableSetOf<String>()

        allPackages.forEach { pkg ->
            val packageName = pkg.packageName
            
            // Ignore KidsGuard itself
            if (packageName == context.packageName) {
                internalExcludedCount++
                return@forEach
            }
            
            val launchIntent = pm.getLaunchIntentForPackage(packageName)
            if (launchIntent == null) {
                internalExcludedCount++
                return@forEach
            }

            launchableCount++
            currentLaunchablePackages.add(packageName)

            try {
                val appInfo = pkg.applicationInfo ?: return@forEach
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

                // Only sync if not in cache or if it's a full rescan
                if (isFullRescan || !prefs.contains(packageName)) {
                    syncAppInstall(installedApp, createNotification = false)
                    uploaded++
                    prefs.edit().putBoolean(packageName, true).apply()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to process $packageName during scan", e)
                failed++
            }
        }

        Log.i(TAG, "InstalledAppsScan: total packages returned=${allPackages.size}")
        Log.i(TAG, "InstalledAppsScan: launchable packages=$launchableCount")
        Log.i(TAG, "InstalledAppsScan: excluded internal packages=$internalExcludedCount")
        Log.i(TAG, "InstalledAppsScan: synced packages=$uploaded")
        Log.i(TAG, "InstalledAppsScan: failed packages=$failed")

        if (isFullRescan) {
            cleanUpUninstalledApps(childId, currentLaunchablePackages)
        }
    }

    private fun cleanUpUninstalledApps(childId: String, currentPackages: Set<String>) {
        // 1. Clean up SharedPreferences cache
        val cachedPackages = prefs.all.keys.toSet()
        val toRemoveFromCache = cachedPackages.filter { !currentPackages.contains(it) }
        toRemoveFromCache.forEach {
            prefs.edit().remove(it).apply()
            Log.d(TAG, "Cleaning up uninstalled app from cache: $it")
        }

        // 2. We could also query Firestore to remove apps that are no longer present.
        // For now, we'll mark them as uninstalled if we had a list, 
        // but typically the Dashboard only shows what's in 'installedApps' collection.
        // We'll leave them in Firestore but removed from local 'new app' detection.
    }

    /**
     * Checks if a package is new and handles syncing/notification.
     */
    fun handlePackageAdded(packageName: String) {
        if (packageName == context.packageName) return

        val launchIntent = pm.getLaunchIntentForPackage(packageName)
        if (launchIntent == null) {
            Log.d(TAG, "Ignoring non-launchable added package: $packageName")
            return
        }

        val isNewInstall = !prefs.contains(packageName)

        try {
            val info = pm.getPackageInfo(packageName, 0)
            val appInfo = info.applicationInfo ?: return

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
