# Paddle Billing setup for KidsGuard

KidsGuard uses Paddle Billing as the planned Merchant of Record checkout.

## Before enabling checkout

1. Create and verify a Paddle seller account using the exact United Foreign Trade business details.
2. Ask Paddle to approve the KidsGuard domain and parental-safety software use case.
3. Create two recurring Family Plan prices in EUR:
   - EUR 3.49 per month with a seven-day trial
   - EUR 35.99 per year with a seven-day trial
   - two child devices included in either interval
4. Under the separate `KidsGuard Extra Child Slot` product, create two
   recurring add-on prices:
   - EUR 1.99 per month for each additional child slot
   - EUR 19.99 per year for each additional child slot
   - the same seven-day free trial as the matching Family Plan price
   - each add-on interval must match the selected Family Plan interval
   - use clear customer-facing price names so the Family Plan and extra-child
     line appear separately on Paddle checkout and invoices
5. Start in Paddle Sandbox.
6. In Vercel, add:
   - `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<sandbox client token>`
   - `NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID=<sandbox monthly price id>`
   - `NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID=<sandbox yearly price id>`
   - `NEXT_PUBLIC_PADDLE_EXTRA_CHILD_MONTHLY_PRICE_ID=<sandbox monthly add-on price id>`
   - `NEXT_PUBLIC_PADDLE_EXTRA_CHILD_YEARLY_PRICE_ID=<sandbox yearly add-on price id>`
7. Redeploy the web dashboard.

When a parent selects extra slots during the first checkout, KidsGuard sends the
Family Plan and add-on as separate line items in one Paddle checkout. Paddle
creates one subscription and bills their combined total in one transaction at
the end of the shared trial. If a slot is added later while the subscription is
already active, Paddle creates an immediate prorated charge; all later renewals
combine the plan and add-on on the same transaction and invoice.

The browser token and price ID are intentionally public Paddle identifiers. Never put a Paddle API key or webhook secret in a `NEXT_PUBLIC_*` variable.

## Secure webhook deployment

The backend endpoint `paddleBillingWebhook` verifies Paddle's `Paddle-Signature`, rejects signatures older than five minutes, deduplicates `event_id` values and atomically synchronizes the family subscription. The `purchaseExtraChildSlot` callable updates the existing Paddle subscription and uses immediate proration with payment-failure protection; access is granted only by the signed webhook.

1. Store the Paddle endpoint secret in Firebase Secret Manager:

   ```powershell
   firebase functions:secrets:set PADDLE_WEBHOOK_SECRET
   ```

2. Add both Functions runtime parameters using the exact Paddle recurring add-on price IDs:

   ```text
   PADDLE_EXTRA_CHILD_MONTHLY_PRICE_ID=<sandbox monthly add-on price id>
   PADDLE_EXTRA_CHILD_YEARLY_PRICE_ID=<sandbox yearly add-on price id>
   ```

   The legacy `PADDLE_EXTRA_CHILD_PRICE_ID` remains supported as the monthly
   add-on only. Until the price for the subscription's interval is present,
   KidsGuard intentionally refuses the billing change.
3. Store a Paddle API key that has subscription read/write permission:

   ```powershell
   firebase functions:secrets:set PADDLE_API_KEY
   ```
4. Deploy the billing functions:

   ```powershell
   $env:FUNCTIONS_DISCOVERY_TIMEOUT="60"
   firebase deploy --only "functions:paddleBillingWebhook,functions:purchaseExtraChildSlot,functions:removeExtraChildSlot"
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
