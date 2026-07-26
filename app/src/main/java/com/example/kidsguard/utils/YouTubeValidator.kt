package com.example.kidsguard.utils

import java.util.regex.Pattern

object YouTubeValidator {

    private val CLOCK_TIME_PATTERN = Pattern.compile("^\\d{1,2}:\\d{2}(:\\d{2})?$")
    private val DURATION_PATTERN = Pattern.compile("^\\d+:\\d{2}$")
    private val DATE_PATTERN = Pattern.compile("^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Yesterday),?.*\\d{1,2}.*$", Pattern.CASE_INSENSITIVE)

    private val GENERIC_LABELS = setOf(
        "Home", "Shorts", "Subscriptions", "Library", "Search", "Premium", "Music", 
        "Like", "Dislike", "Share", "Download", "Save", "Live chat", "Comments", 
        "Subscribe", "Subscribed", "You", "Notifications", "Settings", "Help & feedback",
        "Explore", "Trending", "Gaming", "News", "Sport", "Learning", "Fashion & Beauty", 
        "Podcasts", "Movies", "Live", "Videos", "Playlists", "Community", "Channels", "About",
        "More actions", "In this video", "Touch to add city", "Sponsored", "Ad", "Advertisement", "Skip ad", "Visit advertiser"
    )

    fun isValidVideoTitle(title: String?): Boolean {
        if (title.isNullOrBlank()) return false
        val trimmed = title.trim()
        if (trimmed.length < 5) return false
        if (trimmed.length > 250) return false
        if (isNumericOnly(trimmed)) return false
        if (isClockTime(trimmed)) return false
        if (isDuration(trimmed)) return false
        if (isDate(trimmed)) return false
        if (GENERIC_LABELS.contains(trimmed)) return false
        
        return true
    }

    fun isValidChannelName(name: String?): Boolean {
        if (name.isNullOrBlank()) return false
        val trimmed = name.trim()
        if (trimmed.length < 2) return false
        if (isClockTime(trimmed)) return false
        if (isDuration(trimmed)) return false
        if (isDate(trimmed)) return false
        if (GENERIC_LABELS.contains(trimmed)) return false
        if (trimmed.startsWith("Subscribed", ignoreCase = true)) return false
        if (trimmed.contains("subscriber", ignoreCase = true)) return false
        
        return true
    }

    fun isValidVideoId(id: String?): Boolean {
        if (id.isNullOrBlank()) return false
        // YouTube video IDs are 11 chars
        return id.length == 11 && id.all { it.isLetterOrDigit() || it == '-' || it == '_' }
    }

    fun normalizeYouTubeUrl(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val trimmed = url.trim()
        
        if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return null
        
        val validHosts = listOf("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be")
        val host = try {
            val uri = android.net.Uri.parse(trimmed)
            uri.host?.lowercase()
        } catch (e: Exception) {
            null
        }
        
        if (host == null || validHosts.none { host == it || host.endsWith(".$it") }) return null
        
        // Remove tracking params if possible, or at least return a clean URL
        return trimmed.replace("http://", "https://")
    }

    fun isNumericOnly(s: String): Boolean = s.all { it.isDigit() || it.isWhitespace() || it == '.' || it == ',' }

    fun isClockTime(s: String): Boolean = CLOCK_TIME_PATTERN.matcher(s).matches()

    fun isDuration(s: String): Boolean = DURATION_PATTERN.matcher(s).matches()

    fun isDate(s: String): Boolean = DATE_PATTERN.matcher(s).matches()
    
    fun isGenericLabel(s: String): Boolean = GENERIC_LABELS.contains(s)
}
