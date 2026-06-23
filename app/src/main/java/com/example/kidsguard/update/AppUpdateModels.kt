package com.example.kidsguard.update

import com.google.firebase.Timestamp

data class AppUpdateInfo(
    val latestVersionCode: Long = 0,
    val latestVersionName: String = "",
    val apkDownloadUrl: String = "",
    val updateMessage: String = "",
    val forceUpdate: Boolean = false,
    val releasedAt: Timestamp? = null
)

data class AppUpdateState(
    val currentVersionName: String,
    val currentVersionCode: Int,
    val updateInfo: AppUpdateInfo?,
    val isUpdateAvailable: Boolean = false
)
