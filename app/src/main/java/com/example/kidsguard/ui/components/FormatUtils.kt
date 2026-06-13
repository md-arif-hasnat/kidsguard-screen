package com.example.kidsguard.ui.components

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val timeFormatter = SimpleDateFormat("HH:mm", Locale.getDefault())

fun formatTimestamp(timestampMillis: Long): String {
    return timeFormatter.format(Date(timestampMillis))
}
