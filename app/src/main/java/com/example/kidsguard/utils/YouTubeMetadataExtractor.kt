package com.example.kidsguard.utils

import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log
import com.example.kidsguard.models.YouTubeMetadataCandidate
import com.example.kidsguard.models.YouTubeScreenType

object YouTubeMetadataExtractor {
    private const val TAG = "YOUTUBE_METADATA_DEBUG"

    private val WATCH_TITLE_IDS = listOf(
        "com.google.android.youtube:id/title",
        "com.google.android.youtube:id/video_title"
    )
    
    private val WATCH_CHANNEL_IDS = listOf(
        "com.google.android.youtube:id/channel_name",
        "com.google.android.youtube:id/owner_name"
    )

    private val SHORTS_TITLE_IDS = listOf(
        "com.google.android.youtube:id/shorts_title",
        "com.google.android.youtube:id/video_description"
    )

    fun extract(rootNode: AccessibilityNodeInfo?, screenType: YouTubeScreenType): YouTubeMetadataCandidate? {
        if (rootNode == null) return null

        val candidate = when (screenType) {
            YouTubeScreenType.WATCH_PAGE -> extractWatchPage(rootNode)
            YouTubeScreenType.SHORTS -> extractShorts(rootNode)
            YouTubeScreenType.MINIPLAYER -> extractMiniplayer(rootNode)
            else -> null
        }

        // Try to find video ID/URL regardless of screen type if we found a candidate or even if we didn't (to enrich later)
        return candidate?.let { enrichWithVideoId(rootNode, it) }
    }

    private fun enrichWithVideoId(rootNode: AccessibilityNodeInfo, candidate: YouTubeMetadataCandidate): YouTubeMetadataCandidate {
        // Search tree for any node that might contain a YouTube URL or ID
        val extractedId = findVideoIdInTree(rootNode)
        
        if (extractedId != null) {
            val url = YouTubeMediaUrlBuilder.buildWatchUrl(extractedId, candidate.screenType == YouTubeScreenType.SHORTS)
            val thumb = YouTubeMediaUrlBuilder.buildThumbnailUrl(extractedId)
            
            return candidate.copy(
                videoId = extractedId,
                youtubeUrl = url,
                thumbnailUrl = candidate.thumbnailUrl ?: thumb,
                linkSource = "accessibility_tree",
                linkConfidence = 1.0f
            )
        }
        
        return candidate
    }

    private fun findVideoIdInTree(node: AccessibilityNodeInfo): String? {
        // Check content description for URL patterns
        val contentDesc = node.contentDescription?.toString()
        if (contentDesc != null) {
            val id = YouTubeMediaUrlBuilder.extractVideoId(contentDesc)
            if (YouTubeValidator.isValidVideoId(id)) return id
        }

        // Check text for URL patterns (rare but possible in some views)
        val text = node.text?.toString()
        if (text != null) {
            val id = YouTubeMediaUrlBuilder.extractVideoId(text)
            if (YouTubeValidator.isValidVideoId(id)) return id
        }

        // Specific ID for some share/info buttons
        val shareNodes = node.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/share_button")
        shareNodes?.firstOrNull()?.contentDescription?.toString()?.let {
            val id = YouTubeMediaUrlBuilder.extractVideoId(it)
            if (YouTubeValidator.isValidVideoId(id)) return id
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findVideoIdInTree(child)
            if (found != null) return found
        }
        return null
    }

    private fun extractWatchPage(rootNode: AccessibilityNodeInfo): YouTubeMetadataCandidate? {
        // Strategy 1: Explicit Resource IDs
        for (titleId in WATCH_TITLE_IDS) {
            val titleNodes = rootNode.findAccessibilityNodeInfosByViewId(titleId)
            val title = titleNodes?.firstOrNull()?.text?.toString()
            
            if (YouTubeValidator.isValidVideoTitle(title)) {
                var channel: String? = null
                for (channelId in WATCH_CHANNEL_IDS) {
                    val channelNodes = rootNode.findAccessibilityNodeInfosByViewId(channelId)
                    channel = channelNodes?.firstOrNull()?.text?.toString()
                    if (YouTubeValidator.isValidChannelName(channel)) break else channel = null
                }
                
                return YouTubeMetadataCandidate(
                    videoTitle = title,
                    channelName = channel,
                    screenType = YouTubeScreenType.WATCH_PAGE,
                    confidence = if (channel != null) 0.95f else 0.85f,
                    extractionStrategy = "watch_resource_id"
                )
            }
        }

        // Strategy 2: Structural Relationship (Fallback)
        // Look for the "Subscribe" button and search nearby
        val subscribeNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/subscribe_button")
        if (!subscribeNodes.isNullOrEmpty()) {
            val parent = subscribeNodes[0].parent
            if (parent != null) {
                // Usually title is a few levels up or a sibling's child
                // This is a simplified structural search
                val title = findFirstValidTitleInTree(rootNode)
                if (title != null) {
                    return YouTubeMetadataCandidate(
                        videoTitle = title,
                        channelName = null, // Channel harder to find structurally
                        screenType = YouTubeScreenType.WATCH_PAGE,
                        confidence = 0.80f,
                        extractionStrategy = "watch_structural"
                    )
                }
            }
        }

        return null
    }

    private fun extractShorts(rootNode: AccessibilityNodeInfo): YouTubeMetadataCandidate? {
        for (id in SHORTS_TITLE_IDS) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            val text = nodes?.firstOrNull()?.text?.toString()
            if (YouTubeValidator.isValidVideoTitle(text)) {
                val channelNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/channel_name")
                val channel = channelNodes?.firstOrNull()?.text?.toString()
                
                return YouTubeMetadataCandidate(
                    videoTitle = text,
                    channelName = channel,
                    screenType = YouTubeScreenType.SHORTS,
                    confidence = 0.90f,
                    extractionStrategy = "shorts_resource_id"
                )
            }
        }
        return null
    }

    private fun extractMiniplayer(rootNode: AccessibilityNodeInfo): YouTubeMetadataCandidate? {
        val titleNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/miniplayer_title")
        val title = titleNodes?.firstOrNull()?.text?.toString()
        
        if (YouTubeValidator.isValidVideoTitle(title)) {
            return YouTubeMetadataCandidate(
                videoTitle = title,
                channelName = null,
                screenType = YouTubeScreenType.MINIPLAYER,
                confidence = 0.85f,
                extractionStrategy = "miniplayer_id"
            )
        }
        return null
    }

    private fun findFirstValidTitleInTree(node: AccessibilityNodeInfo): String? {
        val text = node.text?.toString()
        if (YouTubeValidator.isValidVideoTitle(text)) return text
        
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findFirstValidTitleInTree(child)
            if (found != null) return found
        }
        return null
    }
}
