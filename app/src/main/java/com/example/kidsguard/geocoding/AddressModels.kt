package com.example.kidsguard.geocoding

data class AddressInfo(
    val fullAddress: String,
    val street: String? = null,
    val city: String? = null,
    val state: String? = null,
    val country: String? = null,
    val postalCode: String? = null,
    val latitude: Double,
    val longitude: Double,
    val timestamp: Long = System.currentTimeMillis()
)
