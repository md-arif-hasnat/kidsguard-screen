package com.example.kidsguard.billing

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.security.MessageDigest

data class GooglePlayPlan(
    val basePlanId: String,
    val title: String,
    val formattedPrice: String,
    val billingPeriod: String,
    val includesFreeTrial: Boolean
)

data class FamilySubscriptionSummary(
    val isOwner: Boolean = false,
    val provider: String? = null,
    val status: String = "NONE",
    val billingInterval: String? = null,
    val productId: String? = null,
    val currentPeriodEndsAtMillis: Long? = null
) {
    val isGooglePlaySubscription: Boolean
        get() = provider == GooglePlayBillingRepository.PROVIDER_GOOGLE_PLAY

    val hasConflictingProvider: Boolean
        get() = provider != null &&
            provider != "NONE" &&
            provider != GooglePlayBillingRepository.PROVIDER_GOOGLE_PLAY
}

data class GooglePlayBillingUiState(
    val isConnecting: Boolean = true,
    val isProcessing: Boolean = false,
    val plans: List<GooglePlayPlan> = emptyList(),
    val subscription: FamilySubscriptionSummary = FamilySubscriptionSummary(),
    val message: String? = null,
    val error: String? = null
)

/**
 * Owns the Google Play client for the Parent subscription screen.
 *
 * The Android client never grants an entitlement and never acknowledges a
 * purchase. It forwards the Play purchase token to the authenticated Firebase
 * backend, which verifies the token with Google before updating the family.
 */
