package com.example.kidsguard.youtube

data class YouTubeResolveRequest(
    val title: String,
    val channel: String? = null,
    val durationMs: Long? = null,
    val mediaId: String? = null,
    val mediaUri: String? = null
)

data class ResolvedYouTubeVideo(
    val videoId: String,
    val youtubeUrl: String,
    val thumbnailUrl: String,
    val source: String,
    val confidence: Float
)

object YouTubeVideoResolver {

    private val VIDEO_ID_REGEX =
        Regex("""^[A-Za-z0-9_-]{11}$""")

    private val YOUTUBE_URL_REGEX =
        Regex(
            """(?:youtube\.com/watch\?(?:[^#\s]*&)?v=|youtu\.be/|youtube\.com/shorts/)([A-Za-z0-9_-]{11})""",
            RegexOption.IGNORE_CASE
        )

    // নিশ্চিত (high-confidence) accept threshold
    private const val MIN_CONFIDENCE_WITH_CHANNEL = 0.60f
    private const val MIN_CONFIDENCE_NO_CHANNEL = 0.75f

    // low-confidence "best guess" fallback threshold — এর নিচে হলে কিছুই দেওয়া হবে না
    private const val MIN_GUESS_CONFIDENCE = 0.30f

    // channel থাকলে, একদম অমিল চ্যানেল হলে reject করার threshold
    private const val CHANNEL_MISMATCH_REJECT_THRESHOLD = 0.15f

    const val SOURCE_SEARCH_API = "YOUTUBE_SEARCH_API"
    const val SOURCE_LOW_CONFIDENCE_GUESS = "LOW_CONFIDENCE_GUESS"

    fun buildRequest(
        title: String?,
        channel: String?,
        durationMs: Long?,
        mediaId: String?,
        mediaUri: String?
    ): YouTubeResolveRequest? {

        val cleanTitle = title
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: return null

        return YouTubeResolveRequest(
            title = cleanTitle,
            channel = channel
                ?.trim()
                ?.takeIf { it.isNotBlank() },

            durationMs = durationMs
                ?.takeIf { it > 0L },

            mediaId = mediaId
                ?.trim()
                ?.takeIf { it.isNotBlank() },

            mediaUri = mediaUri
                ?.trim()
                ?.takeIf { it.isNotBlank() }
        )
    }

    fun resolveDirect(
        request: YouTubeResolveRequest
    ): ResolvedYouTubeVideo? {

        extractVideoId(request.mediaUri)?.let { videoId ->
            return buildResolvedVideo(
                videoId = videoId,
                source = "MEDIA_URI",
                confidence = 1.0f
            )
        }

        extractVideoId(request.mediaId)?.let { videoId ->
            return buildResolvedVideo(
                videoId = videoId,
                source = "MEDIA_ID",
                confidence = 0.95f
            )
        }

        extractVideoId(request.title)?.let { videoId ->
            return buildResolvedVideo(
                videoId = videoId,
                source = "TITLE",
                confidence = 0.60f
            )
        }

        return null
    }

