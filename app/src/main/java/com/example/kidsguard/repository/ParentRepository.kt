package com.example.kidsguard.repository

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

@Keep
data class ParentProfile(
    var uid: String = "",
    var email: String? = null,
    var phoneNumber: String? = null,
    var displayName: String? = null,
    var avatarId: String? = null,
    var provider: String = "",
    var familyId: String? = null,
    var role: String? = null,
    var region: String? = null,
    var createdAt: Timestamp? = null,
    var lastLoginAt: Timestamp? = null
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
