package com.example.kidsguard.ai

interface AiSummaryProvider {
    /**
     * Generates a natural language summary of the day's events.
     */
    suspend fun generateSummary(data: DailySummaryInput): String

    /**
     * Calculates a safety score from 0 to 100 based on the day's data.
     */
    suspend fun calculateSafetyScore(data: DailySummaryInput): Int
}
