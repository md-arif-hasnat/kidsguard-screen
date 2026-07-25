package com.example.kidsguard.utils

import com.example.kidsguard.models.*
import org.junit.Assert.assertEquals
import org.junit.Test

class WebsitePolicyEngineTest {

    @Test
    fun testAllowedDomainPriority() {
        val policy = WebsitePolicy(
            allowedDomains = setOf("school.facebook.com"),
            blockedDomains = setOf("facebook.com"),
            blockedCategories = setOf(WebsiteCategory.SOCIAL_MEDIA)
        )
        
        val history = BrowserHistory(
            url = "https://school.facebook.com",
            domain = "school.facebook.com",
            pageTitle = null,
            browserPackage = "chrome",
            category = WebsiteCategory.SOCIAL_MEDIA
        )
        
        val result = WebsitePolicyEngine.evaluate(history, policy)
        assertEquals(WebsiteDecision.ALLOW, result.decision)
        assertEquals("school.facebook.com", result.matchedDomain)
    }

    @Test
    fun testBlockedDomain() {
        val policy = WebsitePolicy(
            blockedDomains = setOf("facebook.com")
        )
        
        val history = BrowserHistory(
            url = "https://www.facebook.com",
            domain = "facebook.com",
            pageTitle = null,
            browserPackage = "chrome",
            category = WebsiteCategory.SOCIAL_MEDIA
        )
        
        val result = WebsitePolicyEngine.evaluate(history, policy)
        assertEquals(WebsiteDecision.BLOCK, result.decision)
    }

    @Test
    fun testBlockedCategory() {
        val policy = WebsitePolicy(
            blockedCategories = setOf(WebsiteCategory.GAMBLING)
        )
        
        val history = BrowserHistory(
            url = "https://bet365.com",
            domain = "bet365.com",
            pageTitle = null,
            browserPackage = "chrome",
            category = WebsiteCategory.GAMBLING
        )
        
        val result = WebsitePolicyEngine.evaluate(history, policy)
        assertEquals(WebsiteDecision.BLOCK, result.decision)
        assertEquals(WebsiteCategory.GAMBLING, result.matchedCategory)
    }

    @Test
    fun testRiskLevelCaution() {
        val policy = WebsitePolicy(
            riskLevels = mapOf(WebsiteRiskLevel.CAUTION to WebsiteDecision.WARN)
        )
        
        val history = BrowserHistory(
            url = "https://instagram.com",
            domain = "instagram.com",
            pageTitle = null,
            browserPackage = "chrome",
            category = WebsiteCategory.SOCIAL_MEDIA,
            riskLevel = WebsiteRiskLevel.CAUTION
        )
        
        val result = WebsitePolicyEngine.evaluate(history, policy)
        assertEquals(WebsiteDecision.WARN, result.decision)
    }

    @Test
    fun testDefaultAllow() {
        val policy = WebsitePolicy()
        val history = BrowserHistory(
            url = "https://google.com",
            domain = "google.com",
            pageTitle = null,
            browserPackage = "chrome",
            category = WebsiteCategory.SEARCH,
            riskLevel = WebsiteRiskLevel.SAFE
        )
        
        val result = WebsitePolicyEngine.evaluate(history, policy)
        assertEquals(WebsiteDecision.ALLOW, result.decision)
    }
}
