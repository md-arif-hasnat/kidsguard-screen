package com.example.kidsguard.utils

import android.content.Context
import android.util.Log
import com.example.kidsguard.R
import com.example.kidsguard.models.WebsiteCategory
import com.example.kidsguard.models.WebsiteRiskLevel
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.Locale

data class WebsiteClassificationResult(
    val category: WebsiteCategory,
    val riskLevel: WebsiteRiskLevel,
    val confidence: Float,
    val source: String,
    val matchedRule: String? = null
)

class WebsiteCategoryClassifier(private val context: Context?) {

    private val TAG = "WEBSITE_CATEGORY"
    private var domainMap: Map<String, WebsiteCategory> = emptyMap()
    private val gson = Gson()

    // Constructor for testing
    constructor(context: Context?, testDomainMap: Map<String, WebsiteCategory>) : this(context) {
        this.domainMap = testDomainMap
    }

    private val keywordRules = mapOf(
        WebsiteCategory.EDUCATION to listOf("learn", "academy", "school", "university", "course", "education", "study"),
        WebsiteCategory.SHOPPING to listOf("shop", "store", "marketplace", "buy", "checkout", "cart"),
        WebsiteCategory.GAMING to listOf("game", "gaming", "play", "arcade"),
        WebsiteCategory.NEWS to listOf("news", "newspaper", "journal", "times", "daily"),
        WebsiteCategory.ADULT to listOf("porn", "sex", "xxx", "adult", "erotic"),
        WebsiteCategory.GAMBLING to listOf("bet", "casino", "poker", "slot", "gamble", "betting")
    )

    init {
        context?.let { loadRules(it) }
    }

    private fun logD(tag: String, msg: String) {
        if (context != null) Log.d(tag, msg)
    }

    private fun logE(tag: String, msg: String, e: Throwable? = null) {
        if (context != null) Log.e(tag, msg, e)
    }

    private fun loadRules(ctx: Context) {
        try {
            val jsonString = ctx.resources.openRawResource(R.raw.website_categories).bufferedReader().use { it.readText() }
            val type = object : TypeToken<Map<String, List<String>>>() {}.type
            val rawMap: Map<String, List<String>> = gson.fromJson(jsonString, type)
            
            val mutableMap = mutableMapOf<String, WebsiteCategory>()
            rawMap.forEach { (catName, domains) ->
                val category = try { WebsiteCategory.valueOf(catName) } catch (e: Exception) { WebsiteCategory.UNKNOWN }
                if (category != WebsiteCategory.UNKNOWN) {
                    domains.forEach { domain ->
                        mutableMap[domain.lowercase(Locale.getDefault())] = category
                    }
                }
            }
            domainMap = mutableMap
            logD(TAG, "Loaded ${domainMap.size} domain rules")
        } catch (e: Exception) {
            logE(TAG, "Failed to load category rules", e)
        }
    }

    fun classify(url: String?, domain: String?, title: String?): WebsiteClassificationResult {
        val normalizedDomain = domain ?: DomainNormalizer.normalize(url) ?: ""
        
        if (normalizedDomain.isNotBlank()) {
            // 1. Exact domain match
            domainMap[normalizedDomain]?.let {
                logD(TAG, "Exact domain matched: $normalizedDomain -> $it")
                return WebsiteClassificationResult(it, getRiskLevel(it), 1.0f, "exact_domain", normalizedDomain)
            }

            // 2. Parent domain match (subdomain check)
            for ((ruleDomain, category) in domainMap) {
                if (normalizedDomain.endsWith(".$ruleDomain")) {
                    logD(TAG, "Parent domain matched: $normalizedDomain ends with $ruleDomain -> $category")
                    return WebsiteClassificationResult(category, getRiskLevel(category), 0.95f, "parent_domain", ruleDomain)
                }
            }

            // 3. Domain keyword match
            for ((category, keywords) in keywordRules) {
                for (keyword in keywords) {
                    if (normalizedDomain.contains(keyword)) {
                        // Only allow restricted categories if matched in domain with higher threshold or specific logic
                        val confidence = if (isRestricted(category)) 0.85f else 0.75f
                        logD(TAG, "Domain keyword matched: $normalizedDomain contains $keyword -> $category")
                        return WebsiteClassificationResult(category, getRiskLevel(category), confidence, "domain_keyword", keyword)
                    }
                }
            }
        }

        // 4. Page title keyword match
        if (!title.isNullOrBlank()) {
            val lowerTitle = title.lowercase(Locale.getDefault())
            for ((category, keywords) in keywordRules) {
                // Skip restricted categories for title-only matching to avoid false positives
                if (isRestricted(category)) continue
                
                for (keyword in keywords) {
                    if (lowerTitle.contains(keyword)) {
                        logD(TAG, "Title keyword matched: '$title' contains $keyword -> $category")
                        return WebsiteClassificationResult(category, getRiskLevel(category), 0.55f, "title_keyword", keyword)
                    }
                }
            }
        }

        return fallbackResult()
    }

    private fun getRiskLevel(category: WebsiteCategory): WebsiteRiskLevel {
        return when (category) {
            WebsiteCategory.EDUCATION,
            WebsiteCategory.SEARCH,
            WebsiteCategory.NEWS,
            WebsiteCategory.PRODUCTIVITY,
            WebsiteCategory.TECHNOLOGY,
            WebsiteCategory.GOVERNMENT,
            WebsiteCategory.HEALTH -> WebsiteRiskLevel.SAFE

            WebsiteCategory.SOCIAL_MEDIA,
            WebsiteCategory.VIDEO,
            WebsiteCategory.GAMING,
            WebsiteCategory.SHOPPING,
            WebsiteCategory.COMMUNICATION,
            WebsiteCategory.STREAMING,
            WebsiteCategory.MUSIC,
            WebsiteCategory.FINANCE,
            WebsiteCategory.TRAVEL,
            WebsiteCategory.FOOD -> WebsiteRiskLevel.CAUTION

            WebsiteCategory.ADULT,
            WebsiteCategory.GAMBLING,
            WebsiteCategory.VIOLENCE,
            WebsiteCategory.DRUGS -> WebsiteRiskLevel.RESTRICTED

            WebsiteCategory.UNKNOWN -> WebsiteRiskLevel.UNKNOWN
        }
    }

    private fun isRestricted(category: WebsiteCategory): Boolean {
        return getRiskLevel(category) == WebsiteRiskLevel.RESTRICTED
    }

    private fun fallbackResult() = WebsiteClassificationResult(
        WebsiteCategory.UNKNOWN,
        WebsiteRiskLevel.UNKNOWN,
        0f,
        "none"
    )
}
