package com.example.kidsguard

import android.app.Application
import com.example.kidsguard.sync.FirebaseConfig

class KidsGuardApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Install App Check before activities, workers, receivers, or services use Firebase.
        FirebaseConfig.initializeAppCheck(this)
    }
}
