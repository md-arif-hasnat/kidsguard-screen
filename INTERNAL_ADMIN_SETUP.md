# Internal Admin Portal Setup

The KidsGuard dashboard now has a completely separate **Internal Admin Portal** for the platform team, located at `/internal`.

## 1. Authentication
Internal admins must log in at `/internal/login`. 
Normal parent accounts (even Family Owners) are strictly prohibited from accessing `/internal` routes.

## 2. Platform Admin Roles
Authorized users must be added to the `platformAdmins` collection in Firestore.

**Schema:**
- `uid`: User's Firebase UID
- `email`: Work email
- `role`: `SUPER_ADMIN` | `ADMIN` | `SUPPORT` | `DEVELOPER`
- `active`: `true`
- `createdAt`: server timestamp
- `createdBy`: UID of creator

## 3. Manual Bootstrap
To create the first Super Admin:
1. Log in to the dashboard normally to create a Firebase account.
2. Go to the Firebase Console -> Firestore.
3. Create a collection named `platformAdmins`.
4. Create a document with ID = your UID.
5. Set fields:
   - `uid`: "[YOUR_UID]"
   - `email`: "[YOUR_EMAIL]"
   - `role`: "SUPER_ADMIN"
   - `active`: true
   - `createdAt`: [Current Timestamp]
   - `createdBy`: "SYSTEM_BOOTSTRAP"

## 4. Security Enforcement
Permissions are enforced at three levels:
1. **Frontend Navigation**: Sidebar only shows items relevant to the user's portal.
2. **Route Guards**: `InternalLayout.tsx` checks the `platformAdmins` collection before rendering.
3. **Firestore Rules**: `firestore.rules` prevents non-admins from writing releases or reading other families' tickets.

## 5. Support Workflow
- **Parents**: Create tickets at `/support`. They can view conversation history and reply to support at `/support/[ticketId]`.
- **Support Team**: View all incoming requests at `/internal/support`. They can reply directly to parents and manage ticket status.
