package com.example.kidsguard.location

import android.content.Context
import com.example.kidsguard.repository.LocationRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class BackgroundTrackingManager(
    private val context: Context,
    private val repository: LocationRepository
) {
    private val _isTrackingEnabled = MutableStateFlow(false)
    val isTrackingEnabled: StateFlow<Boolean> = _isTrackingEnabled

    private val _updateIntervalMs = MutableStateFlow(60000L) // Default 1 minute
    val updateIntervalMs: StateFlow<Long> = _updateIntervalMs

    private val _trackingState = MutableStateFlow("IDLE") // IDLE, TRACKING, ERROR
    val trackingState: StateFlow<String> = _trackingState

    fun enableTracking(enabled: Boolean) {
        _isTrackingEnabled.value = enabled
        if (enabled) {
            _trackingState.value = "TRACKING"
            repository.startTracking()
        } else {
            _trackingState.value = "IDLE"
            repository.stopTracking()
        }
    }

    fun setUpdateInterval(intervalMs: Long) {
        _updateIntervalMs.value = intervalMs
    }

    // Architecture ready for future Service implementation
    fun startBackgroundService() {
        // Will start Android Foreground Service
    }

    fun stopBackgroundService() {
        // Will stop Android Foreground Service
    }
}
