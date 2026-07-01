package com.example.kidsguard.repository

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

@Keep
data class FamilyMember(
    var uid: String = "",
    var email: String? = null,
    var displayName: String? = null,
    var role: String = "VIEWER",
    var joinedAt: Timestamp? = null,
    var assignedChildren: List<String> = emptyList()
)

@Keep
data class FamilySettings(
    var name: String = "",
    var timezone: String = "",
    var country: String = "US",
    var language: String = "en",
    var dataRetentionDays: Int = 365
)

@Keep
data class FamilyData(
    var familyId: String = "",
    var ownerId: String = "",
    var members: List<FamilyMember> = emptyList(),
    var childDeviceIds: List<String> = emptyList(),
    var settings: FamilySettings = FamilySettings(),
    var createdAt: Timestamp? = null
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
