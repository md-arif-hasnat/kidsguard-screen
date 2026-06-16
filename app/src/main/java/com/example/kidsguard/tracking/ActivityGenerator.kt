package com.example.kidsguard.tracking

import com.example.kidsguard.models.LocationPoint

/**
 * Interface for generating activity feed events based on location data.
 * Future integration point for activity history logic.
 */
interface ActivityGenerator {
    /**
     * Generates a new activity event based on the captured location point.
     * TODO: Implement logic to detect movement patterns and generate feed items.
     */
    fun generateEvent(point: LocationPoint)
}
