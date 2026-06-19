# KidsGuard - Parent Web Dashboard Architecture

## 1. Purpose
The KidsGuard Web Dashboard is a centralized platform for parents to monitor and manage their children's safety from any web browser. It leverages the existing Firebase backend used by the KidsGuard Android app, providing a real-time, large-screen experience for complex safety management tasks.

## 2. Tech Stack
- **Framework:** Next.js (React)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Headless UI / Shadcn UI
- **Authentication:** Firebase Auth (Email/Password, Google Sign-in)
- **Database:** Cloud Firestore (Real-time updates)
- **Maps:** Google Maps JavaScript API
- **Hosting:** Firebase Hosting or Vercel

## 3. Core Features
### 3.1 Parent Authentication
- Secure login for registered parent accounts.
- Password reset and account management.

### 3.2 Child Selector
- Sidebar or dropdown to switch between multiple paired child devices.
- Quick status overview for each child (Online, Battery, Current Zone).

### 3.3 Live Map
- Real-time tracking of child's location.
- Historical breadcrumbs for the current day.
- Custom markers for Safe Zones.

### 3.4 Safety Management
- **Safe Zones:** Create, edit, and delete circular safe zones on the map.
- **Remote Commands:** Instant buttons to Lock/Unlock devices, start/stop tracking, and refresh GPS.
- **SOS Center:** Real-time alerts when a child triggers an emergency SOS.

### 3.5 Insights & History
- **Activity Feed:** Chronological log of safety events (Zone entries, low battery, etc.).
- **Route History:** Interactive replay of past movements.
- **AI Summary:** View the Daily Safety Summary generated for each child.

## 4. Firebase Architecture
The web dashboard will interface with the following Firestore collections:
- `families`: To identify which children belong to the logged-in parent.
- `children`: To read status, settings, and metadata.
- `locations`: For live tracking and route history.
- `activity`: To populate the activity feed.
- `safeZones`: To manage safe boundaries.
- `remoteCommands`: To send control signals to the Android app.
- `dailySummaries`: To display safety insights.

## 5. Security Strategy
- **Parent Isolation:** Security rules will ensure parents can only access documents linked to their `familyId`.
- **Read-Only Status:** The web dashboard has read-only access to child device metadata (app version, battery) but read-write access to commands and zones.
- **HTTPS Enforcement:** All traffic must be encrypted via SSL.

## 6. Deployment Plan
- Continuous Integration (CI) using GitHub Actions.
- Automated deployment to Firebase Hosting for optimized global delivery and integration with other Firebase services.
