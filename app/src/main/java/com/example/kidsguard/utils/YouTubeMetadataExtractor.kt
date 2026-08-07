package com.example.kidsguard.utils

import android.os.Build
import android.view.accessibility.AccessibilityNodeInfo
import com.example.kidsguard.models.YouTubeMetadataCandidate
import com.example.kidsguard.models.YouTubeScreenType
import com.example.kidsguard.repository.YouTubeHistoryRepository

object YouTubeMetadataExtractor {
    private var lastProcessedTitle: String? = null
    private var lastProcessedTitleTime: Long = 0L
    private const val TITLE_DEBOUNCE_MS = 15_000L
    private var lastCandidateTitle: String? = null
    private var lastCandidateTime: Long = 0L

    private val WATCH_TITLE_IDS = listOf(
        "com.google.android.youtube:id/title",
        "com.google.android.youtube:id/video_title",
        "com.google.android.youtube:id/watch_title"
    )

    private val WATCH_CHANNEL_IDS = listOf(
        "com.google.android.youtube:id/channel_name",
        "com.google.android.youtube:id/channel_title",
        "com.google.android.youtube:id/owner_name"
    )

    private val SHORTS_TITLE_IDS = listOf(
        "com.google.android.youtube:id/shorts_title",
        "com.google.android.youtube:id/video_description",
        "com.google.android.youtube:id/title"
    )

    fun extract(
        rootNode: AccessibilityNodeInfo,
        screenType: YouTubeScreenType,
        repo: YouTubeHistoryRepository
    ): YouTubeMetadataCandidate? {
        val candidate = when (screenType) {
            YouTubeScreenType.WATCH_PAGE -> extractWatchPage(rootNode, repo)
            YouTubeScreenType.SHORTS -> extractShorts(rootNode, repo)
            YouTubeScreenType.MINIPLAYER -> extractMiniplayer(rootNode, repo)
            else -> null
        }

        if (candidate == null) {
            if (screenType != YouTubeScreenType.FEED && screenType != YouTubeScreenType.SEARCH_RESULTS
                && screenType != YouTubeScreenType.UNKNOWN
            ) {
                repo.addDebugLog("METADATA_MISSING screen=$screenType")
                repo.addDebugLog("TITLE_MISSING")
            }
            return null
        } else {
            repo.addDebugLog("TITLE_ACCEPTED: ${candidate.videoTitle}")
            if (candidate.channelName != null) {
                repo.addDebugLog("CHANNEL_ACCEPTED: ${candidate.channelName}")
            } else {
                repo.addDebugLog("CHANNEL_MISSING")
            }
        }
        val now = System.currentTimeMillis()

        if (
            lastCandidateTitle == candidate.videoTitle &&
            now - lastCandidateTime < 3000L
        ) {
            repo.addDebugLog(
                msg = "CANDIDATE_DEBOUNCED: ${candidate.videoTitle}"
            )
            return null
        }

        lastCandidateTitle = candidate.videoTitle
        lastCandidateTime = now

        val enriched = enrichWithVideoId(rootNode, candidate, repo)
        return enriched
    }


    private fun enrichWithVideoId(
        rootNode: AccessibilityNodeInfo,
        candidate: YouTubeMetadataCandidate,
        repo: YouTubeHistoryRepository
    ): YouTubeMetadataCandidate {

        repo.addDebugLog("VIDEO_ID_SEARCH_STARTED")

        val extractedId = findVideoIdInTree(rootNode)

        if (extractedId != null) {
            val url = YouTubeMediaUrlBuilder.buildWatchUrl(
                videoId = extractedId,
                isShort = candidate.screenType == YouTubeScreenType.SHORTS
            )

            val thumb =
                YouTubeMediaUrlBuilder.buildThumbnailUrl(videoId = extractedId)

            repo.addDebugLog("VIDEO_ID_FOUND: $extractedId")
            repo.addDebugLog("YOUTUBE_URL_CREATED: $url")
            repo.addDebugLog("THUMBNAIL_CREATED: $thumb")

            return candidate.copy(
                videoId = extractedId,
                youtubeUrl = url,
                thumbnailUrl = candidate.thumbnailUrl ?: thumb,
                linkSource = "accessibility_tree",
                linkConfidence = 1.0f
            )
        }

        repo.addDebugLog("VIDEO_ID_NOT_FOUND")
        return candidate

    }


