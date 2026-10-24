package com.example.kidsguard.security

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

data class PinCredential(
    val algorithm: String,
    val iterations: Int,
    val saltHex: String,
    val hashHex: String
)

object PinSecurity {
    const val MIN_PIN_LENGTH = 4
    const val MAX_PIN_LENGTH = 8
    const val DEFAULT_ITERATIONS = 120_000

    private const val PRIMARY_ALGORITHM = "PBKDF2WithHmacSHA256"
    private const val FALLBACK_ALGORITHM = "PBKDF2WithHmacSHA1"
    private const val SALT_BYTES = 16
    private const val HASH_BITS = 256
    private val supportedAlgorithms = setOf(PRIMARY_ALGORITHM, FALLBACK_ALGORITHM)

    fun isValidPin(pin: String): Boolean =
        pin.length in MIN_PIN_LENGTH..MAX_PIN_LENGTH && pin.all(Char::isDigit)

    fun createCredential(
        pin: String,
        iterations: Int = DEFAULT_ITERATIONS,
        random: SecureRandom = SecureRandom()
    ): PinCredential {
        require(isValidPin(pin)) { "PIN must contain 4 to 8 digits." }
        require(iterations >= 10_000) { "PIN hashing iterations are too low." }

        val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
        val algorithm = preferredAlgorithm()
        val hash = derive(pin, salt, iterations, algorithm)
        return PinCredential(
            algorithm = algorithm,
            iterations = iterations,
            saltHex = salt.toHex(),
            hashHex = hash.toHex()
        )
    }

    fun verify(pin: String, credential: PinCredential): Boolean {
        if (!isValidPin(pin) ||
            credential.algorithm !in supportedAlgorithms ||
            credential.iterations < 10_000
        ) {
            return false
        }

        val salt = credential.saltHex.hexToBytesOrNull() ?: return false
        val expected = credential.hashHex.hexToBytesOrNull() ?: return false
        if (salt.size != SALT_BYTES || expected.isEmpty()) return false

        val actual = runCatching {
            derive(pin, salt, credential.iterations, credential.algorithm)
        }.getOrNull() ?: return false
        return MessageDigest.isEqual(expected, actual)
    }

    private fun preferredAlgorithm(): String =
        runCatching { SecretKeyFactory.getInstance(PRIMARY_ALGORITHM) }
            .fold(
                onSuccess = { PRIMARY_ALGORITHM },
                onFailure = { FALLBACK_ALGORITHM }
            )

    private fun derive(
        pin: String,
        salt: ByteArray,
        iterations: Int,
        algorithm: String
    ): ByteArray {
        val keySpec = PBEKeySpec(pin.toCharArray(), salt, iterations, HASH_BITS)
        return try {
            SecretKeyFactory.getInstance(algorithm).generateSecret(keySpec).encoded
        } finally {
            keySpec.clearPassword()
        }
    }

    private fun ByteArray.toHex(): String = joinToString(separator = "") {
        "%02x".format(it.toInt() and 0xff)
    }

    private fun String.hexToBytesOrNull(): ByteArray? {
        if (length % 2 != 0 || any { it.digitToIntOrNull(16) == null }) return null
        return ByteArray(length / 2) { index ->
            substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
    }
}

object PinLockoutPolicy {
    const val ATTEMPTS_BEFORE_LOCKOUT = 5
    private const val INITIAL_LOCKOUT_MILLIS = 30_000L
    private const val MAX_LOCKOUT_MILLIS = 15 * 60_000L

    fun remainingAttempts(failedAttempts: Int): Int =
        (ATTEMPTS_BEFORE_LOCKOUT - failedAttempts).coerceAtLeast(0)

    fun lockoutDurationMillis(failedAttempts: Int): Long {
        if (failedAttempts < ATTEMPTS_BEFORE_LOCKOUT) return 0L
        val exponent = (failedAttempts - ATTEMPTS_BEFORE_LOCKOUT).coerceAtMost(5)
        return (INITIAL_LOCKOUT_MILLIS * (1L shl exponent))
            .coerceAtMost(MAX_LOCKOUT_MILLIS)
    }
}
