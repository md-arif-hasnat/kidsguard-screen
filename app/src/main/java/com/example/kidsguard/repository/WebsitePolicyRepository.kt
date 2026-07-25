package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.models.WebsitePolicy
import com.google.gson.Gson
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class WebsitePolicyRepository(context: Context) {
    private val prefs = context.getSharedPreferences("website_policy_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val TAG = "POLICY_ENGINE"

    private val _policy = MutableStateFlow(loadPolicyInternal())
    val policy: StateFlow<WebsitePolicy> = _policy

    fun savePolicy(newPolicy: WebsitePolicy) {
        newPolicy.updatedAt = System.currentTimeMillis()
        val json = gson.toJson(newPolicy)
        prefs.edit().putString("current_policy", json).apply()
        _policy.value = newPolicy
        Log.i(TAG, "Policy saved successfully: ${newPolicy.id}")
    }

    fun loadPolicy(): WebsitePolicy {
        return _policy.value
    }

    fun updatePolicy(updater: (WebsitePolicy) -> WebsitePolicy) {
        val current = loadPolicy()
        val updated = updater(current)
        savePolicy(updated)
    }

    fun deletePolicy() {
        prefs.edit().remove("current_policy").apply()
        _policy.value = WebsitePolicy()
        Log.i(TAG, "Policy deleted/reset to default")
    }

    private fun loadPolicyInternal(): WebsitePolicy {
        val json = prefs.getString("current_policy", null)
        return if (json != null) {
            try {
                gson.fromJson(json, WebsitePolicy::class.java)
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing policy, returning default", e)
                WebsitePolicy()
            }
        } else {
            WebsitePolicy()
        }
    }
}
