package com.example.kidsguard.models

import androidx.annotation.Keep

@Keep
enum class WebsiteCategory {
    EDUCATION,
    SEARCH,
    SOCIAL_MEDIA,
    VIDEO,
    NEWS,
    GAMING,
    SHOPPING,
    COMMUNICATION,
    STREAMING,
    MUSIC,
    PRODUCTIVITY,
    TECHNOLOGY,
    FINANCE,
    HEALTH,
    TRAVEL,
    FOOD,
    GOVERNMENT,
    ADULT,
    GAMBLING,
    VIOLENCE,
    DRUGS,
    UNKNOWN;

    fun getDisplayName(): String {
        return name.lowercase().replace("_", " ").capitalize()
    }
}

@Keep
enum class WebsiteRiskLevel {
    SAFE,
    CAUTION,
    RESTRICTED,
    UNKNOWN
}
