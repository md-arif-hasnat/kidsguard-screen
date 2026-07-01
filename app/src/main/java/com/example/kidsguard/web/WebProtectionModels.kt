package com.example.kidsguard.web

import androidx.annotation.Keep

enum class WebCategory {
    SAFE, EDUCATION, SEARCH, VIDEO, SOCIAL, GAMING, SHOPPING, 
    UNKNOWN, ADULT, GAMBLING, VIOLENCE, DRUGS, PHISHING, SCAM, MALWARE
}

@Keep
data class WebRuleSet(
    var blockedDomains: List<String> = emptyList(),
    var allowedDomains: List<String> = emptyList(),
    var blockedCategories: List<WebCategory> = emptyList(),
    var allowedCategories: List<WebCategory> = emptyList(),
    var safeSearchEnabled: Boolean = true,
    var youtubeRestrictedMode: Boolean = true,
    var adultContentBlockEnabled: Boolean = true
)

@Keep
data class WebActivityEvent(
    var domain: String = "",
    var category: WebCategory = WebCategory.UNKNOWN,
    var timestamp: Long = System.currentTimeMillis(),
    var browserApp: String = "",
    var status: String = "ALLOWED" // "ALLOWED" or "BLOCKED"
)

@Keep
data class WebAccessRequest(
    var requestId: String = "",
    var childId: String = "",
    var domain: String = "",
    var timestamp: Long = System.currentTimeMillis(),
    var status: String = "PENDING" // "PENDING", "APPROVED", "DENIED"
)
