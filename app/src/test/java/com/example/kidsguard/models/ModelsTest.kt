package com.example.kidsguard.models

import org.junit.Assert.*
import org.junit.Test

class ModelsTest {

    // --- SafeZone tests ---

    @Test
    fun safeZone_defaultValues() {
        val zone = SafeZone(name = "Home", latitude = 37.0, longitude = -122.0, radiusMeters = 500.0)
        assertEquals("Custom", zone.type)
        assertTrue(zone.notifyOnEnter)
        assertTrue(zone.notifyOnExit)
        assertTrue(zone.enabled)
        assertTrue(zone.id.isNotEmpty())
    }

    @Test
    fun safeZone_customType() {
        val zone = SafeZone(
            name = "School", type = "School",
            latitude = 37.0, longitude = -122.0, radiusMeters = 200.0
        )
        assertEquals("School", zone.type)
    }

    @Test
    fun safeZone_disabledNotifications() {
        val zone = SafeZone(
            name = "Test", latitude = 0.0, longitude = 0.0, radiusMeters = 100.0,
            notifyOnEnter = false, notifyOnExit = false, enabled = false
        )
        assertFalse(zone.notifyOnEnter)
        assertFalse(zone.notifyOnExit)
        assertFalse(zone.enabled)
    }

    @Test
    fun safeZone_uniqueIds() {
        val zone1 = SafeZone(name = "A", latitude = 0.0, longitude = 0.0, radiusMeters = 100.0)
        val zone2 = SafeZone(name = "B", latitude = 0.0, longitude = 0.0, radiusMeters = 100.0)
        assertNotEquals(zone1.id, zone2.id)
    }

    @Test
    fun safeZone_copyChangesFields() {
        val original = SafeZone(name = "Home", latitude = 37.0, longitude = -122.0, radiusMeters = 500.0)
        val copy = original.copy(radiusMeters = 750.0, name = "Updated Home")
        assertEquals("Updated Home", copy.name)
        assertEquals(750.0, copy.radiusMeters, 0.01)
        assertEquals(original.id, copy.id)
        assertEquals(original.latitude, copy.latitude, 0.01)
    }

    @Test
    fun safeZone_equality() {
        val id = "fixed-id"
        val zone1 = SafeZone(id = id, name = "Home", latitude = 37.0, longitude = -122.0, radiusMeters = 500.0)
        val zone2 = SafeZone(id = id, name = "Home", latitude = 37.0, longitude = -122.0, radiusMeters = 500.0)
        assertEquals(zone1, zone2)
    }

    // --- ActivityEvent tests ---

    @Test
    fun activityEvent_defaultValues() {
        val event = ActivityEvent(type = "TEST", title = "Test Event")
        assertTrue(event.id.isNotEmpty())
        assertTrue(event.timestamp > 0)
        assertEquals("", event.description)
        assertNull(event.latitude)
        assertNull(event.longitude)
    }

    @Test
    fun activityEvent_withLocation() {
        val event = ActivityEvent(
            type = "SAFE_ZONE_ENTER", title = "Entered Home",
            latitude = 37.0, longitude = -122.0
        )
        assertNotNull(event.latitude)
        assertNotNull(event.longitude)
        assertEquals(37.0, event.latitude!!, 0.01)
    }

    @Test
    fun activityEvent_uniqueIds() {
        val e1 = ActivityEvent(type = "A", title = "A")
        val e2 = ActivityEvent(type = "B", title = "B")
        assertNotEquals(e1.id, e2.id)
    }

    // --- DevicePlatform enum tests ---

    @Test
    fun devicePlatform_hasAndroidAndIos() {
        val values = DevicePlatform.values()
        assertEquals(2, values.size)
        assertTrue(values.contains(DevicePlatform.ANDROID))
        assertTrue(values.contains(DevicePlatform.IOS))
    }

    // --- UserRole enum tests ---

