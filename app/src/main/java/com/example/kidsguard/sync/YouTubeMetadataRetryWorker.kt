package com.example.kidsguard.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import androidx.work.WorkerParameters
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.repository.YouTubeHistoryRepository
import com.example.kidsguard.repository.YouTubeSyncRepository
import com.example.kidsguard.youtube.YouTubeApiClient
import com.example.kidsguard.youtube.YouTubeVideoResolver
import java.util.concurrent.TimeUnit

/**
 * Recovers thumbnails that could not be resolved while the YouTube session
 * was active. One item is processed per run to respect API budgets.
 */
class YouTubeMetadataRetryWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val IMMEDIATE_WORK_NAME = "kidsguard_youtube_metadata_retry"
        private const val PERIODIC_WORK_NAME = "kidsguard_youtube_metadata_retry_periodic"

        private fun constraints() = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        fun scheduleImmediate(context: Context) {
            val request = OneTimeWorkRequestBuilder<YouTubeMetadataRetryWorker>()
                .setInitialDelay(20, TimeUnit.SECONDS)
                .setConstraints(constraints())
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                IMMEDIATE_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                request
            )
        }

        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<YouTubeMetadataRetryWorker>(
                1,
                TimeUnit.HOURS
            )
                .setConstraints(constraints())
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun stop(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_WORK_NAME)
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME)
        }
    }

    override suspend fun doWork(): Result {
        val preferences = PreferenceHelper(applicationContext)
        if (
            preferences.userRole != "CHILD" ||
            preferences.familyId.isNullOrBlank()
        ) {
            return Result.success()
        }

        YouTubeApiClient.init(applicationContext)
        val history = YouTubeHistoryRepository.getInstance(applicationContext)
        val repairedCount = history.repairDerivedThumbnails()
        val unresolved = history.getNextUnresolvedThumbnail()

        if (unresolved == null) {
            if (repairedCount > 0) {
                return syncRecoveredMetadata()
            }
            return Result.success()
        }

        val request = YouTubeVideoResolver.buildRequest(
            title = unresolved.videoTitle,
            channel = unresolved.channelName,
            durationMs = unresolved.watchDurationSeconds
                .takeIf { it > 0L }
                ?.times(1000L),
            mediaId = null,
            mediaUri = null
        )

        if (request == null) {
            history.recordThumbnailRetryFailure(unresolved.id, "INVALID_METADATA")
            return syncRecoveredMetadataIfNeeded(repairedCount)
        }

        val response = YouTubeApiClient.searchVideos(request) { message ->
            history.addDebugLog("THUMBNAIL_RETRY_API $message")
        }

        if (response == null) {
            history.recordThumbnailRetryFailure(
                unresolved.id,
                YouTubeApiClient.lastError ?: "NO_API_RESPONSE"
            )
            return syncRecoveredMetadataIfNeeded(repairedCount)
        }

        val resolved = YouTubeVideoResolver.resolveFromSearch(request, response)
        if (resolved == null) {
            history.recordThumbnailRetryFailure(unresolved.id, "NO_CONFIDENT_MATCH")
            return syncRecoveredMetadataIfNeeded(repairedCount)
        }

        YouTubeApiClient.cacheResolvedVideo(request, resolved)

        history.enrichSavedActivityById(
            activityId = unresolved.id,
            channelName = unresolved.channelName,
            videoId = resolved.videoId,
            youtubeUrl = resolved.youtubeUrl,
            thumbnailUrl = resolved.thumbnailUrl,
            linkSource = resolved.source,
            linkConfidence = resolved.confidence
        )
        return syncRecoveredMetadata()
    }

    private suspend fun syncRecoveredMetadataIfNeeded(repairedCount: Int): Result {
        return if (repairedCount > 0) syncRecoveredMetadata() else Result.success()
    }

    private suspend fun syncRecoveredMetadata(): Result {
        val result = YouTubeSyncRepository(applicationContext).syncHistory()
        return if (result.isSuccess) Result.success() else Result.retry()
    }
}
