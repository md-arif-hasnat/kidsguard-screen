package com.example.kidsguard.utils

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.content.ComponentName
import com.example.kidsguard.KidGuardAccessibilityService
//import android.provider.Settings
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityManager
import androidx.core.content.ContextCompat

object PermissionUtils {

    fun hasLocationPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasAudioPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasBackgroundLocationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    fun hasMediaPermissions(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val images = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
            val video = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
            val audio = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED
            images && video && audio
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
    }

    fun hasMediaLocationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_MEDIA_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun isAccessibilityServiceEnabled(context: Context): Boolean {
        return try {
            val componentName = ComponentName(
                context,
                KidGuardAccessibilityService::class.java
            )

            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false

            enabledServices.contains(
                componentName.flattenToString(),
                ignoreCase = true
            )
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Safely checks if the system's Live Caption service is enabled.
     * Prevents IllegalArgumentException: Unknown component: ComponentInfo{com.google.android.as/com.google.android.apps.miphone.aiai.captions.CaptionsService}
     * which occurs on some Google devices when the service is registered but not found.
     */
    fun isCaptionsServiceEnabled(context: Context): Boolean {
        return try {
            val captionsComponent = ComponentName(
                "com.google.android.as",
                "com.google.android.apps.miphone.aiai.captions.CaptionsService"
            )
            
            // Verify component existence to avoid "Unknown component" errors
            try {
                context.packageManager.getServiceInfo(captionsComponent, 0)
            } catch (e: PackageManager.NameNotFoundException) {
                return false
            }

            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            
            enabledServices.contains(captionsComponent.flattenToString(), ignoreCase = true)
        } catch (e: Exception) {
            false
        }
    }

    fun hasUsageStatsPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        } else {
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun isAdbEnabled(context: Context): Boolean {
        return Settings.Global.getInt(context.contentResolver, Settings.Global.ADB_ENABLED, 0) != 0
    }

    fun isDeveloperOptionsEnabled(context: Context): Boolean {
        return Settings.Global.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) != 0
    }

    fun isUsbConnected(context: Context): Boolean {
        val intent = context.registerReceiver(null, android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED))
        val plugged = intent?.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        return plugged == android.os.BatteryManager.BATTERY_PLUGGED_USB
    }

    /**
     * Safely checks for Ethernet support without triggering the ServiceNotFoundException
     * found in some Android versions when calling getSystemService(Context.ETHERNET_SERVICE)
     */
    fun hasEthernetSupport(context: Context): Boolean {
        return try {
            // 1. Check feature first - this is safest
            if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_ETHERNET)) return true
            
            // 2. Check via ConnectivityManager to avoid direct EthernetManager access
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                cm?.allNetworks?.any { network ->
                    cm.getNetworkCapabilities(network)?.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET) == true
                } ?: false
            } else {
                false
            }
        } catch (e: Exception) {
            // Guard against any internal SystemServiceRegistry crashes
            false
        }
    }

    /**
     * Checks if the StorageManagerService is responsive.
     * Detects:
     * 1. java.util.concurrent.TimeoutException at StorageUserConnection.waitForAsync
     * 2. android.os.ServiceSpecificException: (code -5) - ERROR_IO_EXCEPTION
     * which occurs on some Android 11+ builds when the FUSE/MediaProvider connection hangs or vold is unresponsive.
     */
    fun isStorageSystemHealthy(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return true
        
        return try {
            val sm = context.getSystemService(Context.STORAGE_SERVICE) as? android.os.storage.StorageManager
                ?: return true
            
            // Probing storage volumes can trigger the StorageUserConnection timeout or ServiceSpecificException.
            // We use a short-lived thread to avoid blocking the caller.
            val executor = java.util.concurrent.Executors.newSingleThreadExecutor()
            val future = executor.submit(java.util.concurrent.Callable {
                sm.storageVolumes
            })
            
            try {
                // 1.5 second timeout is sufficient to detect a system-level stall (usually 20s)
                future.get(1500, java.util.concurrent.TimeUnit.MILLISECONDS)
                true
            } catch (e: java.util.concurrent.TimeoutException) {
                future.cancel(true)
                false
            } catch (t: Throwable) {
                // Catch ExecutionException (wrapping ServiceSpecificException) or any other errors
                false
            } finally {
                executor.shutdownNow()
            }
        } catch (t: Throwable) {
            false
        }
    }
}
