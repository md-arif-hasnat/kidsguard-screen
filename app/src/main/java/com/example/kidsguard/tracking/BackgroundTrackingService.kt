package com.example.kidsguard.tracking

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.kidsguard.R
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.geocoding.ReverseGeocoder
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.google.android.gms.location.*

class BackgroundTrackingService : Service() {

    private lateinit var locationRepository: LocationRepository
    private lateinit var safeZoneRepository: SafeZoneRepository
    private lateinit var trackingRepository: TrackingRepository
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var notificationEngine: LocalNotificationEngine
    private lateinit var prefHelper: PreferenceHelper
    private lateinit var reverseGeocoder: ReverseGeocoder

    companion object {
        private const val NOTIFICATION_ID = 101
        private const val CHANNEL_ID = "tracking_channel"
        private const val TAG = "TrackingService"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val appContext = applicationContext
        locationRepository = LocationRepository(appContext)
        safeZoneRepository = SafeZoneRepository() 
        trackingRepository = TrackingRepository(appContext)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationEngine = LocalNotificationEngine(appContext)
        prefHelper = PreferenceHelper(appContext)
        reverseGeocoder = ReverseGeocoder(appContext)

        createNotificationChannel()
        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service started")
        startForeground(NOTIFICATION_ID, createNotification())
        startLocationUpdates()
        
        trackingRepository.updateState(TrackingState.RUNNING)
        
        if (prefHelper.isTrackingNotificationsEnabled) {
            notificationEngine.sendSafetyAlert("KidsGuard Active", "Location tracking started")
        }

        safeZoneRepository.addEvent(ActivityEvent(
            type = "TRACKING_STARTED",
            title = "Background Tracking Active",
            description = "Device location is being monitored"
        ))

        return START_STICKY
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    // Get address from reverse geocoder
                    val addressInfo = reverseGeocoder.getAddress(location.latitude, location.longitude)
                    
                    val point = LocationPoint(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        accuracy = location.accuracy,
                        speed = location.speed,
                        bearing = location.bearing,
                        timestamp = location.time,
                        address = addressInfo?.fullAddress,
                        city = addressInfo?.city,
                        country = addressInfo?.country
                    )
                    Log.d(TAG, "Captured location: $point")
                    locationRepository.addLocationPoint(point)
                    
                    checkBatteryLevel()
                }
            }
        }
    }

    private fun checkBatteryLevel() {
        val batteryLevel = getBatteryLevel(this)
        if (batteryLevel != -1 && batteryLevel <= 15) {
            if (prefHelper.isBatteryNotificationsEnabled) {
                notificationEngine.sendSafetyAlert(
                    "Battery Low", 
                    "${prefHelper.childName.ifEmpty { "Child" }}'s device battery is below 15%"
                )
            }
        }
    }

    private fun getBatteryLevel(context: Context): Int {
        val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { ifilter ->
            context.registerReceiver(null, ifilter)
        }
        return batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val config = trackingRepository.loadTrackingConfig()
        val interval = config.updateIntervalSeconds * 1000
        
        val locationRequest = LocationRequest.Builder(
            if (config.highAccuracyEnabled) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            interval
        ).apply {
            setMinUpdateIntervalMillis(interval / 2)
            setWaitForAccurateLocation(false)
        }.build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start location updates", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service destroyed")
        fusedLocationClient.removeLocationUpdates(locationCallback)
        
        trackingRepository.updateState(TrackingState.STOPPED)
        
        safeZoneRepository.addEvent(ActivityEvent(
            type = "TRACKING_STOPPED",
            title = "Background Tracking Stopped",
            description = "Location monitoring disabled"
        ))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "KidsGuard Tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KidsGuard Active")
            .setContentText("Location tracking is running in the background")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }
}
