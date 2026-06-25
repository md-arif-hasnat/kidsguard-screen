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

    fun triggerSiren() {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // In a real app, we would play a custom media file. 
            // Here we use the default alarm/ringtone for the notification.
            val sirenNotification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("🚨 EMERGENCY SIREN")
                .setContentText("A parent has triggered the emergency siren on this device.")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(null, true)
                .setOngoing(true)
                .setVibrate(longArrayOf(0, 1000, 500, 1000))
                .build()

            notificationManager.notify(911, sirenNotification)
            
            // Start playing alarm sound
            val ringtoneUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
            val ringtone = android.media.RingtoneManager.getRingtone(context, ringtoneUri)
            ringtone?.play()
            
            // Stop sound after 30 seconds
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                ringtone?.stop()
                notificationManager.cancel(911)
            }, 30000)
            
        } catch (e: Exception) {
            errorLogRepository?.addError("NotificationEngine", "Failed to trigger siren", e)
        }
    }
}
