package com.example.kidsguard.update

import androidx.annotation.Keep
import com.google.firebase.Timestamp

@Keep
data class AppUpdateInfo(
    var latestVersionCode: Long = 0,
    var latestVersionName: String = "",
    var apkDownloadUrl: String = "",
    var updateMessage: String = "",
    var forceUpdate: Boolean = false,
    var mandatoryUpdate: Boolean = false,
    var releaseChannel: String = "stable",
    var releasedAt: Timestamp? = null,
    var fileSize: String = "",
    var minimumAndroidVersion: String = "",
    var releaseNotes: List<String> = emptyList(),
    var webVersion: String = "",
    var webUpdateMessage: String = "",
    var webReleaseNotes: List<String> = emptyList()
)

data class AppUpdateState(
    val currentVersionName: String,
    val currentVersionCode: Int,
    val updateInfo: AppUpdateInfo?,
    val isUpdateAvailable: Boolean = false
)
