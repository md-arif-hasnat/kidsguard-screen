package com.example.kidsguard.youtube

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.example.kidsguard.BuildConfig
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.Calendar
import java.util.concurrent.TimeUnit

object YouTubeApiClient {

    private const val PREFS_NAME = "yt_api_client_prefs"
    private const val KEY_LAST_SEARCH_TIME = "last_search_time"
    private const val KEY_BACKOFF_UNTIL = "backoff_until"
    private const val KEY_BACKOFF_LEVEL = "backoff_level"
    private const val KEY_DAILY_COUNT = "daily_count"
    private const val KEY_DAILY_DATE = "daily_date"
    private const val KEY_CACHE_JSON = "search_cache_v1"

    private const val SEARCH_COOLDOWN_MS = 15_000L
    private const val DAILY_BUDGET = 80
    private const val CACHE_TTL_MS = 30L * 24 * 60 * 60 * 1000
    private const val MAX_CACHE_ENTRIES = 200
    private val BACKOFF_STEPS_MS = longArrayOf(
        5 * 60_000L,
        15 * 60_000L,
        60 * 60_000L,
        4 * 60 * 60_000L
    )

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private var initialized = false

    @Volatile
    var lastError: String? = null
        private set

    private const val BASE_URL = "https://www.googleapis.com/"

