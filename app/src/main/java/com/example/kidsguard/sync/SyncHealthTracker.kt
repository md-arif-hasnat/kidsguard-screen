package com.example.kidsguard.sync

import android.content.Context

data class SyncHealthSnapshot(
    val healthy: Boolean,
    val failureCount: Int,
    val failureSource: String?,
    val lastFailureAt: Long,
    val lastSuccessAt: Long,
    val errorMessage: String?
)

/** Persists small, non-sensitive sync diagnostics for the parent dashboard. */
class SyncHealthTracker(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    fun recordSuccess(source: String) {
        prefs.edit()
            .putInt(key(source, "failures"), 0)
            .putLong(key(source, "success_at"), System.currentTimeMillis())
            .remove(key(source, "error"))
            .apply()
    }

    fun recordFailure(source: String, error: Throwable?) {
        val count = prefs.getInt(key(source, "failures"), 0) + 1
        val safeMessage = error?.message
            ?.replace(Regex("[\\r\\n]+"), " ")
            ?.take(160)
            ?: "Unknown sync error"

        prefs.edit()
            .putInt(key(source, "failures"), count)
            .putLong(key(source, "failure_at"), System.currentTimeMillis())
            .putString(key(source, "error"), safeMessage)
            .apply()
    }

    fun snapshot(): SyncHealthSnapshot {
        val worstSource = SOURCES.maxByOrNull {
            prefs.getInt(key(it, "failures"), 0)
        }
        val failureCount = worstSource?.let {
            prefs.getInt(key(it, "failures"), 0)
        } ?: 0
        val lastSuccessAt = SOURCES.maxOfOrNull {
            prefs.getLong(key(it, "success_at"), 0L)
        } ?: 0L

        return SyncHealthSnapshot(
            healthy = failureCount < WARNING_THRESHOLD,
            failureCount = failureCount,
            failureSource = worstSource?.takeIf { failureCount > 0 },
            lastFailureAt = worstSource?.let {
                prefs.getLong(key(it, "failure_at"), 0L)
            } ?: 0L,
            lastSuccessAt = lastSuccessAt,
            errorMessage = worstSource?.let {
                prefs.getString(key(it, "error"), null)
            }
        )
    }

    private fun key(source: String, suffix: String) =
        "${source.lowercase()}_$suffix"

    companion object {
        const val APP_USAGE = "APP_USAGE"
        const val YOUTUBE = "YOUTUBE"
        const val BROWSER = "BROWSER"
        private const val PREFS_NAME = "sync_health_prefs"
        private const val WARNING_THRESHOLD = 3
        private val SOURCES = listOf(APP_USAGE, YOUTUBE, BROWSER)
    }
}
