package com.example.kidsguard.ai

import java.util.UUID

data class DailySummary(
    val id: String = UUID.randomUUID().toString(),
    val date: Long, // Start of day timestamp
    val childId: String,
    val totalDistanceMeters: Double,
    val totalTimeAtHomeMinutes: Int,
    val totalTimeAtSchoolMinutes: Int,
    val totalTimeAtPlaygroundMinutes: Int,
    val totalTrackingMinutes: Int,
    val totalLockMinutes: Int,
    val totalUnlockAttempts: Int,
    val totalSafeZoneEvents: Int,
    val totalSosEvents: Int,
    val lowestBatteryPercent: Int,
    val highestSpeed: Float,
    val summaryText: String,
    val safetyScore: Int, // 0 to 100
    val generatedAt: Long = System.currentTimeMillis()
)

interface AiSummaryProvider {
    suspend fun generateSummary(data: DailySummaryInput): String
    suspend fun calculateSafetyScore(data: DailySummaryInput): Int
}

data class DailySummaryInput(
    val childId: String,
    val events: List<com.example.kidsguard.models.ActivityEvent>,
    val locations: List<com.example.kidsguard.models.LocationPoint>,
    val routes: List<com.example.kidsguard.models.RouteSession>,
    val sosEvents: List<com.example.kidsguard.models.SosEvent>
)