    /**
     * Search API ফলাফল থেকে video resolve করে।
     *
     * দুই স্তরের confidence:
     *  - >= MIN_CONFIDENCE_*  → নিশ্চিত (SOURCE_SEARCH_API), channel mismatch হলে reject
     *  - >= MIN_GUESS_CONFIDENCE কিন্তু নিশ্চিত থ্রেশহোল্ডের নিচে → best-guess
     *    (SOURCE_LOW_CONFIDENCE_GUESS) — videoId/URL/thumbnail তবুও দেওয়া হয়,
     *    কিন্তু caller চাইলে source দেখে আলাদা treat করতে পারবে
     *  - তার নিচে → null (কিছুই না)
     */
    fun resolveFromSearch(
        request: YouTubeResolveRequest,
        response: YouTubeSearchResponse
    ): ResolvedYouTubeVideo? {

        val bestMatch = response.items
            .mapNotNull { item ->
                val videoId = item.id?.videoId
                    ?.takeIf { VIDEO_ID_REGEX.matches(it) }
                    ?: return@mapNotNull null

                val resultTitle = item.snippet?.title.orEmpty()
                val resultChannel = item.snippet?.channelTitle.orEmpty()

                val titleScore = calculateSimilarity(
                    first = request.title,
                    second = resultTitle
                )

                val channelScore = if (request.channel.isNullOrBlank()) {
                    0f
                } else {
                    calculateSimilarity(
                        first = request.channel,
                        second = resultChannel
                    )
                }

                val totalScore = if (request.channel.isNullOrBlank()) {
                    titleScore
                } else {
                    (titleScore * 0.80f) + (channelScore * 0.20f)
                }

                Triple(videoId, totalScore, item)
            }
            .maxByOrNull { it.second }
            ?: return null

        val videoId = bestMatch.first
        val confidence = bestMatch.second
        val hasChannel = !request.channel.isNullOrBlank()
        val minConfidence =
            if (hasChannel) MIN_CONFIDENCE_WITH_CHANNEL else MIN_CONFIDENCE_NO_CHANNEL

        val finalSource: String
        val finalConfidence: Float

        when {
            confidence >= minConfidence -> {
                // hard channel-mismatch reject — score threshold পার হলেও
                // channel সম্পূর্ণ অমিল হলে ভুল ভিডিও accept করব না
                if (hasChannel) {
                    val channelScore = calculateSimilarity(
                        request.channel!!,
                        bestMatch.third.snippet?.channelTitle.orEmpty()
                    )
                    if (channelScore < CHANNEL_MISMATCH_REJECT_THRESHOLD) {
                        return null
                    }
                }
                finalSource = SOURCE_SEARCH_API
                finalConfidence = confidence
            }

            confidence >= MIN_GUESS_CONFIDENCE -> {
                finalSource = SOURCE_LOW_CONFIDENCE_GUESS
                finalConfidence = confidence
            }

            else -> return null
        }

        return ResolvedYouTubeVideo(
            videoId = videoId,
            youtubeUrl = buildYouTubeUrl(videoId),
            thumbnailUrl = bestMatch.third.snippet
                ?.thumbnails
                ?.high
                ?.url
                ?: bestMatch.third.snippet
                    ?.thumbnails
                    ?.medium
                    ?.url
                ?: buildThumbnailUrl(videoId),
            source = finalSource,
            confidence = finalConfidence
        )
    }

    private fun calculateSimilarity(
        first: String,
        second: String
    ): Float {

        val firstWords = normalizeWords(first)
        val secondWords = normalizeWords(second)

        if (firstWords.isEmpty() || secondWords.isEmpty()) {
            return 0f
        }

        val commonWords = firstWords.intersect(secondWords).size
        val largestSize = maxOf(firstWords.size, secondWords.size)

        return commonWords.toFloat() / largestSize.toFloat()
    }

    private fun normalizeWords(
        value: String
    ): Set<String> {

        return value
            .lowercase()
            .replace(Regex("""[^a-z0-9\u0980-\u09FF]+"""), " ")
            .trim()
            .split(Regex("""\s+"""))
            .filter { it.length >= 2 }
            .toSet()
    }

    fun extractVideoId(
        value: String?
    ): String? {

        val cleanValue = value
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: return null

        if (VIDEO_ID_REGEX.matches(cleanValue)) {
            return cleanValue
        }

        return YOUTUBE_URL_REGEX
            .find(cleanValue)
            ?.groupValues
            ?.getOrNull(1)
            ?.takeIf { VIDEO_ID_REGEX.matches(it) }
    }

    fun buildYouTubeUrl(
        videoId: String
    ): String {
        return "https://www.youtube.com/watch?v=$videoId"
    }

    fun buildThumbnailUrl(
        videoId: String
    ): String {
        return "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"
    }

    /**
     * exact videoId resolve করা যায়নি এমন ক্ষেত্রে ব্যবহারের জন্য —
     * এটা কোনো নির্দিষ্ট ভিডিওর লিংক না, বরং title+channel দিয়ে
     * YouTube search result page এর URL, যাতে অন্তত একটা clickable
     * লিংক থাকে "কিছুই নেই" এর বদলে।
     */
    fun buildSearchFallbackUrl(title: String, channel: String?): String {
        val query = buildString {
            append(title)
            channel?.takeIf { it.isNotBlank() }?.let {
                append(" ")
                append(it)
            }
        }
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        return "https://www.youtube.com/results?search_query=$encoded"
    }

    private fun buildResolvedVideo(
        videoId: String,
        source: String,
        confidence: Float
    ): ResolvedYouTubeVideo {

        return ResolvedYouTubeVideo(
            videoId = videoId,
            youtubeUrl = buildYouTubeUrl(videoId),
            thumbnailUrl = buildThumbnailUrl(videoId),
            source = source,
            confidence = confidence
        )
    }
}