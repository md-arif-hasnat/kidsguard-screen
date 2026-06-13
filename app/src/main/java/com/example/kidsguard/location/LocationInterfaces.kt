package com.example.kidsguard.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.util.Log
import com.example.kidsguard.models.LocationPoint
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource

interface LocationProvider {
    fun requestSingleUpdate(onResult: (LocationPoint?) -> Unit)
    fun startContinuousUpdates(callback: (LocationPoint) -> Unit)
    fun stopUpdates()
}

class LocalLocationProvider(private val context: Context) : LocationProvider {
    private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    override fun requestSingleUpdate(onResult: (LocationPoint?) -> Unit) {
        // Try FusedLocationProviderClient first
        val cts = CancellationTokenSource()
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
            .addOnSuccessListener { location: Location? ->
                if (location != null) {
                    onResult(location.toLocationPoint())
                } else {
                    // Fallback to LocationManager
                    requestSingleUpdateLocationManager(onResult)
                }
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "FusedLocationProvider failed, falling back to LocationManager", e)
                requestSingleUpdateLocationManager(onResult)
            }
    }

    @SuppressLint("MissingPermission")
    private fun requestSingleUpdateLocationManager(onResult: (LocationPoint?) -> Unit) {
        val providers = locationManager.getProviders(true)
        var bestLocation: Location? = null
        for (provider in providers) {
            val l = locationManager.getLastKnownLocation(provider) ?: continue
            if (bestLocation == null || l.accuracy < bestLocation.accuracy) {
                bestLocation = l
            }
        }
        
        if (bestLocation != null) {
            onResult(bestLocation.toLocationPoint())
        } else {
            // Last resort: request a fresh update
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    onResult(location.toLocationPoint())
                    locationManager.removeUpdates(this)
                }
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }
            
            val provider = if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                LocationManager.GPS_PROVIDER
            } else if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                LocationManager.NETWORK_PROVIDER
            } else {
                null
            }
            
            if (provider != null) {
                try {
                    locationManager.requestSingleUpdate(provider, listener, null)
                } catch (e: Exception) {
                    Log.e(TAG, "LocationManager.requestSingleUpdate failed for provider=$provider", e)
                    onResult(null)
                }
            } else {
                Log.w(TAG, "No location provider available (GPS and Network both disabled)")
                onResult(null)
            }
        }
    }

    override fun startContinuousUpdates(callback: (LocationPoint) -> Unit) {
        // Future local GPS implementation
    }

    override fun stopUpdates() {
        // Future local GPS implementation
    }
    
    companion object {
        private const val TAG = "LocalLocationProvider"
    }

    private fun Location.toLocationPoint() = LocationPoint(
        latitude = latitude,
        longitude = longitude,
        accuracy = accuracy,
        speed = speed,
        bearing = bearing,
        timestamp = time
    )
}

class FutureFirebaseLocationProvider : LocationProvider {
    override fun requestSingleUpdate(onResult: (LocationPoint?) -> Unit) {
        // Future Firebase implementation
    }

    override fun startContinuousUpdates(callback: (LocationPoint) -> Unit) {
        // Future Firebase implementation
    }

    override fun stopUpdates() {
        // Future Firebase implementation
    }
}
