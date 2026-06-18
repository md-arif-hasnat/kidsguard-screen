package com.example.kidsguard.geocoding

import android.content.Context
import android.location.Geocoder
import java.util.Locale

class ReverseGeocoder(
    private val context: Context,
    private val errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository? = null
) {

    // Simple local cache to avoid repeated requests for same coordinates
    private val cache = mutableMapOf<String, AddressInfo>()

    var lastException: String? = null
    var lastResultCount: Int = -1
    var lastAddressInfo: AddressInfo? = null

    fun getAddress(latitude: Double, longitude: Double): AddressInfo? {
        val cacheKey = "%.4f,%.4f".format(latitude, longitude)
        cache[cacheKey]?.let { 
            lastAddressInfo = it
            lastResultCount = 1
            lastException = null
            return it 
        }

        android.util.Log.d("ReverseGeocoder", "Requesting address for Lat: $latitude, Lng: $longitude")
        lastException = null

        return try {
            val geocoder = Geocoder(context, Locale.getDefault())
            // Note: getFromLocation is blocking, should be called from background thread
            val addresses = geocoder.getFromLocation(latitude, longitude, 1)
            
            lastResultCount = addresses?.size ?: 0
            android.util.Log.d("ReverseGeocoder", "Geocoder returned $lastResultCount results for ($latitude, $longitude)")

            if (!addresses.isNullOrEmpty()) {
                val address = addresses[0]
                val fullAddress = (0..address.maxAddressLineIndex).joinToString(", ") { address.getAddressLine(it) }
                
                android.util.Log.d("ReverseGeocoder", "Address found: $fullAddress")
                android.util.Log.d("ReverseGeocoder", "City: ${address.locality}, Country: ${address.countryName}")

                val info = AddressInfo(
                    fullAddress = fullAddress,
                    street = address.thoroughfare,
                    city = address.locality ?: address.subLocality,
                    state = address.adminArea,
                    country = address.countryName,
                    postalCode = address.postalCode,
                    latitude = latitude,
                    longitude = longitude
                )
                lastAddressInfo = info
                cache[cacheKey] = info
                info
            } else {
                lastAddressInfo = null
                android.util.Log.w("ReverseGeocoder", "No addresses found for coordinates: $latitude, $longitude")
                null
            }
        } catch (e: Exception) {
            lastException = e.toString()
            lastAddressInfo = null
            lastResultCount = 0
            android.util.Log.e("ReverseGeocoder", "Geocoding exception for ($latitude, $longitude): ${e.message}")
            android.util.Log.e("ReverseGeocoder", "Full exception: ", e)
            errorLogRepository?.addError("ReverseGeocoder", "Geocoding failed for ($latitude, $longitude)", e)
            null
        }
    }

    fun getShortAddress(latitude: Double, longitude: Double): String {
        val info = getAddress(latitude, longitude)
        return info?.let {
            val parts = mutableListOf<String>()
            it.street?.let { s -> parts.add(it.fullAddress.split(",").firstOrNull() ?: s) }
            it.city?.let { c -> parts.add(c) }
            if (parts.isEmpty()) it.fullAddress.take(20) else parts.joinToString(", ")
        } ?: "Address unavailable"
    }

    fun clearCache() {
        cache.clear()
    }
}
