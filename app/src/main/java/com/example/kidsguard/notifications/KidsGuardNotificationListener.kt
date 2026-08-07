package com.example.kidsguard.notification

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.example.kidsguard.repository.YouTubeHistoryRepository
import com.example.kidsguard.utils.MediaSessionMetadataReader

class KidsGuardNotificationListener : NotificationListenerService() {

    private val youtubeRepository by lazy {
        YouTubeHistoryRepository.getInstance(applicationContext)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        //MediaSessionMetadataReader.refresh(applicationContext)

        Log.d(
            "KidsGuardMediaSession", "on_Listener_Connected"
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)

        if (sbn?.packageName != "com.google.android.youtube") return

        val snapshot =
            MediaSessionMetadataReader.readYouTubeSession(
                context = applicationContext,
                debugLog = { message ->
                    youtubeRepository.addDebugLog(message)
                }
            )

        if (snapshot == null) {
            Log.d(
                "KidsGuardMediaSession",
                "MEDIA_SESSION_NOT_FOUND"
            )
            youtubeRepository.addDebugLog(
                "MEDIA_SESSION_NOT_FOUND"
            )
            return
        }

        Log.d(
            "KidsGuardMediaSession",
            """
                    MEDIA_SESSION_FOUND
                    package=${snapshot.packageName}
                    title=${snapshot.title}
                    artist=${snapshot.artist}
                    album=${snapshot.album}
                    mediaId=${snapshot.mediaId}
                    mediaUri=${snapshot.mediaUri}
                    artworkUri=${snapshot.artworkUri}
                    durationMs=${snapshot.durationMs}
                    playbackState=${snapshot.playbackState}
                    """.trimIndent()
        )

        youtubeRepository.addDebugLog(
            "MEDIA_SESSION_FOUND " +
                    "package=${snapshot.packageName} " +
                    "title=${snapshot.title} " +
                    "artist=${snapshot.artist} " +
                    "album=${snapshot.album} " +
                    "mediaId=${snapshot.mediaId} " +
                    "mediaUri=${snapshot.mediaUri} " +
                    "artworkUri=${snapshot.artworkUri} " +
                    "durationMs=${snapshot.durationMs} " +
                    "playbackState=${snapshot.playbackState}"
        )
    }


    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
    }
}
