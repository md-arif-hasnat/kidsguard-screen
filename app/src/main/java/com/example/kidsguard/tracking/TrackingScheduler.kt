package com.example.kidsguard.tracking

import android.content.Context
import android.content.Intent
import android.os.Build

interface TrackingScheduler {
    fun start()
    fun stop()
    fun pause()
    fun resume()
    fun setInterval(seconds: Long)
    fun getState(): TrackingState
}

class LocalTrackingScheduler(private val context: Context) : TrackingScheduler {
    override fun start() {
        val intent = Intent(context, BackgroundTrackingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    override fun stop() {
        val intent = Intent(context, BackgroundTrackingService::class.java)
        context.stopService(intent)
    }

    override fun pause() {
        // For now, stop is enough, or we could implement a custom action
        stop()
    }

    override fun resume() {
        start()
    }

    override fun setInterval(seconds: Long) {
        // To update interval, we might need to restart the service or send an intent
        // For now, let's just restart if it was running
    }

    override fun getState(): TrackingState {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        for (service in manager.getRunningServices(Int.MAX_VALUE)) {
            if (BackgroundTrackingService::class.java.name == service.service.className) {
                return TrackingState.RUNNING
            }
        }
        return TrackingState.STOPPED
    }
}
