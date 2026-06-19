# KidsGuard Parent Web Dashboard MVP Skeleton

This is the Next.js + TypeScript skeleton for the KidsGuard Parent Web Dashboard.

## Goal
To provide a professional, responsive web interface for parents to monitor their children's safety, manage safe zones, and send remote commands.

## Architecture
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Backend:** Firebase (Placeholder integration)

## Implementation Status
- [x] Next.js App Structure
- [x] Professional Dashboard UI (Tailwind)
- [x] Mock Data for MVP
- [x] Routing & Navigation
- [x] Child Dashboard Detail View
- [x] Login Screen Placeholder
- [ ] Real Firebase Auth Integration
- [ ] Real Cloud Firestore Integration
- [ ] Google Maps JS API Implementation

## How to Install
Navigate to the `web-dashboard/` folder and run:
```bash
npm install
```

## How to Run
To start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables
Create a `.env.local` file in the `web-dashboard/` folder:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## Future Integration Plan
1. **Auth:** Connect `lib/firebase.ts` to real Firebase project and use `firebase/auth` for `Login` page.
2. **Firestore:** Implement real-time listeners in `DashboardRepository` pattern for the web, mirroring the Android implementation.
3. **App Check:** Implement reCAPTCHA Enterprise as per `web-dashboard/APP_CHECK_PLAN.md`.
4. **Maps:** Replace the Map placeholder in `app/dashboard/[childId]/page.tsx` with `@react-google-maps/api`.
