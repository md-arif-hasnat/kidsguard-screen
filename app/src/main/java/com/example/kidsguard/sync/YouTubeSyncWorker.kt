package com.example.kidsguard.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.YouTubeSyncRepository
import java.util.concurrent.TimeUnit

class YouTubeSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "YT_SYNC"
        private const val WORK_NAME = "kidsguard_youtube_sync"

        fun schedule(context: Context) {
            val prefHelper = PreferenceHelper(context)
            
            // Only schedule if child is paired
            if (prefHelper.userRole != "CHILD" || prefHelper.familyId.isNullOrBlank()) {
                Log.d(TAG, "Not a paired child device, skipping YouTube sync scheduling")
                return
            }

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            // Run every 15 minutes to sync new history
            val request = PeriodicWorkRequestBuilder<YouTubeSyncWorker>(15, TimeUnit.MINUTES)
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
            Log.d(TAG, "YouTube Sync work scheduled")
        }
        
        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "YouTube Sync work cancelled")
        }

        fun runOnce(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<YouTubeSyncWorker>()
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

        Log.d(TAG, "Starting background YouTube history sync")
        val repository = YouTubeSyncRepository(applicationContext)
        val result = repository.syncHistory()

        return if (result.isSuccess) {
            Result.success()
        } else {
            Log.e(TAG, "YouTube sync failed, retrying...")
            Result.retry()
        }
    }
}
