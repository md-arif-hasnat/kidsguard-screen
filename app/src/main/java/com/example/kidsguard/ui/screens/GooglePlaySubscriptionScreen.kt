package com.example.kidsguard.ui.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.kidsguard.billing.GooglePlayBillingRepository
import com.example.kidsguard.billing.GooglePlayPlan
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GooglePlaySubscriptionScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val repository = remember(context.applicationContext) {
        GooglePlayBillingRepository(context.applicationContext)
    }
    val state by repository.uiState.collectAsState()

    DisposableEffect(repository) {
        repository.connect()
        onDispose { repository.disconnect() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subscription") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CurrentSubscriptionCard(
                context = context,
                state = state.subscription
            )

            state.error?.let { message ->
                StatusCard(message, isError = true)
            }
            state.message?.let { message ->
                StatusCard(message, isError = false)
            }

            when {
                !state.subscription.isOwner -> {
                    Text(
                        "Only the family owner can start or change a subscription.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                state.subscription.hasConflictingProvider -> {
                    Text(
                        "This family is billed through the KidsGuard website. Manage that subscription before switching billing providers.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    OutlinedButton(
                        onClick = {
                            context.startActivity(
                                Intent(
                                    Intent.ACTION_VIEW,
                                    Uri.parse("https://kidsguard-screen.vercel.app/manage-subscription")
                                )
                            )
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.OpenInNew, contentDescription = null)
                        Text("Manage website subscription", modifier = Modifier.padding(start = 8.dp))
                    }
                }
                state.subscription.isGooglePlaySubscription &&
                    state.subscription.status in setOf("ACTIVE", "TRIALING", "PAST_DUE") -> {
                    Text(
                        "Your Google Play subscription is connected to this family.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                else -> {
                    Text(
                        "Choose a plan",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (state.isConnecting) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    } else {
                        state.plans.forEach { plan ->
                            PlanCard(
                                plan = plan,
                                enabled = !state.isProcessing,
                                onPurchase = {
                                    val activity = context.findActivity()
                                    if (activity != null) {
                                        repository.launchPurchase(activity, plan.basePlanId)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            OutlinedButton(
                onClick = repository::restorePurchases,
                enabled = !state.isConnecting && !state.isProcessing,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (state.isProcessing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Restore Google Play purchase")
                }
            }

            Text(
                "Google Play securely handles payment, renewal and cancellation. Subscription access is activated only after KidsGuard verifies the purchase with Google.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun CurrentSubscriptionCard(
    context: Context,
    state: com.example.kidsguard.billing.FamilySubscriptionSummary
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CreditCard, contentDescription = null)
                Text(
                    "Current subscription",
                    modifier = Modifier.padding(start = 8.dp),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Text("Status: ${state.status.replace('_', ' ')}")
            state.provider?.let { Text("Payment provider: ${it.replace('_', ' ')}") }
            state.billingInterval?.let {
                Text(
                    "Billing: ${it.lowercase().replaceFirstChar { first -> first.uppercase() }}"
                )
            }
            state.currentPeriodEndsAtMillis?.let { timestamp ->
                Text("Current period ends: ${DateFormat.getDateInstance().format(Date(timestamp))}")
            }
            if (state.isGooglePlaySubscription) {
                OutlinedButton(
                    onClick = {
                        val uri = Uri.parse(
                            "https://play.google.com/store/account/subscriptions" +
                                "?sku=${GooglePlayBillingRepository.SUBSCRIPTION_PRODUCT_ID}" +
                                "&package=${context.packageName}"
                        )
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                ) {
                    Icon(Icons.Default.OpenInNew, contentDescription = null)
                    Text("Manage in Google Play", modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }
}

@Composable
private fun PlanCard(
    plan: GooglePlayPlan,
    enabled: Boolean,
    onPurchase: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(plan.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
            Text(
                "${plan.formattedPrice} per ${if (plan.basePlanId == GooglePlayBillingRepository.ANNUAL_BASE_PLAN_ID) "year" else "month"}",
                style = MaterialTheme.typography.titleMedium
            )
            Text("Includes protection for two child devices")
            if (plan.includesFreeTrial) {
                Text(
                    "Eligible new customers receive the Google Play trial shown at checkout.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Button(
                onClick = onPurchase,
                enabled = enabled,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Continue with Google Play")
            }
        }
    }
}

@Composable
private fun StatusCard(message: String, isError: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isError) {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.primaryContainer
            }
        )
    ) {
        Text(message, modifier = Modifier.padding(12.dp))
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
