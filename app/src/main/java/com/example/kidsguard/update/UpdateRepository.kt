package com.example.kidsguard.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class UpdateRepository(private val context: Context) {

    private val _updateInfo = MutableStateFlow<AppUpdateInfo?>(null)
    val updateInfo: StateFlow<AppUpdateInfo?> = _updateInfo

    fun getCurrentVersion(): String {
        return "1.0.0" // Fallback if BuildConfig unavailable
    }

    fun getVersionCode(): Int {
        return 1 // Fallback
    }

    fun checkForUpdates() {
        // Mock check
    }

    fun simulateNewVersionAvailable() {
        _updateInfo.value = AppUpdateInfo(
            currentVersion = getCurrentVersion(),
            latestVersion = "1.1.0",
            versionCode = getVersionCode() + 1,
            apkUrl = "https://github.com/example/kidsguard/releases/download/v1.1.0/app-release.apk",
            releaseNotes = "• Improved GPS accuracy\n• Fixed minor UI bugs\n• Enhanced SOS system security",
            mandatory = false
        )
    }

    fun clearUpdateState() {
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
            e.printStackTrace()
        }
    }
}
