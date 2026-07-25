package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

class BrowserHistorySyncRepository(private val context: Context) {
    private val db = FirebaseFirestore.getInstance()
    private val prefHelper = PreferenceHelper(context)
    private val historyRepo = BrowserHistoryRepository(context)
    private val TAG = "BROWSER_SYNC"

    suspend fun syncHistory(): Result<Int> {
        val childId = prefHelper.childId
        val familyId = prefHelper.familyId

        if (childId.isBlank() || familyId.isNullOrBlank()) {
            Log.w(TAG, "Sync aborted: childId ($childId) or familyId ($familyId) is missing")
            return Result.failure(IllegalStateException("Pairing info missing"))
        }

        val unsynced = historyRepo.getUnsynced()
        if (unsynced.isEmpty()) {
            Log.d(TAG, "Sync: No unsynced browser history found.")
            return Result.success(0)
        }

        Log.i(TAG, "Sync: Starting upload for ${unsynced.size} items...")

        var successCount = 0
        for (item in unsynced) {
            try {
                // Populate required fields for cloud sync
                item.deviceId = prefHelper.deviceId
                item.createdBy = childId
                
                val uploadSuccess = uploadHistoryItem(familyId, childId, item)
                if (uploadSuccess) {
                    historyRepo.markAsSynced(item.id)
                    successCount++
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to upload history item ${item.id}: ${e.message}")
            }
        }

        Log.i(TAG, "Sync: Completed. Uploaded: $successCount, Failed: ${unsynced.size - successCount}")
        return Result.success(successCount)
    }

    private suspend fun uploadHistoryItem(familyId: String, childId: String, item: BrowserHistory): Boolean {
        val docRef = db.collection(FirebaseConfig.COL_FAMILIES)
            .document(familyId)
            .collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("browserHistory")
            .document(item.id)

        return try {
            val data = hashMapOf(
                "historyId" to item.id,
                "url" to item.url,
                "domain" to item.domain,
                "pageTitle" to item.pageTitle,
                "browserPackage" to item.browserPackage,
                "capturedAt" to item.capturedAt,
                "startedAt" to item.startedAt,
                "endedAt" to item.endedAt,
                "durationSeconds" to item.durationSeconds,
                "category" to item.category.name,
                "categoryConfidence" to item.categoryConfidence,
                "categorySource" to item.categorySource,
                "categorizedAt" to item.categorizedAt,
                "riskLevel" to item.riskLevel.name,
                "deviceId" to item.deviceId,
                "uploadedAt" to System.currentTimeMillis(),
                "syncVersion" to item.syncVersion,
                "createdBy" to item.createdBy
            )

            docRef.set(data, SetOptions.merge()).await()
            Log.d(TAG, "Upload success: ${item.url}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Upload failed for ${item.id}: ${e.message}")
            false
        }
    }
}
