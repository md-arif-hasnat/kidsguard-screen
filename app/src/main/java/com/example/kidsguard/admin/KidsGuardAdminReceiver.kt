package com.example.kidsguard.admin

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

/**
 * Modern Device Admin Receiver for KidsGuard.
 * This is the entry point for Device Policy Controller (DPC) features.
 */
class KidsGuardAdminReceiver : DeviceAdminReceiver() {
    
    companion object {
        private const val TAG = "KidsGuardAdmin"

        fun getComponentName(context: Context): ComponentName {
            return ComponentName(context.applicationContext, KidsGuardAdminReceiver::class.java)
        }

        fun isAdminActive(context: Context): Boolean {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            return dpm.isAdminActive(getComponentName(context))
        }

        fun getRequestIntent(context: Context): Intent {
            return Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, getComponentName(context))
                putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "KidsGuard needs system protection to manage app limits and prevent unauthorized removal.")
            }
        }
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device Admin Enabled")
        Toast.makeText(context, "KidsGuard Protection Enabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Device Admin Disabled")
        Toast.makeText(context, "KidsGuard Protection Disabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence? {
        // Warning message shown to user when they try to disable admin
        return "Disabling KidsGuard will stop parental controls and wellbeing features."
    }
}
