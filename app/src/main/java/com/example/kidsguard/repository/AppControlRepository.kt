package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.SyncAppControl
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class AppControlRepository(private val context: Context) {

    private val db = FirebaseFirestore.getInstance()
    private val prefHelper = PreferenceHelper(context)
    private val gson = Gson()

    private val prefs = context.getSharedPreferences(
        "app_controls_cache",
        Context.MODE_PRIVATE
    )

    private val _controls =
        MutableStateFlow<Map<String, SyncAppControl>>(loadCachedControls())

    val controls: StateFlow<Map<String, SyncAppControl>> = _controls

    private var listener: ListenerRegistration? = null

    companion object {
        private const val TAG = "AppControlSync"
        private const val KEY_CACHE = "controls_json"
    }

    /**
     * Listen to:
     *
     * children/{childId}/appControls
     *
     * Existing function name is preserved so other files do not break.
     */
    fun startListening() {

        // val childId = prefHelper.childId.trim()

        val childId = prefHelper.childId
            .trim()
            .takeIf { it.isNotEmpty() }
            ?: prefHelper.pairedChildId
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
            ?: prefHelper.selectedChildId
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
            ?: ""

        if (childId.isEmpty()) {
            Log.e("APP_CONTROL_DEBUG", "No valid childId available")
            return
        }


        Log.e("APP_CONTROL_DEBUG", "LISTENER childId='$childId' path=children/$childId/appControls")


        if (childId.isEmpty()) {
            Log.w(TAG, "Cannot start listening: childId is empty")
            return
        }

        // Avoid multiple active listeners.
        listener?.remove()
        listener = null

        val collectionRef = db
            .collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("appControls")

        Log.i(
            TAG,
            "Starting realtime listener for child=$childId, " +
                    "path=${collectionRef.path}"
        )

        listener = collectionRef.addSnapshotListener { snapshots, error ->


            Log.e(
                "APP_CONTROL_DEBUG",
                "SNAPSHOT size=${snapshots?.size()} docs=${snapshots?.documents?.map { it.id }}"
            )



            if (error != null) {
                Log.e(TAG, "Listen failed", error)
                return@addSnapshotListener
            }

            if (snapshots == null) {
                Log.w(TAG, "Snapshot is null")
                return@addSnapshotListener
            }

            val newControls = mutableMapOf<String, SyncAppControl>()

            Log.d(
                TAG,
                "Received snapshot with ${snapshots.documents.size} documents"
            )

            for (doc in snapshots.documents) {
                try {
                    val packageName = doc.getString("packageName")
                        ?.trim()
                        ?.takeIf { it.isNotEmpty() }
                        ?: doc.id.replace("_", ".")

                    val blocked = doc.getBoolean("blocked") ?: false

                    val dailyLimitMinutes =
                        (doc.get("dailyLimitMinutes") as? Number)?.toInt()

                    Log.e(
                        "APP_CONTROL_DEBUG",
                        "PARSED doc=${doc.id}, package=$packageName, blocked=$blocked, limit=$dailyLimitMinutes"
                    )

                    val control = doc.toObject(SyncAppControl::class.java)

                    if (control == null) {
                        Log.e(
                            "APP_CONTROL_DEBUG",
                            "toObject returned null for doc=${doc.id}"
                        )
                        continue
                    }

                    newControls[packageName] = control

                } catch (e: Exception) {
                    Log.e(
                        "APP_CONTROL_DEBUG",
                        "Failed parsing doc=${doc.id}",
                        e
                    )
                }
            }



            _controls.value = newControls
            cacheControls(newControls)

            Log.i(
                TAG,
                "Received ${newControls.size} app controls from cloud"
            )

            Log.i(
                TAG,
                "Blocked packages: ${
                    newControls
                        .filterValues { it.blocked }
                        .keys
                }"
            )
        }
    }

    /**
     * Existing function name preserved.
     */
    fun stopListening() {
        listener?.remove()
        listener = null

        Log.i(TAG, "App control listener stopped")
    }

    /**
     * Save the latest cloud controls locally.
     */
    private fun cacheControls(
        controls: Map<String, SyncAppControl>
    ) {
        try {
            val json = gson.toJson(controls)

            prefs.edit()
                .putString(KEY_CACHE, json)
                .apply()

            Log.d(
                TAG,
                "Cached ${controls.size} app controls"
            )

        } catch (exception: Exception) {
            Log.e(
                TAG,
                "Failed to cache controls",
                exception
            )
        }
    }

    /**
     * Load local cache when repository starts.
     */
    private fun loadCachedControls(): Map<String, SyncAppControl> {
        val json = prefs.getString(KEY_CACHE, null)
            ?: return emptyMap()

        return try {
            val type = object :
                TypeToken<Map<String, SyncAppControl>>() {}.type

            val cachedControls:
                    Map<String, SyncAppControl> =
                gson.fromJson(json, type) ?: emptyMap()

            Log.d(
                TAG,
                "Loaded ${cachedControls.size} cached controls"
            )

            cachedControls

        } catch (exception: Exception) {
            Log.e(
                TAG,
                "Failed to load cached controls",
                exception
            )

            emptyMap()
        }
    }

    /**
     * Existing function name and return type preserved.
     *
     * Other files can continue calling:
     *
     * appControlRepository.getControl("com.whatsapp")
     */
    fun getControl(packageName: String): SyncAppControl? {
        val normalizedPackageName = packageName.trim()

        if (normalizedPackageName.isEmpty()) {
            return null
        }

        val directControl = _controls.value[normalizedPackageName]

        if (directControl != null) {
            return directControl
        }

        /*
        * Backward compatibility in case an older cache still contains
        * com_whatsapp as its map key.
        */
        val underscoreKey =
            normalizedPackageName.replace(".", "_")

        return _controls.value[underscoreKey]
    }
}


