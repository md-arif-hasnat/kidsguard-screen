package com.example.kidsguard.admin

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.FirebaseConfig
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore

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
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "KidsGuard needs system protection to manage " +
                            "app limits and prevent unauthorized removal."
                )
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
        val prefHelper = PreferenceHelper(context)

        val childId = prefHelper.childId
        val familyId = prefHelper.familyId

        if (!childId.isNullOrBlank() && !familyId.isNullOrBlank()) {
            val notification = mapOf(
                "type" to "TAMPER_ALERT",
                "title" to "Security Alert",
                "body" to "KidsGuard Device Admin protection was disabled.",
                "reason" to "DEVICE_ADMIN_DISABLED",
                "childId" to childId,
                "childName" to prefHelper.childName,
                "familyId" to familyId,
                "createdAt" to FieldValue.serverTimestamp(),
                "read" to false,
                "clickAction" to "/dashboard/$childId"
            )

            FirebaseFirestore.getInstance()
                .collection(FirebaseConfig.COL_NOTIFICATIONS)
                .add(notification)
                .addOnSuccessListener {
                    Log.i(TAG, "DEVICE_ADMIN_TAMPER_ALERT_SENT")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "DEVICE_ADMIN_TAMPER_ALERT_FAILED", e)
                }
        }
        Toast.makeText(context, "KidsGuard Protection Disabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        Log.w(TAG, "Device Admin disable requested")

        return "KidsGuard Protection is active. Disabling this protection may allow the app to be removed and parental safety features to stop."
    }
}
