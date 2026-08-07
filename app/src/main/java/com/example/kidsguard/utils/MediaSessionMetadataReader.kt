package com.example.kidsguard.utils

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.util.Log
import com.example.kidsguard.models.MediaSessionSnapshot
import com.example.kidsguard.notification.KidsGuardNotificationListener

object MediaSessionMetadataReader {

    private const val YOUTUBE_PACKAGE = "com.google.android.youtube"

    private val YOUTUBE_VIDEO_ID_REGEX =
        Regex("""(?:v=|youtu\.be/|shorts/|embed/)?([A-Za-z0-9_-]{11})""")

    private fun extractVideoId(metadata: MediaMetadata): String? {
        val description = metadata.description

        val candidates = mutableListOf<String>()

        description.mediaId?.let { candidates.add(it) }
        description.mediaUri?.toString()?.let { candidates.add(it) }

        description.extras?.keySet()?.forEach { key ->
            description.extras?.get(key)?.toString()?.let { value ->
                candidates.add(value)
            }
        }

        metadata.keySet().forEach { key ->
            runCatching {
                metadata.getString(key)
            }.getOrNull()?.let { value ->
                candidates.add(value)
            }
        }

        return candidates
            .asSequence()
            .mapNotNull { value ->
                val cleanValue = value.trim()

                when {
                    cleanValue.matches(Regex("""^[A-Za-z0-9_-]{11}$""")) -> cleanValue

                    else -> YOUTUBE_VIDEO_ID_REGEX
                        .find(cleanValue)
                        ?.groupValues
                        ?.getOrNull(1)
                }
            }
            .firstOrNull()
    }

    private fun extractYouTubeVideoId(value: String?): String? {
        if (value.isNullOrBlank()) return null

        val patterns = listOf(
            Regex("""(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})"""),
            Regex("""^[A-Za-z0-9_-]{11}$""")
        )

        return patterns.firstNotNullOfOrNull { pattern ->
            pattern.find(value.trim())?.groupValues?.getOrNull(1)
                ?: pattern.find(value.trim())?.value
                    ?.takeIf { it.length == 11 }
        }
    }

    fun readYouTubeSession(
        context: Context,
        debugLog: ((String) -> Unit)? = null
    ): MediaSessionSnapshot? {

        val manager = context.getSystemService(
            Context.MEDIA_SESSION_SERVICE
        ) as MediaSessionManager

        val listenerComponent = ComponentName(
            context,
            KidsGuardNotificationListener::class.java
        )

        val controllers: List<MediaController> = try {
            manager.getActiveSessions(listenerComponent)
        } catch (securityException: SecurityException) {
            android.util.Log.e(
                "KG_MEDIA_SESSION",
                "SECURITY_EXCEPTION: notification listener access missing",
                securityException
            )
            return null
        }

        android.util.Log.d(
            "KG_MEDIA_SESSION",
            "ACTIVE_SESSIONS count=${controllers.size} " +
                    "packages=${controllers.joinToString { it.packageName }}"
        )

        val youtubeController = controllers.firstOrNull {
            it.packageName == YOUTUBE_PACKAGE
        }

        if (youtubeController == null) {
            android.util.Log.d(
                "KG_MEDIA_SESSION",
                "YOUTUBE_CONTROLLER_NOT_FOUND"
            )

            debugLog?.invoke(
                "MEDIA_CONTROLLER_NOT_FOUND controllers=${controllers.map { it.packageName }}"
            )

            return null
        }

        val metadata = youtubeController.metadata

        if (metadata == null) {
            android.util.Log.d(
                "KG_MEDIA_SESSION",
                "YOUTUBE_METADATA_NULL playbackState=${youtubeController.playbackState?.state}"
            )
            debugLog?.invoke(
                "MEDIA_METADATA_NULL playbackState=${youtubeController.playbackState?.state}"
            )
            return null
        }
        val playbackState = youtubeController.playbackState

        val metadataValues = metadata.keySet()
            .joinToString(" | ") { key ->
                "$key=${runCatching { metadata.getString(key) }.getOrNull()}"
            }
        val detectedVideoId = metadata.keySet()
            .firstNotNullOfOrNull { key ->
                extractYouTubeVideoId(
                    runCatching { metadata.getString(key) }.getOrNull()
                )
            }

        debugLog?.invoke("MEDIA_DETECTED_VIDEO_ID=$detectedVideoId")

        val playbackExtras = playbackState?.extras
            ?.keySet()
            ?.joinToString(" | ") { key ->
                "$key=${playbackState.extras?.get(key)}"
            } ?: "none"

        val queueValues = youtubeController.queue?.joinToString(" || ") { item ->
            "queueId=${item.queueId}, " +
                    "mediaId=${item.description.mediaId}, " +
                    "mediaUri=${item.description.mediaUri}, " +
                    "title=${item.description.title}"
        }
        Log.d("KG_MEDIA_SOURCE", "METADATA_KEYS: $metadataValues")
        Log.d("KG_MEDIA_SOURCE", "PLAYBACK_EXTRAS: $playbackExtras")
        Log.d("KG_MEDIA_SOURCE", "QUEUE_ITEMS: $queueValues")
        debugLog?.invoke("MEDIA_METADATA_KEYS: $metadataValues")
        debugLog?.invoke("MEDIA_PLAYBACK_EXTRAS: $playbackExtras")
        debugLog?.invoke("MEDIA_QUEUE_ITEMS: $queueValues")




        Log.d("KG_MEDIA_SOURCE", "METADATA_KEYS: $metadataValues")
        Log.d("KG_MEDIA_SOURCE", "PLAYBACK_EXTRAS: $playbackExtras")
        Log.d("KG_MEDIA_SOURCE", "QUEUE_ITEMS: $queueValues")
        android.util.Log.d(
            "KG_MEDIA_RAW",
            "title=${metadata.getString(MediaMetadata.METADATA_KEY_TITLE)} | " +
                    "artist=${metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)} | " +
                    "mediaId=${metadata.description?.mediaId} | " +
                    "mediaUri=${metadata.description?.mediaUri} | " +
                    "iconUri=${metadata.description?.iconUri} | " +
                    "duration=${metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)}"
        )

        val extractedVideoId = extractVideoId(metadata)

        android.util.Log.d(
            "KG_MEDIA_RAW",
            "extractedVideoId=$extractedVideoId"
        )
        return MediaSessionSnapshot(
            packageName = youtubeController.packageName,

            title = metadata.getString(
                MediaMetadata.METADATA_KEY_TITLE
            ) ?: metadata.description?.title?.toString(),

            artist = metadata.getString(
                MediaMetadata.METADATA_KEY_ARTIST
            ) ?: metadata.description?.subtitle?.toString(),

            album = metadata.getString(
                MediaMetadata.METADATA_KEY_ALBUM
            ),

            mediaId = extractedVideoId
                ?: metadata.description?.mediaId,

            mediaUri = metadata.description
                ?.mediaUri
                ?.toString(),

            artworkUri = metadata.description
                ?.iconUri
                ?.toString(),

            durationMs = metadata.getLong(
                MediaMetadata.METADATA_KEY_DURATION
            ).takeIf { it > 0L },

            playbackState = youtubeController.playbackState?.state
        )
    }
}