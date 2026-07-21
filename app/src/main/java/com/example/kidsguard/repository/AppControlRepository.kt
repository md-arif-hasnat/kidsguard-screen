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
