package com.example.kidsguard.utils

import org.junit.Assert.assertEquals
import org.junit.Test

class DomainNormalizerTest {

    @Test
    fun testNormalizeUrls() {
        assertEquals("youtube.com", DomainNormalizer.normalize("https://www.youtube.com/watch?v=123"))
        assertEquals("facebook.com", DomainNormalizer.normalize("https://m.facebook.com/home"))
        assertEquals("bbc.co.uk", DomainNormalizer.normalize("http://news.bbc.co.uk/page.html"))
        assertEquals("google.com", DomainNormalizer.normalize("google.com"))
        assertEquals("google.com", DomainNormalizer.normalize("www.google.com"))
        assertEquals("google.com", DomainNormalizer.normalize("https://www.google.com:443/"))
        assertEquals("amazon.de", DomainNormalizer.normalize("https://www.amazon.de/ref=nav_logo"))
    }

    @Test
    fun testMalformedUrls() {
        assertEquals(null, DomainNormalizer.normalize(""))
        assertEquals(null, DomainNormalizer.normalize("   "))
        assertEquals(null, DomainNormalizer.normalize("invalid-url-no-dot"))
    }
}
