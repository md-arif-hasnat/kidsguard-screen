package com.example.kidsguard.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

import com.example.kidsguard.data.PreferenceHelper

class UpdateRepository(private val context: Context) {

    private val db = FirebaseFirestore.getInstance()
    private val prefs = PreferenceHelper(context)
    private val mandatoryUpdatePrefs = context.applicationContext
        .getSharedPreferences(
            "mandatory_update_state",
            Context.MODE_PRIVATE
        )
    private val updateScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _updateState = MutableStateFlow(
        AppUpdateState(
            currentVersionName = getCurrentVersionName(),
            currentVersionCode = getCurrentVersionCode(),
            updateInfo = null
        )
    )
    val updateState: StateFlow<AppUpdateState> = _updateState

    private val _updateInfo = MutableStateFlow<AppUpdateInfo?>(null)
    val updateInfo: StateFlow<AppUpdateInfo?> = _updateInfo

    private val _showWhatsNew = MutableStateFlow<AppUpdateInfo?>(null)
    val showWhatsNew: StateFlow<AppUpdateInfo?> = _showWhatsNew

    init {
        restoreMandatoryUpdate()
    }

    companion object {
        private const val TAG = "UpdateRepository"
        private const val CONFIG_PATH = "appConfig/update"
    }

    fun getCurrentVersionName(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.0.0"
        } catch (e: PackageManager.NameNotFoundException) {
            "1.0.0"
        }
    }

    fun getCurrentVersionCode(): Int {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode
            }
        } catch (e: PackageManager.NameNotFoundException) {
            1
        }
    }

    suspend fun checkForUpdates() {
        if (!isNetworkAvailable()) {
            Log.d(TAG, "Skipping update check: Device is offline")
            return
        }

        Log.d(TAG, "Checking for updates from Firestore...")
        try {
            val doc = db.document(CONFIG_PATH).get().await()
            val info = if (doc.exists()) {
                doc.toObject(AppUpdateInfo::class.java)
            } else {
                Log.w(TAG, "Update config document not found at $CONFIG_PATH, using fallback")
                AppUpdateInfo(
                    latestVersionCode = 1,
                    latestVersionName = "1.0.0",
                    apkDownloadUrl = "https://github.com/md-arif-hasnat/kidsguard-screen/releases/download/v1.0.0/KidsGuard-v1.0.0.apk",
                    mandatoryUpdate = false,
                    updateMessage = "First KidsGuard beta release is available.",
                    releaseNotes = listOf("Initial beta release", "Live tracking", "Safe zones", "Parent dashboard")
                )
            }

            if (info != null) {
                val currentCode = getCurrentVersionCode()
                val currentName = getCurrentVersionName()
                val isAvailable = info.latestVersionCode > currentCode
                
                Log.i(TAG, "Installed Version: $currentName ($currentCode)")
                Log.i(TAG, "Latest Version: ${info.latestVersionName} (${info.latestVersionCode})")
                Log.i(TAG, "Should Update: $isAvailable")
                
                _updateState.value = _updateState.value.copy(
                    updateInfo = info,
                    isUpdateAvailable = isAvailable
                )
                updateMandatoryCache(info, currentCode)

                // Part 4: What's New logic
                if (info.latestVersionCode.toInt() == currentCode && prefs.lastSeenVersionCode < currentCode) {
                    Log.d(TAG, "New version detected! Showing What's New for v$currentCode")
                    _showWhatsNew.value = info
                }
            }
        } catch (e: Exception) {
            val isOffline = isOfflineException(e)
            if (isOffline) {
                Log.i(TAG, "Update check skipped: Firestore is offline (${e.message})")
            } else {
                Log.e(TAG, "Failed to check for updates", e)
            }
        }
    }

    private fun isOfflineException(e: Throwable): Boolean {
        if (e is FirebaseFirestoreException) {
            return e.code == FirebaseFirestoreException.Code.UNAVAILABLE ||
                    e.message?.contains("offline", ignoreCase = true) == true
        }
        val message = e.message ?: ""
        if (message.contains("offline", ignoreCase = true) || 
            message.contains("UNAVAILABLE", ignoreCase = true)) {
            return true
        }
        return e.cause?.let { isOfflineException(it) } ?: false
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val network = cm?.activeNetwork
        val capabilities = cm?.getNetworkCapabilities(network)
        val hasInternet = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        val isValidated = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
        return hasInternet && isValidated
    }

    fun dismissWhatsNew() {
        prefs.lastSeenVersionCode = getCurrentVersionCode()
        _showWhatsNew.value = null
    }

    fun simulateUpdate(force: Boolean = false) {
        val mockInfo = AppUpdateInfo(
            latestVersionCode = (getCurrentVersionCode() + 1).toLong(),
            latestVersionName = "2.0.0-DEBUG",
            apkDownloadUrl = "https://example.com/mock.apk",
            updateMessage = if (force) "Critical security update required immediately." else "New features are available. Please update.",
            forceUpdate = force,
            mandatoryUpdate = force,
            releaseChannel = "beta"
        )
        _updateState.value = _updateState.value.copy(
            updateInfo = mockInfo,
            isUpdateAvailable = true
        )
        _updateInfo.value = mockInfo
    }

    fun clearUpdateState() {
        val info = _updateState.value.updateInfo
        val mandatoryUpdateActive =
            _updateState.value.isUpdateAvailable &&
                info != null &&
                (info.mandatoryUpdate || info.forceUpdate)
        if (mandatoryUpdateActive) {
            Log.w(TAG, "Ignored attempt to clear a mandatory update")
            return
        }

        _updateState.value = _updateState.value.copy(
            updateInfo = null,
            isUpdateAvailable = false
        )
        _updateInfo.value = null
    }

    private fun updateMandatoryCache(
        info: AppUpdateInfo,
        currentVersionCode: Int
    ) {
        val isMandatory = info.mandatoryUpdate || info.forceUpdate
        if (isMandatory && info.latestVersionCode > currentVersionCode) {
            mandatoryUpdatePrefs.edit()
                .putLong("version_code", info.latestVersionCode)
                .putString("version_name", info.latestVersionName)
                .putString("apk_url", info.apkDownloadUrl)
                .putString("apk_sha256", info.apkSha256)
                .putString("message", info.updateMessage)
                .putString("release_channel", info.releaseChannel)
                .putBoolean("force_update", info.forceUpdate)
                .apply()
        } else {
            mandatoryUpdatePrefs.edit().clear().apply()
        }
    }

    private fun restoreMandatoryUpdate() {
        val versionCode = mandatoryUpdatePrefs.getLong(
            "version_code",
            0L
        )
        if (versionCode <= getCurrentVersionCode().toLong()) {
            if (versionCode > 0L) {
                mandatoryUpdatePrefs.edit().clear().apply()
            }
            return
        }

        val cachedInfo = AppUpdateInfo(
            latestVersionCode = versionCode,
            latestVersionName = mandatoryUpdatePrefs.getString(
                "version_name",
                ""
            ).orEmpty(),
            apkDownloadUrl = mandatoryUpdatePrefs.getString(
                "apk_url",
                ""
            ).orEmpty(),
            apkSha256 = mandatoryUpdatePrefs.getString(
                "apk_sha256",
                ""
            ).orEmpty(),
            mandatoryUpdate = true,
            forceUpdate = mandatoryUpdatePrefs.getBoolean(
                "force_update",
                false
            ),
            updateMessage = mandatoryUpdatePrefs.getString(
                "message",
                "A required KidsGuard update must be installed."
            ).orEmpty(),
            releaseChannel = mandatoryUpdatePrefs.getString(
                "release_channel",
                "stable"
            ).orEmpty()
        )
        _updateState.value = _updateState.value.copy(
            updateInfo = cachedInfo,
            isUpdateAvailable = true,
            downloadError = null
        )
        _updateInfo.value = cachedInfo
        Log.i(
            TAG,
            "Restored mandatory update gate for version $versionCode"
        )
    }

    fun openUpdateUrl(url: String) {
        if (url.isBlank()) return
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open update URL: $url", e)
        }
    }

    fun downloadAndInstallUpdate(info: AppUpdateInfo) {
        if (_updateState.value.isDownloading) return

        val downloadUri = Uri.parse(info.apkDownloadUrl.trim())
        if (
            downloadUri.scheme?.lowercase() != "https" ||
            downloadUri.host.isNullOrBlank()
        ) {
            failDownload(
                "The update URL is not secure. Installation was blocked."
            )
            return
        }

        val expectedHash = info.apkSha256.trim().lowercase()
        if (!expectedHash.matches(Regex("^[a-f0-9]{64}$"))) {
            failDownload(
                "This release has no valid SHA-256 checksum. " +
                    "Installation was blocked for safety."
            )
            return
        }

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !context.packageManager.canRequestPackageInstalls()
        ) {
            val permissionIntent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            context.startActivity(permissionIntent)
            failDownload(
                "Allow installs from KidsGuard, then tap Update Now again."
            )
            return
        }

        updateScope.launch {
            try {
                val manager = context.getSystemService(
                    Context.DOWNLOAD_SERVICE
                ) as DownloadManager
                val fileName =
                    "KidsGuard-v${info.latestVersionName}.apk"
                val downloadDirectory = requireNotNull(
                    context.getExternalFilesDir(
                        Environment.DIRECTORY_DOWNLOADS
                    )
                ) {
                    "Secure download storage is unavailable"
                }
                val apkFile = File(downloadDirectory, fileName)
                if (apkFile.exists()) {
                    apkFile.delete()
                }

                val request = DownloadManager.Request(downloadUri)
                    .setTitle("KidsGuard ${info.latestVersionName}")
                    .setDescription("Downloading verified update")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE
                    )
                    .setDestinationInExternalFilesDir(
                        context,
                        Environment.DIRECTORY_DOWNLOADS,
                        fileName
                    )

                val downloadId = manager.enqueue(request)
                _updateState.value = _updateState.value.copy(
                    isDownloading = true,
                    downloadProgress = 0,
                    downloadError = null
                )

                awaitDownload(manager, downloadId)
                val uri = manager.getUriForDownloadedFile(downloadId)
                    ?: throw IllegalStateException(
                        "Downloaded APK could not be opened"
                    )
                val actualHash = sha256(uri)

                if (!actualHash.equals(expectedHash, ignoreCase = true)) {
                    manager.remove(downloadId)
                    throw SecurityException(
                        "APK integrity check failed. The downloaded file was removed."
                    )
                }

                val identityError = verifyApkIdentity(
                    apkFile,
                    info.latestVersionCode
                )
                if (identityError != null) {
                    manager.remove(downloadId)
                    throw SecurityException(identityError)
                }

                _updateState.value = _updateState.value.copy(
                    isDownloading = false,
                    downloadProgress = 100,
                    downloadError = null
                )

                withContext(Dispatchers.Main) {
                    val installIntent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(
                            uri,
                            "application/vnd.android.package-archive"
                        )
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(installIntent)
                }
            } catch (error: Exception) {
                Log.e(TAG, "Secure update failed", error)
                failDownload(
                    error.message ?: "Update download failed"
                )
            }
        }
    }

    private suspend fun awaitDownload(
        manager: DownloadManager,
        downloadId: Long
    ) {
        while (true) {
            manager.query(
                DownloadManager.Query().setFilterById(downloadId)
            ).use { cursor ->
                if (!cursor.moveToFirst()) {
                    throw IllegalStateException("Download disappeared")
                }
                val status = cursor.getInt(
                    cursor.getColumnIndexOrThrow(
                        DownloadManager.COLUMN_STATUS
                    )
                )
                val downloaded = cursor.getLong(
                    cursor.getColumnIndexOrThrow(
                        DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR
                    )
                )
                val total = cursor.getLong(
                    cursor.getColumnIndexOrThrow(
                        DownloadManager.COLUMN_TOTAL_SIZE_BYTES
                    )
                )
                val progress = if (total > 0) {
                    ((downloaded * 100) / total).toInt().coerceIn(0, 99)
                } else {
                    0
                }
                _updateState.value = _updateState.value.copy(
                    isDownloading = true,
                    downloadProgress = progress,
                    downloadError = null
                )

                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> return
                    DownloadManager.STATUS_FAILED -> {
                        val reason = cursor.getInt(
                            cursor.getColumnIndexOrThrow(
                                DownloadManager.COLUMN_REASON
                            )
                        )
                        throw IllegalStateException(
                            "APK download failed (reason $reason)"
                        )
                    }
                }
            }
            delay(500)
        }
    }

    private fun verifyApkIdentity(
        apkFile: File,
        expectedVersionCode: Long
    ): String? {
        val archiveInfo = context.packageManager.getPackageArchiveInfo(
            apkFile.absolutePath,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_SIGNING_CERTIFICATES
            } else {
                @Suppress("DEPRECATION")
                PackageManager.GET_SIGNATURES
            }
        ) ?: return "The downloaded file is not a valid Android package."

        if (archiveInfo.packageName != context.packageName) {
            return "APK package identity does not match KidsGuard. " +
                "Installation was blocked."
        }

        val archiveVersionCode = if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
        ) {
            archiveInfo.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            archiveInfo.versionCode.toLong()
        }
        if (archiveVersionCode != expectedVersionCode) {
            return "APK version does not match the published release. " +
                "Installation was blocked."
        }
        if (archiveVersionCode <= getCurrentVersionCode().toLong()) {
            return "The downloaded APK is not newer than the installed app."
        }

        val installedInfo = try {
            context.packageManager.getPackageInfo(
                context.packageName,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    PackageManager.GET_SIGNING_CERTIFICATES
                } else {
                    @Suppress("DEPRECATION")
                    PackageManager.GET_SIGNATURES
                }
            )
        } catch (_: PackageManager.NameNotFoundException) {
            return "Installed KidsGuard identity could not be verified."
        }

        val installedSigners = signerDigests(installedInfo)
        val archiveSigners = signerDigests(archiveInfo)
        if (
            installedSigners.isEmpty() ||
            archiveSigners.isEmpty() ||
            installedSigners.intersect(archiveSigners).isEmpty()
        ) {
            return "APK signing certificate does not match the installed " +
                "KidsGuard app. The downloaded file was removed."
        }

        return null
    }

    private fun signerDigests(
        packageInfo: android.content.pm.PackageInfo
    ): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = packageInfo.signingInfo
                ?: return emptySet()
            if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
        } else {
            @Suppress("DEPRECATION")
            packageInfo.signatures
        }

        return signatures.orEmpty().map { signature ->
            val digest = MessageDigest.getInstance("SHA-256")
                .digest(signature.toByteArray())
            digest.joinToString("") { byte ->
                (byte.toInt() and 0xff)
                    .toString(16)
                    .padStart(2, '0')
            }
        }.toSet()
    }

    private fun sha256(uri: Uri): String {
        val digest = MessageDigest.getInstance("SHA-256")
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Downloaded APK could not be read" }
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") {
            "%02x".format(it)
        }
    }

    private fun failDownload(message: String) {
        _updateState.value = _updateState.value.copy(
            isDownloading = false,
            downloadProgress = 0,
            downloadError = message
        )
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            android.widget.Toast.makeText(
                context,
                message,
                android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }
}
