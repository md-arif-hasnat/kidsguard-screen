package com.example.kidsguard.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.BrowserHistorySyncRepository
import java.util.concurrent.TimeUnit

class BrowserSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "BROWSER_SYNC"
        private const val WORK_NAME = "kidsguard_browser_sync"

        fun schedule(context: Context) {
            val prefHelper = PreferenceHelper(context)
            
            if (prefHelper.userRole != "CHILD" || prefHelper.familyId.isNullOrBlank()) {
                Log.d(TAG, "Not a paired child device, skipping Browser sync scheduling")
                return
            }

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<BrowserSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.d(TAG, "Browser Sync work scheduled")
        }
        
        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Browser Sync work cancelled")
        }

        fun runOnce(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<BrowserSyncWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME + "_once",
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }

    override suspend fun doWork(): Result {
        val prefHelper = PreferenceHelper(applicationContext)
        
        if (prefHelper.userRole != "CHILD" || prefHelper.familyId.isNullOrBlank()) {
            return Result.success()
        }

        Log.d(TAG, "Starting background Browser history sync")
        val repository = BrowserHistorySyncRepository(applicationContext)
        val result = repository.syncHistory()

        return if (result.isSuccess) {
            Result.success()
        } else {
            Log.e(TAG, "Browser sync failed, retrying...")
            Result.retry()
        }
    }
}
