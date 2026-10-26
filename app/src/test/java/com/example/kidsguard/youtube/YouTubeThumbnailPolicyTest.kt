package com.example.kidsguard.youtube

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class YouTubeThumbnailPolicyTest {

    @Test
    fun derivesRemoteThumbnailFromValidVideoId() {
        assertEquals(
            "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            YouTubeThumbnailPolicy.remoteThumbnailOrNull("dQw4w9WgXcQ", null)
        )
    }

    @Test
    fun preservesExistingHttpsThumbnail() {
        val existing = "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
        assertEquals(
            existing,
            YouTubeThumbnailPolicy.remoteThumbnailOrNull("dQw4w9WgXcQ", existing)
        )
    }

    @Test
    fun replacesDeviceOnlyArtworkWhenVideoIdExists() {
        assertEquals(
            "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            YouTubeThumbnailPolicy.remoteThumbnailOrNull(
                "dQw4w9WgXcQ",
                "content://media/external/audio/albumart/1"
            )
        )
    }

    @Test
    fun rejectsDeviceOnlyArtworkWithoutVideoId() {
        assertNull(
            YouTubeThumbnailPolicy.remoteThumbnailOrNull(
                null,
                "content://media/external/audio/albumart/1"
            )
        )
    }

    @Test
    fun validatesExactYouTubeVideoIdShape() {
        assertTrue(YouTubeThumbnailPolicy.isValidVideoId("dQw4w9WgXcQ"))
        assertNull(YouTubeThumbnailPolicy.buildThumbnailUrl("too-short"))
    }
}
