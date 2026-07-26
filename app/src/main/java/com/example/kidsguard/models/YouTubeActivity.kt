package com.example.kidsguard.models

import androidx.annotation.Keep

@Keep
data class YouTubeActivity(
    val id: String, // Locally generated UUID
    val videoTitle: String,
    val channelName: String?,
    val videoId: String? = null,
    val thumbnailUrl: String? = null,
    val packageName: String = "com.google.android.youtube",
    val capturedAt: Long = System.currentTimeMillis(),
    val startedAt: Long,
    var endedAt: Long? = null,
    var watchDurationSeconds: Long = 0,
    
    // Sync fields
    var isSynced: Boolean = false,
    var deviceId: String? = null,
    var uploadedAt: Long? = null,
    var syncVersion: Int = 1,
    var createdBy: String? = null // Child ID or Device ID
)
