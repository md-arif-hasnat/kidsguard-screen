package com.example.kidsguard.notification

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
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

        if (!PreferenceHelper(applicationContext)
                .notificationAccessDisclosureAccepted
        ) {
            return
        }

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

        // Do not emit video titles, identifiers or media URIs into diagnostics.
        // The monitored YouTube history is managed by its dedicated repository.
        Log.d("KidsGuardMediaSession", "MEDIA_SESSION_FOUND")

    }


    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
    }
}
