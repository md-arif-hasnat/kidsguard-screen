package com.example.kidsguard.tracking

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class BackgroundTrackingManager(
    private val scheduler: TrackingScheduler,
    private val repository: TrackingRepository
) {
    private val _trackingState = MutableStateFlow(TrackingState.STOPPED)
    val trackingState: StateFlow<TrackingState> = _trackingState

    private val _isTrackingEnabled = MutableStateFlow(false)
    val isTrackingEnabled: StateFlow<Boolean> = _isTrackingEnabled

    fun initialize() {
        // TODO: Load initial config from repository and setup scheduler
        val config = repository.loadTrackingConfig()
        _isTrackingEnabled.value = config.trackingEnabled
    }

    fun startTracking() {
        _trackingState.value = TrackingState.STARTING
        repository.enableTracking()
        scheduler.start()
        _trackingState.value = TrackingState.RUNNING
        _isTrackingEnabled.value = true
    }

    fun stopTracking() {
        repository.disableTracking()
        scheduler.stop()
        _trackingState.value = TrackingState.STOPPED
        _isTrackingEnabled.value = false
    }

    fun pauseTracking() {
        scheduler.pause()
        _trackingState.value = TrackingState.PAUSED
    }

    fun resumeTracking() {
        scheduler.resume()
        _trackingState.value = TrackingState.RUNNING
    }

    fun trackingState(): TrackingState = _trackingState.value

    fun trackingEnabled(): Boolean = _isTrackingEnabled.value
}
