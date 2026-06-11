# KidsGuard Project Bible

## Product Vision

KidsGuard is a family safety platform, not just a phone lock app.

Main goal:
Protect children and help parents know if their child is safe, while respecting privacy and platform rules.

## Current Stable Lock Engine

These features already work and must be preserved:

* Fake dead battery screen
* Full black OLED-style screen
* PIN unlock
* Custom PIN
* Secret 5-tap unlock
* Volume Up unlock
* Parent settings
* Scheduled Kid Mode
* Immersive full screen
* Hide status bar
* Hide navigation bar
* Back button protection
* Home button protection
* Auto re-lock

## Future Family Safety Features

* Parent dashboard
* Child dashboard
* Live moving map
* Smart Safe Zones
* Custom radius per location
* Location history
* Activity feed
* Battery status
* Online/offline status
* SOS alerts
* Remote lock
* Remote unlock
* Ring child phone
* Push notifications
* Daily summary
* AI unusual activity alerts

## Smart Safe Zones

Each safe zone can have its own radius.

Examples:

* Home: 500m
* School: 200m
* Playground: 1000m
* Mosque: 300m
* Grandma: 150m

Each safe zone should support:

* Name
* Latitude
* Longitude
* Radius in meters
* Notify on enter
* Notify on exit
* Enabled/disabled status

## Platform Rules

### Android Child

Android child devices can support:

* Fake dead battery lock
* Remote lock
* Remote unlock
* Scheduled lock
* Volume unlock
* Secret tap unlock
* Accessibility protection
* Live location
* Safe zones
* Activity feed
* SOS
* Battery status

### iPhone Child

iPhone child devices have Apple restrictions.

Allowed:

* Live location
* Safe zones
* SOS
* Battery status
* Activity feed
* Notifications

Not allowed or not realistically possible:

* System-wide fake lock
* Blocking Home button
* Blocking system navigation
* Android-style accessibility control

### Parent App

Parent app should work on both:

* iPhone
* Android

Parent app should show:

* Child status
* Live map
* Safe zones
* Activity feed
* Notifications
* Remote commands when supported by child platform

## Privacy Rules

KidsGuard must never include:

* Secret camera access
* Secret microphone access
* WhatsApp reading
* Messenger reading
* Call recording
* Keylogger
* Password stealing
* Hidden spyware behavior
* Hidden surveillance

KidsGuard must be transparent and parental-control focused.

## Future Tech Stack

Android:

* Kotlin
* Jetpack Compose

Backend:

* Firebase Auth
* Firestore
* Firebase Cloud Messaging

Maps:

* Google Maps

Notifications:

* Firebase Cloud Messaging

iOS future:

* Swift / SwiftUI
* Firebase
* Apple-compliant location and notification features

## Development Strategy

Do not add too many features at once.

Each phase should:

1. Add only one major feature.
2. Preserve all existing working features.
3. Build successfully.
4. Be tested before moving to the next phase.
5. Be committed to Git.
