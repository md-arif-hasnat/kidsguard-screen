package com.example.kidsguard.models

data class ChildSchedule(
    val id: String,
    val childId: String,
    val zoneId: String, // Destination Safe Zone
    val dayOfWeek: Int, // 1-7 (Sunday-Saturday)
    val arrivalTime: String, // HH:mm
    val toleranceMinutes: Int = 15,
    val enabled: Boolean = true
)
