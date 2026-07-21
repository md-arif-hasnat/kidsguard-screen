package com.example.kidsguard.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.kidsguard.repository.InstalledAppsRepository

class AppInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_PACKAGE_ADDED) {
            val packageName = intent.data?.encodedSchemeSpecificPart
            val replacing = intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)

            if (packageName != null && !replacing) {
                Log.i("AppInstallReceiver", "Package added: $packageName")
                InstalledAppsRepository(context).handlePackageAdded(packageName)
            }
        }
    }
}
