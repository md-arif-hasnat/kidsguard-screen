package com.example.kidsguard.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.kidsguard.repository.InstalledAppsRepository

class AppInstallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val packageName =
            intent.data?.schemeSpecificPart?.takeIf { it.isNotBlank() }
                ?: return

        val replacing =
            intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)

        when (intent.action) {

            Intent.ACTION_PACKAGE_ADDED -> {
                if (replacing) return

                Log.i(
                    "AppInstallMonitor",
                    "New package added: $packageName"
                )

                InstalledAppsRepository(context.applicationContext)
                    .handlePackageAdded(packageName)
            }

            Intent.ACTION_PACKAGE_REMOVED -> {
                if (replacing) return

                Log.i(
                    "AppInstallMonitor",
                    "Package removed: $packageName"
                )

                InstalledAppsRepository(context.applicationContext)
                    .handlePackageRemoved(packageName)
            }
        }
    }


    companion object {
        private const val TAG = "AppInstallReceiver"
    }
}


