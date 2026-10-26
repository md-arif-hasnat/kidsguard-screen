package com.example.kidsguard.sync

import android.content.Context
import android.util.Log
import com.example.kidsguard.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

object FirebaseConfig {
    private const val TAG = "FirebaseConfig"

    @Volatile
    private var appCheckInitialized = false
    
    /**
     * Initializes Firebase App Check with the appropriate provider.
     * This is called on startup to protect backend resources.
     */
    @Synchronized
    fun initializeAppCheck(context: Context) {
        if (appCheckInitialized) return

        if (!isFirebaseConfigured(context)) {
            Log.w(TAG, "Skipping App Check: Firebase not configured")
            return
        }

        try {
            val firebaseAppCheck = FirebaseAppCheck.getInstance()

            // Use Debug provider for development (Debug builds)
            // Use Play Integrity provider for production (Release builds)
            if (BuildConfig.DEBUG) {
                firebaseAppCheck.installAppCheckProviderFactory(
                    DebugAppCheckProviderFactory.getInstance()
                )
            } else {
                firebaseAppCheck.installAppCheckProviderFactory(
                    PlayIntegrityAppCheckProviderFactory.getInstance()
                )
            }
            appCheckInitialized = true
            Log.i(
                TAG,
                "App Check initialized with ${if (BuildConfig.DEBUG) "Debug" else "Play Integrity"} provider"
            )
        } catch (e: Exception) {
            Log.e(TAG, "App Check initialization failed", e)
        }
    }

    /**
     * Checks if Firebase is properly configured in the app.
     * This is determined by the presence of google-services.json and successful initialization.
     */
    fun isFirebaseConfigured(context: Context): Boolean {
        return try {
            FirebaseApp.getInstance()
            true
        } catch (e: Exception) {
            Log.w(TAG, "FirebaseApp.getInstance() failed: ${e.message}")
            try {
                val hasApps = FirebaseApp.getApps(context).isNotEmpty()
                if (!hasApps) {
                    Log.w(TAG, "No Firebase Apps found in context")
                }
                hasApps
            } catch (ex: Exception) {
                Log.e(TAG, "Error checking for Firebase Apps", ex)
                false
            }
        }
    }

    fun currentProviderName(context: Context): String {
        return if (isFirebaseConfigured(context)) "Firebase" else "Local Mock"
    }

    fun shouldUseFirebase(context: Context): Boolean {
        // Future: Could add a setting to force Mock even if Firebase is available
        return isFirebaseConfigured(context)
    }

    // Firestore Collection Names
    const val COL_DEVICES = "devices"
    const val COL_PARENTS = "parents"
    const val COL_CHILDREN = "children"
    const val COL_FAMILIES = "families"
    const val COL_LOCATIONS = "locations"
    const val COL_ACTIVITY = "activities"
    const val COL_SAFE_ZONES = "safeZones"
    const val COL_REMOTE_COMMANDS = "remoteCommands"
    const val COL_NOTIFICATIONS = "notifications"
    const val COL_PAIRING_CODES = "pairingCodes"
    const val COL_APP_CONFIG = "appConfig"
}
