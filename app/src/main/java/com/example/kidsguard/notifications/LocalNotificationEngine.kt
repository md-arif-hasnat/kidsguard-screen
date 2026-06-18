package com.example.kidsguard.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.example.kidsguard.tracking.NotificationEngine

class LocalNotificationEngine(
    private val context: Context,
    private val errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository? = null
) : NotificationEngine {

    companion object {
        const val CHANNEL_ID = "kidsguard_safety_alerts"
        const val CHANNEL_NAME = "KidsGuard Safety Alerts"
    }

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = "Urgent safety alerts for KidsGuard"
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun sendSafetyAlert(title: String, body: String) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            notificationManager.notify(System.currentTimeMillis().toInt(), notification)
        } catch (e: Exception) {
            errorLogRepository?.addError("NotificationEngine", "Failed to send alert: $title", e)
        }
    }
}
