package com.example.kidsguard.models

import androidx.annotation.Keep
import java.util.UUID

@Keep
data class BrowserHistory(
    val id: String = UUID.randomUUID().toString(),
    val url: String?,
    val domain: String?,
    val pageTitle: String?,
    val browserPackage: String,
    val startedAt: Long = System.currentTimeMillis(),
    var endedAt: Long? = null,
    var durationSeconds: Long = 0,
    val capturedAt: Long = System.currentTimeMillis(),
    
    // Phase 8G - Category Detection
    var category: WebsiteCategory = WebsiteCategory.UNKNOWN,
    var categoryConfidence: Float = 0f,
    var categorySource: String? = null,
    var categorizedAt: Long? = null,
    var riskLevel: WebsiteRiskLevel = WebsiteRiskLevel.UNKNOWN,

    // Sync fields
    var isSynced: Boolean = false,
    var deviceId: String? = null,
    var uploadedAt: Long? = null,
    var syncVersion: Int = 1,
    var createdBy: String? = null // Child ID
)
