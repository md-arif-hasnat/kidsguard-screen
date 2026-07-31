package com.example.kidsguard.utils

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import com.example.kidsguard.notification.KidsGuardNotificationListener

object NotificationAccessHelper {

    fun isEnabled(context: Context): Boolean {
        val enabledListeners =
            Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            ) ?: return false

        val component = ComponentName(
            context,
            KidsGuardNotificationListener::class.java
        )

        return enabledListeners
            .split(":")
            .any { it.equals(component.flattenToString(), ignoreCase = true) }
    }
}
