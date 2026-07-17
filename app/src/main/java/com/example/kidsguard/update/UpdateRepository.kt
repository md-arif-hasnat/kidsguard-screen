package com.example.kidsguard.update

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await

import com.example.kidsguard.data.PreferenceHelper

class UpdateRepository(private val context: Context) {

    private val db = FirebaseFirestore.getInstance()
    private val prefs = PreferenceHelper(context)
    private val _updateState = MutableStateFlow(
        AppUpdateState(
            currentVersionName = getCurrentVersionName(),
            currentVersionCode = getCurrentVersionCode(),
            updateInfo = null
        )
    )
    val updateState: StateFlow<AppUpdateState> = _updateState

    private val _updateInfo = MutableStateFlow<AppUpdateInfo?>(null)
    val updateInfo: StateFlow<AppUpdateInfo?> = _updateInfo

    private val _showWhatsNew = MutableStateFlow<AppUpdateInfo?>(null)
    val showWhatsNew: StateFlow<AppUpdateInfo?> = _showWhatsNew

    companion object {
        private const val TAG = "UpdateRepository"
        private const val CONFIG_PATH = "appConfig/update"
    }

    fun getCurrentVersionName(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: PackageManager.NameNotFoundException) {
            "1.0.0"
        }
    }

    fun getCurrentVersionCode(): Int {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode
            }
        } catch (e: PackageManager.NameNotFoundException) {
            1
        }
    }

    suspend fun checkForUpdates() {
        if (!isNetworkAvailable()) {
            Log.d(TAG, "Skipping update check: Device is offline")
            return
        }

        Log.d(TAG, "Checking for updates from Firestore...")
        try {
            val doc = db.document(CONFIG_PATH).get().await()
            val info = if (doc.exists()) {
                doc.toObject(AppUpdateInfo::class.java)
            } else {
                Log.w(TAG, "Update config document not found at $CONFIG_PATH, using fallback")
                AppUpdateInfo(
                    latestVersionCode = 1,
                    latestVersionName = "1.0.0",
                    apkDownloadUrl = "https://github.com/md-arif-hasnat/kidsguard-screen/releases/download/v1.0.0/KidsGuard-v1.0.0.apk",
                    mandatoryUpdate = false,
                    updateMessage = "First KidsGuard beta release is available.",
                    releaseNotes = listOf("Initial beta release", "Live tracking", "Safe zones", "Parent dashboard")
                )
            }

            if (info != null) {
                val currentCode = getCurrentVersionCode()
                val currentName = getCurrentVersionName()
                val isAvailable = info.latestVersionCode > currentCode
                
                Log.i(TAG, "Installed Version: $currentName ($currentCode)")
                Log.i(TAG, "Latest Version: ${info.latestVersionName} (${info.latestVersionCode})")
                Log.i(TAG, "Should Update: $isAvailable")
                
                _updateState.value = _updateState.value.copy(
                    updateInfo = info,
                    isUpdateAvailable = isAvailable
                )

                // Part 4: What's New logic
                if (info.latestVersionCode.toInt() == currentCode && prefs.lastSeenVersionCode < currentCode) {
                    Log.d(TAG, "New version detected! Showing What's New for v$currentCode")
                    _showWhatsNew.value = info
                }
            }
        } catch (e: Exception) {
            val isOffline = isOfflineException(e)
            if (isOffline) {
                Log.i(TAG, "Update check skipped: Firestore is offline (${e.message})")
            } else {
                Log.e(TAG, "Failed to check for updates", e)
            }
        }
    }

    private fun isOfflineException(e: Throwable): Boolean {
        if (e is FirebaseFirestoreException) {
            return e.code == FirebaseFirestoreException.Code.UNAVAILABLE ||
                    e.message?.contains("offline", ignoreCase = true) == true
        }
        val message = e.message ?: ""
        if (message.contains("offline", ignoreCase = true) || 
            message.contains("UNAVAILABLE", ignoreCase = true)) {
            return true
        }
        return e.cause?.let { isOfflineException(it) } ?: false
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val network = cm?.activeNetwork
        val capabilities = cm?.getNetworkCapabilities(network)
        val hasInternet = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        val isValidated = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
        return hasInternet && isValidated
    }

    fun dismissWhatsNew() {
        prefs.lastSeenVersionCode = getCurrentVersionCode()
        _showWhatsNew.value = null
    }

    fun simulateUpdate(force: Boolean = false) {
        val mockInfo = AppUpdateInfo(
            latestVersionCode = (getCurrentVersionCode() + 1).toLong(),
            latestVersionName = "2.0.0-DEBUG",
            apkDownloadUrl = "https://example.com/mock.apk",
            updateMessage = if (force) "Critical security update required immediately." else "New features are available. Please update.",
            forceUpdate = force,
            mandatoryUpdate = force,
            releaseChannel = "beta"
        )
        _updateState.value = _updateState.value.copy(
            updateInfo = mockInfo,
            isUpdateAvailable = true
        )
        _updateInfo.value = mockInfo
    }

    fun clearUpdateState() {
        _updateState.value = _updateState.value.copy(
            updateInfo = null,
            isUpdateAvailable = false
        )
        _updateInfo.value = null
    }

    fun openUpdateUrl(url: String) {
        if (url.isBlank()) return
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open update URL: $url", e)
        }
    }
}
