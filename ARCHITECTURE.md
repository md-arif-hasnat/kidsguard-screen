# KidsGuard Architecture

## Product Vision

KidsGuard is a Family Safety Platform.

The primary goals are:

* Child Safety
* Parent Awareness
* Location Safety
* Safe Zones
* Activity Tracking
* Emergency SOS
* Device Protection

It is NOT a spyware application.

---

## High Level Architecture

```
                Parent App
                     │
                     │
              (Future Firebase)
                     │
                     │
                Child App

                     │

    ------------------------------------

          Location Engine

          Safe Zone Engine

          Activity Engine

          Notification Engine

          Tracking Engine

          SOS Engine

          AI Engine (Future)
```

---

## Android Child

Supported:

* Fake Battery Screen
* PIN Unlock
* Secret Tap Unlock
* Volume Unlock
* Scheduled Kid Mode
* Parent Dashboard
* Activity Feed
* Safe Zones
* GPS Tracking
* Background Tracking
* SOS
* Battery Status

---

## iPhone Child

Supported:

* Live Location
* Safe Zones
* Activity Feed
* Battery Status
* SOS
* Notifications

Restricted:

* Fake Lock Screen
* Home Button Blocking
* Android Accessibility Features

---

## Main Modules

ui/
navigation/
models/
repository/
tracking/
location/
safezone/
activity/
notifications/
services/
utils/

---

## Tracking Flow

GPS

↓

LocationRepository

↓

Activity Generator

↓

Safe Zone Checker

↓

Notification Engine

↓

Firebase Sync (Future)

↓

Parent Dashboard

---

## Future Firebase

Authentication

Firestore

FCM

Real-time Sync

Location Sync

Parent/Child Pairing

---

## Future AI

Daily Summary

Route Deviation

Unknown Place Detection

Battery Intelligence

Safety Alerts

---

## Development Philosophy

* Modular
* Maintainable
* Offline First
* Firebase Ready
* Cross Platform Ready
* Privacy Focused
* No Spyware Features
