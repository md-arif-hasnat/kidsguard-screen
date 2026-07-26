package com.example.kidsguard.utils

import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.models.YouTubeScreenType

object YouTubeScreenDetector {

    fun detect(rootNode: AccessibilityNodeInfo?): YouTubeScreenType {
        if (rootNode == null) return YouTubeScreenType.UNKNOWN

        // Check for Ad
        if (isAdPlaying(rootNode)) return YouTubeScreenType.AD_PLAYING

        // Check for Shorts
        if (isShorts(rootNode)) return YouTubeScreenType.SHORTS

        // Check for Watch Page
        if (isWatchPage(rootNode)) return YouTubeScreenType.WATCH_PAGE

        // Check for Feed
        if (isHomeFeed(rootNode)) return YouTubeScreenType.HOME_FEED

        // Check for Search Results
        if (isSearchResults(rootNode)) return YouTubeScreenType.SEARCH_RESULTS

        return YouTubeScreenType.UNKNOWN
    }

    private fun isAdPlaying(rootNode: AccessibilityNodeInfo): Boolean {
        // Look for "Ad", "Sponsored", or typical Ad UI components
        val adTexts = listOf("Ad ", "Sponsored", "Visit Advertiser", "Skip Ad")
        return findAnyText(rootNode, adTexts)
    }

    private fun isShorts(rootNode: AccessibilityNodeInfo): Boolean {
        // Shorts usually have a "Remix" button or specific container IDs
        val shortsIndicators = listOf("Shorts", "Remix")
        // Also check for view IDs if known
        return findAnyText(rootNode, shortsIndicators)
    }

    private fun isWatchPage(rootNode: AccessibilityNodeInfo): Boolean {
        // Watch page has like/dislike/share buttons below a player
        val watchIndicators = listOf("Share", "Subscribe", "Comments")
        return findAnyText(rootNode, watchIndicators)
    }

    private fun isHomeFeed(rootNode: AccessibilityNodeInfo): Boolean {
        val feedIndicators = listOf("Home", "Subscriptions", "Library")
        return findAnyText(rootNode, feedIndicators)
    }

    private fun isSearchResults(rootNode: AccessibilityNodeInfo): Boolean {
        val searchNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/search_edit_text")
        return !searchNodes.isNullOrEmpty()
    }

    private fun findAnyText(node: AccessibilityNodeInfo, targets: List<String>): Boolean {
        val text = node.text?.toString() ?: ""
        val contentDesc = node.contentDescription?.toString() ?: ""
        
        if (targets.any { text.contains(it, ignoreCase = true) || contentDesc.contains(it, ignoreCase = true) }) {
            return true
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (findAnyText(child, targets)) return true
        }
        return false
    }
}
