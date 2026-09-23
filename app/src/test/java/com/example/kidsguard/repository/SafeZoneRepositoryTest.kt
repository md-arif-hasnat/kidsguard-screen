package com.example.kidsguard.repository

import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.SafeZone
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class SafeZoneRepositoryTest {

    private lateinit var repository: SafeZoneRepository

    @Before
    fun setUp() {
        repository = SafeZoneRepository()
    }

    // --- Initial state tests ---

    @Test
    fun init_hasMockSafeZones() {
        val zones = repository.safeZones.value
        assertEquals(3, zones.size)
    }

    @Test
    fun init_containsHomeSchoolPlayground() {
        val names = repository.safeZones.value.map { it.name }
        assertTrue(names.contains("Home"))
        assertTrue(names.contains("School"))
        assertTrue(names.contains("Playground"))
    }

    @Test
    fun init_homeZoneHasCorrectRadius() {
        val home = repository.safeZones.value.first { it.name == "Home" }
        assertEquals(500.0, home.radiusMeters, 0.01)
    }

    @Test
    fun init_schoolZoneHasCorrectRadius() {
        val school = repository.safeZones.value.first { it.name == "School" }
        assertEquals(200.0, school.radiusMeters, 0.01)
    }

    @Test
    fun init_hasMockActivityEvents() {
        val events = repository.activityEvents.value
        assertEquals(4, events.size)
    }

    @Test
    fun init_activityEventsContainExpectedTypes() {
        val types = repository.activityEvents.value.map { it.type }
        assertTrue(types.contains("KID_MODE_DISABLED"))
        assertTrue(types.contains("SAFE_ZONE_ENTER"))
        assertTrue(types.contains("SAFE_ZONE_EXIT"))
        assertTrue(types.contains("KID_MODE_ENABLED"))
    }

    // --- addSafeZone tests ---

    @Test
    fun addSafeZone_increasesCount() {
        val initialCount = repository.safeZones.value.size
        val newZone = SafeZone(
            name = "Mosque", latitude = 37.0, longitude = -122.0, radiusMeters = 300.0
        )
        repository.addSafeZone(newZone)
        assertEquals(initialCount + 1, repository.safeZones.value.size)
    }

    @Test
    fun addSafeZone_containsNewZone() {
        val newZone = SafeZone(
            name = "Grandma", latitude = 38.0, longitude = -121.0, radiusMeters = 150.0
        )
        repository.addSafeZone(newZone)
        val names = repository.safeZones.value.map { it.name }
        assertTrue(names.contains("Grandma"))
    }

    // --- updateSafeZone tests ---

    @Test
    fun updateSafeZone_updatesExistingZone() {
        val original = repository.safeZones.value.first { it.name == "Home" }
        val updated = original.copy(radiusMeters = 750.0)
        repository.updateSafeZone(updated)

        val result = repository.safeZones.value.first { it.id == original.id }
        assertEquals(750.0, result.radiusMeters, 0.01)
    }

    @Test
    fun updateSafeZone_doesNotChangeOtherZones() {
        val home = repository.safeZones.value.first { it.name == "Home" }
        val updated = home.copy(radiusMeters = 750.0)
        repository.updateSafeZone(updated)

        val school = repository.safeZones.value.first { it.name == "School" }
        assertEquals(200.0, school.radiusMeters, 0.01)
    }

    @Test
    fun updateSafeZone_nonExistentId_noChange() {
        val initialZones = repository.safeZones.value
        val fake = SafeZone(
            id = "non-existent-id", name = "Fake", latitude = 0.0, longitude = 0.0, radiusMeters = 100.0
        )
        repository.updateSafeZone(fake)
        assertEquals(initialZones.size, repository.safeZones.value.size)
    }

    // --- deleteSafeZone tests ---

    @Test
    fun deleteSafeZone_removesZone() {
        val home = repository.safeZones.value.first { it.name == "Home" }
        repository.deleteSafeZone(home.id)

        val names = repository.safeZones.value.map { it.name }
        assertFalse(names.contains("Home"))
        assertEquals(2, repository.safeZones.value.size)
    }

    @Test
    fun deleteSafeZone_nonExistentId_noChange() {
        val initialCount = repository.safeZones.value.size
        repository.deleteSafeZone("non-existent-id")
        assertEquals(initialCount, repository.safeZones.value.size)
    }

    // --- addEvent tests ---

    @Test
    fun addEvent_prependsToList() {
        val event = ActivityEvent(
            type = "TEST_EVENT", title = "Test", description = "A test event"
        )
        repository.addEvent(event)

        val first = repository.activityEvents.value.first()
        assertEquals("TEST_EVENT", first.type)
        assertEquals("Test", first.title)
    }

    @Test
    fun addEvent_increasesCount() {
        val initialCount = repository.activityEvents.value.size
        val event = ActivityEvent(type = "TEST", title = "Test")
        repository.addEvent(event)
        assertEquals(initialCount + 1, repository.activityEvents.value.size)
    }

    @Test
    fun addEvent_multipleEvents_maintainsOrder() {
        val event1 = ActivityEvent(type = "FIRST", title = "First")
        val event2 = ActivityEvent(type = "SECOND", title = "Second")
        repository.addEvent(event1)
        repository.addEvent(event2)

        val events = repository.activityEvents.value
        assertEquals("SECOND", events[0].type)
        assertEquals("FIRST", events[1].type)
    }

    // --- clearEvents tests ---

    @Test
    fun clearEvents_emptiesEventsList() {
        repository.clearEvents()
        assertTrue(repository.activityEvents.value.isEmpty())
    }

    @Test
    fun clearEvents_doesNotAffectSafeZones() {
        repository.clearEvents()
        assertEquals(3, repository.safeZones.value.size)
    }
}
