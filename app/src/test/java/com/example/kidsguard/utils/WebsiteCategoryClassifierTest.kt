package com.example.kidsguard.utils

import android.content.Context
import com.example.kidsguard.models.WebsiteCategory
import com.example.kidsguard.models.WebsiteRiskLevel
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class WebsiteCategoryClassifierTest {

    private lateinit var classifier: WebsiteCategoryClassifier
    private val testDomainMap = mapOf(
        "google.com" to WebsiteCategory.SEARCH,
        "wikipedia.org" to WebsiteCategory.EDUCATION,
        "youtube.com" to WebsiteCategory.VIDEO,
        "facebook.com" to WebsiteCategory.SOCIAL_MEDIA,
        "bet365.com" to WebsiteCategory.GAMBLING
    )

    @Before
    fun setup() {
        // We don't need a real context since we use the test constructor
        // But we need to pass something that satisfies the type system if not using mocks
        // Let's use a simple anonymous implementation or just null if the code allows (it doesn't in init)
        // I'll skip mocking and just test the classify logic by making a slight change to the class
    }

    @Test
    fun testExactDomainMatch() {
        val classifier = WebsiteCategoryClassifier(null, testDomainMap)
        
        val result = classifier.classify("https://google.com", "google.com", null)
        assertEquals(WebsiteCategory.SEARCH, result.category)
        assertEquals(WebsiteRiskLevel.SAFE, result.riskLevel)
        assertEquals(1.0f, result.confidence)
        assertEquals("exact_domain", result.source)
    }

    @Test
    fun testSubdomainMatch() {
        val classifier = WebsiteCategoryClassifier(null, testDomainMap)
        val result = classifier.classify("https://m.facebook.com", "m.facebook.com", null)
        assertEquals(WebsiteCategory.SOCIAL_MEDIA, result.category)
        assertEquals(0.95f, result.confidence)
        assertEquals("parent_domain", result.source)
    }

    @Test
    fun testKeywordMatch() {
        val classifier = WebsiteCategoryClassifier(null, testDomainMap)
        val result = classifier.classify("https://poker-stars.net", "poker-stars.net", null)
        assertEquals(WebsiteCategory.GAMBLING, result.category)
        assertEquals(WebsiteRiskLevel.RESTRICTED, result.riskLevel)
        assertEquals("domain_keyword", result.source)
    }

    @Test
    fun testTitleMatch() {
        val classifier = WebsiteCategoryClassifier(null, testDomainMap)
        val result = classifier.classify(null, null, "History Course Online")
        assertEquals(WebsiteCategory.EDUCATION, result.category)
        assertEquals("title_keyword", result.source)
    }

    @Test
    fun testUnknown() {
        val classifier = WebsiteCategoryClassifier(null, testDomainMap)
        val result = classifier.classify("https://random-site-123.xyz", "random-site-123.xyz", null)
        assertEquals(WebsiteCategory.UNKNOWN, result.category)
    }
}
