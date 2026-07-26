package com.example.kidsguard.utils

import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log

data class YouTubeMetadata(
    val title: String?,
    val channel: String?,
    val videoId: String?,
    val strategy: String,
    val confidence: Float
)

object YouTubeMetadataExtractor {
    private const val TAG = "YOUTUBE_HISTORY_TRACE"

    fun extract(rootNode: AccessibilityNodeInfo?): YouTubeMetadata? {
        if (rootNode == null) return null

        // Strategy 1: Resource IDs (Watch Page)
        extractByResourceIds(rootNode)?.let { 
            Log.d(TAG, "Extraction Strategy: resource_ids - Title: ${it.title}")
            return it 
        }

        // Strategy 2: Shorts Specific
        extractShortsMetadata(rootNode)?.let { 
            Log.d(TAG, "Extraction Strategy: shorts - Title: ${it.title}")
            return it 
        }

        // Strategy 3: Text Hierarchy (Watch Page)
        extractByTextHierarchy(rootNode)?.let { 
            Log.d(TAG, "Extraction Strategy: text_hierarchy - Title: ${it.title}")
            return it 
        }

        return null
    }

    private fun extractByResourceIds(rootNode: AccessibilityNodeInfo): YouTubeMetadata? {
        // Modern YouTube View IDs
        val titleIds = listOf(
            "com.google.android.youtube:id/title",
            "com.google.android.youtube:id/video_title",
            "com.google.android.youtube:id/watch_title"
        )
        val channelIds = listOf(
            "com.google.android.youtube:id/channel_name",
            "com.google.android.youtube:id/channel_title",
            "com.google.android.youtube:id/owner_name"
        )

        var title: String? = null
        for (id in titleIds) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                title = nodes[0].text?.toString()
                if (!title.isNullOrBlank()) break
            }
        }

        var channel: String? = null
        for (id in channelIds) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                channel = nodes[0].text?.toString()
                if (!channel.isNullOrBlank()) break
            }
        }

        if (!title.isNullOrBlank()) {
            return YouTubeMetadata(title, channel, null, "resource_ids", 1.0f)
        }
        return null
    }

    private fun extractByTextHierarchy(rootNode: AccessibilityNodeInfo): YouTubeMetadata? {
        // Heuristic: The title is often a large text node above the channel name and view count
        val allTexts = mutableListOf<String>()
        collectAllTexts(rootNode, allTexts)

        for (i in allTexts.indices) {
            val text = allTexts[i].trim()
            if (text.length in 8..150 && !isGenericText(text) && !isTimeOrViews(text)) {
                // Potential title. Check if next is channel or views
                if (i + 1 < allTexts.size) {
                    val nextText = allTexts[i + 1]
                    if (isTimeOrViews(nextText)) {
                        return YouTubeMetadata(text, null, null, "text_hierarchy_no_channel", 0.7f)
                    }
                }
            }
        }
        return null
    }

    private fun extractShortsMetadata(rootNode: AccessibilityNodeInfo): YouTubeMetadata? {
        val shortsTitleIds = listOf(
            "com.google.android.youtube:id/shorts_title",
            "com.google.android.youtube:id/video_description"
        )
        
        var title: String? = null
        for (id in shortsTitleIds) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                title = nodes[0].text?.toString()
                if (!title.isNullOrBlank()) break
            }
        }

        val channelNodes = rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/channel_name")
        val channel = channelNodes?.firstOrNull()?.text?.toString()

        if (!title.isNullOrBlank()) {
            return YouTubeMetadata(title, channel, null, "shorts_ids", 0.9f)
        }
        return null
    }

    private fun collectAllTexts(node: AccessibilityNodeInfo, list: MutableList<String>) {
        val text = node.text?.toString()
        if (!text.isNullOrBlank()) list.add(text)
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectAllTexts(child, list)
        }
    }

    private fun isGenericText(text: String): Boolean {
        val generic = setOf("Home", "Shorts", "Subscriptions", "Library", "Search")
        return generic.contains(text)
    }

    private fun isTimeOrViews(s: String): Boolean {
        val lower = s.lowercase()
        return lower.contains("views") || lower.contains("ago") || lower.matches(Regex(".*\\d:\\d+.*"))
    }
}
