# Owner-Controlled Team Access Rollout

This rollout keeps the existing Super Admin from being locked out while adding
Admin, Employee, and Accounting accounts.

## Security model

- Every new internal Firebase Auth user is created disabled.
- The raw one-time approval token is sent only to the configured owner email;
  Firestore stores only its SHA-256 hash in a server-only collection.
- Approval requires the owner email, an active `SUPER_ADMIN` profile, and a
  current Firebase TOTP sign-in claim.
- TOTP is mandatory for `SUPER_ADMIN`, `PLATFORM_ADMIN`, and `DEV_ADMIN` roles.
- TOTP is optional for `EMPLOYEE` and `ACCOUNTING`; those users can enroll an
  authenticator from Internal Settings after signing in.
- Admin promotion and account reactivation do not apply until owner approval.
- Deactivation is immediate and cannot target the Super Admin owner.
- Direct client writes to profiles, approvals, secrets, and rate limits are
  denied by Firestore rules.
- A Firestore trigger disables any active privilege change without a matching
  approved owner request.

## Prerequisites

1. Identity Platform TOTP is enabled.
2. `freshmartbd123@gmail.com` is the intended owner email, or the
   `PLATFORM_OWNER_EMAIL` Firebase parameter is set to the correct address.
3. That Firebase Auth user has an active `platformAdmins/{uid}` document with
   role `SUPER_ADMIN`.
4. The owner has completed TOTP enrollment and can sign in at `/internal/login`.
5. `RESEND_API_KEY` is configured. Team Access defaults to the verified sender
   `KidsGuard <noreply@kidsguard-screen.purevelofood.com>`; a different verified
   sender can be provided through `RESEND_FROM_EMAIL`.

## Safe deployment order

1. Deploy the web dashboard and verify the owner can complete password/Google
   sign-in plus TOTP.
2. Build Functions:

   ```powershell
   cd functions
   npm install
   npm run build
   cd ..
   ```

3. Deploy the Team Access functions:

   ```powershell
   $env:FUNCTIONS_DISCOVERY_TIMEOUT="60"

   firebase deploy --only "functions:requestPlatformStaffAccount,functions:requestPlatformStaffChange,functions:resendPlatformStaffApproval,functions:deactivatePlatformStaff,functions:reviewPlatformStaffRequest,functions:resendPlatformStaffInvite,functions:enforcePlatformStaffApproval"
   ```

4. Deploy Firestore and Storage rules:

   ```powershell
   firebase deploy --only "firestore:rules,storage"
   ```

## Acceptance test

1. Open `/internal/team` as the Super Admin.
2. Create one Employee profile. Confirm Firebase Auth shows it as disabled.
3. Open the owner approval email and approve after TOTP sign-in.
4. Confirm the employee receives a password setup email.
5. Sign in as the employee without TOTP and confirm only Health, Devices,
   Support, Issues, and Settings are accessible.
6. From Internal Settings, optionally enroll TOTP for the employee. Sign out,
   sign in again, and confirm the authenticator challenge appears.
7. Create an Accounting profile, sign in without TOTP, and confirm only
   Customers, Families, and Settings are accessible.
8. Request an Employee-to-Admin role change and confirm the employee keeps the
   old role until the owner approves from email.
9. After approval, confirm the promoted Admin must enroll and use TOTP.
10. Deactivate a test profile and confirm sign-in is blocked immediately.

No Android APK update is required.
