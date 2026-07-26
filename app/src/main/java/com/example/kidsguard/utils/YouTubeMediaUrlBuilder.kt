package com.example.kidsguard.utils

object YouTubeMediaUrlBuilder {

    fun buildWatchUrl(videoId: String, isShort: Boolean): String {
        return if (isShort) {
            "https://www.youtube.com/shorts/$videoId"
        } else {
            "https://www.youtube.com/watch?v=$videoId"
        }
    }

    fun buildThumbnailUrl(videoId: String): String {
        return "https://img.youtube.com/vi/$videoId/hqdefault.jpg"
    }

    /**
     * Extracts video ID from a YouTube URL.
     * Supports:
     * - youtube.com/watch?v=VIDEO_ID
     * - youtu.be/VIDEO_ID
     * - youtube.com/shorts/VIDEO_ID
     */
    fun extractVideoId(url: String?): String? {
        if (url == null) return null
        
        val normalized = url.trim()
        
        // pattern: youtu.be/ID
        if (normalized.contains("youtu.be/")) {
            return normalized.substringAfter("youtu.be/").substringBefore("?").substringBefore("/")
        }
        
        // pattern: watch?v=ID
        if (normalized.contains("v=")) {
            return normalized.substringAfter("v=").substringBefore("&").substringBefore("/")
        }
        
        // pattern: /shorts/ID
        if (normalized.contains("/shorts/")) {
            return normalized.substringAfter("/shorts/").substringBefore("?").substringBefore("/")
        }

        return null
    }
}
