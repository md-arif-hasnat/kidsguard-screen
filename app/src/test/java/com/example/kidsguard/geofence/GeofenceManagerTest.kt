package com.example.kidsguard.geofence

import com.example.kidsguard.models.SafeZone
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class GeofenceManagerTest {

    private lateinit var manager: GeofenceManager

    @Before
    fun setUp() {
        manager = GeofenceManager()
    }

    // --- calculateDistance tests ---

    @Test
    fun calculateDistance_samePoint_returnsZero() {
        val distance = manager.calculateDistance(51.5074, -0.1278, 51.5074, -0.1278)
        assertEquals(0.0, distance, 0.01)
    }

    @Test
    fun calculateDistance_knownDistance_londondToParisApprox340km() {
        // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ~340km
        val distance = manager.calculateDistance(51.5074, -0.1278, 48.8566, 2.3522)
        assertEquals(340_000.0, distance, 5000.0) // within 5km tolerance
    }

    @Test
    fun calculateDistance_shortDistance_within100m() {
        // Two points ~111m apart (0.001 degrees latitude at equator)
        val distance = manager.calculateDistance(0.0, 0.0, 0.001, 0.0)
        assertEquals(111.0, distance, 2.0)
    }

    @Test
    fun calculateDistance_isSymmetric() {
        val d1 = manager.calculateDistance(37.7749, -122.4194, 34.0522, -118.2437)
        val d2 = manager.calculateDistance(34.0522, -118.2437, 37.7749, -122.4194)
        assertEquals(d1, d2, 0.01)
    }

    @Test
    fun calculateDistance_antipodal_returnsHalfEarthCircumference() {
        // North pole to south pole ~20,000 km
        val distance = manager.calculateDistance(90.0, 0.0, -90.0, 0.0)
        assertEquals(20_015_000.0, distance, 100_000.0)
    }

    // --- isInsideZone tests ---

    @Test
    fun isInsideZone_pointAtCenter_returnsTrue() {
        val zone = SafeZone(
            name = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 500.0
        )
        assertTrue(manager.isInsideZone(37.7749, -122.4194, zone))
    }

    @Test
    fun isInsideZone_pointWellOutside_returnsFalse() {
        val zone = SafeZone(
            name = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 100.0
        )
        // ~1km away
        assertFalse(manager.isInsideZone(37.7849, -122.4194, zone))
    }

    @Test
    fun isInsideZone_pointJustInsideBoundary_returnsTrue() {
        val zone = SafeZone(
            name = "School", latitude = 0.0, longitude = 0.0, radiusMeters = 1000.0
        )
        // ~555m away (0.005 degrees lat)
        assertTrue(manager.isInsideZone(0.005, 0.0, zone))
    }

    @Test
    fun isInsideZone_pointJustOutsideBoundary_returnsFalse() {
        val zone = SafeZone(
            name = "School", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0
        )
        // ~555m away (0.005 degrees lat at equator)
        assertFalse(manager.isInsideZone(0.005, 0.0, zone))
    }

    // --- checkTransitions tests ---

    @Test
    fun checkTransitions_nullPreviousLocation_returnsEmpty() {
        val zone = SafeZone(
            name = "Home", latitude = 37.7749, longitude = -122.4194, radiusMeters = 500.0
        )
        val events = manager.checkTransitions(null, null, 37.7749, -122.4194, listOf(zone))
        assertTrue(events.isEmpty())
    }

    @Test
    fun checkTransitions_enterZone_returnsEnterEvent() {
        val zone = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = true, notifyOnExit = true
        )
        // Move from outside (1km away) to center
        val events = manager.checkTransitions(0.01, 0.0, 0.0, 0.0, listOf(zone))
        assertEquals(1, events.size)
        assertEquals("Entered Home", events[0])
    }

    @Test
    fun checkTransitions_exitZone_returnsExitEvent() {
        val zone = SafeZone(
            name = "School", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = true, notifyOnExit = true
        )
        // Move from center to 1km away
        val events = manager.checkTransitions(0.0, 0.0, 0.01, 0.0, listOf(zone))
        assertEquals(1, events.size)
        assertEquals("Left School", events[0])
    }

    @Test
    fun checkTransitions_stayInside_noEvents() {
        val zone = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 5000.0,
            notifyOnEnter = true, notifyOnExit = true
        )
        // Move slightly within zone
        val events = manager.checkTransitions(0.001, 0.0, 0.002, 0.0, listOf(zone))
        assertTrue(events.isEmpty())
    }

    @Test
    fun checkTransitions_stayOutside_noEvents() {
        val zone = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 100.0,
            notifyOnEnter = true, notifyOnExit = true
        )
        // Both points far outside
        val events = manager.checkTransitions(1.0, 1.0, 1.001, 1.0, listOf(zone))
        assertTrue(events.isEmpty())
    }

    @Test
    fun checkTransitions_disabledZone_noEvents() {
        val zone = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = true, notifyOnExit = true, enabled = false
        )
        // Would be an enter transition if enabled
        val events = manager.checkTransitions(0.01, 0.0, 0.0, 0.0, listOf(zone))
        assertTrue(events.isEmpty())
    }

    @Test
    fun checkTransitions_enterWithNotifyDisabled_noEvents() {
        val zone = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = false, notifyOnExit = true
        )
        val events = manager.checkTransitions(0.01, 0.0, 0.0, 0.0, listOf(zone))
        assertTrue(events.isEmpty())
    }

    @Test
    fun checkTransitions_exitWithNotifyDisabled_noEvents() {
        val zone = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = true, notifyOnExit = false
        )
        val events = manager.checkTransitions(0.0, 0.0, 0.01, 0.0, listOf(zone))
        assertTrue(events.isEmpty())
    }

    @Test
    fun checkTransitions_multipleZones_multipleEvents() {
        val zone1 = SafeZone(
            name = "Home", latitude = 0.0, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = true, notifyOnExit = true
        )
        val zone2 = SafeZone(
            name = "Park", latitude = 0.01, longitude = 0.0, radiusMeters = 500.0,
            notifyOnEnter = true, notifyOnExit = true
        )
        // Move from center of zone1 to center of zone2
        val events = manager.checkTransitions(0.0, 0.0, 0.01, 0.0, listOf(zone1, zone2))
        assertEquals(2, events.size)
        assertTrue(events.contains("Left Home"))
        assertTrue(events.contains("Entered Park"))
    }

    @Test
    fun checkTransitions_emptyZoneList_noEvents() {
        val events = manager.checkTransitions(0.0, 0.0, 0.01, 0.0, emptyList())
        assertTrue(events.isEmpty())
    }
}
