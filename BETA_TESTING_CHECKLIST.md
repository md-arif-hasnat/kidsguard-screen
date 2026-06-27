# KidsGuard Beta Testing Checklist

## 1. Onboarding & Authentication
- [ ] Parent can sign up with email and password.
- [ ] Parent can log in with an existing account.
- [ ] Role selection works correctly (Parent vs. Child).
- [ ] Child app generates a pairing code.
- [ ] Parent app/dashboard accepts pairing code and links device.
- [ ] Auto-provisioning of family vault works for new parents.

## 2. Real-Time Monitoring
- [ ] Live location updates on parent map.
- [ ] Battery level and charging status sync.
- [ ] Online/Offline status reflects device connectivity.
- [ ] Last seen timestamp updates correctly.

## 3. Safe Zones (Geofencing)
- [ ] Parent can create a Safe Zone via Map picker.
- [ ] Parent can edit/delete Safe Zones.
- [ ] Child receives notification when entering/exiting a zone.
- [ ] Parent receives push notification for zone transitions.
- [ ] Activity feed records zone events.

## 4. Digital Wellbeing & App Control
- [ ] App usage statistics sync to dashboard.
- [ ] Parent can set time limits for specific apps.
- [ ] Parent can block specific apps.
- [ ] Child app correctly blocks apps when limits reached.
- [ ] Child app shows "App Blocked" screen.

## 5. Web Protection
- [ ] Content filters (Safe Search, Adult Content) work on Chrome.
- [ ] Domain blocking works on child device.
- [ ] Child can request access to a blocked domain.
- [ ] Parent can approve/deny access requests from mobile/web.

## 6. Remote Commands
- [ ] "Locate Now" forces GPS update.
- [ ] "Ring Device" sounds siren even on silent (if permitted).
- [ ] "Lock Device" / "Unlock Device" toggles KidGuard Lock.
- [ ] "Send Message" displays a remote popup on child device.

## 7. Protection Modes (Automation)
- [ ] School Mode activates on schedule or location.
- [ ] Sleep Mode locks device during bedtime.
- [ ] Manual override of modes by parent works.

## 8. Security & Audit
- [ ] Audit logs record all sensitive parent actions.
- [ ] Multi-tenant isolation (Parent A cannot see Parent B's kids).
- [ ] RBAC enforcement (Guardian cannot change settings).
- [ ] Data export works (JSON/CSV).

## 9. Performance & Stability
- [ ] No crashes during background tracking.
- [ ] App handles offline states gracefully.
- [ ] Battery drain is within acceptable limits ( < 5% extra per day).
