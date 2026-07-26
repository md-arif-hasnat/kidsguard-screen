package com.example.kidsguard.utils

import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.models.YouTubeScreenType

object YouTubeScreenDetector {

    fun detect(rootNode: AccessibilityNodeInfo?): YouTubeScreenType {
        if (rootNode == null) return YouTubeScreenType.UNKNOWN

        // 1. Check for Ad Playing
        if (isAdPlaying(rootNode)) return YouTubeScreenType.AD

        // 2. Check for Shorts
        if (isShorts(rootNode)) return YouTubeScreenType.SHORTS

        // 3. Check for Watch Page
        if (isWatchPage(rootNode)) return YouTubeScreenType.WATCH_PAGE

        // 4. Check for Miniplayer
        if (isMiniplayer(rootNode)) return YouTubeScreenType.MINIPLAYER

        // 5. Check for Feed
        if (isFeed(rootNode)) return YouTubeScreenType.FEED

        // 6. Check for Search Results
        if (isSearchResults(rootNode)) return YouTubeScreenType.SEARCH_RESULTS

        return YouTubeScreenType.UNKNOWN
    }

    private fun isAdPlaying(rootNode: AccessibilityNodeInfo): Boolean {
        // Ads often have "Ad" text or "Skip ad" buttons with specific IDs
        val skipAdNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/skip_ad_button")
        if (!skipAdNodes.isNullOrEmpty()) return true
        
        val adTextNodes = rootNode.findAccessibilityNodeInfosByText("Ad ")
        if (!adTextNodes.isNullOrEmpty()) {
            // Verify it's actually the "Ad" label, not just a word in a title
            return adTextNodes.any { it.text?.toString() == "Ad" || it.text?.toString()?.startsWith("Ad ·") == true }
        }
        
        return false
    }

    private fun isShorts(rootNode: AccessibilityNodeInfo): Boolean {
        // Shorts player container
        val shortsNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/shorts_player_view")
        if (!shortsNodes.isNullOrEmpty()) return true
        
        // Secondary signal: Remix button which is unique to Shorts
        val remixNodes = rootNode.findAccessibilityNodeInfosByText("Remix")
        return !remixNodes.isNullOrEmpty()
    }

    private fun isWatchPage(rootNode: AccessibilityNodeInfo): Boolean {
        // Watch page has like/dislike/share buttons and a specific player ID
        val watchPlayerNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/watch_player")
        if (!watchPlayerNodes.isNullOrEmpty()) return true
        
        // "Subscribe" button is a very strong signal for a watch page or channel page
        val subscribeNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/subscribe_button")
        return !subscribeNodes.isNullOrEmpty()
    }

    private fun isMiniplayer(rootNode: AccessibilityNodeInfo): Boolean {
        val miniplayerNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/miniplayer_container")
        return !miniplayerNodes.isNullOrEmpty()
    }

    private fun isFeed(rootNode: AccessibilityNodeInfo): Boolean {
        val feedNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/results_list")
        if (!feedNodes.isNullOrEmpty()) return true
        
        val chipsNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/chips_container")
        return !chipsNodes.isNullOrEmpty()
    }

    private fun isSearchResults(rootNode: AccessibilityNodeInfo): Boolean {
        val searchBoxNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/search_edit_text")
        return !searchBoxNodes.isNullOrEmpty()
    }
}
