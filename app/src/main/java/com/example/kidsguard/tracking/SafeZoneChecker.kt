package com.example.kidsguard.tracking

import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.models.SafeZone

/**
 * Interface for checking if a location point is within defined safe zones.
 * Future integration point for geofencing logic.
 */
interface SafeZoneChecker {
    /**
     * Checks the given location point against a list of safe zones.
     * TODO: Implement geofencing algorithm.
     */
    fun checkLocation(point: LocationPoint, zones: List<SafeZone>)
}
