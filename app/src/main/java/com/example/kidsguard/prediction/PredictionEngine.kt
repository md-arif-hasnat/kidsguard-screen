package com.example.kidsguard.prediction

import android.content.Context
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.SyncChildStatus
import com.example.kidsguard.sync.SyncPredictions
import com.example.kidsguard.utils.DeviceUtils
import kotlin.math.abs

class PredictionEngine(
    private val context: Context,
    private val locationRepository: LocationRepository,
    private val safeZoneRepository: SafeZoneRepository,
    private val scheduleRepository: com.example.kidsguard.repository.ChildScheduleRepository? = null
) {
    private var lastBatteryLevel: Int? = null
    private var lastBatteryTime: Long? = null
    private var dischargeRatePerMinute: Float = 0.1f // Default fallback

    fun generatePredictions(status: SyncChildStatus, currentHistory: List<LocationPoint>): SyncPredictions {
        val now = System.currentTimeMillis()
        
        // 1. Battery Prediction
        updateDischargeRate(status.batteryPercent, now)
        val remainingMins = if (dischargeRatePerMinute > 0) (status.batteryPercent / dischargeRatePerMinute).toInt() else 0
        val dieAt = now + (remainingMins * 60 * 1000L)

        // 2. Offline Risk
        val offlineRisk = when {
            status.batteryPercent < 15 && status.internetType == "MOBILE" -> "High"
            status.batteryPercent < 25 || status.internetType == "NONE" -> "Medium"
            else -> "Low"
        }

        // 3. Safe Zone Prediction (Approaching)
        val lastPoint = currentHistory.firstOrNull()
        var approachingZoneId: String? = null
        var distanceToZone: Double? = null

        if (lastPoint != null) {
            val zones = safeZoneRepository.safeZones.value
            val nearest = zones.filter { !isInside(lastPoint, it) }
                .map { it to DeviceUtils.calculateDistance(lastPoint.latitude, lastPoint.longitude, it.latitude, it.longitude) }
                .minByOrNull { it.second }
            
            if (nearest != null && nearest.second < 500) { // Within 500m
                approachingZoneId = nearest.first.id
                distanceToZone = nearest.second
            }
        }

        // 4. Long Stop Detection
        val isLongStop = detectLongStop(currentHistory)

        // 5. Late Arrival Detection
        val isLate = detectLateArrival(status, now)

        // 6. Unusual Route Detection
        val isUnusual = detectUnusualRoute(currentHistory)

        return SyncPredictions(
            batteryRemainingMinutes = remainingMins,
            batteryDieAtTimestamp = dieAt,
            offlineRisk = offlineRisk,
            approachingZoneId = approachingZoneId,
            distanceToApproachingZone = distanceToZone,
            unusualRouteDetected = isUnusual,
            lateArrivalDetected = isLate,
            longStopDetected = isLongStop,
            stopLocation = if (isLongStop) lastPoint?.address ?: "Unknown Location" else null,
            lastPredictionAt = now
        )
    }

    private fun detectLateArrival(status: SyncChildStatus, now: Long): Boolean {
        val schedules = scheduleRepository?.schedules?.value?.filter { it.enabled } ?: return false
        val calendar = java.util.Calendar.getInstance()
        val currentDay = calendar.get(java.util.Calendar.DAY_OF_WEEK)
        val currentHour = calendar.get(java.util.Calendar.HOUR_OF_DAY)
        val currentMinute = calendar.get(java.util.Calendar.MINUTE)

        schedules.forEach { schedule ->
            if (schedule.dayOfWeek == currentDay) {
                val timeParts = schedule.arrivalTime.split(":")
                if (timeParts.size == 2) {
                    val targetHour = timeParts[0].toInt()
                    val targetMin = timeParts[1].toInt()
                    
                    // If current time is past arrival time + tolerance
                    val targetTotalMins = targetHour * 60 + targetMin + schedule.toleranceMinutes
                    val currentTotalMins = currentHour * 60 + currentMinute
                    
                    if (currentTotalMins > targetTotalMins) {
                        // If not in the correct zone
                        if (status.currentZoneId != schedule.zoneId) {
                            return true
                        }
                    }
                }
            }
        }
        return false
    }

    private fun detectUnusualRoute(history: List<LocationPoint>): Boolean {
        if (history.size < 10) return false
        
        // If child is moving but NOT on a known route (simplified)
        val lastPoint = history.first()
        if (lastPoint.speed < 1.0) return false // Not moving much
        
        // Check if we are outside all safe zones for > 20 mins while moving
        val nonSafeTime = history.takeWhile { point ->
            safeZoneRepository.safeZones.value.none { zone ->
                DeviceUtils.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude) <= zone.radiusMeters
            }
        }.lastOrNull()?.let { (System.currentTimeMillis() - it.timestamp) / 60000 } ?: 0
        
        return nonSafeTime > 30 // Outside for more than 30 mins
    }

    private fun updateDischargeRate(currentLevel: Int, now: Long) {
        if (lastBatteryLevel != null && lastBatteryTime != null) {
            val diffLevel = lastBatteryLevel!! - currentLevel
            val diffTimeMins = (now - lastBatteryTime!!) / 60000f
            if (diffLevel > 0 && diffTimeMins > 1) {
                val currentRate = diffLevel / diffTimeMins
                // Simple moving average (alpha = 0.3)
                dischargeRatePerMinute = (dischargeRatePerMinute * 0.7f) + (currentRate * 0.3f)
            }
        }
        lastBatteryLevel = currentLevel
        lastBatteryTime = now
    }

    private fun detectLongStop(history: List<LocationPoint>): Boolean {
        if (history.size < 5) return false
        val recent = history.take(5)
        val now = System.currentTimeMillis()
        val oldest = recent.last()
        
        // If 5 points in last 15 mins are all within 20 meters
        if (now - oldest.timestamp > 15 * 60 * 1000) {
            val anchor = recent.first()
            return recent.all { DeviceUtils.calculateDistance(it.latitude, it.longitude, anchor.latitude, anchor.longitude) < 20 }
        }
        return false
    }

    private fun isInside(point: LocationPoint, zone: com.example.kidsguard.models.SafeZone): Boolean {
        return DeviceUtils.calculateDistance(point.latitude, point.longitude, zone.latitude, zone.longitude) <= zone.radiusMeters
    }
}