    private fun findVideoIdInTree(node: AccessibilityNodeInfo): String? {
        val candidates = buildList {
            node.viewIdResourceName?.let(::add)
            node.contentDescription?.toString()?.let(::add)
            node.text?.toString()?.let(::add)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                node.hintText?.toString()?.let(::add)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                node.tooltipText?.toString()?.let(::add)
                node.paneTitle?.toString()?.let(::add)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                node.stateDescription?.toString()?.let(::add)
            }

            add(node.toString())
        }

        for (candidate in candidates) {
            val id = YouTubeMediaUrlBuilder.extractVideoId(candidate)
            if (YouTubeValidator.isValidVideoId(id)) {
                return id
            }
        }

        val possibleIds = listOf(
            "com.google.android.youtube:id/share_button",
            "com.google.android.youtube:id/copy_link",
            "com.google.android.youtube:id/menu_item_view",
            "com.google.android.youtube:id/player_overflow_button",
            "com.google.android.youtube:id/watch_panel"
        )

        for (viewId in possibleIds) {
            val nodes = node.findAccessibilityNodeInfosByViewId(viewId)

            for (targetNode in nodes) {
                val values = listOfNotNull(
                    targetNode.contentDescription?.toString(),
                    targetNode.text?.toString(),
                    targetNode.viewIdResourceName,
                    targetNode.toString()
                )

                for (value in values) {
                    val id = YouTubeMediaUrlBuilder.extractVideoId(value)

                    if (YouTubeValidator.isValidVideoId(id)) {
                        return id
                    }
                }
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findVideoIdInTree(child)
            if (found != null) return found
        }
        return null
    }

    private fun findChannelNameInTree(
        node: AccessibilityNodeInfo,
        acceptedTitle: String
    ): String? {

        val text = getTextDeep(node)?.trim()

        if (
            !text.isNullOrBlank() &&
            text != acceptedTitle &&
            YouTubeValidator.isValidChannelName(text)
        ) {
            return text
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findChannelNameInTree(child, acceptedTitle)

            if (found != null) {
                return found
            }
        }

        return null
    }


    private fun extractWatchPage(
        rootNode: AccessibilityNodeInfo,
        repo: YouTubeHistoryRepository
    ): YouTubeMetadataCandidate? {

        var acceptedTitle: String? = null
        var channel: String? = null

        for (titleId in WATCH_TITLE_IDS) {
            val titleNodes =
                rootNode.findAccessibilityNodeInfosByViewId(titleId)

            if (!titleNodes.isNullOrEmpty()) {
                val title = getTextDeep(titleNodes[0])

                repo.addDebugLog(
                    "TITLE_CANDIDATE: $title (ID: $titleId)"
                )

                if (YouTubeValidator.isValidVideoTitle(title)) {
                    acceptedTitle = title

                    for (channelId in WATCH_CHANNEL_IDS) {
                        val channelNodes =
                            rootNode.findAccessibilityNodeInfosByViewId(channelId)

                        if (!channelNodes.isNullOrEmpty()) {
                            val channelCand = getTextDeep(channelNodes[0])

                            if (
                                YouTubeValidator.isValidChannelName(
                                    channelCand
                                )
                            ) {
                                channel = channelCand
                                break
                            }
                        }
                    }

                    break
                }
            }
        }

        val safeTitle = acceptedTitle ?: return null

        var finalChannel = channel

        if (finalChannel == null) {
            repo.addDebugLog("CHANNEL_STRUCTURAL_SEARCH_STARTED")

            finalChannel = findChannelNameInTree(
                node = rootNode,
                acceptedTitle = safeTitle
            )

            if (finalChannel != null) {
                repo.addDebugLog(
                    "CHANNEL_STRUCTURAL_FOUND: $finalChannel"
                )
            } else {
                repo.addDebugLog(
                    "CHANNEL_STRUCTURAL_NOT_FOUND"
                )
            }
        }

        val videoId = extractVideoId(rootNode = rootNode, repo = repo)

        val youtubeUrl = videoId?.let {
            YouTubeMediaUrlBuilder.buildWatchUrl(
                videoId = it,
                isShort = false
            )
        }
        val thumbnailUrl = videoId?.let {
            YouTubeMediaUrlBuilder.buildThumbnailUrl(it)
        }




        return YouTubeMetadataCandidate(
            videoTitle = safeTitle,
            channelName = finalChannel,
            videoId = videoId,
            youtubeUrl = youtubeUrl,
            thumbnailUrl = thumbnailUrl,
            screenType = YouTubeScreenType.WATCH_PAGE,
            confidence = if (finalChannel != null) 0.95f else 0.85f,
            extractionStrategy = "watch_resource_id"
        )
    }

