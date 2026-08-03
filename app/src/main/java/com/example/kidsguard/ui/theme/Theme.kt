package com.example.kidsguard.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val KidsGuardLightColorScheme = lightColorScheme(
    primary = Color(0xFF0071E3),
    onPrimary = Color.White,

    primaryContainer = Color(0xFFE8F2FF),
    onPrimaryContainer = Color(0xFF003E7A),

    secondary = Color(0xFF6E6E73),
    onSecondary = Color.White,

    secondaryContainer = Color(0xFFF0F0F2),
    onSecondaryContainer = Color(0xFF1D1D1F),

    tertiary = Color(0xFF34C759),
    onTertiary = Color.White,

    background = Color(0xFFF5F5F7),
    onBackground = Color(0xFF1D1D1F),

    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1D1D1F),

    surfaceVariant = Color(0xFFF0F0F2),
    onSurfaceVariant = Color(0xFF6E6E73),

    outline = Color(0xFFD2D2D7),
    outlineVariant = Color(0xFFE5E5E7),

    error = Color(0xFFFF3B30),
    onError = Color.White,

    inverseSurface = Color(0xFF1D1D1F),
    inverseOnSurface = Color(0xFFF5F5F7),
    inversePrimary = Color(0xFF64A8FF),

    scrim = Color.Black
)

@Composable
fun KidsGuardTheme(
    darkTheme: Boolean = false,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = KidsGuardLightColorScheme,
        typography = Typography,
        content = content
    )
}