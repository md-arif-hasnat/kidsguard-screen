package com.example.kidsguard.tracking

data class TrackingConfig(
    val trackingEnabled: Boolean = false,
    val saveHistory: Boolean = true,
    val updateIntervalSeconds: Long = 60,
    val highAccuracyEnabled: Boolean = true,
    val batteryOptimized: Boolean = true
)
