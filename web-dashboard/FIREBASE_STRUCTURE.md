# Firebase Structure for Web Dashboard

The Web Dashboard will utilize the same Firestore structure as the Android app to ensure data consistency and real-time synchronization.

## Collections & Documents

### `families/{familyId}`
- **Usage:** Root document for a family unit.
- **Fields:** `parentDeviceId`, `childDeviceIds[]`, `createdAt`.
- **Web Access:** Read (to get linked children).

### `parents/{parentId}`
- **Usage:** Profile and settings for the parent user.
- **Fields:** `email`, `displayName`, `preferredNotificationMethod`.
- **Web Access:** Read/Write.

### `children/{childId}/status/current`
- **Usage:** Real-time status of the child's device.
- **Fields:** `batteryPercent`, `online`, `lastSeen`, `kidGuardActive`, `trackingEnabled`, `currentZone`.
- **Web Access:** Read.

### `children/{childId}/locations/latest`
- **Usage:** The most recent GPS coordinate of the child.
- **Fields:** `latitude`, `longitude`, `accuracy`, `timestamp`.
- **Web Access:** Read.

### `children/{childId}/locations/{locationId}`
- **Usage:** Historical location data for route replay.
- **Web Access:** Read (last 24 hours).

### `children/{childId}/activity/{activityId}`
- **Usage:** Log of safety events.
- **Fields:** `type`, `title`, `description`, `timestamp`.
- **Web Access:** Read.

### `children/{childId}/remoteCommands/{commandId}`
- **Usage:** Commands sent from parent to child.
- **Fields:** `commandType`, `status`, `createdAt`.
- **Web Access:** Write (Create new commands).

### `devices/{deviceId}`
- **Usage:** Hardware metadata for registered devices (Parent and Child).
- **Fields:** `model`, `osVersion`, `appVersion`, `fcmToken`.
- **Web Access:** Read.

### `safeZones/{familyId}/{zoneId}`
- **Usage:** Management of safe boundaries.
- **Web Access:** Read/Write.

### `notifications/{userId}/{notificationId}`
- **Usage:** History of push notifications sent to the parent.
- **Web Access:** Read.

### `sosEvents/{childId}/{eventId}`
- **Usage:** Critical log of all SOS triggers.
- **Fields:** `timestamp`, `location`, `resolvedStatus`.
- **Web Access:** Read/Write (Resolve status).

### `dailySummaries/{childId}/{date}`
- **Usage:** AI-generated safety insights.
- **Web Access:** Read.

### `routeDeviations/{childId}/{deviationId}`
- **Usage:** Instances where child strayed from known routes.
- **Web Access:** Read.
