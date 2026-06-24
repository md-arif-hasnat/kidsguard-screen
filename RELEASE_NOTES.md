# Release Notes

## [v0.1] - Initial Concept & UI
**Release Date:** 2024-12-15
### Summary
The foundation of KidsGuard, focusing on the "Child Mode" experience and initial safety features.
### New Features
- **Kid Mode UI**: High-contrast, child-friendly interface.
- **PIN Unlock**: Secure mechanism to exit child mode.
- **Immersive Mode**: Blocks standard Android navigation buttons (Home/Back).
- **Scheduled Mode**: Initial local logic for timed device locking.

---

## [v0.2] - Management Logic
**Release Date:** 2025-01-20
### Summary
Added the first layer of parent-child relationship management.
### New Features
- **Role Selection**: Dedicated paths for Parents and Children.
- **Pairing Prototype**: Local-first pairing architecture.
- **Activity Feed**: Initial local log of unlock attempts and state changes.

---

## [v0.3] - Tracking Engine
**Release Date:** 2025-03-10
### Summary
Introduced the production background tracking architecture.
### Improvements
- **Background Service**: Reliable GPS updates even when the app is closed.
- **State Management**: Robust tracking configuration (Active/Passive/Stopped).
- **Diagnostics**: Developer tools to verify GPS precision.

---

## [v0.4] - Firebase Foundation
**Release Date:** 2025-05-24
### Summary
Integration of the real-time cloud backend.
### New Features
- **Anonymous Auth**: Stable identity for child devices.
- **Remote Sync**: First version of location uploading to Firestore.
- **Cloud Config**: Fetch app configuration from the cloud.

---

## [v0.5] - Safe Zone Alpha
**Release Date:** 2025-08-12
### Summary
Introduction of geofencing and geographical safety.
### New Features
- **Safe Zone UI**: Parent interface to define areas.
- **Detection Logic**: Device-side Haversine formula implementation.
- **Transition Alerts**: Local notifications for zone entry/exit.

---

## [v0.6] - Web Dashboard Beta
**Release Date:** 2025-11-05
### Summary
Expansion beyond mobile with the Next.js parent portal.
### New Features
- **Next.js Dashboard**: Manage multiple children from any browser.
- **Live Google Map**: Visualize child position in real-time.
- **Multi-Child Cards**: Telemetry dashboard for battery and status.

---

## [v0.7] - SOS & Critical Alerts
**Release Date:** 2026-02-18
### Summary
Safety-critical features for emergency situations.
### New Features
- **Emergency SOS**: Immediate panic button with high-priority cloud sync.
- **FCM Integration**: Real-time push notifications to the parent's device.
- **Sound Alerts**: Local siren for child location finding.

---

## [v0.8] - Child-Specific Intelligence
**Release Date:** 2026-05-10
### Summary
Refining management to support complex family structures.
### Improvements
- **Child-Specific Zones**: Unique perimeters for Home and School per child.
- **Avatar API**: Personalized bot icons for identity visualization.
- **FCM History**: Cloud-stored notification center in the web dashboard.

---

## [v0.9 Beta] - Production Hardening
**Release Date:** 2026-06-25
### Summary
Finalizing security and reliability for the first public release.
### Improvements
- **Security Rules**: Robust Firestore multi-tenancy rules.
- **Geocoding Fallback**: "Pick on Map" support to bypass API billing issues.
- **Auto-Provisioning**: Automated family vault creation for new parents.
- **FCM Dispatch**: Moved notification logic to Cloud Functions.
### Fixed Issues
- Fixed Family Overview regression where children disappeared after cache clear.
- Fixed infinite loading on Safe Zones page.
- Fixed terminology consistency ("children" instead of "devices").
### Known Issues
- Geocoding API may still return REQUEST_DENIED if billing is not enabled; use Map Picker instead.
- iOS Child app is currently not supported.
