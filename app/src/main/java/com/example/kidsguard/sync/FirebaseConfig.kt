package com.example.kidsguard.sync

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

object FirebaseConfig {
    
    /**
     * Initializes Firebase App Check with the appropriate provider.
     * This is called on startup to protect backend resources.
     */
    fun initializeAppCheck(context: Context) {
        if (!isFirebaseConfigured(context)) return

        try {
            val firebaseAppCheck = FirebaseAppCheck.getInstance()
            
            // Use Debug provider for development (Debug builds)
            // Use Play Integrity provider for production (Release builds)
            if (com.example.kidsguard.BuildConfig.DEBUG) {
                firebaseAppCheck.installAppCheckProviderFactory(
                    DebugAppCheckProviderFactory.getInstance()
                )
            } else {
                firebaseAppCheck.installAppCheckProviderFactory(
                    PlayIntegrityAppCheckProviderFactory.getInstance()
                )
            }
        } catch (e: Exception) {
            // Log to internal logger if available later
        }
    }

    /**
     * Checks if Firebase is properly configured in the app.
     * This is determined by the presence of google-services.json and successful initialization.
     */
    fun isFirebaseConfigured(context: Context): Boolean {
        return try {
            FirebaseApp.getInstance()
            // If getInstance doesn't throw, it's configured
            true
        } catch (e: Exception) {
            // Check if it can be initialized (it might not be if google-services.json is missing)
            try {
                // This will fail if google-services.json is missing
                FirebaseApp.getApps(context).isNotEmpty()
            } catch (ex: Exception) {
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
    const val COL_ACTIVITY = "activity"
    const val COL_SAFE_ZONES = "safeZones"
    const val COL_REMOTE_COMMANDS = "remoteCommands"
    const val COL_NOTIFICATIONS = "notifications"
    const val COL_PAIRING_CODES = "pairingCodes"
}
