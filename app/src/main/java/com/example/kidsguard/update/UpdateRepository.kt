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

class UpdateRepository(private val context: Context) {

    private val db = FirebaseFirestore.getInstance()
    private val _updateState = MutableStateFlow(
        AppUpdateState(
            currentVersionName = getCurrentVersionName(),
            currentVersionCode = getCurrentVersionCode(),
            updateInfo = null
        )
    )
    val updateState: StateFlow<AppUpdateState> = _updateState

    // Keep legacy updateInfo for backward compatibility with UI if needed
    private val _updateInfo = MutableStateFlow<AppUpdateInfo?>(null)
    val updateInfo: StateFlow<AppUpdateInfo?> = _updateInfo

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
                    val isAvailable = info.latestVersionCode > getCurrentVersionCode()
                    Log.i(TAG, "Update check result: Available=$isAvailable, Latest=${info.latestVersionCode}, Current=${getCurrentVersionCode()}")
                    
                    _updateState.value = _updateState.value.copy(
                        updateInfo = info,
                        isUpdateAvailable = isAvailable
                    )
                    _updateInfo.value = info
                }
            } else {
                Log.w(TAG, "Update config document not found at $CONFIG_PATH")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check for updates", e)
        }
    }

    fun simulateUpdate(force: Boolean = false) {
        val mockInfo = AppUpdateInfo(
            latestVersionCode = (getCurrentVersionCode() + 1).toLong(),
            latestVersionName = "2.0.0-DEBUG",
            apkDownloadUrl = "https://example.com/mock.apk",
            updateMessage = if (force) "Critical security update required immediately." else "New features are available. Please update.",
            forceUpdate = force
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
