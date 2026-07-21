package com.example.kidsguard.repository

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.AppUsageItem
import com.example.kidsguard.models.DailyAppUsage
import com.example.kidsguard.utils.PermissionUtils
import java.text.SimpleDateFormat
import java.util.*

class AppUsageRepository(private val context: Context) {
    private val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    private val prefHelper = PreferenceHelper(context)
    private val packageManager = context.packageManager

    companion object {
        private const val TAG = "AppUsageSync"
    }

    suspend fun getTodayUsage(): DailyAppUsage? {
        if (!PermissionUtils.hasUsageStatsPermission(context)) {
            Log.w(TAG, "Missing Usage Stats permission")
            return null
        }

        val childId = prefHelper.childId
        val familyId = prefHelper.familyId ?: ""

        if (childId.isBlank()) {
            Log.w(TAG, "Child ID is blank, skipping usage collection")
            return null
        }

        try {
            val calendar = Calendar.getInstance()
            val endTime = calendar.timeInMillis
            
            // Set to start of day
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            if (stats.isNullOrEmpty()) {
                Log.d(TAG, "No usage stats collected for today")
                return null
            }

            val appUsageList = mutableListOf<AppUsageItem>()
            var totalScreenTime = 0L

            for (usage in stats) {
                // Ignore zero meaningful foreground time and own package
                if (usage.totalTimeInForeground <= 0L || usage.packageName == context.packageName) {
                    continue
                }

                val appName = try {
                    val appInfo = packageManager.getApplicationInfo(usage.packageName, 0)
                    packageManager.getApplicationLabel(appInfo).toString()
                } catch (e: PackageManager.NameNotFoundException) {
                    usage.packageName
                }

                val item = AppUsageItem(
                    packageName = usage.packageName,
                    appName = appName,
                    foregroundTimeMs = usage.totalTimeInForeground,
                    lastUsedAt = usage.lastTimeUsed,
                    firstUsedAt = usage.firstTimeStamp,
                    launchCount = 0 // launchCount is not directly available in UsageStats, requires UsageEvents
                )
                
                appUsageList.add(item)
                totalScreenTime += usage.totalTimeInForeground
            }

            val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val sortedApps = appUsageList.sortedByDescending { it.foregroundTimeMs }

            Log.d(TAG, "Collected ${sortedApps.size} apps. Total screen time: $totalScreenTime ms")

            return DailyAppUsage(
                childId = childId,
                familyId = familyId,
                date = dateStr,
                totalScreenTimeMs = totalScreenTime,
                apps = sortedApps,
                timezone = TimeZone.getDefault().id,
                updatedAt = System.currentTimeMillis()
            )

        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException while querying usage stats", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error collecting app usage", e)
        }

        return null
    }
}
