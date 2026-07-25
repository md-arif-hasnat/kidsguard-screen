package com.example.kidsguard.utils

import android.util.Log
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.models.WebsiteDecision
import com.example.kidsguard.models.WebsiteDecisionResult
import com.example.kidsguard.models.WebsitePolicy

object WebsitePolicyEngine {
    private const val TAG = "POLICY_ENGINE"

    fun evaluate(history: BrowserHistory, policy: WebsitePolicy): WebsiteDecisionResult {
        if (!policy.enabled) {
            return WebsiteDecisionResult(WebsiteDecision.ALLOW, "Policy disabled")
        }

        val domain = history.domain?.lowercase() ?: ""
        val category = history.category
        val riskLevel = history.riskLevel

        // 1. Allowed Domain
        if (domain.isNotEmpty()) {
            if (policy.allowedDomains.contains(domain) || policy.allowedDomains.any { domain.endsWith(".$it") }) {
                logD("Allowed Domain: $domain")
                return WebsiteDecisionResult(WebsiteDecision.ALLOW, "Matched allowed domain", matchedDomain = domain)
            }
        }

        // 2. Blocked Domain
        if (domain.isNotEmpty()) {
            if (policy.blockedDomains.contains(domain) || policy.blockedDomains.any { domain.endsWith(".$it") }) {
                logI("Blocked Domain: $domain")
                return WebsiteDecisionResult(WebsiteDecision.BLOCK, "Matched blocked domain", matchedDomain = domain)
            }
        }

        // 3. Allowed Category
        if (policy.allowedCategories.contains(category)) {
            logD("Allowed Category: $category for $domain")
            return WebsiteDecisionResult(WebsiteDecision.ALLOW, "Matched allowed category", matchedCategory = category)
        }

        // 4. Blocked Category
        if (policy.blockedCategories.contains(category)) {
            logI("Blocked Category: $category for $domain")
            return WebsiteDecisionResult(WebsiteDecision.BLOCK, "Matched blocked category", matchedCategory = category)
        }

        // 5. Risk Level
        val riskDecision = policy.riskLevels[riskLevel] ?: WebsiteDecision.ALLOW
        if (riskDecision != WebsiteDecision.ALLOW) {
            logI("Risk Level Decision ($riskDecision): $riskLevel for $domain")
            return WebsiteDecisionResult(riskDecision, "Matched risk level: $riskLevel")
        }

        // 6. Default Allow
        return WebsiteDecisionResult(WebsiteDecision.ALLOW, "Default policy allow")
    }

    private fun logD(msg: String) {
        try {
            Log.d(TAG, msg)
        } catch (e: Exception) {
            // Probably running in a unit test environment where Log is not mocked
            println("$TAG [D]: $msg")
        }
    }

    private fun logI(msg: String) {
        try {
            Log.i(TAG, msg)
        } catch (e: Exception) {
            // Probably running in a unit test environment where Log is not mocked
            println("$TAG [I]: $msg")
        }
    }
}
