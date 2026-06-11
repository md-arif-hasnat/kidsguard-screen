package com.example.kidsguard.location

import com.example.kidsguard.models.LocationPoint

interface LocationProvider {
    fun requestSingleUpdate(onResult: (LocationPoint?) -> Unit)
    fun startContinuousUpdates(callback: (LocationPoint) -> Unit)
    fun stopUpdates()
}

class LocalLocationProvider : LocationProvider {
    override fun requestSingleUpdate(onResult: (LocationPoint?) -> Unit) {
        // Future local GPS implementation
    }

    override fun startContinuousUpdates(callback: (LocationPoint) -> Unit) {
        // Future local GPS implementation
    }

    override fun stopUpdates() {
        // Future local GPS implementation
    }
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
