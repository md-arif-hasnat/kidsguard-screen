# Paddle Billing setup for KidsGuard

KidsGuard uses Paddle Billing as the planned Merchant of Record checkout.

## Before enabling checkout

1. Create and verify a Paddle seller account using the exact United Foreign Trade business details.
2. Ask Paddle to approve the KidsGuard domain and parental-safety software use case.
3. Create a recurring Family Plan price in EUR:
   - EUR 2.99 per month
   - seven-day trial
   - two child devices included
4. Create a recurring extra-child add-on:
   - EUR 1.99 per month for each additional child slot
   - same monthly billing interval as the Family Plan
5. Start in Paddle Sandbox.
6. In Vercel, add:
   - `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<sandbox client token>`
   - `NEXT_PUBLIC_PADDLE_PRICE_ID=<sandbox recurring price id>`
   - `NEXT_PUBLIC_PADDLE_EXTRA_CHILD_PRICE_ID=<sandbox add-on price id>`
7. Redeploy the web dashboard.

The browser token and price ID are intentionally public Paddle identifiers. Never put a Paddle API key or webhook secret in a `NEXT_PUBLIC_*` variable.

## Secure webhook deployment

The backend endpoint `paddleBillingWebhook` verifies Paddle's `Paddle-Signature`, rejects signatures older than five minutes, deduplicates `event_id` values and atomically synchronizes the family subscription. The `purchaseExtraChildSlot` callable updates the existing Paddle subscription and uses immediate proration with payment-failure protection; access is granted only by the signed webhook.

1. Store the Paddle endpoint secret in Firebase Secret Manager:

   ```powershell
   firebase functions:secrets:set PADDLE_WEBHOOK_SECRET
   ```

2. Add the Functions runtime parameter `PADDLE_EXTRA_CHILD_PRICE_ID` using the exact Paddle recurring add-on price ID. Until it is present, the webhook intentionally does not change `extraChildSlots`.
3. Store a Paddle API key that has subscription read/write permission:

   ```powershell
   firebase functions:secrets:set PADDLE_API_KEY
   ```
4. Deploy the billing functions:

   ```powershell
   $env:FUNCTIONS_DISCOVERY_TIMEOUT="60"
   firebase deploy --only "functions:paddleBillingWebhook,functions:purchaseExtraChildSlot"
   ```

5. In Paddle Sandbox, create a notification destination using the deployed function URL and subscribe to:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.activated`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.canceled`
   - `transaction.completed`

Every checkout must include `custom_data.familyId` and `custom_data.parentUid`. Events without a family mapping or with an owner mismatch are rejected.

## Required before live payments

- Test the full sandbox lifecycle: trial, paid, past due, cancellation, undo cancellation and resubscription.
- Confirm that the add-on quantity updates `subscription.extraChildSlots` only after a verified subscription event.
- Switch Vercel variables to production only after Paddle approves the domain and product.
