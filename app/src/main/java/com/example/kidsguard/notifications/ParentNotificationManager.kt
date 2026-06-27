package com.example.kidsguard.notifications

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await

class ParentNotificationManager(private val context: Context) {
    private val db = FirebaseFirestore.getInstance()
    private val prefs = PreferenceHelper(context)
    private val TAG = "ParentNotificationMgr"

    suspend fun registerParentDevice() {
        val uid = prefs.firebaseUid ?: return
        if (prefs.userRole != "PARENT") return

        try {
            val token = FirebaseMessaging.getInstance().token.await()
            val deviceId = prefs.deviceId
            
            val deviceData = mapOf(
                "deviceId" to deviceId,
                "token" to token,
                "platform" to "Android",
                "deviceName" to prefs.deviceName,
                "lastSeen" to Timestamp.now(),
                "appVersion" to "1.0.0"
            )

            db.collection(FirebaseConfig.COL_PARENTS)
                .document(uid)
                .collection(FirebaseConfig.COL_DEVICES)
                .document(deviceId)
                .set(deviceData, com.google.firebase.firestore.SetOptions.merge())
                .await()

            Log.i(TAG, "Parent device registered for notifications")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register parent device", e)
        }
    }
}
