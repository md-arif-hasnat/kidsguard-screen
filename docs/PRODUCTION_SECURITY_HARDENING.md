# Production security hardening

This checklist is ordered by incident impact.

## P0 — release blockers

- Firestore and Storage require a matching, active, unexpired server-side admin session for internal access.
- Parent clients cannot create paid subscription state, rewrite family ownership fields, delete their root profile, or create arbitrary private subcollections.
- Login and session evidence collections are server-only.
- Internal sessions are limited to eight hours, single-login, and bound to their original IP address and browser fingerprint.
- An IP or browser mismatch marks the session compromised, revokes refresh tokens, and sends owner email and push alerts.
- Production dependencies must pass `npm audit --omit=dev --audit-level=moderate` before deployment.
- Internal routes are non-cacheable and use clickjacking, MIME-sniffing, referrer, HSTS, CSP guard, and opener-policy headers.

The deployment workflow publishes Functions before Firestore and Storage rules. Do not reverse that order: the stricter rules depend on `finalizeInternalLogin` being able to create the session record.

### Rollout effect

The first rules rollout ends every pre-existing internal browser session because those sessions have no server registry record. Admins must sign in again. Full administrators still require TOTP; employee and accounting accounts retain their existing MFA policy.

## P1 — platform controls

1. Enable Firestore point-in-time recovery and schedule a daily export to a dedicated backup bucket in a separate project or tightly isolated service account.
2. Apply least-privilege IAM. Humans should not hold Owner or Editor for daily work. Keep one emergency account offline and require MFA for every privileged Google account.
3. Keep Paddle, Resend, and other credentials in Secret Manager. Rotate any key copied into chat, email, a local file, or a CI log.
4. Configure budget alerts, Cloud Audit Logs retention, monitoring alerts, and an incident contact independent of the application domain.
5. Create a reCAPTCHA Enterprise site key, set `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` in Vercel, verify valid App Check traffic, then enable enforcement and replay protection on sensitive callable Functions.

App Check enforcement must not be enabled before the production site key is present; otherwise legitimate admin login is blocked.

## P2 — complete session isolation

Stage 1 detects and revokes session reuse when the dashboard or a privileged callable reaches the backend. Firestore Security Rules cannot compare a request's IP address or browser fingerprint. A stolen Firebase ID token could therefore call Firestore directly until it expires or another protected backend check detects the mismatch.

The final isolation stage is to move all internal reads and writes behind a server-side backend-for-frontend using Firebase session cookies, CSRF protection, strict same-site secure cookies, and per-request session-registry validation. After migration, Firestore and Storage should deny all direct internal client access.

## Verification gates

- Functions compile and security unit tests pass on Node.js 22.
- Firestore and Storage emulator tests pass on Java 21.
- Dashboard lint and production build pass.
- Functions and dashboard dependency audits report zero moderate-or-higher vulnerabilities.
- A stolen-session drill confirms: mismatch → session `COMPROMISED` → refresh tokens revoked → owner alert opens `/internal/security/sessions`.
