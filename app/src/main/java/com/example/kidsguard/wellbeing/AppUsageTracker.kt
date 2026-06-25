package com.example.kidsguard.wellbeing

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import java.util.Calendar

class AppUsageTracker(private val context: Context) {

    private val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    private val packageManager = context.packageManager

    fun getDailyUsage(): List<AppUsageInfo> {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        
        val startTime = calendar.timeInMillis
        val endTime = System.currentTimeMillis()

        val stats = usageStatsManager.queryAndAggregateUsageStats(startTime, endTime)
        
        return stats.mapNotNull { (packageName, usageStats) ->
            if (usageStats.totalTimeInForeground <= 0) return@mapNotNull null
            
            val appInfo = try {
                packageManager.getApplicationInfo(packageName, 0)
            } catch (e: PackageManager.NameNotFoundException) {
                null
            } ?: return@mapNotNull null

            val appName = packageManager.getApplicationLabel(appInfo).toString()
            val category = classifyApp(appInfo)

            AppUsageInfo(
                packageName = packageName,
                appName = appName,
                category = category,
                totalTimeVisibleMs = usageStats.totalTimeInForeground,
                launchCount = 0, // launchCount is not available in aggregateStats easily without queryEvents
                lastTimeUsed = usageStats.lastTimeUsed,
                firstTimeUsed = usageStats.firstTimeStamp
            )
        }
    }

    private fun classifyApp(appInfo: ApplicationInfo): AppCategory {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return when (appInfo.category) {
                ApplicationInfo.CATEGORY_GAME -> AppCategory.GAMES
                ApplicationInfo.CATEGORY_AUDIO, ApplicationInfo.CATEGORY_VIDEO -> AppCategory.VIDEO
                ApplicationInfo.CATEGORY_SOCIAL -> AppCategory.SOCIAL
                ApplicationInfo.CATEGORY_NEWS -> AppCategory.EDUCATION
                ApplicationInfo.CATEGORY_MAPS -> AppCategory.SYSTEM
                ApplicationInfo.CATEGORY_PRODUCTIVITY -> AppCategory.EDUCATION
                else -> inferCategory(appInfo.packageName)
            }
        }
        return inferCategory(appInfo.packageName)
    }

    private fun inferCategory(packageName: String): AppCategory {
        return when {
            packageName.contains("youtube") || packageName.contains("netflix") || packageName.contains("disney") -> AppCategory.VIDEO
            packageName.contains("facebook") || packageName.contains("instagram") || packageName.contains("tiktok") || packageName.contains("twitter") -> AppCategory.SOCIAL
            packageName.contains("whatsapp") || packageName.contains("messenger") || packageName.contains("telegram") || packageName.contains("viber") -> AppCategory.MESSAGING
            packageName.contains("chrome") || packageName.contains("browser") || packageName.contains("firefox") || packageName.contains("opera") -> AppCategory.BROWSER
            packageName.contains("candy") || packageName.contains("roblox") || packageName.contains("pubg") || packageName.contains("clash") -> AppCategory.GAMES
            packageName.contains("amazon") || packageName.contains("ebay") || packageName.contains("aliexpress") -> AppCategory.SHOPPING
            packageName.contains("bank") || packageName.contains("paypal") || packageName.contains("wallet") -> AppCategory.FINANCE
            packageName.contains("google") || packageName.contains("android") -> AppCategory.SYSTEM
            else -> AppCategory.OTHER
        }
    }
}