    @Test
    fun userRole_hasAllRoles() {
        val values = UserRole.values()
        assertEquals(3, values.size)
        assertTrue(values.contains(UserRole.PARENT))
        assertTrue(values.contains(UserRole.CHILD))
        assertTrue(values.contains(UserRole.NONE))
    }

    // --- ParentDevice tests ---

    @Test
    fun parentDevice_construction() {
        val device = ParentDevice(id = "p1", platform = DevicePlatform.IOS, name = "Mom's iPhone")
        assertEquals("p1", device.id)
        assertEquals(DevicePlatform.IOS, device.platform)
        assertEquals("Mom's iPhone", device.name)
    }

    // --- ChildDevice tests ---

    @Test
    fun childDevice_defaultValues() {
        val device = ChildDevice(id = "c1", platform = DevicePlatform.ANDROID, name = "Kid's Phone")
        assertEquals(-1, device.batteryLevel)
        assertFalse(device.isLocked)
        assertTrue(device.lastActive > 0)
    }

    @Test
    fun childDevice_withBattery() {
        val device = ChildDevice(
            id = "c1", platform = DevicePlatform.ANDROID, name = "Kid's Phone",
            batteryLevel = 85, isLocked = true
        )
        assertEquals(85, device.batteryLevel)
        assertTrue(device.isLocked)
    }

    // --- LocationUpdate tests ---

    @Test
    fun locationUpdate_defaultValues() {
        val update = LocationUpdate(latitude = 51.5, longitude = -0.12)
        assertTrue(update.timestamp > 0)
        assertEquals(0f, update.accuracy, 0.001f)
    }

    // --- LocationPoint tests ---

    @Test
    fun locationPoint_defaultTimestamp() {
        val point = LocationPoint(latitude = 51.5, longitude = -0.12, accuracy = 10f, speed = 0f, bearing = 0f)
        assertTrue(point.timestamp > 0)
    }

    @Test
    fun locationPoint_allFields() {
        val ts = 1000L
        val point = LocationPoint(
            latitude = 51.5074, longitude = -0.1278,
            accuracy = 5f, speed = 1.2f, bearing = 45f, timestamp = ts
        )
        assertEquals(51.5074, point.latitude, 0.0001)
        assertEquals(-0.1278, point.longitude, 0.0001)
        assertEquals(5f, point.accuracy, 0.01f)
        assertEquals(1.2f, point.speed, 0.01f)
        assertEquals(45f, point.bearing, 0.01f)
        assertEquals(ts, point.timestamp)
    }

    // --- PairingCode tests ---

    @Test
    fun pairingCode_construction() {
        val code = PairingCode(code = "KDG-123456", expiresAt = 1000L)
        assertEquals("KDG-123456", code.code)
        assertEquals(1000L, code.expiresAt)
    }

    // --- DeviceStatus tests ---

    @Test
    fun deviceStatus_construction() {
        val status = DeviceStatus(
            isOnline = true, batteryPercentage = 75,
            isKidGuardActive = true, lastUpdated = 1000L
        )
        assertTrue(status.isOnline)
        assertEquals(75, status.batteryPercentage)
        assertTrue(status.isKidGuardActive)
        assertEquals(1000L, status.lastUpdated)
    }

    // --- RemoteCommand tests ---

    @Test
    fun remoteCommand_defaultValues() {
        val cmd = RemoteCommand(command = "LOCK", targetChildId = "child-1")
        assertTrue(cmd.id.isNotEmpty())
        assertTrue(cmd.timestamp > 0)
        assertEquals("LOCK", cmd.command)
        assertEquals("child-1", cmd.targetChildId)
    }

    @Test
    fun remoteCommand_uniqueIds() {
        val cmd1 = RemoteCommand(command = "LOCK", targetChildId = "c1")
        val cmd2 = RemoteCommand(command = "UNLOCK", targetChildId = "c1")
        assertNotEquals(cmd1.id, cmd2.id)
    }
}
