package com.example.kidsguard.update

data class AppUpdateInfo(
    val currentVersion: String,
    val latestVersion: String,
    val versionCode: Int,
    val apkUrl: String,
    val releaseNotes: String,
    val mandatory: Boolean = false,
    val publishedAt: Long = System.currentTimeMillis()
)
