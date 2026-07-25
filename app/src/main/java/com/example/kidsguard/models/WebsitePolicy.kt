package com.example.kidsguard.models

import androidx.annotation.Keep
import java.util.UUID

@Keep
data class WebsitePolicy(
    val id: String = UUID.randomUUID().toString(),
    val enabled: Boolean = true,
    val blockedDomains: Set<String> = emptySet(),
    val allowedDomains: Set<String> = emptySet(),
    val blockedCategories: Set<WebsiteCategory> = emptySet(),
    val allowedCategories: Set<WebsiteCategory> = emptySet(),
    val riskLevels: Map<WebsiteRiskLevel, WebsiteDecision> = mapOf(
        WebsiteRiskLevel.SAFE to WebsiteDecision.ALLOW,
        WebsiteRiskLevel.CAUTION to WebsiteDecision.ALLOW,
        WebsiteRiskLevel.RESTRICTED to WebsiteDecision.BLOCK,
        WebsiteRiskLevel.UNKNOWN to WebsiteDecision.ALLOW
    ),
    val createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = System.currentTimeMillis()
)

@Keep
enum class WebsiteDecision {
    ALLOW,
    WARN,
    BLOCK
}

@Keep
data class WebsiteDecisionResult(
    val decision: WebsiteDecision,
    val reason: String,
    val matchedRule: String? = null,
    val matchedCategory: WebsiteCategory? = null,
    val matchedDomain: String? = null
)
