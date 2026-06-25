package com.example.kidsguard.web

enum class WebCategory {
    SAFE, EDUCATION, SEARCH, VIDEO, SOCIAL, GAMING, SHOPPING, 
    UNKNOWN, ADULT, GAMBLING, VIOLENCE, DRUGS, PHISHING, SCAM, MALWARE
}

data class WebRuleSet(
    val blockedDomains: List<String> = emptyList(),
    val allowedDomains: List<String> = emptyList(),
    val blockedCategories: List<WebCategory> = emptyList(),
    val allowedCategories: List<WebCategory> = emptyList(),
    val safeSearchEnabled: Boolean = true,
    val youtubeRestrictedMode: Boolean = true,
    val adultContentBlockEnabled: Boolean = true
)

data class WebActivityEvent(
    val domain: String,
    val category: WebCategory,
    val timestamp: Long = System.currentTimeMillis(),
    val browserApp: String,
    val status: String // "ALLOWED" or "BLOCKED"
)

data class WebAccessRequest(
    val requestId: String,
    val childId: String,
    val domain: String,
    val timestamp: Long = System.currentTimeMillis(),
    val status: String = "PENDING" // "PENDING", "APPROVED", "DENIED"
)
