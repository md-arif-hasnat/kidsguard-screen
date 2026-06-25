package com.example.kidsguard.prediction

import com.example.kidsguard.sync.SyncSafetySummary
import com.example.kidsguard.sync.SyncWeeklyReport

class WeeklyReportGenerator {
    fun generateWeeklyReport(summaries: List<SyncSafetySummary>): SyncWeeklyReport {
        if (summaries.isEmpty()) {
            return SyncWeeklyReport(
                weekStartDate = "",
                averageSafetyScore = 0,
                totalDistanceKm = 0.0,
                totalAlerts = 0,
                topVisitedZones = emptyList(),
                safetyTrend = "Stable",
                recommendations = listOf("No data available for this week.")
            )
        }

        val avgScore = summaries.map { it.safetyScore }.average().toInt()
        val totalDist = summaries.sumOf { it.totalDistanceKm }
        val totalAlerts = summaries.sumOf { it.alertCount }
        
        val zoneCounts = mutableMapOf<String, Int>()
        summaries.forEach { summary ->
            summary.visitedZones.forEach { zone ->
                zoneCounts[zone] = zoneCounts.getOrDefault(zone, 0) + 1
            }
        }
        val topZones = zoneCounts.entries.sortedByDescending { it.value }.take(3).map { it.key }

        val trend = when {
            summaries.size >= 2 && summaries.first().safetyScore > summaries.last().safetyScore -> "Improving"
            summaries.size >= 2 && summaries.first().safetyScore < summaries.last().safetyScore -> "Declining"
            else -> "Stable"
        }

        val recommendations = mutableListOf<String>()
        if (avgScore < 80) recommendations.add("Consider reviewing safe zone boundaries.")
        if (totalAlerts > 5) recommendations.add("Frequent deviations detected this week.")
        if (recommendations.isEmpty()) recommendations.add("Keep up the great safety habits!")

        return SyncWeeklyReport(
            weekStartDate = summaries.lastOrNull()?.date ?: "",
            averageSafetyScore = avgScore,
            totalDistanceKm = totalDist,
            totalAlerts = totalAlerts,
            topVisitedZones = topZones,
            safetyTrend = trend,
            recommendations = recommendations
        )
    }
}
