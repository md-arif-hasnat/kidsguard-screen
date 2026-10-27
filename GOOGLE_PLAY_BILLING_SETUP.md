# Google Play Billing production setup

The application code is ready to use the following immutable Play Console IDs:

| Item | Value |
| --- | --- |
| Android package | `secure.kidsguard.app` |
| Subscription product | `kidsguard_family` |
| Monthly base plan | `monthly` |
| Annual base plan | `annual` |
| Suggested new-customer offer | `trial-7-days` |
| RTDN Pub/Sub topic | `google-play-rtdn` |

Do not create alternative IDs without updating both the Android application and
the Firebase Functions parameters.

## 1. Play Console account and app

1. Create and verify the KidsGuard organisation developer account.
2. Link the organisation payments profile and payout bank account.
3. Create the KidsGuard app with package `secure.kidsguard.app`.
4. Enrol in Play App Signing and upload a release AAB to Internal testing.
5. Complete the monitoring, Accessibility API, background location, package
   visibility, notification access, privacy and Data safety declarations.

## 2. Subscription catalogue

In **Monetize with Play → Products → Subscriptions**:

1. Create subscription `kidsguard_family`.
2. Create and activate auto-renewing base plan `monthly`.
3. Create and activate auto-renewing base plan `annual`.
4. Optionally create new-customer offer `trial-7-days` on both plans.
5. Configure regional availability, local prices, grace period and account
   hold. The first release includes two child devices and no Play-billed
   quantity add-on.

## 3. Android Publisher API

1. Enable **Google Play Android Developer API** in the Google Cloud project
   linked to Play Console.
2. In Play Console **Users and permissions**, grant the Firebase Functions
   runtime service account access to the KidsGuard app and the billing
   permissions needed to view orders/subscriptions and manage orders.
3. Use the deployed runtime identity. Never create or commit a service-account
   JSON key for the app.

Production currently uses this Functions runtime identity for Gen 2 billing
workloads:

```text
kidsguard-0626@appspot.gserviceaccount.com
```

Confirm the deployed Google Play functions use the same runtime identity before
granting Play Console permissions.

## 4. Real-time developer notifications

1. Create Pub/Sub topic `google-play-rtdn` in the linked Cloud project.
2. Grant `google-play-developer-notifications@system.gserviceaccount.com` the
   Pub/Sub Publisher role on that topic.
3. Configure the topic in Play Console's monetization setup and send a test
   notification.
4. Deploy `handleGooglePlaySubscriptionNotification` after the topic exists.

RTDN is only a change signal. The function always calls the Android Publisher
API for the authoritative subscription state before changing family access.

## 5. Firebase Functions parameters

The defaults match production, but they should be confirmed during deployment:

```text
GOOGLE_PLAY_PACKAGE_NAME=secure.kidsguard.app
GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID=kidsguard_family
GOOGLE_PLAY_RTDN_TOPIC=google-play-rtdn
```

Functions to deploy:

```text
verifyGooglePlaySubscription
handleGooglePlaySubscriptionNotification
```

## 6. Internal test matrix

- New monthly purchase and optional trial.
- New annual purchase and optional trial.
- Pending payment does not grant access.
- Purchase restoration on a second parent device.
- A purchase cannot be linked to a different Firebase parent/family.
- An active Paddle family cannot start Google Play billing.
- An active Google Play family cannot open normal Paddle checkout.
- Renewal extends access.
- User cancellation retains access until the paid period ends.
- Grace period retains access and reports `PAST_DUE`.
- Account hold removes entitlement.
- Expiry and refund remove entitlement.
- Google Play management and order-history links open correctly.

Use Play licence testers and the Internal testing track. Do not test production
billing with a personal payment card.
