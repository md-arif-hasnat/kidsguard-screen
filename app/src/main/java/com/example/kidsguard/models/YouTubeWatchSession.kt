package com.example.kidsguard.models

import androidx.annotation.Keep
import java.util.UUID

@Keep
enum class YouTubeScreenType {
    WATCH_PAGE,
    SHORTS,
    MINIPLAYER,
    AD,
    FEED,
    SEARCH_RESULTS,
    CHANNEL_PAGE,
    UNKNOWN
}

@Keep
data class YouTubeMetadataCandidate(
    val videoTitle: String?,
    val channelName: String?,
    val videoId: String? = null,
    val youtubeUrl: String? = null,
    val thumbnailUrl: String? = null,
    val linkSource: String? = null,
    val linkConfidence: Float? = null,
    val screenType: YouTubeScreenType,
    val confidence: Float,
    val extractionStrategy: String,
    val rejectedReason: String? = null
)

@Keep
data class YouTubeWatchSession(
    val sessionId: String = UUID.randomUUID().toString(),
    var videoId: String? = null,
    var youtubeUrl: String? = null,
    var title: String? = null,
    var channel: String? = null,
    var thumbnailUrl: String? = null,
    var linkSource: String? = null,
    var linkConfidence: Float? = null,
    val startedAt: Long = System.currentTimeMillis(),
    var lastSeenAt: Long = System.currentTimeMillis(),
    var accumulatedDuration: Long = 0,
    var screenType: YouTubeScreenType = YouTubeScreenType.UNKNOWN,
    var isAdPlaying: Boolean = false,
    var lastDetectionConfidence: Float = 0f
)
