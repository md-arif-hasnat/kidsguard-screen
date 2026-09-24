package com.example.kidsguard.notifications

import android.util.Log
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
        if (prefs.userRole == "PARENT" && type == "APP_INSTALLED") {
            LocalNotificationEngine(applicationContext)
                .sendSafetyAlert(title, body)
        }
    }
}
