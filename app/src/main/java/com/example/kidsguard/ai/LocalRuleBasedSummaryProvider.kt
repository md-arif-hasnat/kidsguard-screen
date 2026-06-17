package com.example.kidsguard.ai

class LocalRuleBasedSummaryProvider : AiSummaryProvider {
    override suspend fun generateSummary(data: DailySummaryInput): String {
        val sb = StringBuilder()
        
        val eventsCount = data.events.size
        val distanceKm = data.routes.sumOf { it.totalDistanceMeters } / 1000.0
        val sosCount = data.sosEvents.size
        
        sb.append("Today's activity report for child ${data.childId}. ")
        
        if (sosCount > 0) {
            sb.append("URGENT: $sosCount SOS events were triggered today. Please review the safety history immediately. ")
        }
        
        if (eventsCount > 0) {
            sb.append("A total of $eventsCount safety events were recorded. ")
        } else {
            sb.append("No significant safety events recorded today. ")
        }
        
        if (distanceKm > 0) {
            sb.append("Total distance traveled was ${"%.1f".format(distanceKm)} km across ${data.routes.size} routes. ")
        }
        
        val schoolTime = data.events.count { it.title.contains("School", ignoreCase = true) }
        if (schoolTime > 0) {
            sb.append("Activity detected near school area. ")
        }
        
        val unlockAttempts = data.events.count { it.type == "PIN_FAILED" }
        if (unlockAttempts > 3) {
            sb.append("Multiple failed unlock attempts ($unlockAttempts) detected. ")
        }
        
        if (sb.isEmpty()) {
            return "No data available to generate summary for today."
        }
        
        return sb.toString().trim()
    }

    override suspend fun calculateSafetyScore(data: DailySummaryInput): Int {
        var score = 100
        
        // Deduct for SOS
        if (data.sosEvents.isNotEmpty()) {
            score -= (data.sosEvents.size * 25)
        }
        
        // Deduct for failed unlock attempts
        val failedPinCount = data.events.count { it.type == "PIN_FAILED" }
        if (failedPinCount > 0) {
            score -= (failedPinCount * 5)
        }
        
        // Deduct for high speed (if > 50km/h and not in a vehicle - but we just simple mock for now)
        val highSpeed = data.locations.any { it.speed > 15 } // ~54 km/h
        if (highSpeed) {
            score -= 10
        }
        
        return score.coerceIn(0, 100)
    }
}
