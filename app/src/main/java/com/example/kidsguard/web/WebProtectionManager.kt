package com.example.kidsguard.web

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.RemoteSyncProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.net.URI

class WebProtectionManager(
    private val context: Context,
    private val prefHelper: PreferenceHelper,
    private val syncProvider: RemoteSyncProvider
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    
    private val _rules = MutableStateFlow(WebRuleSet())
    val rules: StateFlow<WebRuleSet> = _rules

    companion object {
        private const val TAG = "WebProtectionManager"
    }

    init {
        startRulesListener()
    }

    private fun startRulesListener() {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        scope.launch {
            syncProvider.getWebRules(childId).collectLatest { syncRules ->
                _rules.value = syncRules ?: WebRuleSet()
            }
        }
    }

    fun checkUrl(url: String, browserApp: String): Boolean {
        val domain = getDomain(url) ?: return true // Can't parse, allow
        val currentRules = _rules.value
        
        // 1. Check Allow List
        if (currentRules.allowedDomains.any { domain.contains(it) }) return true
        
        // 2. Check Block List
        if (currentRules.blockedDomains.any { domain.contains(it) }) {
            syncActivity(domain, WebCategory.UNKNOWN, browserApp, "BLOCKED")
            return false
        }
        
        // 3. Category Check (MVP: Local rules)
        val category = classifyUrl(url)
        if (currentRules.blockedCategories.contains(category)) {
            syncActivity(domain, category, browserApp, "BLOCKED")
            return false
        }
        
        // Adult Content Global Toggle
        if (currentRules.adultContentBlockEnabled && isAdultContent(url)) {
            syncActivity(domain, WebCategory.ADULT, browserApp, "BLOCKED")
            return false
        }

        syncActivity(domain, category, browserApp, "ALLOWED")
        return true
    }

    private fun getDomain(url: String): String? {
        return try {
            val uri = URI(url)
            val domain = uri.host ?: url
            domain.removePrefix("www.")
        } catch (e: Exception) {
            null
        }
    }

    private fun classifyUrl(url: String): WebCategory {
        val lowerUrl = url.lowercase()
        return when {
            lowerUrl.contains("google.com/search") || lowerUrl.contains("bing.com") -> WebCategory.SEARCH
            lowerUrl.contains("youtube.com") || lowerUrl.contains("netflix.com") -> WebCategory.VIDEO
            lowerUrl.contains("facebook.com") || lowerUrl.contains("tiktok.com") || lowerUrl.contains("instagram.com") -> WebCategory.SOCIAL
            lowerUrl.contains("roblox.com") || lowerUrl.contains("steam") -> WebCategory.GAMING
            lowerUrl.contains("wikipedia.org") || lowerUrl.contains("coursera") -> WebCategory.EDUCATION
            lowerUrl.contains("amazon.com") || lowerUrl.contains("ebay") -> WebCategory.SHOPPING
            else -> WebCategory.SAFE
        }
    }

    private fun isAdultContent(url: String): Boolean {
        // Placeholder for a real safety API or large blocklist
        val risky = listOf("porn", "sex", "casino", "gamble", "bet", "xxx")
        return risky.any { url.lowercase().contains(it) }
    }

    private fun syncActivity(domain: String, category: WebCategory, browser: String, status: String) {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        scope.launch {
            syncProvider.syncWebActivity(childId, WebActivityEvent(
                domain = domain,
                category = category,
                browserApp = browser,
                status = status
            ))
        }
    }

    fun requestAccess(domain: String) {
        val childId = prefHelper.childId
        if (childId.isEmpty()) return

        scope.launch {
            syncProvider.createWebAccessRequest(WebAccessRequest(
                requestId = java.util.UUID.randomUUID().toString(),
                childId = childId,
                domain = domain
            ))
        }
    }
}
