package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.BuildConfig
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.models.DeviceDoc
import com.example.kidsguard.models.FamilyDoc
import com.example.kidsguard.models.PairingCodeDoc
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.Calendar

class AuthRepository(private val context: Context) {
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }
    private val prefs = PreferenceHelper(context)
    private val errorLogger = ErrorLogRepository(context)

    companion object {
        private const val TAG = "AuthRepository"
    }

    suspend fun signInAnonymously(): Boolean {
        return try {
            val result = auth.signInAnonymously().await()
            val uid = result.user?.uid
            if (uid != null) {
                prefs.firebaseUid = uid
                true
            } else {
                false
            }
        } catch (e: Exception) {
            errorLogger.addError(TAG, "Firebase Auth failed", e)
            false
        }
    }

    suspend fun registerDevice(): Boolean {
        if (!FirebaseConfig.isFirebaseConfigured(context)) return false
        
        val uid = auth.currentUser?.uid ?: return false
        val deviceId = prefs.deviceId
        
        val deviceDoc = DeviceDoc(
            deviceId = deviceId,
            firebaseUid = uid,
            role = prefs.userRole,
            deviceName = prefs.deviceName,
            appVersion = "0.3.0-dev", // Current version
            createdAt = Timestamp.now(), // Firestore will use server time if we use @ServerTimestamp but for simplicity we use this
            lastSeen = Timestamp.now()
        )

        return try {
            db.collection(FirebaseConfig.COL_DEVICES)
                .document(deviceId)
                .set(deviceDoc)
                .await()
            prefs.lastFirestoreWrite = System.currentTimeMillis()
            true
        } catch (e: Exception) {
            errorLogger.addError(TAG, "Device registration failed", e)
            false
        }
    }

    suspend fun generatePairingCode(): String? {
        if (!FirebaseConfig.isFirebaseConfigured(context)) return null
        
        val code = (100000..999999).random().toString()
        val expiry = Calendar.getInstance().apply {
            add(Calendar.HOUR, 1)
        }.time

        val pairingDoc = PairingCodeDoc(
            pairingCode = code,
            childDeviceId = prefs.deviceId,
            childName = prefs.childName,
            createdAt = Timestamp.now(),
            expiresAt = Timestamp(expiry)
        )

        return try {
            db.collection(FirebaseConfig.COL_PAIRING_CODES)
                .document(code)
                .set(pairingDoc)
                .await()
            prefs.lastFirestoreWrite = System.currentTimeMillis()
            code
        } catch (e: Exception) {
            errorLogger.addError(TAG, "Failed to generate pairing code", e)
            null
        }
    }

    suspend fun validateAndPair(code: String): Boolean {
        if (!FirebaseConfig.isFirebaseConfigured(context)) return false
        
        return try {
            val doc = db.collection(FirebaseConfig.COL_PAIRING_CODES)
                .document(code)
                .get()
                .await()
            
            if (doc.exists()) {
                val pairingData = doc.toObject(PairingCodeDoc::class.java)
                if (pairingData != null && pairingData.expiresAt?.toDate()?.after(Calendar.getInstance().time) == true) {
                    // Create or update family
                    createOrUpdateFamily(pairingData.childDeviceId)
                    // Delete code after use
                    db.collection(FirebaseConfig.COL_PAIRING_CODES).document(code).delete()
                    true
                } else {
                    false
                }
            } else {
                false
            }
        } catch (e: Exception) {
            errorLogger.addError(TAG, "Pairing validation failed", e)
            false
        }
    }

    private suspend fun createOrUpdateFamily(childDeviceId: String) {
        val existingFamilyId = prefs.familyId
        val familyId = existingFamilyId ?: java.util.UUID.randomUUID().toString()
        
        try {
            val familyRef = db.collection(FirebaseConfig.COL_FAMILIES).document(familyId)
            val doc = familyRef.get().await()
            
            if (doc.exists()) {
                val family = doc.toObject(FamilyDoc::class.java)
                val updatedChildren = family?.childDeviceIds?.toMutableList() ?: mutableListOf()
                if (!updatedChildren.contains(childDeviceId)) {
                    updatedChildren.add(childDeviceId)
                    familyRef.update("childDeviceIds", updatedChildren).await()
                }
            } else {
                val familyDoc = FamilyDoc(
                    familyId = familyId,
                    parentDeviceId = prefs.deviceId,
                    childDeviceIds = listOf(childDeviceId),
                    createdAt = Timestamp.now()
                )
                familyRef.set(familyDoc).await()
            }
            
            prefs.familyId = familyId
            // Also set as current child if none selected
            if (prefs.pairedChildId == null) {
                prefs.pairedChildId = childDeviceId
            }
            prefs.lastFirestoreWrite = System.currentTimeMillis()
        } catch (e: Exception) {
            errorLogger.addError(TAG, "Failed to create/update family", e)
        }
    }
}
