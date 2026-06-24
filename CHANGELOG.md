# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-beta] - 2026-06-25

### Added
- **Firebase Authentication**: Full integration with Email/Password, Google, Apple, and Phone Login.
- **Parent Dashboard**: Real-time web-based monitoring platform built with Next.js and Tailwind CSS.
- **Child Pairing**: Secure 6-digit pairing system linking Android devices to the Parent web account.
- **Family Overview**: Unified view of all paired children with live status cards (Battery, Charging, Last Seen).
- **Live Map Center**: Real-time GPS tracking with "Follow Child" functionality and custom robot avatars.
- **Avatar System**: Integrated DiceBear API for unique bot-style avatars for both parents and children.
- **Child Profiles**: Manage child names and individual settings remotely.
- **Safe Zones**: Child-specific geofencing support for Home, School, and Custom locations.
- **Safe Zone Detection**: High-precision boundary detection using the Haversine formula on the Android client.
- **Activity Feed**: Comprehensive log of safety events including zone entries, exits, and system alerts.
- **SOS System**: Real-time emergency triggering from Android with immediate broadcast to Parent Dashboard.
- **Push Notifications**: Integrated Firebase Cloud Messaging (FCM) for instant alerts on Web and Android.
- **Notification Center**: Dedicated history page in the web dashboard for reviewing and managing past alerts.
- **Cloud Functions**: Server-side notification dispatching for enhanced reliability and battery efficiency.
- **Production Hardening**: Integrated Firestore Security Rules for data isolation and "Pick on Map" fallback for geocoding.

### Changed
- Refactored `SafeZoneRepository` to support child-specific scoping instead of global family-level zones.
- Updated `BackgroundTrackingService` to use FCM for remote commands.
- Enhanced `LiveMap` with color-coded safe zone rendering and status markers.

### Fixed
- Fixed regression where paired children were not showing in Family Overview due to missing `localStorage` familyId.
- Resolved build errors caused by missing imports and duplicate definitions in the Next.js dashboard.
- Fixed Geocoding failure (`REQUEST_DENIED`) by implementing a manual location picker.

### Security
- Implemented Firestore rules ensuring parents can only access data for children linked to their specific family vault.
- Fenced all Developer simulation tools behind `BuildConfig.DEBUG` in the Android app.

## [0.3.0] - 2025-05-24
### Added
- App Diagnostics screen for system health verification.
- Permission Health Check with direct system settings deep-links.
- ErrorLogRepository for persistent diagnostic logging.

## [0.2.1] - 2025-04-15
### Added
- Firebase-ready Remote Sync Architecture.
- RemoteCommandHandler for remote instruction execution.

## [0.2.0] - 2025-03-10
### Added
- Production Background Tracking Engine.
- Tracking Config and State management system.

## [0.1.0] - 2025-01-20
### Added
- Parent / Child Role Selection screen.
- Initial Pairing Architecture.
- Immersive protection for Home and Back buttons.
