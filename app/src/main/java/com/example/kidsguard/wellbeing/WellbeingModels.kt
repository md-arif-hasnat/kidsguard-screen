package com.example.kidsguard.wellbeing

enum class AppCategory {
    EDUCATION, GAMES, SOCIAL, ENTERTAINMENT, VIDEO, 
    MESSAGING, BROWSER, SHOPPING, FINANCE, SYSTEM, OTHER
}

enum class AppBlockReason {
    NONE,
    STATIC_BLOCK,
    LIMIT_REACHED,
    SCHEDULE
}

data class AppUsageInfo(
    val packageName: String,
    val appName: String,
    val category: AppCategory,
    val totalTimeVisibleMs: Long,
    val launchCount: Int,
    val lastTimeUsed: Long,
    val firstTimeUsed: Long
)

data class DailyAppUsage(
    val date: String, // YYYY-MM-DD
    val totalScreenTimeMs: Long,
    val apps: List<AppUsageInfo>
)

data class AppLimit(
    val packageName: String,
    val dailyLimitMs: Long,
    val enabled: Boolean = true
)

data class AppBlockRule(
    val packageName: String,
    val isBlocked: Boolean = false,
    val scheduledBlocks: List<ScheduleRule> = emptyList()
)

data class ScheduleRule(
    val name: String, // e.g., "School Hours"
    val startTime: String, // HH:mm
    val endTime: String, // HH:mm
    val daysOfWeek: List<Int>, // 1-7
    val blockedCategories: List<AppCategory> = emptyList(),
    val blockedPackages: List<String> = emptyList(),
    val enabled: Boolean = true
)

data class WellbeingSettings(
    val appLimits: List<AppLimit> = emptyList(),
    val blockRules: List<AppBlockRule> = emptyList(),
    val globalSchedules: List<ScheduleRule> = emptyList()
)
