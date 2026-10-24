package com.example.kidsguard.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PinSecurityTest {
    @Test
    fun `PIN format accepts only four to eight digits`() {
        assertTrue(PinSecurity.isValidPin("1234"))
        assertTrue(PinSecurity.isValidPin("12345678"))
        assertFalse(PinSecurity.isValidPin("123"))
        assertFalse(PinSecurity.isValidPin("123456789"))
        assertFalse(PinSecurity.isValidPin("12a4"))
    }

    @Test
    fun `credential verifies the correct PIN and rejects a wrong PIN`() {
        val credential = PinSecurity.createCredential("2468", iterations = 10_000)

        assertTrue(PinSecurity.verify("2468", credential))
        assertFalse(PinSecurity.verify("1357", credential))
    }

    @Test
    fun `credentials use independent salts`() {
        val first = PinSecurity.createCredential("2468", iterations = 10_000)
        val second = PinSecurity.createCredential("2468", iterations = 10_000)

        assertNotEquals(first.saltHex, second.saltHex)
        assertNotEquals(first.hashHex, second.hashHex)
    }

    @Test
    fun `tampered credential is rejected`() {
        val credential = PinSecurity.createCredential("2468", iterations = 10_000)
        val tampered = credential.copy(hashHex = "00".repeat(32))

        assertFalse(PinSecurity.verify("2468", tampered))
    }

    @Test
    fun `lockout begins after five failures and increases with repeated failures`() {
        assertEquals(1, PinLockoutPolicy.remainingAttempts(4))
        assertEquals(0L, PinLockoutPolicy.lockoutDurationMillis(4))
        assertEquals(30_000L, PinLockoutPolicy.lockoutDurationMillis(5))
        assertEquals(60_000L, PinLockoutPolicy.lockoutDurationMillis(6))
        assertEquals(15 * 60_000L, PinLockoutPolicy.lockoutDurationMillis(99))
    }
}
