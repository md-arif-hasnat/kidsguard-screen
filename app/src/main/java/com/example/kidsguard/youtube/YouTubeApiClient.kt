package com.example.kidsguard.youtube

import android.util.Log
import com.example.kidsguard.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object YouTubeApiClient {

    private const val BASE_URL =
        "https://www.googleapis.com/"

    private val loggingInterceptor =
        HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

    private val httpClient =
        OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()

    private val retrofit =
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    val service: YouTubeApiService by lazy {
        retrofit.create(YouTubeApiService::class.java)
    }

    fun getApiKey(): String? {
        return BuildConfig.YOUTUBE_API_KEY
            .trim()
            .takeIf { it.isNotBlank() }
    }

    suspend fun searchVideos(
        request: YouTubeResolveRequest
    ): YouTubeSearchResponse? {

        val apiKey = getApiKey()

        if (apiKey == null) {
            Log.e(
                "YouTubeApiClient",
                "YOUTUBE_API_KEY_MISSING"
            )
            return null
        }

        val searchQuery = buildString {
            append(request.title)

            request.channel
                ?.takeIf { it.isNotBlank() }
                ?.let {
                    append(" ")
                    append(it)
                }
        }

        return try {
            service.searchVideos(
                query = searchQuery,
                apiKey = apiKey
            )
        } catch (e: Exception) {
            Log.e(
                "YouTubeApiClient",
                "YOUTUBE_SEARCH_FAILED",
                e
            )
            null
        }
    }
}