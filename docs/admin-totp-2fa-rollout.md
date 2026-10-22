# Admin TOTP 2FA rollout

KidsGuard full admin access requires a verified Firebase email, an active
`platformAdmins/{uid}` profile with a `SUPER_ADMIN`, `PLATFORM_ADMIN`, or
`DEV_ADMIN` role, and a TOTP second-factor claim. `EMPLOYEE` and `ACCOUNTING`
roles can sign in without TOTP and may opt in from Internal Settings. The TOTP
secret stays inside Firebase Authentication and the user's authenticator app;
it is never written to Firestore.

Internal authentication uses browser-session persistence. Closing the browser
ends the local login. While the dashboard is open, 30 minutes without user
activity signs the user out. Every internal role also has an eight-hour
absolute session limit, enforced by the dashboard and Firestore rules. Full
administrator callable actions enforce the same limit on the backend.

## Safe production rollout order

Do not deploy the restrictive rules before the new login page is live.

1. Enable Identity Platform for Firebase project `kidsguard-0626` if it is not
   already enabled.
2. Enable TOTP MFA at the project level. From an authenticated Google Cloud
   Shell, run:

   ```bash
   curl -X PATCH \
     "https://identitytoolkit.googleapis.com/admin/v2/projects/kidsguard-0626/config?updateMask=mfa" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     -H "Content-Type: application/json" \
     -H "X-Goog-User-Project: kidsguard-0626" \
     -d '{
       "mfa": {
         "providerConfigs": [{
           "state": "ENABLED",
           "totpProviderConfig": {
             "adjacentIntervals": 1
           }
         }]
       }
     }'
   ```

3. Deploy the web dashboard and wait for the production deployment to finish.
4. Open `/internal/login` in a private browser window and sign in with an active
   admin account. Scan the displayed QR code with an authenticator app, enter
   the six-digit code, and complete enrollment.
5. The setup flow signs the admin out. Sign in again and confirm the TOTP
   challenge opens and `/internal` loads only after the code is accepted.
6. Only after step 5 succeeds, deploy the backend enforcement:

   ```powershell
   firebase deploy --only "firestore:rules,storage"

   $env:FUNCTIONS_DISCOVERY_TIMEOUT="60"
   firebase deploy --only "functions:verifyReleaseArtifact,functions:createPromoCode,functions:setPromoCodeStatus,functions:sendPromoCodeEmail"
   ```

The listed callable functions are the current privileged admin actions. Future
admin callable functions must use `requirePlatformAdmin`, which also verifies
the TOTP claim.

## Recovery

Keep recovery access limited to the Firebase/Identity Platform owner. If an
admin loses the authenticator device, an authorized project owner can remove
that user's enrolled factor using the Firebase Admin SDK, after verifying the
admin's identity through an offline process. Do not add an email-only bypass.

## Recommended next hardening

- Enforce a strong Firebase Authentication password policy for password users.
- Keep at least two individually named super-admin accounts; never share one
  administrator login.
- Alert on new admin-factor enrollment, factor removal, role changes, and
  repeated failed sign-in attempts.
- Move toward phishing-resistant WebAuthn/passkeys or hardware security keys
  when the identity provider supports them for this admin architecture.
