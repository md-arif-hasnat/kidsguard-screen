package com.example.kidsguard.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class FamilyMember(
    val uid: String = "",
    val email: String? = null,
    val displayName: String? = null,
    val role: String = "VIEWER",
    val joinedAt: Timestamp? = null,
    val assignedChildren: List<String> = emptyList()
)

data class FamilySettings(
    val name: String = "",
    val timezone: String = "",
    val country: String = "US",
    val language: String = "en",
    val dataRetentionDays: Int = 365
)

data class FamilyData(
    val familyId: String = "",
    val ownerId: String = "",
    val members: List<FamilyMember> = emptyList(),
    val childDeviceIds: List<String> = emptyList(),
    val settings: FamilySettings = FamilySettings(),
    val createdAt: Timestamp? = null
)

class FamilyRepository {
    private val db = FirebaseFirestore.getInstance()

    suspend fun getFamily(familyId: String): FamilyData? {
        return try {
            val doc = db.collection("families").document(familyId).get().await()
            if (doc.exists()) doc.toObject(FamilyData::class.java) else null
        } catch (e: Exception) {
            null
        }
    }
}