class GooglePlayBillingRepository(context: Context) : PurchasesUpdatedListener {
    private val applicationContext = context.applicationContext
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val functions = FirebaseFunctions.getInstance(FUNCTIONS_REGION)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val billingClient = BillingClient.newBuilder(applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .enableAutoServiceReconnection()
        .build()

    private val _uiState = MutableStateFlow(GooglePlayBillingUiState())
    val uiState: StateFlow<GooglePlayBillingUiState> = _uiState.asStateFlow()

    private val offerDetailsByBasePlan = mutableMapOf<String, OfferSelection>()

    fun connect() {
        scope.launch { loadFamilySubscription() }

        if (billingClient.isReady) {
            queryProductsAndPurchases()
            return
        }

        _uiState.value = _uiState.value.copy(isConnecting = true, error = null)
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryProductsAndPurchases()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isConnecting = false,
                        error = billingError(result)
                    )
                }
            }

            override fun onBillingServiceDisconnected() {
                _uiState.value = _uiState.value.copy(
                    isConnecting = true,
                    message = "Reconnecting to Google Play…"
                )
            }
        })
    }

    fun disconnect() {
        billingClient.endConnection()
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null, error = null)
    }

    fun launchPurchase(activity: Activity, basePlanId: String) {
        val state = _uiState.value
        if (!state.subscription.isOwner) {
            _uiState.value = state.copy(
                error = "Only the family owner can purchase a subscription."
            )
            return
        }
        if (state.subscription.hasConflictingProvider) {
            _uiState.value = state.copy(
                error = "This family already has a subscription managed by another billing provider."
            )
            return
        }

        val selection = offerDetailsByBasePlan[basePlanId]
        if (selection == null) {
            _uiState.value = state.copy(
                error = "This Google Play plan is not available for this account."
            )
            return
        }

        val uid = auth.currentUser?.uid
        if (uid.isNullOrBlank()) {
            _uiState.value = state.copy(error = "Please sign in again before subscribing.")
            return
        }

        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(selection.productDetails)
            .setOfferToken(selection.offerToken)
            .build()
        val billingParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .setObfuscatedAccountId(sha256(uid))
            .build()

        val result = billingClient.launchBillingFlow(activity, billingParams)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            _uiState.value = state.copy(error = billingError(result))
        }
    }

    fun restorePurchases() {
        if (!billingClient.isReady) {
            connect()
            return
        }
        _uiState.value = _uiState.value.copy(
            isProcessing = true,
            message = "Checking Google Play purchases…",
            error = null
        )
        queryExistingPurchases(showEmptyMessage = true)
    }

    override fun onPurchasesUpdated(
        billingResult: BillingResult,
        purchases: MutableList<Purchase>?
    ) {
        when (billingResult.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val received = purchases.orEmpty()
                if (received.isEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        isProcessing = false,
                        error = "Google Play did not return a purchase."
                    )
                } else {
                    received.forEach(::processPurchase)
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    message = "Purchase cancelled."
                )
            }
            else -> {
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    error = billingError(billingResult)
                )
            }
        }
    }

    private fun queryProductsAndPurchases() {
        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(SUBSCRIPTION_PRODUCT_ID)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(product))
            .build()

        billingClient.queryProductDetailsAsync(params) { result, response ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                _uiState.value = _uiState.value.copy(
                    isConnecting = false,
                    error = billingError(result)
                )
                return@queryProductDetailsAsync
            }

            offerDetailsByBasePlan.clear()
            val plans = response.productDetailsList
                .flatMap(::selectOffers)
                .sortedBy { if (it.plan.basePlanId == MONTHLY_BASE_PLAN_ID) 0 else 1 }
            plans.forEach { offerDetailsByBasePlan[it.plan.basePlanId] = it }

            _uiState.value = _uiState.value.copy(
                isConnecting = false,
                plans = plans.map(OfferSelection::plan),
                error = if (plans.isEmpty()) {
                    "Google Play subscription products are not available yet."
                } else {
                    null
                }
            )
            queryExistingPurchases(showEmptyMessage = false)
        }
    }

    private fun selectOffers(productDetails: ProductDetails): List<OfferSelection> {
        val offerDetails = productDetails.subscriptionOfferDetails.orEmpty()
        return listOf(MONTHLY_BASE_PLAN_ID, ANNUAL_BASE_PLAN_ID).mapNotNull { basePlanId ->
            val candidates = offerDetails.filter { it.basePlanId == basePlanId }
            val selected = candidates.firstOrNull { offer ->
                offer.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L }
            } ?: candidates.firstOrNull { it.offerId == null }
                ?: candidates.firstOrNull()
                ?: return@mapNotNull null
            val phases = selected.pricingPhases.pricingPhaseList
            val paidPhase = phases.lastOrNull { it.priceAmountMicros > 0L }
                ?: phases.lastOrNull()
                ?: return@mapNotNull null
            val title = if (basePlanId == ANNUAL_BASE_PLAN_ID) "Annual" else "Monthly"
            OfferSelection(
                productDetails = productDetails,
                offerToken = selected.offerToken,
                plan = GooglePlayPlan(
                    basePlanId = basePlanId,
                    title = title,
                    formattedPrice = paidPhase.formattedPrice,
                    billingPeriod = paidPhase.billingPeriod,
                    includesFreeTrial = phases.any { it.priceAmountMicros == 0L }
                )
            )
        }
    }

    private fun queryExistingPurchases(showEmptyMessage: Boolean) {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    error = billingError(result)
                )
                return@queryPurchasesAsync
            }

            val purchased = purchases.filter {
                it.purchaseState == Purchase.PurchaseState.PURCHASED &&
                    it.products.contains(SUBSCRIPTION_PRODUCT_ID)
            }
            if (purchased.isEmpty()) {
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    message = if (showEmptyMessage) {
                        "No Google Play subscription was found for this account."
                    } else {
                        _uiState.value.message
                    }
                )
            } else {
                purchased.forEach(::processPurchase)
            }
        }
    }

    private fun processPurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
            _uiState.value = _uiState.value.copy(
                isProcessing = false,
                message = "Payment is pending in Google Play. Access will start after payment completes."
            )
            return
        }
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return

        _uiState.value = _uiState.value.copy(
            isProcessing = true,
            message = "Verifying your subscription securely…",
            error = null
        )
        scope.launch {
            try {
                auth.currentUser?.getIdToken(true)?.await()
                    ?: error("Please sign in again before subscribing.")
                val result = functions
                    .getHttpsCallable(VERIFY_FUNCTION_NAME)
                    .call(
                        mapOf(
                            "purchaseToken" to purchase.purchaseToken,
                            "productId" to SUBSCRIPTION_PRODUCT_ID
                        )
                    )
                    .await()
                val data = result.getData() as? Map<*, *>
                if (data?.get("success") != true) {
                    error("Google Play subscription verification failed.")
                }
                loadFamilySubscription()
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    message = "Google Play subscription is active.",
                    error = null
                )
            } catch (error: Exception) {
                Log.e(TAG, "Google Play subscription verification failed", error)
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    error = error.message ?: "Google Play subscription verification failed."
                )
            }
        }
    }

    private suspend fun loadFamilySubscription() {
        try {
            val uid = auth.currentUser?.uid ?: return
            val parent = db.collection("parents").document(uid).get().await()
            val familyId = parent.getString("familyId") ?: return
            val family = db.collection("families").document(familyId).get().await()
            val subscription = family.get("subscription") as? Map<*, *> ?: emptyMap<Any, Any>()
            val explicitProvider = (subscription["provider"] as? String)?.uppercase()
            val provider = explicitProvider ?: when {
                !((subscription["paddleSubscriptionId"] as? String).isNullOrBlank()) -> "PADDLE"
                else -> null
            }
            val timestamp = subscription["currentPeriodEndsAt"] as? com.google.firebase.Timestamp
            _uiState.value = _uiState.value.copy(
                subscription = FamilySubscriptionSummary(
                    isOwner = family.getString("ownerId") == uid,
                    provider = provider,
                    status = (subscription["status"] as? String)?.uppercase() ?: "NONE",
                    billingInterval = (subscription["billingInterval"] as? String)?.uppercase(),
                    productId = subscription["googlePlayProductId"] as? String,
                    currentPeriodEndsAtMillis = timestamp?.toDate()?.time
                )
            )
        } catch (error: Exception) {
            Log.e(TAG, "Could not read family subscription", error)
            _uiState.value = _uiState.value.copy(
                error = "Subscription details could not be loaded."
            )
        }
    }

    private fun billingError(result: BillingResult): String {
        val detail = result.debugMessage.takeIf { it.isNotBlank() }
        return detail ?: "Google Play Billing is temporarily unavailable."
    }

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray())
            .joinToString("") { "%02x".format(it) }

    private data class OfferSelection(
        val productDetails: ProductDetails,
        val offerToken: String,
        val plan: GooglePlayPlan
    )

    companion object {
        const val PROVIDER_GOOGLE_PLAY = "GOOGLE_PLAY"
        const val SUBSCRIPTION_PRODUCT_ID = "kidsguard_family"
        const val MONTHLY_BASE_PLAN_ID = "monthly"
        const val ANNUAL_BASE_PLAN_ID = "annual"
        private const val VERIFY_FUNCTION_NAME = "verifyGooglePlaySubscription"
        private const val FUNCTIONS_REGION = "us-central1"
        private const val TAG = "GooglePlayBilling"
    }
}
