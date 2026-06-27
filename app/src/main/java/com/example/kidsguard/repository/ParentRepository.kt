package com.example.kidsguard.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class ParentProfile(
    val uid: String = "",
    val email: String? = null,
    val phoneNumber: String? = null,
    val displayName: String? = null,
    val avatarId: String? = null,
    val provider: String = "",
    val familyId: String? = null,
    val role: String? = null,
    val region: String? = null,
    val createdAt: Timestamp? = null,
    val lastLoginAt: Timestamp? = null
)

class ParentRepository {
    private val db = FirebaseFirestore.getInstance()

    suspend fun getProfile(uid: String): ParentProfile? {
        return try {
            val doc = db.collection("parents").document(uid).get().await()
            if (doc.exists()) doc.toObject(ParentProfile::class.java) else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun updateProfile(uid: String, updates: Map<String, Any>) {
        try {
            db.collection("parents").document(uid).update(updates).await()
        } catch (e: Exception) {
            // If update fails, try set with merge
            db.collection("parents").document(uid).set(updates, com.google.firebase.firestore.SetOptions.merge()).await()
        }
    }
}
