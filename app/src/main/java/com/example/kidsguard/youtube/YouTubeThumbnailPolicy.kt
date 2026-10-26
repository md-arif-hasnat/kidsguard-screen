package com.example.kidsguard.youtube

/**
 * Keeps dashboard-bound YouTube artwork deterministic and remotely loadable.
 * Android MediaSession artwork is often a content:// URI that only the child
 * device can read, so it must never be treated as a web thumbnail.
 */
object YouTubeThumbnailPolicy {
    private val VIDEO_ID_REGEX = Regex("^[A-Za-z0-9_-]{11}$")

    fun isValidVideoId(videoId: String?): Boolean {
        return videoId?.trim()?.let(VIDEO_ID_REGEX::matches) == true
    }

    fun buildThumbnailUrl(videoId: String): String? {
        val cleanId = videoId.trim()
        if (!VIDEO_ID_REGEX.matches(cleanId)) return null
        return "https://i.ytimg.com/vi/$cleanId/hqdefault.jpg"
    }

    fun remoteThumbnailOrNull(videoId: String?, candidateUrl: String?): String? {
        val cleanCandidate = candidateUrl
            ?.trim()
            ?.takeIf { it.startsWith("https://", ignoreCase = true) }

        return cleanCandidate ?: videoId?.let(::buildThumbnailUrl)
    }
}
