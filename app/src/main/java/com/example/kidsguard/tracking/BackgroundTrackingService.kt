package com.example.kidsguard.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.kidsguard.R
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.location.LocalLocationProvider
import com.example.kidsguard.models.ActivityEvent
import com.example.kidsguard.models.LocationPoint
import com.example.kidsguard.geocoding.ReverseGeocoder
import com.example.kidsguard.notifications.LocalNotificationEngine
import com.example.kidsguard.repository.LocationRepository
import com.example.kidsguard.repository.SafeZoneRepository
import com.example.kidsguard.sync.FirebaseRemoteSyncProvider
import com.example.kidsguard.sync.RemoteCommandHandler
import com.example.kidsguard.sync.SyncRemoteCommand
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
    private lateinit var syncProvider: FirebaseRemoteSyncProvider
    private lateinit var commandHandler: RemoteCommandHandler
    private lateinit var errorLogRepository: com.example.kidsguard.repository.ErrorLogRepository
    private var forceNextLocationSync = false
    private var lastListenedChildId: String? = null

    companion object {
        private const val NOTIFICATION_ID = 101
        private const val CHANNEL_ID = "tracking_channel"
        private const val TAG = "TrackingService"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "BackgroundTrackingService: onCreate")
        
        createNotificationChannel()
        
        // Call startForeground() immediately to prevent ForegroundServiceDidNotStartInTimeException
        try {
            val notification = createNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            Log.d(TAG, "BackgroundTrackingService: startForeground called")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground", e)
        }

        val appContext = applicationContext
        prefHelper = PreferenceHelper(appContext)
        errorLogRepository = com.example.kidsguard.repository.ErrorLogRepository(appContext)
        reverseGeocoder = ReverseGeocoder(appContext, errorLogRepository)
        syncProvider = FirebaseRemoteSyncProvider(appContext)
        safeZoneRepository = SafeZoneRepository() 
        trackingRepository = TrackingRepository(appContext)
        
        locationRepository = LocationRepository(
            context = appContext,
            safeZoneRepository = safeZoneRepository,
            knownRouteRepository = com.example.kidsguard.routeintelligence.KnownRouteRepository(appContext),
            geocoder = reverseGeocoder,
            errorLogRepository = errorLogRepository,
            syncProvider = syncProvider
        )

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationEngine = LocalNotificationEngine(appContext, errorLogRepository)
        
        val trackingManager = BackgroundTrackingManager(LocalTrackingScheduler(appContext), trackingRepository)
        
        commandHandler = RemoteCommandHandler(
            androidContext = appContext,
            prefHelper = prefHelper,
            trackingManager = trackingManager,
            syncProvider = syncProvider,
            safeZoneRepository = safeZoneRepository,
            notificationEngine = notificationEngine,
            onLockRequested = {
                broadcastCommandIntent("LOCK")
            },
            onUnlockRequested = {
                broadcastCommandIntent("UNLOCK")
            },
            onRefreshLocationRequested = {
                forceNextLocationSync = true
                requestSingleLocationUpdate()
            },
            onShowMessageRequested = { msg ->
                broadcastCommandIntent("SHOW_MESSAGE", msg)
            },
            onRingRequested = {
                broadcastCommandIntent("RING")
            },
            onVibrateRequested = {
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(android.os.VibrationEffect.createOneShot(5000, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    vibrator.vibrate(5000)
                }
            }
        )

        setupLocationCallback()
        setupCommandListener()
    }

    private fun setupCommandListener() {
        val currentChildId = prefHelper.childId
        if (currentChildId.isNotEmpty() && currentChildId != lastListenedChildId) {
            Log.d(TAG, "Starting remote command listener with childId: $currentChildId")
            lastListenedChildId = currentChildId
            syncProvider.listenForRemoteCommands(currentChildId) { command ->
                Log.i(TAG, "Remote command received: ${command.commandType} (ID: ${command.commandId})")
                commandHandler.handleCommand(command)
            }
        }
    }

    private fun broadcastCommandIntent(action: String, payload: String? = null) {
        val intent = Intent(this, com.example.kidsguard.MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("action", "REMOTE_COMMAND")
            putExtra("command_action", action)
            putExtra("payload", payload)
        }
        startActivity(intent)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "BackgroundTrackingService: onStartCommand")
        
        // Ensure foreground is started immediately (safety call)
        try {
            val notification = createNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground in onStartCommand", e)
        }

        // Permission check
        val fineLocation = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        if (fineLocation != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "BackgroundTrackingService: missing location permission - stopping service")
            stopSelf()
            return START_NOT_STICKY
        }

        setupCommandListener()
        startLocationUpdates()
        Log.d(TAG, "BackgroundTrackingService: location updates started")
        
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
                    Log.i(TAG, "GPS Acquired: lat=${location.latitude}, lng=${location.longitude}, acc=${location.accuracy}")
                    locationRepository.addLocationPoint(point, forceNextLocationSync)
                    forceNextLocationSync = false
                    
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

    @SuppressLint("MissingPermission")
    private fun requestSingleLocationUpdate() {
        Log.d(TAG, "Requesting single location update")
        try {
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                .setMaxUpdates(1)
                .build()
            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request single update", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "BackgroundTrackingService: stopped safely")
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
        val intent = Intent(this, com.example.kidsguard.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KidsGuard Active")
            .setContentText("Location protection is running")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .build()
    }
}
