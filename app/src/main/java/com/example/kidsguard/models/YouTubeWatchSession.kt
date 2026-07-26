package com.example.kidsguard.models

import androidx.annotation.Keep
import java.util.UUID

@Keep
enum class YouTubeScreenType {
    WATCH_PAGE,
    SHORTS,
    HOME_FEED,
    SEARCH_RESULTS,
    CHANNEL_PAGE,
    MINIPLAYER,
    AD_PLAYING,
    UNKNOWN
}

@Keep
data class YouTubeWatchSession(
    val sessionId: String = UUID.randomUUID().toString(),
    var videoId: String? = null,
    var title: String? = null,
    var channel: String? = null,
    var thumbnailUrl: String? = null,
    val startedAt: Long = System.currentTimeMillis(),
    var lastSeenAt: Long = System.currentTimeMillis(),
    var accumulatedDuration: Long = 0,
    var screenType: YouTubeScreenType = YouTubeScreenType.UNKNOWN,
    var isAdPlaying: Boolean = false,
    var lastDetectionConfidence: Float = 0f
)
