package com.example.kidsguard.repository

import com.example.kidsguard.models.ProtectionModeDoc
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class ProtectionModeRepository {
    private val db = FirebaseFirestore.getInstance()

    fun listenToModes(childId: String): Flow<List<ProtectionModeDoc>> = callbackFlow {
        if (childId.isEmpty()) {
            trySend(emptyList())
            return@callbackFlow
        }

        val listener = db.collection("children").document(childId)
            .collection("protectionModes")
            .addSnapshotListener { snapshot, e ->
                if (snapshot != null) {
                    val modes = snapshot.map { it.toObject(ProtectionModeDoc::class.java) }
                    trySend(modes)
                }
            }
        
        awaitClose { listener.remove() }
    }

    suspend fun saveMode(childId: String, mode: ProtectionModeDoc) {
        val id = mode.id.ifEmpty { java.util.UUID.randomUUID().toString() }
        val finalMode = mode.copy(id = id)
        db.collection("children").document(childId)
            .collection("protectionModes").document(id)
            .set(finalMode).await()
    }

    suspend fun deleteMode(childId: String, modeId: String) {
        db.collection("children").document(childId)
            .collection("protectionModes").document(modeId)
            .delete().await()
    }
}
