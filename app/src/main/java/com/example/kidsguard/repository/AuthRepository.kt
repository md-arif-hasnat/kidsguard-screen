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
        Log.d(TAG, "Starting anonymous sign-in...")
        return try {
            val result = auth.signInAnonymously().await()
            val uid = result.user?.uid
            if (uid != null) {
                Log.i(TAG, "Firebase Anonymous Sign-in Success. UID: $uid")
                prefs.firebaseUid = uid
                true
            } else {
                Log.e(TAG, "Firebase Anonymous Sign-in failed: UID is null")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Firebase Anonymous Sign-in Exception", e)
            
            // Handle specific "Restricted to administrators" or "Operation not allowed" errors
            val message = e.message ?: ""
            if (message.contains("restricted to administrators", ignoreCase = true) || 
                message.contains("operation-not-allowed", ignoreCase = true)) {
                Log.e(TAG, "FIX REQUIRED: Ensure 'Anonymous' Sign-in provider is ENABLED in Firebase Console.")
            }
            
            errorLogger.addError(TAG, "Firebase Auth failed: ${e.message}", e)
            false
        }
    }

    suspend fun signInWithEmail(email: String, password: String): Boolean {
        return try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            prefs.firebaseUid = result.user?.uid
            true
        } catch (e: Exception) {
            Log.e(TAG, "Email Sign-in failed", e)
            false
        }
    }

    suspend fun signUpWithEmail(email: String, password: String): Boolean {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, password).await()
            prefs.firebaseUid = result.user?.uid
            true
        } catch (e: Exception) {
            Log.e(TAG, "Email Sign-up failed", e)
            false
        }
    }

    suspend fun registerDevice(): Boolean {
        if (!FirebaseConfig.isFirebaseConfigured(context)) {
            Log.w(TAG, "Device registration skipped: Firebase not configured")
            return false
        }
        
        val uid = auth.currentUser?.uid
        if (uid == null) {
            Log.e(TAG, "Device registration failed: No current user UID. Ensure anonymous sign-in is enabled.")
            return false
        }
        
        val deviceId = prefs.deviceId
        Log.d(TAG, "Registering device $deviceId for UID $uid")
        
        // Fetch FCM token
        var fcmToken: String? = null
        try {
            fcmToken = com.google.firebase.messaging.FirebaseMessaging.getInstance().token.await()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get FCM token", e)
        }

        val deviceDoc = DeviceDoc(
            deviceId = deviceId,
            firebaseUid = uid,
            role = prefs.userRole,
            deviceName = prefs.deviceName,
            appVersion = "0.3.0-dev", 
            createdAt = Timestamp.now(), 
            lastSeen = Timestamp.now(),
            fcmToken = fcmToken,
            fcmTokenUpdatedAt = if (fcmToken != null) Timestamp.now() else null
        )

        try {
            val devicePath = "${FirebaseConfig.COL_DEVICES}/$deviceId"
            Log.d(TAG, "Writing device doc to: $devicePath")

            // 1. Global devices collection - CRITICAL for Firestore Rules (isDeviceOwner)
            db.collection(FirebaseConfig.COL_DEVICES)
                .document(deviceId)
                .set(deviceDoc, com.google.firebase.firestore.SetOptions.merge())
                .await()
            
            // 2. Parent-specific devices collection for FCM
            if (prefs.userRole == "PARENT") {
                val parentDevicePath = "${FirebaseConfig.COL_PARENTS}/$uid/${FirebaseConfig.COL_DEVICES}/$deviceId"
                Log.d(TAG, "Writing parent-specific device doc to: $parentDevicePath")
                db.collection(FirebaseConfig.COL_PARENTS)
                    .document(uid)
                    .collection(FirebaseConfig.COL_DEVICES)
                    .document(deviceId)
                    .set(mapOf(
                        "deviceId" to deviceId,
                        "token" to fcmToken,
                        "platform" to "Android",
                        "deviceName" to prefs.deviceName,
                        "lastSeen" to Timestamp.now(),
                        "appVersion" to "1.0.0"
                    ), com.google.firebase.firestore.SetOptions.merge())
                    .await()
            }

            Log.i(TAG, "Device registration successful in Firestore")
            prefs.lastFirestoreWrite = System.currentTimeMillis()
            return true
        } catch (e: Exception) {
            val firebaseErrorCode = (e as? com.google.firebase.firestore.FirebaseFirestoreException)?.code?.name ?: "UNKNOWN"
            Log.e(TAG, "Firestore device registration failed. Error: $firebaseErrorCode - ${e.message}", e)
            errorLogger.addError(TAG, "Device registration failed", e)
            return false
        }
    }

    suspend fun generatePairingCode(): String? {
        if (!FirebaseConfig.isFirebaseConfigured(context)) {
            Log.e(TAG, "ANDROID: Firebase NOT configured while generating code")
            return null
        }

        // Ensure user is signed in before generating code to avoid PERMISSION_DENIED
        if (auth.currentUser == null) {
            Log.i(TAG, "No current user, attempting anonymous sign-in before generating code...")
            try {
                val success = signInAnonymously()
                if (!success) {
                    Log.e(TAG, "Failed to sign in anonymously. Cannot generate pairing code.")
                    return null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception during anonymous sign-in in generatePairingCode", e)
                return null
            }
        }

        val uid = auth.currentUser?.uid ?: ""
        Log.d(TAG, "Generating pairing code for UID: $uid")

        // 1. Invalidate previous code if it exists
        val oldCode = prefs.pairingCode
        if (oldCode.isNotEmpty() && !oldCode.startsWith("MOCK-")) {
            try {
                Log.d(TAG, "Invalidating previous pairing code: $oldCode")
                db.collection(FirebaseConfig.COL_PAIRING_CODES).document(oldCode).delete().await()
                Log.d(TAG, "Previous code $oldCode invalidated successfully")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to delete old pairing code $oldCode", e)
            }
        }
        
        val code = (100000..999999).random().toString()
        val expiry = Calendar.getInstance().apply {
            add(Calendar.MINUTE, 15)
        }.time

        val pairingDoc = PairingCodeDoc(
            code = code,
            childId = prefs.childId,
            deviceId = prefs.deviceId,
            childName = prefs.childName,
            deviceName = prefs.deviceName,
            avatarId = prefs.avatarId,
            firebaseUid = uid,
            createdAt = Timestamp.now(),
            expiresAt = Timestamp(expiry),
            used = false
        )

        Log.i(TAG, "Pairing code generated: $code. Expiry: $expiry")

        // Sync Initial Status to children/{childId}/status/current
        try {
            syncInitialStatus(prefs.childId)
            Log.i(TAG, "children status synced for ${prefs.childId}")
        } catch (e: Exception) {
            Log.w(TAG, "Initial status sync failed, but proceeding with pairing code generation", e)
        }

        val path = "${FirebaseConfig.COL_PAIRING_CODES}/$code"
        Log.d(TAG, "Writing pairing code to Firestore path: $path with payload keys: ${pairingDoc.javaClass.declaredFields.map { it.name }}")

        return try {
            db.collection(FirebaseConfig.COL_PAIRING_CODES)
                .document(code)
                .set(pairingDoc)
                .await()
            
            Log.i(TAG, "Pairing code write SUCCESS: $path")
            prefs.lastFirestoreWrite = System.currentTimeMillis()
            code
        } catch (e: Exception) {
            val firebaseErrorCode = (e as? com.google.firebase.firestore.FirebaseFirestoreException)?.code?.name ?: "UNKNOWN"
            Log.e("PairingCode", "Pairing code write FAILURE")
            Log.e("PairingCode", "Path: $path")
            Log.e("PairingCode", "Auth Status: Signed In (UID: $uid)")
            Log.e("PairingCode", "Type: ${e.javaClass.simpleName}")
            Log.e("PairingCode", "Code: $firebaseErrorCode")
            Log.e("PairingCode", "Message: ${e.message}")
            Log.e("PairingCode", "Full Exception: ", e)

            errorLogger.addError(TAG, "Failed to generate pairing code at $path", e)
            null
        }
    }

    private suspend fun syncInitialStatus(childId: String) {
        // Ensure device is registered first to satisfy Firestore Rules (isDeviceOwner)
        val registrationSuccess = registerDevice()
        if (!registrationSuccess) {
            Log.w(TAG, "Device registration failed before status sync. This might cause PERMISSION_DENIED.")
        }

        val status = com.example.kidsguard.sync.SyncChildStatus(
            childId = childId,
            childName = prefs.childName,
            avatarId = prefs.avatarId,
            deviceId = prefs.deviceId,
            deviceName = prefs.deviceName,
            batteryPercent = 100,
            charging = false,
            online = true,
            trackingEnabled = false,
            kidGuardActive = prefs.isLocked,
            lastSeen = System.currentTimeMillis(),
            appVersion = "1.0.0",
            androidVersion = android.os.Build.VERSION.RELEASE
        )
        
        val statusPath = "${FirebaseConfig.COL_CHILDREN}/$childId/status/current"
        Log.d(TAG, "Syncing initial status to: $statusPath")

        try {
            db.collection(FirebaseConfig.COL_CHILDREN)
                .document(childId)
                .collection("status")
                .document("current")
                .set(status, com.google.firebase.firestore.SetOptions.merge())
                .await()
            Log.i(TAG, "Initial status sync SUCCESS for $childId")
        } catch (e: Exception) {
            val firebaseErrorCode = (e as? com.google.firebase.firestore.FirebaseFirestoreException)?.code?.name ?: "UNKNOWN"
            Log.e(TAG, "Failed to sync initial status for $childId at $statusPath. Error: $firebaseErrorCode - ${e.message}")
            // Rethrow to allow generatePairingCode to catch it if desired, 
            // but currently we just log it in generatePairingCode's caller.
            throw e
        }
    }

    suspend fun validateAndPair(code: String): Boolean {
        if (!FirebaseConfig.isFirebaseConfigured(context)) return false
        
        Log.d(TAG, "ANDROID: Validating pair code: $code")
        return try {
            val docRef = db.collection(FirebaseConfig.COL_PAIRING_CODES).document(code)
            val doc = docRef.get().await()
            
            if (doc.exists()) {
                val pairingData = doc.toObject(PairingCodeDoc::class.java)
                if (pairingData != null && 
                    !pairingData.used &&
                    pairingData.expiresAt?.toDate()?.after(Calendar.getInstance().time) == true) {
                    
                    Log.i(TAG, "ANDROID: Valid pair code found for child: ${pairingData.childId}")
                    // Create or update family
                    createOrUpdateFamily(pairingData.deviceId)
                    // Mark as used
                    docRef.update("used", true).await()
                    true
                } else {
                    Log.w(TAG, "ANDROID: Pair code $code is invalid, used, or expired")
                    false
                }
            } else {
                Log.w(TAG, "ANDROID: Pair code $code NOT FOUND in Firestore at ${FirebaseConfig.COL_PAIRING_CODES}/$code")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "ANDROID: Error during pair code validation", e)
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
