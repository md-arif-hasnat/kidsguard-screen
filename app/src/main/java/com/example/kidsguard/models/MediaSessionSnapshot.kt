package com.example.kidsguard.models

data class MediaSessionSnapshot(
    val packageName: String,
    val title: String?,
    val artist: String?,
    val album: String?,
    val mediaId: String?,
    val mediaUri: String?,
    val artworkUri: String?,
    val durationMs: Long?,
    val playbackState: Int?,
    val capturedAt: Long = System.currentTimeMillis()
)