/*

------------------------------------
-------------------
-------------

package com.example.kidsguard.repository

import android.content.Context
import android.util.Log
import com.example.kidsguard.data.PreferenceHelper
import com.example.kidsguard.sync.FirebaseConfig
import com.example.kidsguard.sync.SyncAppControl
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class AppControlRepository(private val context: Context) {
    private val db = FirebaseFirestore.getInstance()
    private val prefHelper = PreferenceHelper(context)
    private val gson = Gson()
    private val prefs = context.getSharedPreferences("app_controls_cache", Context.MODE_PRIVATE)

    private val _controls = MutableStateFlow<Map<String, SyncAppControl>>(loadCachedControls())
    val controls: StateFlow<Map<String, SyncAppControl>> = _controls

    private var listener: ListenerRegistration? = null

    companion object {
        private const val TAG = "AppControlSync"
        private const val KEY_CACHE = "controls_json"
    }

    fun startListening() {
        val childId = prefHelper.childId
        if (childId.isEmpty()) {
            Log.w(TAG, "Cannot start listening: childId is empty")
            return
        }

        Log.i(TAG, "Starting realtime listener for child: $childId")
        listener?.remove()
        listener = db.collection(FirebaseConfig.COL_CHILDREN)
            .document(childId)
            .collection("appControls")
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Log.e(TAG, "Listen failed", e)
                    return@addSnapshotListener
                }

                if (snapshots != null) {
                    val newControls = mutableMapOf<String, SyncAppControl>()
                    for (doc in snapshots.documents) {
                        val control = doc.toObject(SyncAppControl::class.java)
                        if (control != null) {
                            newControls[control.packageName] = control
                        }
                    }
                    Log.i(TAG, "Received ${newControls.size} app controls from cloud")
                    _controls.value = newControls
                    cacheControls(newControls)
                }
            }
    }

    fun stopListening() {
        listener?.remove()
        listener = null
    }

    private fun cacheControls(controls: Map<String, SyncAppControl>) {
        val json = gson.toJson(controls)
        prefs.edit().putString(KEY_CACHE, json).apply()
    }

    private fun loadCachedControls(): Map<String, SyncAppControl> {
        val json = prefs.getString(KEY_CACHE, null) ?: return emptyMap()
        return try {
            val type = object : TypeToken<Map<String, SyncAppControl>>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load cached controls", e)
            emptyMap()
        }
    }

    fun getControl(packageName: String): SyncAppControl? {
        return _controls.value[packageName]
    }
}


*/