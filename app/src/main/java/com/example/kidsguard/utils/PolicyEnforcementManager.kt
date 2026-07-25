package com.example.kidsguard.utils

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import com.example.kidsguard.R
import com.example.kidsguard.models.BrowserHistory
import com.example.kidsguard.models.WebsiteDecision
import com.example.kidsguard.models.WebsiteDecisionResult
import com.example.kidsguard.repository.WebsitePolicyRepository
import com.example.kidsguard.ui.activities.BlockedWebsiteActivity

class PolicyEnforcementManager(private val context: Context) {

    private val TAG = "POLICY_ENFORCEMENT"
    private val policyRepository = WebsitePolicyRepository(context)
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val handler = Handler(Looper.getMainLooper())
    
    private var warningOverlay: View? = null
    private var lastBlockTime = 0L
    private val BLOCK_COOLDOWN_MS = 3000L

    companion object {
        @Volatile
        private var lastResult: WebsiteDecisionResult? = null
        @Volatile
        private var lastEnforcedHistory: BrowserHistory? = null
        @Volatile
        private var lastEnforcementTime: Long = 0

        fun getLastEnforcement(): Triple<BrowserHistory?, WebsiteDecisionResult?, Long> {
            return Triple(lastEnforcedHistory, lastResult, lastEnforcementTime)
        }
    }

    fun enforce(history: BrowserHistory) {
        val policy = policyRepository.loadPolicy()
        val result = try {
            WebsitePolicyEngine.evaluate(history, policy)
        } catch (e: Exception) {
            Log.e(TAG, "Policy Engine failed", e)
            WebsiteDecisionResult(WebsiteDecision.ALLOW, "Engine failure fallback")
        }

        lastResult = result
        lastEnforcedHistory = history
        lastEnforcementTime = System.currentTimeMillis()

        Log.d(TAG, "Enforcing ${result.decision} for ${history.domain} (Reason: ${result.reason})")

        when (result.decision) {
            WebsiteDecision.ALLOW -> {
                removeWarningOverlay()
            }
            WebsiteDecision.WARN -> {
                showWarningOverlay(history)
            }
            WebsiteDecision.BLOCK -> {
                handleBlock(history, result)
            }
        }
    }

    private fun handleBlock(history: BrowserHistory, result: WebsiteDecisionResult) {
        val now = System.currentTimeMillis()
        if (now - lastBlockTime < BLOCK_COOLDOWN_MS) {
            Log.d(TAG, "Block cooldown active for ${history.domain}")
            return
        }
        lastBlockTime = now

        Log.i(TAG, "BLOCK: ${history.domain}")
        val intent = Intent(context, BlockedWebsiteActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("domain", history.domain)
            putExtra("url", history.url)
            putExtra("category", history.category.name)
            putExtra("reason", result.reason)
        }
        context.startActivity(intent)
    }

    private fun showWarningOverlay(history: BrowserHistory) {
        handler.post {
            if (warningOverlay != null) return@post

            try {
                val inflater = LayoutInflater.from(context)
                val view = inflater.inflate(R.layout.layout_warning_overlay, null)
                val text = view.findViewById<TextView>(R.id.warning_text)
                text.text = "Monitoring: ${history.domain}"

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O)
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    else
                        WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    y = 100
                }

                windowManager.addView(view, params)
                warningOverlay = view
                Log.d(TAG, "Warning overlay shown for ${history.domain}")

                handler.postDelayed({
                    removeWarningOverlay()
                }, 4000)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to show overlay", e)
            }
        }
    }

    private fun removeWarningOverlay() {
        handler.post {
            warningOverlay?.let {
                try {
                    windowManager.removeView(it)
                } catch (e: Exception) {
                    // Ignore
                }
                warningOverlay = null
                Log.d(TAG, "Warning overlay removed")
            }
        }
    }
}
