package com.example.kidsguard.update

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
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
        Log.d(TAG, "Checking for updates from Firestore...")
        try {
            val doc = db.document(CONFIG_PATH).get().await()
            if (doc.exists()) {
                val info = doc.toObject(AppUpdateInfo::class.java)
                if (info != null) {
                    val currentCode = getCurrentVersionCode()
                    val isAvailable = info.latestVersionCode > currentCode
                    Log.i(TAG, "Update check result: Available=$isAvailable, Latest=${info.latestVersionCode}, Current=$currentCode")
                    
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
            } else {
                Log.w(TAG, "Update config document not found at $CONFIG_PATH")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check for updates", e)
        }
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
