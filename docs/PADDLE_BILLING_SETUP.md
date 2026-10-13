# Paddle Billing setup for KidsGuard

KidsGuard uses Paddle Billing as the planned Merchant of Record checkout.

## Before enabling checkout

1. Create and verify a Paddle seller account using the exact United Foreign Trade business details.
2. Ask Paddle to approve the KidsGuard domain and parental-safety software use case.
3. Create a recurring Family Plan price in EUR:
   - EUR 2.99 per month
   - seven-day trial
   - two child devices included
4. Start in Paddle Sandbox.
5. In Vercel, add:
   - `NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox`
   - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<sandbox client token>`
   - `NEXT_PUBLIC_PADDLE_PRICE_ID=<sandbox recurring price id>`
6. Redeploy the web dashboard.

The browser token and price ID are intentionally public Paddle identifiers. Never put a Paddle API key or webhook secret in a `NEXT_PUBLIC_*` variable.

## Required before live payments

- Implement and deploy a signature-verified Paddle webhook.
- Subscribe to transaction and subscription lifecycle events.
- Store event IDs for deduplication.
- Sync customer, subscription, status, scheduled cancellation and effective date to the family record.
- Replace the provisional local cancellation handling with Paddle API/customer-portal cancellation.
- Test the full sandbox lifecycle: trial, paid, past due, cancellation, undo cancellation and resubscription.
- Switch Vercel variables to production only after Paddle approves the domain and product.
