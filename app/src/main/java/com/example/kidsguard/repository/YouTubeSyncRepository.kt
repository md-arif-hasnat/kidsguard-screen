package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.YouTubeActivity
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

class YouTubeSyncRepository(private val context: Context) {
    private val db = FirebaseFirestore.getInstance()
    private val prefHelper = PreferenceHelper(context)
    private val historyRepo = YouTubeHistoryRepository.getInstance(context)
    private val TAG = "YT_SYNC"

    suspend fun syncHistory(): Result<Int> {
    val pairedChildId = prefHelper.pairedChildId.orEmpty()
    val savedChildId = prefHelper.childId

    val childId = when {
        pairedChildId.isNotBlank() -> pairedChildId
        savedChildId.isNotBlank() -> savedChildId
        else -> ""
    }

    val familyId = prefHelper.familyId.orEmpty()

    historyRepo.addDebugLog(
        "SYNC_STARTED childId=$childId familyId=$familyId " +
                "pairedChildId=$pairedChildId"
    )

    if (childId.isBlank()) {
        val error = IllegalStateException("Child ID is missing")
        Log.e(TAG, "SYNC_ABORTED: childId is missing")
        historyRepo.addDebugLog("SYNC_ABORTED reason=CHILD_ID_MISSING")
        return Result.failure(error)
    }

    if (familyId.isBlank()) {
        val error = IllegalStateException("Family ID is missing")
        Log.e(TAG, "SYNC_ABORTED: familyId is missing")
        historyRepo.addDebugLog("SYNC_ABORTED reason=FAMILY_ID_MISSING")
        return Result.failure(error)
    }

    val unsynced = historyRepo.getUnsynced()

    historyRepo.addDebugLog(
        "SYNC_PENDING_COUNT=${unsynced.size}"
    )

    if (unsynced.isEmpty()) {
        Log.d(TAG, "No unsynced YouTube activities found")
        historyRepo.addDebugLog("SYNC_NOTHING_TO_UPLOAD")
        return Result.success(0)
    }

    var successCount = 0
    var failureCount = 0
    var lastError: Throwable? = null

    for (activity in unsynced) {
        try {
            activity.deviceId = prefHelper.deviceId
            activity.createdBy = childId

            historyRepo.addDebugLog(
                "UPLOAD_STARTED id=${activity.id} title=${activity.videoTitle}"
            )

            val uploadSuccess = uploadActivity(
                familyId = familyId,
                childId = childId,
                activity = activity
            )

            if (uploadSuccess) {
                historyRepo.markAsSynced(activity.id)
                successCount++

                historyRepo.addDebugLog(
                    "UPLOAD_SUCCESS id=${activity.id}"
                )
            } else {
                failureCount++
                lastError = IllegalStateException(
                    "Firestore upload returned false for ${activity.id}"
                )

                historyRepo.addDebugLog(
                    "UPLOAD_FAILED id=${activity.id}"
                )
            }
        } catch (e: Exception) {
            failureCount++
            lastError = e

            Log.e(
                TAG,
                "Failed to upload activity ${activity.id}",
                e
            )

            historyRepo.addDebugLog(
                "UPLOAD_EXCEPTION id=${activity.id} " +
                        "error=${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    historyRepo.addDebugLog(
        "SYNC_COMPLETED success=$successCount failed=$failureCount"
    )

    return if (failureCount == 0) {
        Result.success(successCount)
    } else {
        Result.failure(
            lastError ?: IllegalStateException(
                "$failureCount YouTube activities failed to upload"
            )
        )
    }
}

    private suspend fun uploadActivity(familyId: String, childId: String, activity: YouTubeActivity): Boolean {
        val docRef = db.collection(FirebaseConfig.COL_FAMILIES)
            .document(familyId)
            .collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("youtubeHistory")
            .document(activity.id)

        return try {
            val data = mutableMapOf<String, Any?>(
                "historyId" to activity.id,
                "videoTitle" to activity.videoTitle,
                "channelName" to activity.channelName,
                "packageName" to activity.packageName,
                "capturedAt" to activity.capturedAt,
                "startedAt" to activity.startedAt,
                "endedAt" to activity.endedAt,
                "watchDurationSeconds" to activity.watchDurationSeconds,
                "deviceId" to activity.deviceId,
                "uploadedAt" to System.currentTimeMillis(),
                "syncVersion" to activity.syncVersion,
                "createdBy" to activity.createdBy
            )

            activity.videoId?.let { data["videoId"] = it }
            activity.youtubeUrl?.let { data["youtubeUrl"] = it }
            activity.thumbnailUrl?.let { data["thumbnailUrl"] = it }
            activity.linkSource?.let { data["linkSource"] = it }
            activity.linkConfidence?.let { data["linkConfidence"] = it }

            docRef.set(data, SetOptions.merge()).await()
            Log.d(TAG, "Upload success: ${activity.videoTitle}")
            true
        } catch (e: Exception) {
    Log.e(TAG, "Upload failed for ${activity.id}", e)

    historyRepo.addDebugLog(
        "FIRESTORE_UPLOAD_FAILED " +
                "id=${activity.id} " +
                "error=${e.message ?: e.javaClass.simpleName}"
    )

    false
}
    }
}
