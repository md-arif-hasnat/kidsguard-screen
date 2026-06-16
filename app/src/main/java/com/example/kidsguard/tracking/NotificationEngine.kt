package com.example.kidsguard.tracking

/**
 * Interface for the tracking notification engine.
 * Future integration point for local and push notifications.
 */
interface NotificationEngine {
    /**
     * Sends a notification to the parent.
     * TODO: Implement local notification and Firebase Cloud Messaging (FCM) hooks.
     */
    fun sendSafetyAlert(title: String, body: String)
}
