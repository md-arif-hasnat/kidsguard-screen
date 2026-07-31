package com.example.kidsguard.utils

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import com.example.kidsguard.models.MediaSessionSnapshot
import com.example.kidsguard.notification.KidsGuardNotificationListener

object MediaSessionMetadataReader {

    private const val YOUTUBE_PACKAGE = "com.google.android.youtube"

    fun readYouTubeSession(context: Context): MediaSessionSnapshot? {
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
            return null
        }

        val youtubeController = controllers.firstOrNull {
            it.packageName == YOUTUBE_PACKAGE
        } ?: return null

        val metadata = youtubeController.metadata ?: return null
        android.util.Log.d(
            "KG_MEDIA_RAW",
            "title=${metadata.getString(MediaMetadata.METADATA_KEY_TITLE)} | " +
                    "artist=${metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)} | " +
                    "mediaId=${metadata.description?.mediaId} | " +
                    "mediaUri=${metadata.description?.mediaUri} | " +
                    "iconUri=${metadata.description?.iconUri} | " +
                    "duration=${metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)}"
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

            mediaId = metadata.description?.mediaId,

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