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
        Log.d("FCMService", "Message received: ${message.notification?.title}")
        
        // Handle incoming data messages or standard notifications
        // Parent app would show the notification here if it's in foreground
    }
}
