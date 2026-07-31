package com.example.kidsguard.youtube

data class YouTubeSearchResponse(
    val items: List<YouTubeSearchItem> = emptyList()
)

data class YouTubeSearchItem(
    val id: YouTubeSearchItemId? = null,
    val snippet: YouTubeSearchSnippet? = null
)

data class YouTubeSearchItemId(
    val videoId: String? = null
)

data class YouTubeSearchSnippet(
    val title: String? = null,
    val channelTitle: String? = null,
    val thumbnails: YouTubeThumbnails? = null
)

data class YouTubeThumbnails(
    val default: YouTubeThumbnail? = null,
    val medium: YouTubeThumbnail? = null,
    val high: YouTubeThumbnail? = null
)

data class YouTubeThumbnail(
    val url: String? = null,
    val width: Int? = null,
    val height: Int? = null
)