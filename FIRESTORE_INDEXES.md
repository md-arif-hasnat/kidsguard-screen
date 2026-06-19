# Firestore Composite Indexes Plan

The following composite indexes are required to support the efficient querying of safety data and history in the KidsGuard Android app and Web Dashboard.

## 1. Location History
- **Collection:** `children/{childId}/locations` (or collection group `locations`)
- **Fields:**
  - `childId` (ASC)
  - `timestamp` (DESC)
- **Purpose:** Fetching the most recent location points and generating route replays.

## 2. Activity Feed
- **Collection:** `children/{childId}/activity` (or collection group `activity`)
- **Fields:**
  - `childId` (ASC)
  - `timestamp` (DESC)
- **Purpose:** Displaying chronological safety events for a specific child.

## 3. Remote Commands
- **Collection:** `children/{childId}/remoteCommands` (or collection group `remoteCommands`)
- **Fields:**
  - `childId` (ASC)
  - `status` (ASC)
  - `createdAt` (DESC)
- **Purpose:** Finding `PENDING` commands for the child device to execute.

## 4. SOS Alerts
- **Collection:** `sosEvents`
- **Fields:**
  - `childId` (ASC)
  - `status` (ASC)
  - `timestamp` (DESC)
- **Purpose:** Retrieving active SOS alerts and historical emergency logs.

## 5. Route Deviations
- **Collection:** `routeDeviations`
- **Fields:**
  - `childId` (ASC)
  - `resolved` (ASC)
  - `timestamp` (DESC)
- **Purpose:** Notifying parents of active deviations that haven't been acknowledged.

## 6. Notifications History
- **Collection:** `notifications`
- **Fields:**
  - `userId` (ASC)
  - `sentAt` (DESC)
  - `read` (ASC)
- **Purpose:** Showing unread alerts to the parent.

## 7. Safe Zones
- **Collection:** `safeZones`
- **Fields:**
  - `familyId` (ASC)
  - `enabled` (ASC)
- **Purpose:** Efficiently fetching active zones for background geofencing logic.

## Instructions
1. Open [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Firestore Database** -> **Indexes**.
3. Click **Add Index** and enter the fields above.
4. Alternatively, deploy via Firebase CLI using a `firestore.indexes.json` file.
