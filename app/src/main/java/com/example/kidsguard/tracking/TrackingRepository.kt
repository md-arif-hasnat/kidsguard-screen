package com.example.kidsguard.tracking

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class TrackingRepository(context: Context) {
    private val prefs = context.getSharedPreferences("tracking_prefs", Context.MODE_PRIVATE)
    
    private val _currentConfig = MutableStateFlow(loadConfig())
    val currentConfig: StateFlow<TrackingConfig> = _currentConfig

    private val _currentState = MutableStateFlow(TrackingState.STOPPED)
    val currentState: StateFlow<TrackingState> = _currentState

    fun enableTracking() {
        val newConfig = _currentConfig.value.copy(trackingEnabled = true)
        saveTrackingConfig(newConfig)
    }

    fun disableTracking() {
        val newConfig = _currentConfig.value.copy(trackingEnabled = false)
        saveTrackingConfig(newConfig)
    }

    fun saveTrackingConfig(config: TrackingConfig) {
        prefs.edit().apply {
            putBoolean("enabled", config.trackingEnabled)
            putBoolean("save_history", config.saveHistory)
            putLong("interval", config.updateIntervalSeconds)
            putBoolean("high_accuracy", config.highAccuracyEnabled)
            putBoolean("battery_optimized", config.batteryOptimized)
            apply()
        }
        _currentConfig.value = config
    }

    fun loadTrackingConfig(): TrackingConfig = loadConfig()

    private fun loadConfig(): TrackingConfig {
        return TrackingConfig(
            trackingEnabled = prefs.getBoolean("enabled", false),
            saveHistory = prefs.getBoolean("save_history", true),
            updateIntervalSeconds = prefs.getLong("interval", 60),
            highAccuracyEnabled = prefs.getBoolean("high_accuracy", true),
            batteryOptimized = prefs.getBoolean("battery_optimized", true)
        )
    }

    fun updateState(state: TrackingState) {
        _currentState.value = state
    }

    fun getTrackingState(): TrackingState = _currentState.value
}
