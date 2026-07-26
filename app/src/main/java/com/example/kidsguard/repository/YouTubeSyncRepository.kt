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
    private val historyRepo = YouTubeHistoryRepository(context)
    private val TAG = "YT_SYNC"

    suspend fun syncHistory(): Result<Int> {
        val childId = prefHelper.childId
        val familyId = prefHelper.familyId

        if (childId.isBlank() || familyId.isNullOrBlank()) {
            Log.w(TAG, "Sync aborted: childId ($childId) or familyId ($familyId) is missing")
            return Result.failure(IllegalStateException("Pairing info missing"))
        }

        val unsynced = historyRepo.getUnsynced()
        if (unsynced.isEmpty()) {
            Log.d(TAG, "Sync: No unsynced YouTube activities found.")
            return Result.success(0)
        }

        Log.i(TAG, "Sync: Starting upload for ${unsynced.size} items...")

        var successCount = 0
        for (activity in unsynced) {
            try {
                // Populate required fields for cloud sync
                activity.deviceId = prefHelper.deviceId
                activity.createdBy = childId
                
                val uploadSuccess = uploadActivity(familyId, childId, activity)
                if (uploadSuccess) {
                    historyRepo.markAsSynced(activity.id)
                    successCount++
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to upload activity ${activity.id}: ${e.message}")
            }
        }

        Log.i(TAG, "Sync: Completed. Uploaded: $successCount, Failed: ${unsynced.size - successCount}")
        return Result.success(successCount)
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
            Log.e(TAG, "Upload failed for ${activity.id}: ${e.message}")
            false
        }
    }
}