    private fun extractShorts(
        rootNode: AccessibilityNodeInfo,
        repo: YouTubeHistoryRepository
    ): YouTubeMetadataCandidate? {
        for (id in SHORTS_TITLE_IDS) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                val text = getTextDeep(nodes[0])
                repo.addDebugLog("TITLE_CANDIDATE: $text (Shorts ID: $id)")
                if (YouTubeValidator.isValidVideoTitle(text)) {
                    val channelNodes =
                        rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/channel_name")
                    val channel =
                        if (!channelNodes.isNullOrEmpty()) getTextDeep(channelNodes[0]) else null

                    return YouTubeMetadataCandidate(
                        videoTitle = text!!,
                        channelName = channel,
                        screenType = YouTubeScreenType.SHORTS,
                        confidence = 0.90f,
                        extractionStrategy = "shorts_resource_id"
                    )
                } else if (text != null) {
                    repo.addDebugLog("TITLE_REJECTED: $text")
                }
            }
        }
        return null
    }

    private fun extractMiniplayer(
        rootNode: AccessibilityNodeInfo,
        repo: YouTubeHistoryRepository
    ): YouTubeMetadataCandidate? {
        val titleNodes =
            rootNode.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/miniplayer_title")
        if (!titleNodes.isNullOrEmpty()) {
            val title = getTextDeep(titleNodes[0])
            repo.addDebugLog("TITLE_CANDIDATE: $title (Miniplayer)")
            if (YouTubeValidator.isValidVideoTitle(title)) {
                return YouTubeMetadataCandidate(
                    videoTitle = title!!,
                    channelName = null,
                    screenType = YouTubeScreenType.MINIPLAYER,
                    confidence = 0.85f,
                    extractionStrategy = "miniplayer_id"
                )
            } else if (title != null) {
                repo.addDebugLog("TITLE_REJECTED: $title")
            }
        }
        return null
    }

    private fun findFirstValidTitleInTree(
        node: AccessibilityNodeInfo,
        repo: YouTubeHistoryRepository
    ): String? {
        val text = node.text?.toString()
        if (text != null) {
            repo.addDebugLog("TITLE_CANDIDATE (Structural Text): $text")
            if (YouTubeValidator.isValidVideoTitle(text)) return text
            else repo.addDebugLog("TITLE_REJECTED: $text")
        }

        val desc = node.contentDescription?.toString()
        if (desc != null) {
            repo.addDebugLog("TITLE_CANDIDATE (Structural Desc): $desc")
            if (YouTubeValidator.isValidVideoTitle(desc)) return desc
            else repo.addDebugLog("TITLE_REJECTED: $desc")
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findFirstValidTitleInTree(child, repo)
            if (found != null) return found
        }
        return null
    }

    /**
     * Tries to get text from the node, or its first child if empty.
     * Useful for ViewGroups that act as containers for labels.
     */
    private fun getTextDeep(node: AccessibilityNodeInfo): String? {
        val text = node.text?.toString()
        if (!text.isNullOrBlank()) return text

        val desc = node.contentDescription?.toString()
        if (!desc.isNullOrBlank()) return desc

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val childText = getTextDeep(child)
            if (!childText.isNullOrBlank()) return childText
        }
        return null
    }

    private fun extractVideoId(
        rootNode: AccessibilityNodeInfo,
        repo: YouTubeHistoryRepository
    ): String? {

        repo.addDebugLog("VIDEO_ID_SCAN_STARTED")

        val urlRegex = Regex(
            pattern = """(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([A-Za-z0-9_-]{11})""",
            option = RegexOption.IGNORE_CASE
        )

        val videoId = searchVideoId(rootNode, urlRegex)

        if (videoId != null) {
            repo.addDebugLog("VIDEO_ID_FOUND: $videoId")
        } else {
            repo.addDebugLog("VIDEO_ID_NOT_FOUND")
        }

        return videoId
    }


    private fun searchVideoId(
        node: AccessibilityNodeInfo,
        regex: Regex
    ): String? {

        val values = listOfNotNull(
            node.text?.toString(),
            node.contentDescription?.toString(),
            node.viewIdResourceName
        )

        for (value in values) {
            val match = regex.find(value)

            if (match != null) {
                val videoId = match.groupValues.getOrNull(1)

                if (
                    !videoId.isNullOrBlank() &&
                    YouTubeValidator.isValidVideoId(videoId)
                ) {
                    return videoId
                }
            }
        }

        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue

            val foundVideoId = searchVideoId(
                node = child,
                regex = regex
            )

            if (foundVideoId != null) {
                return foundVideoId
            }
        }

        return null
    }

}
