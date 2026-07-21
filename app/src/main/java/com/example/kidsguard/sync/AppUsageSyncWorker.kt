package com.example.kidsguard.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.AppUsageRepository
import com.example.kidsguard.utils.PermissionUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.concurrent.TimeUnit

class AppUsageSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "AppUsageSync"
        private const val WORK_NAME = "kidsguard_app_usage_sync"

        fun schedule(context: Context) {
            val prefHelper = PreferenceHelper(context)
            
            // Only schedule if child is paired
            if (prefHelper.userRole != "CHILD" || prefHelper.familyId.isNullOrBlank()) {
                Log.d(TAG, "Not a paired child device, skipping work scheduling")
                return
            }

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<AppUsageSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.d(TAG, "Periodic work scheduled")
        }
        
        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Periodic work cancelled")
        }

        fun isScheduled(context: Context): Flow<Boolean> {
            return WorkManager.getInstance(context).getWorkInfosForUniqueWorkFlow(WORK_NAME)
                .map { list ->
                    list.any { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.RUNNING }
                }
        }
    }

    override suspend fun doWork(): Result {
        val prefHelper = PreferenceHelper(applicationContext)
        
        // Check if child is paired
        if (prefHelper.userRole != "CHILD" || prefHelper.familyId.isNullOrBlank()) {
            Log.d(TAG, "Not a paired child device, stopping worker")
            return Result.success()
        }

        // Check permission
        if (!PermissionUtils.hasUsageStatsPermission(applicationContext)) {
            Log.w(TAG, "Usage Stats permission not granted, cannot sync")
            return Result.success()
        }

        Log.d(TAG, "Starting background usage sync")

        val repository = AppUsageRepository(applicationContext)
        val usage = repository.getTodayUsage()

        if (usage == null) {
            Log.d(TAG, "No usage data collected")
            return Result.success()
        }

        val syncProvider = FirebaseRemoteSyncProvider(applicationContext)
        val result = syncProvider.syncDailyAppUsage(usage)

        return if (result.isSuccess) {
            Log.i(TAG, "Background sync success")
            Result.success()
        } else {
            Log.e(TAG, "Background sync failed, retrying")
            Result.retry()
        }
    }
}