    private data class CacheEntry(
        val videoId: String,
        val youtubeUrl: String,
        val thumbnailUrl: String?,
        val source: String,
        val confidence: Float,
        val savedAt: Long
    )

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
        else HttpLoggingInterceptor.Level.NONE
    }

    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(httpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val service: YouTubeApiService by lazy {
        retrofit.create(YouTubeApiService::class.java)
    }

    /** একবার কল করতে হবে — KidsGuardAccessibilityService.onCreate() এ */
    @Synchronized
    fun init(context: Context) {
        if (initialized) return
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        initialized = true
    }

    fun getApiKey(): String? {
        return BuildConfig.YOUTUBE_API_KEY.trim().takeIf { it.isNotBlank() }
    }

    private fun todayStamp(): Int {
        val cal = Calendar.getInstance()
        return cal.get(Calendar.YEAR) * 10000 + (cal.get(Calendar.MONTH) + 1) * 100 + cal.get(
            Calendar.DAY_OF_MONTH
        )
    }

    private fun normalizeKey(title: String, channel: String?): String {
        fun norm(s: String) = s.lowercase()
            .replace(Regex("""[^a-z0-9\u0980-\u09FF]+"""), " ")
            .trim()
            .replace(Regex("""\s+"""), " ")
        return norm(title) + "|" + norm(channel.orEmpty())
    }

    private fun loadCache(): MutableMap<String, CacheEntry> {
        val json = prefs.getString(KEY_CACHE_JSON, null) ?: return mutableMapOf()
        return try {
            val type = object : TypeToken<MutableMap<String, CacheEntry>>() {}.type
            gson.fromJson(json, type) ?: mutableMapOf()
        } catch (e: Exception) {
            mutableMapOf()
        }
    }

    private fun saveCache(cache: MutableMap<String, CacheEntry>) {
        if (cache.size > MAX_CACHE_ENTRIES) {
            val sorted = cache.entries.sortedBy { it.value.savedAt }
            val toRemove = sorted.take(cache.size - MAX_CACHE_ENTRIES)
            toRemove.forEach { cache.remove(it.key) }
        }
        prefs.edit().putString(KEY_CACHE_JSON, gson.toJson(cache)).apply()
    }

    private fun isInBackoff(): Boolean {
        val until = prefs.getLong(KEY_BACKOFF_UNTIL, 0L)
        return System.currentTimeMillis() < until
    }

    private fun registerBackoff() {
        val level = prefs.getInt(KEY_BACKOFF_LEVEL, 0)
        val duration = BACKOFF_STEPS_MS.getOrElse(level) { BACKOFF_STEPS_MS.last() }
        val until = System.currentTimeMillis() + duration
        prefs.edit()
            .putLong(KEY_BACKOFF_UNTIL, until)
            .putInt(KEY_BACKOFF_LEVEL, (level + 1).coerceAtMost(BACKOFF_STEPS_MS.size - 1))
            .apply()
        Log.w("YouTubeApiClient", "BACKOFF_REGISTERED level=$level untilMs=$until")
    }

    private fun clearBackoff() {
        prefs.edit().putInt(KEY_BACKOFF_LEVEL, 0).putLong(KEY_BACKOFF_UNTIL, 0L).apply()
    }

    private fun dailyBudgetExceeded(): Boolean {
        val today = todayStamp()
        val storedDate = prefs.getInt(KEY_DAILY_DATE, 0)
        if (storedDate != today) {
            prefs.edit().putInt(KEY_DAILY_DATE, today).putInt(KEY_DAILY_COUNT, 0).apply()
            return false
        }
        return prefs.getInt(KEY_DAILY_COUNT, 0) >= DAILY_BUDGET
    }

    private fun incrementDailyCount() {
        val today = todayStamp()
        val storedDate = prefs.getInt(KEY_DAILY_DATE, 0)
        val count = if (storedDate == today) prefs.getInt(KEY_DAILY_COUNT, 0) else 0
        prefs.edit()
            .putInt(KEY_DAILY_DATE, today)
            .putInt(KEY_DAILY_COUNT, count + 1)
            .apply()
    }

    /**
     * Exact-video resolution via YouTube Data API search.
     * Persisted rate limiting + backoff + daily budget + title/channel cache.
     *
     * @param debugLog optional callback to forward status into the in-app
     *   Debug screen (YouTubeHistoryRepository.addDebugLog), since normal
     *   Log.d() calls here are only visible in Logcat.
     */
    suspend fun searchVideos(
        request: YouTubeResolveRequest,
        debugLog: ((String) -> Unit)? = null
    ): YouTubeSearchResponse? {
        check(initialized) { "YouTubeApiClient.init(context) must be called before use" }
        lastError = null

        val apiKey = getApiKey()
        if (apiKey == null) {
            lastError = "YOUTUBE_API_KEY_MISSING"
            Log.e("YouTubeApiClient", lastError!!)
            debugLog?.invoke("YOUTUBE_API_KEY_MISSING")
            return null
        }

        val cacheKey = normalizeKey(request.title, request.channel)
        val cache = loadCache()

        cache[cacheKey]?.let { entry ->
            if (System.currentTimeMillis() - entry.savedAt < CACHE_TTL_MS) {
                Log.d("YouTubeApiClient", "CACHE_HIT key=$cacheKey")
                debugLog?.invoke("YOUTUBE_CACHE_HIT key=$cacheKey id=${entry.videoId}")
                return YouTubeSearchResponse(
                    items = listOf(
                        YouTubeSearchItem(
                            id = YouTubeSearchItemId(videoId = entry.videoId),
                            snippet = YouTubeSearchSnippet(
                                title = request.title,
                                channelTitle = request.channel,
                                thumbnails = null
                            )
                        )
                    )
                )
            } else {
                cache.remove(cacheKey)
            }
        }

        if (isInBackoff()) {
            lastError = "YOUTUBE_BACKOFF_ACTIVE"
            Log.w("YouTubeApiClient", lastError!!)
            debugLog?.invoke("YOUTUBE_BACKOFF_ACTIVE")
            return null
        }

        if (dailyBudgetExceeded()) {
            lastError = "YOUTUBE_DAILY_BUDGET_EXCEEDED"
            Log.w("YouTubeApiClient", lastError!!)
            debugLog?.invoke("YOUTUBE_DAILY_BUDGET_EXCEEDED")
            return null
        }

        val now = System.currentTimeMillis()
        val lastSearchTime = prefs.getLong(KEY_LAST_SEARCH_TIME, 0L)
        if (now - lastSearchTime < SEARCH_COOLDOWN_MS) {
            lastError = "YOUTUBE_SEARCH_COOLDOWN"
            Log.d("YouTubeApiClient", "SEARCH_SKIPPED_COOLDOWN key=$cacheKey")
            debugLog?.invoke("YOUTUBE_SEARCH_SKIPPED_COOLDOWN key=$cacheKey")
            return null
        }

        prefs.edit().putLong(KEY_LAST_SEARCH_TIME, now).apply()

        val searchQuery = buildString {
            append(request.title)
            request.channel?.takeIf { it.isNotBlank() }?.let { append(" ").append(it) }
        }

        debugLog?.invoke("YOUTUBE_API_CALL_STARTED query=$searchQuery")

        return try {
            val response = service.searchVideos(query = searchQuery, apiKey = apiKey)
            clearBackoff()
            incrementDailyCount()

            Log.d(
                "YouTubeApiClient",
                "SEARCH_RESULT items=${response.items.size} query=$searchQuery"
            )
            debugLog?.invoke("YOUTUBE_API_CALL_SUCCESS items=${response.items.size}")

            response.items.firstOrNull()?.id?.videoId?.let { videoId ->
                val thumb = response.items.first().snippet?.thumbnails?.high?.url
                    ?: response.items.first().snippet?.thumbnails?.medium?.url
                cache[cacheKey] = CacheEntry(
                    videoId = videoId,
                    youtubeUrl = YouTubeVideoResolver.buildYouTubeUrl(videoId),
                    thumbnailUrl = thumb,
                    source = "YOUTUBE_SEARCH_API",
                    confidence = 0f,
                    savedAt = now
                )
                saveCache(cache)
            }

            response
        } catch (e: HttpException) {
            if (e.code() == 429) {
                registerBackoff()
                lastError = "HTTP_429_RATE_LIMITED"
                debugLog?.invoke("YOUTUBE_API_429_BACKOFF_REGISTERED")
            } else {
                lastError = "HttpException ${e.code()}: ${e.message()}"
                debugLog?.invoke("YOUTUBE_API_HTTP_ERROR code=${e.code()}")
            }
            Log.e("YouTubeApiClient", "SEARCH_FAILED: $lastError", e)
            null
        } catch (e: Exception) {
            lastError = "${e.javaClass.simpleName}: ${e.message}"
            Log.e("YouTubeApiClient", "SEARCH_FAILED: $lastError", e)
            debugLog?.invoke("YOUTUBE_API_EXCEPTION error=$lastError")
            null
        }
    }
}