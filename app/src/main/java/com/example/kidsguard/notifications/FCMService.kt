package com.example.kidsguard.notifications

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FCMService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCMService", "New FCM Token: $token")
        
        val prefs = PreferenceHelper(applicationContext)
        val uid = prefs.firebaseUid
        if (uid != null) {
            val syncProvider = FirebaseRemoteSyncProvider(applicationContext)
            syncProvider.registerFcmToken(uid, token, prefs.userRole)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "KidsGuard"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: return
        val type = message.data["type"]

        Log.d("FCMService", "Message received: $title type=$type")

        // Android displays notification payloads itself while the app is in
        // the background. When the parent app is foregrounded, render the
        // new-install alert locally so it is not silently lost.
        val prefs = PreferenceHelper(applicationContext)
        val foregroundTypes = setOf(
            "APP_INSTALLED",
            "APP_LIMIT_REACHED",
            "BLOCKED_APP_ATTEMPT",
            "PERMISSION_CHANGE_REQUEST"
        )
        if (prefs.userRole == "PARENT" && type in foregroundTypes) {
            if (type == "PERMISSION_CHANGE_REQUEST") {
                showPermissionRequestNotification(message, title, body)
            } else {
                LocalNotificationEngine(applicationContext)
                    .sendSafetyAlert(title, body)
            }
        }
    }

    private fun showPermissionRequestNotification(
        message: RemoteMessage,
        title: String,
        body: String
    ) {
        LocalNotificationEngine(applicationContext)

        val childId = message.data["childId"].orEmpty()
        val requestId = message.data["eventId"].orEmpty()
        val targetUrl =
            "https://kidsguard-screen.vercel.app/dashboard/" +
                Uri.encode(childId) +
                "?tab=overview&permissionRequest=" +
                Uri.encode(requestId) +
                "#permission-approvals"

        val browserIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse(targetUrl)
        )
        val pendingIntent = PendingIntent.getActivity(
            this,
            requestId.hashCode(),
            browserIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(
            this,
            LocalNotificationEngine.CHANNEL_ID
        )
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(this).notify(
            requestId.hashCode(),
            notification
        )
    }
}
