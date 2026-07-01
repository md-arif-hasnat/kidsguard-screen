package com.example.kidsguard.ai

import androidx.annotation.Keep
import java.util.UUID

@Keep
data class DailySummary(
    val id: String = UUID.randomUUID().toString(),
    val date: Long = 0L, // Start of day timestamp
    val childId: String = "",
    val totalDistanceMeters: Double = 0.0,
    val totalTimeAtHomeMinutes: Int = 0,
    val totalTimeAtSchoolMinutes: Int = 0,
    val totalTimeAtPlaygroundMinutes: Int = 0,
    val totalTrackingMinutes: Int = 0,
    val totalLockMinutes: Int = 0,
    val totalUnlockAttempts: Int = 0,
    val totalSafeZoneEvents: Int = 0,
    val totalSosEvents: Int = 0,
    val lowestBatteryPercent: Int = 0,
    val highestSpeed: Float = 0f,
    val summaryText: String = "",
    val safetyScore: Int = 0, // 0 to 100
    val generatedAt: Long = System.currentTimeMillis()
)

@Keep
data class DailySummaryInput(
    val childId: String = "",
    val events: List<com.example.kidsguard.models.ActivityEvent> = emptyList(),
    val locations: List<com.example.kidsguard.models.LocationPoint> = emptyList(),
    val routes: List<com.example.kidsguard.models.RouteSession> = emptyList(),
    val sosEvents: List<com.example.kidsguard.models.SosEvent> = emptyList()
)
