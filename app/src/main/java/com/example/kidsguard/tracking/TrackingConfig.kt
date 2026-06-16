package com.example.kidsguard.tracking

data class TrackingConfig(
    val trackingEnabled: Boolean = false,
    val updateIntervalSeconds: Long = 60,
    val saveHistory: Boolean = true,
    val batteryOptimized: Boolean = true
)
