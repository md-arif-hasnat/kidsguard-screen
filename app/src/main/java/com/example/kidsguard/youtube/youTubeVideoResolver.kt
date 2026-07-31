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

        return null
    }

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

        if (confidence < 0.55f) {
            return null
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

            source = "YOUTUBE_SEARCH_API",
            confidence = confidence
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