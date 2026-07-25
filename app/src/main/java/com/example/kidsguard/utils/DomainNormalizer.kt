package com.example.kidsguard.utils

import java.net.URI
import java.util.Locale

object DomainNormalizer {

    /**
     * Normalizes a URL or raw domain string.
     * Examples:
     * https://www.google.com/search?q=test -> google.com
     * m.facebook.com -> facebook.com (in many cases, but we should be careful with subdomains)
     * news.bbc.co.uk -> bbc.co.uk
     */
    fun normalize(input: String?): String? {
        if (input.isNullOrBlank()) return null

        var cleaned = input.trim().lowercase(Locale.getDefault())

        // 1. Ensure protocol for URI parsing if missing
        if (!cleaned.contains("://")) {
            cleaned = "https://$cleaned"
        }

        return try {
            val uri = URI(cleaned)
            var host = uri.host ?: return null

            // 2. Remove leading www.
            if (host.startsWith("www.")) {
                host = host.substring(4)
            }

            // 3. Remove trailing dot
            if (host.endsWith(".")) {
                host = host.substring(0, host.length - 1)
            }

            // 4. Handle subdomains briefly
            val parts = host.split(".")
            if (parts.size > 2) {
                // If it's something like news.bbc.co.uk (4 parts)
                // or news.google.com (3 parts)
                val lastTwo = "${parts[parts.size - 2]}.${parts[parts.size - 1]}"
                val doubleTlds = setOf("co.uk", "com.br", "com.mx", "com.au", "org.uk", "gov.uk", "edu.au")
                
                if (parts.size >= 4 && doubleTlds.contains(lastTwo)) {
                    // news.bbc.co.uk -> bbc.co.uk
                    host = parts.drop(1).joinToString(".")
                } else if (parts.size >= 3 && !doubleTlds.contains(lastTwo)) {
                    // news.google.com -> google.com
                    host = parts.drop(1).joinToString(".")
                }
            }

            if (!host.contains(".")) return null
            host
        } catch (e: Exception) {
            // Fallback for malformed URLs: try regex or simple split
            extractHostManual(cleaned)
        }
    }

    private fun extractHostManual(input: String): String? {
        val withoutProtocol = if (input.contains("://")) {
            input.substringAfter("://")
        } else {
            input
        }
        val hostPart = withoutProtocol.substringBefore("/").substringBefore(":").substringBefore("?")
        
        var host = hostPart
        if (host.startsWith("www.")) host = host.substring(4)
        if (host.startsWith("m.")) host = host.substring(2)
        if (host.endsWith(".")) host = host.substring(0, host.length - 1)
        
        return if (host.contains(".")) host else null
    }
}
