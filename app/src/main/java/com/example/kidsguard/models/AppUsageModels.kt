package com.example.kidsguard.models

import androidx.annotation.Keep

@Keep
data class AppUsageItem(
    val packageName: String = "",
    val appName: String = "",
    val foregroundTimeMs: Long = 0L,
    val lastUsedAt: Long = 0L,
    val firstUsedAt: Long? = null,
    val launchCount: Int = 0
)

@Keep
data class DailyAppUsage(
    val childId: String = "",
    val familyId: String = "",
    val date: String = "", // yyyy-MM-dd
    val totalScreenTimeMs: Long = 0L,
    val apps: List<AppUsageItem> = emptyList(),
    val timezone: String = "",
    val updatedAt: Long = System.currentTimeMillis()
)
