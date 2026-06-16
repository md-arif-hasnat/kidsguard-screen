# KidsGuard Database Design

Current:
Offline First

Future:
Firebase Ready

---

## Parent

Fields:

* id

* name

* email

* createdAt

---

## Child

Fields:

* id

* parentId

* deviceId

* childName

* battery

* charging

* online

* trackingEnabled

* kidGuardEnabled

* lastSeen

---

## SafeZone

Fields:

* id

* childId

* name

* type

* latitude

* longitude

* radiusMeters

* notifyOnEnter

* notifyOnExit

* enabled

---

## ActivityEvent

Fields:

* id

* childId

* type

* title

* description

* latitude

* longitude

* timestamp

---

## LocationPoint

Fields:

* id

* childId

* latitude

* longitude

* accuracy

* speed

* bearing

* timestamp

---

## Pairing

Fields:

* id

* pairingCode

* parentId

* childId

* createdAt

* expiresAt

---

## NotificationEvent

Fields:

* id

* childId

* type

* title

* body

* sentAt

* read

---

## RemoteCommand

Fields:

* id

* childId

* command

* payload

* createdAt

* executedAt

* status

---

## Future Firebase Collections

parents/

children/

safeZones/

activity/

locations/

notifications/

pairings/

remoteCommands/

settings/

---

## Future Local Storage

Room Database

Tables:

* parents

* children

* safe_zones

* activities

* locations

* notifications

* settings

---

## Design Principles

* Offline First

* Firebase Ready

* Modular

* Scalable

* Multi Child Support

* Multi Parent Support (future)

* Cross Platform Ready

* Easy Migration

Never tightly couple UI and database logic.

Keep repositories as abstraction layers.
