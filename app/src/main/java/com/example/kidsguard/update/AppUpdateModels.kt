package com.example.kidsguard.update

import com.google.firebase.Timestamp

data class AppUpdateInfo(
    val latestVersionCode: Long = 0,
    val latestVersionName: String = "",
    val apkDownloadUrl: String = "",
    val updateMessage: String = "",
    val forceUpdate: Boolean = false,
    val mandatoryUpdate: Boolean = false,
    val releaseChannel: String = "stable",
    val releasedAt: Timestamp? = null,
    val fileSize: String = "",
    val minimumAndroidVersion: String = "",
    val releaseNotes: List<String> = emptyList(),
    val webVersion: String = "",
    val webUpdateMessage: String = "",
    val webReleaseNotes: List<String> = emptyList()
)

data class AppUpdateState(
    val currentVersionName: String,
    val currentVersionCode: Int,
    val updateInfo: AppUpdateInfo?,
    val isUpdateAvailable: Boolean = false
)
