# KidsGuard - Emulator Data Seed Plan

## 1. Familiy Structure A (Happy Path)
- **Family ID:** `fam_alpha_123`
- **Parent UID:** `parent_user_001`
- **Children:**
  - `child_c1_001` (Name: "Alex")
  - `child_c2_002` (Name: "Sam")

## 2. Family Structure B (Isolation Test)
- **Family ID:** `fam_beta_999`
- **Parent UID:** `parent_user_002`
- **Children:**
  - `child_c3_003` (Name: "Jordan")

## 3. Data Payloads
### 3.1 Locations (Alex)
- 10 points scattered around "Home" Safe Zone.
- 5 points on a trajectory toward "School".

### 3.2 Activity History
- `KID_MODE_ENABLED` at 08:00 AM.
- `SAFE_ZONE_EXIT` (Home) at 08:15 AM.

### 3.3 Safe Zones (fam_alpha_123)
- **Home:** Lat 51.5074, Lng -0.1278, Rad 500m.
- **School:** Lat 51.5150, Lng -0.1300, Rad 200m.

### 3.4 Route Deviations
- 1 active deviation for "Sam" (child_c2_002) at 02:00 PM today.

### 3.5 Daily Summaries
- Summary for 2026-06-18 (Yesterday) for Alex: Safety Score 92.

## 4. Implementation
Seed data should be exported from a configured Emulator instance using:
```bash
firebase emulators:export ./seed-data
```
And re-imported on start:
```bash
firebase emulators:start --import ./seed-data
```
