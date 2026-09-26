# KidsGuard Master Specification Compliance

Source: the 20-part product specification shared by the project owner.

This document is the release source of truth. A requirement is only `Complete`
when its Android/Web implementation, backend/rules, and relevant tests exist.
Screens that only display mock data do not count as complete.

Status legend:

- `Complete` — implemented end to end in the repository.
- `Partial` — some layers exist, but the end-to-end requirement is incomplete.
- `Missing` — no production implementation was found.
- `External` — implementation also depends on billing, credentials, policy, or a business decision.
- `Device test` — code exists, but real-device verification is still required.

## 1. Family and Account System

| Requirement | Status | Completion condition |
|---|---|---|
| Parent email account and login | Complete | Firebase Auth flow remains covered by smoke tests. |
| Mandatory email verification | Partial | Enforce consistently in Android, Web, Functions, and rules. |
| Family creation and membership | Complete | Emulator tests must prove tenant isolation. |
| Owner / Manager / Viewer roles | Partial | Align role names and permissions across UI, Functions, and rules. |
| Multiple family members | Complete | Invitation and removal regression tests required. |
| Child profile management | Complete | Add/update/remove flows require E2E coverage. |
| Per-child device/data separation | Partial | Complete security-rule matrix and cross-family denial tests. |
| Child-slot entitlement | Partial | Backend slot enforcement exists; plan/trial enforcement is incomplete. |

## 2. Child Android App and Device Pairing

| Requirement | Status | Completion condition |
|---|---|---|
| Child role/setup flow | Complete | Fresh-install device test. |
| Secure pairing to child and family | Partial | Pairing Function and rollback paths require deployed E2E verification. |
| Stable unique device identity | Complete | Upgrade/data-clear behaviour must be documented and tested. |
| Authorized family connection | Partial | Complete rules and callable-Function abuse tests. |
| Firebase data sync | Partial | Several features sync; unified offline/error semantics remain incomplete. |
| Background sync | Partial | WorkManager exists; OEM/battery and retry tests remain. |
| Remote configuration | Partial | Some settings sync; acknowledgement/versioning is incomplete. |
| App update prompt | Device test | v1.0.54 validates the release artifact and restores a previously received mandatory update gate after restart or while offline. |

## 3. Screen Time and App Usage

| Requirement | Status | Completion condition |
|---|---|---|
| Usage Access onboarding/status | Device test | v1.0.50 reports permission state; Wellbeing distinguishes unavailable, stale, and not-yet-reported usage instead of presenting zero as authoritative. |
| Installed-app inventory | Complete | v1.0.37+ repair scan; real-device regression required. |
| Daily total screen time | Device test | Real today, yesterday, and recorded-day 7-day average are implemented; historical child-device data requires validation. |
| Per-app usage duration | Complete | v1.0.38 writes dashboard-compatible app documents. |
| Last-used data | Complete | Verify Android-version differences. |
| YouTube activity/history | Complete | Shorts thumbnails are deferred; sync/device tests remain. |
| Browser history | Partial | Sync/rules fixed; multi-browser coverage and privacy controls remain. |
| Offline usage queue and recovery | Partial | YouTube/browser local stores exist; generic usage durability needs tests. |

## 4. App Blocking and Screen-Time Limits

| Requirement | Status | Completion condition |
|---|---|---|
| Block/unblock a selected app | Complete | v1.0.40 parent control acknowledgement and real-device enforcement verified. |
| Daily total limit | Device test | v1.0.42 dashboard control and child-side daily enforcement implemented; reset/device test required. |
| Per-app daily limit | Complete | v1.0.40 authoritative rule acknowledgement and real-device blocking verified. |
| Time-based schedules | Device test | Global lock and per-app recurring schedules are implemented; verify v1.0.56 on a child device. |
| Bedtime schedule | Device test | v1.0.46 supports independent weekday/weekend overnight windows; real-device boundary test required. |
| Weekday/weekend rules | Device test | v1.0.46 adds separate weekday and weekend lock windows with midnight rollover enforcement. |
| Temporary unlock | Device test | v1.0.51 makes parent/PIN unlock override the active bedtime window until it ends and prevents immediate schedule relock. |
| Per-child rules | Partial | Data is child-scoped; full role/rules test coverage required. |
| Limit-reached parent notification | Complete | v1.0.40 deduplicated restriction event and FCM delivery verified. |

## 5. GPS Location and Safe Zones

| Requirement | Status | Completion condition |
|---|---|---|
| Current location and map | Complete | v1.0.38 canonical latest-location listener/rules. |
| Last-updated time | Complete | Validate stale/offline presentation. |
| Background location sync | Partial | Real-device/OEM/background tests required. |
| Location history | Partial | Points display; retention, pagination, and long-term cost controls remain. |
| Per-child safe zones and radius | Complete | Background service cloud-zone loading fixed in v1.0.38. |
| Enter/exit detection | Device test | v1.0.41 persists zone state and adds GPS-accuracy hysteresis; boundary/restart test required. |
| Safe-zone parent alert | Device test | Function is deployed; v1.0.41 honours per-zone enter/exit settings and requires movement testing. |
| Battery-aware tracking | Partial | Adaptive behaviour exists in parts; measured battery acceptance test missing. |

## 6. Notifications and Alerts

| Requirement | Status | Completion condition |
|---|---|---|
| Parent push notifications | Partial | Functions billing/deployment and Android/Web token delivery tests required. |
| Screen-time limit alert | Device test | v1.0.42 creates one daily total-limit event and uses the deployed restriction FCM pipeline. |
| App-usage limit alert | Complete | v1.0.40 restriction event, deduplication, history, and FCM verified. |
| Blocked-app attempt alert | Complete | v1.0.40 daily event deduplication and FCM implemented; delivery test remains recommended. |
| Safe-zone enter/exit alert | Partial | Trigger exists; deployment/device validation required. |
| Low-battery alert | Partial | Status trigger exists; threshold/settings/device tests required. |
| Device-offline alert | Partial | Scheduled Function exists; deploy and duplicate tests required. |
| Sync-error alert | Missing | Define critical error threshold and notify parent. |
| App-update alert | Partial | In-app update prompt exists; parent notification is incomplete. |
| Parent alert preferences | Partial | Settings exist for some types; complete type mapping. |
| Notification history | Partial | Backend records exist only when Functions run. |
| New-app-installed alert only after baseline | Complete | v1.0.39 flagging prevents baseline notifications; Function deployment required. |

## 7. Parent Dashboard and Analytics

| Requirement | Status | Completion condition |
|---|---|---|
| Child overview/status | Complete | Device smoke test. |
| Location, safe zones, history | Complete | Pagination/staleness improvements remain performance work. |
| Installed apps and app usage | Complete | Requires Usage Access on child. |
| YouTube and browser history | Complete | Browser compatibility tests remain. |
| Remote controls and protection modes | Partial | Applied/failed acknowledgement is incomplete. |
| Wellbeing data | Partial | Real current-day, yesterday, and 7-day screen-time metrics plus lock schedules work; broader trends/limits remain incomplete. |
| Daily/weekly analytics | Partial | Live 7-day screen-time analytics are implemented; broader nightly/weekly aggregation remains incomplete. |
| No production mock data | Partial | Major dashboard mocks removed in v1.0.38; all routes need final sweep. |
| Fast initial load/lazy analytics | Complete | Child status stays live globally while overview, intelligence, wellbeing, internet, modes, and panel-specific data listeners attach only for the active tab. |

## 8. Reports, History, and Data Retention

| Requirement | Status | Completion condition |
|---|---|---|
| Daily history | Partial | Multiple event histories exist; unified report is incomplete. |
| Weekly summary and trends | Partial | Models/UI exist; reliable aggregation pipeline is incomplete. |
| App, alert, location, safe-zone history | Partial | Individual sources exist; filtering/pagination is inconsistent. |
| Restriction-event history | Complete | Real-time parent history displays blocked-app, app-limit, total-limit, and scheduled restriction events with period filters. |
| Sync history | Partial | Diagnostics fields exist in parts; unified history is missing. |
| Date/date-range filters | Partial | Some panels support dates; range support is incomplete. |
| Per-child reports | Partial | Child scoping exists; consolidated reports are incomplete. |
| Retention policy and scheduled cleanup | Partial | Family export/deletion cleanup exists; event-specific retention is missing. |
| Parent data deletion | Partial | Family deletion exists; granular child-data deletion requires verification. |
| Data export | Partial | Family export Function exists; deployment and download E2E test required. |

## 9. Subscription, Trial, and Child Limits

| Requirement | Status | Completion condition |
|---|---|---|
| Trial lifecycle | Partial | Metadata exists; expiry/feature enforcement is incomplete. |
| Paid plans and payment provider | External | Final plans/provider required; payment integration is missing. |
| Child/device limits | Partial | Child slots are backend-enforced; device-limit policy is incomplete. |
| Active/expired/cancelled states | Partial | Complete authoritative state transitions. |
| Renewal/cancellation | Missing | Requires payment provider and webhooks. |
| Expiry behaviour | Missing | Business rules and backend enforcement required. |
| Backend entitlement enforcement | Partial | Child slots exist; feature entitlements are incomplete. |

## 10. Security, Privacy, and Permissions

| Requirement | Status | Completion condition |
|---|---|---|
| Authentication and verification | Partial | Verification enforcement must be consistent. |
| Family/child data isolation | Partial | Formal emulator rules suite must pass. |
| Role-based authorization | Partial | UI and rules exist; callable/admin paths need complete tests. |
| Device authorization | Partial | Pairing/identity rules exist; abuse and recovery tests required. |
| Backend authorization | Partial | Functions include checks; audit all exports. |
| Account/data deletion | Partial | Functions exist; deploy and E2E test. |
| Data minimization | Partial | Complete data inventory and retention mapping. |
| Audit logging | Partial | Some logs exist; immutable security audit coverage incomplete. |
| Secure trusted updates | Device test | v1.0.53 requires release SHA-256 and verifies HTTPS, package identity, and signing-certificate continuity before opening Android installer; mismatched files are deleted. |
| Secret and credential hygiene | Partial | Keystore is present in repository and must be remediated. |

## 11. Child Device Health and Connectivity

| Requirement | Status | Completion condition |
|---|---|---|
| Online/offline and last seen | Complete | Scheduled offline Function deployment required for alerts. |
| Last successful sync | Partial | v1.0.50 standardizes app-usage, YouTube, and browser sync health and displays last success/failure diagnostics; remaining workers need adoption. |
| Battery and charging | Complete | Device tests. |
| Network status | Complete | Device tests. |
| Service/tracking status | Complete | Improve stale-state handling. |
| Permission status | Device test | v1.0.50 reports eight child permission states, including Usage, Accessibility, Notification, background location, overlay, microphone, and battery exemption. |
| Sync failure warning | Device test | v1.0.49 tracks consecutive app-usage, YouTube, and browser sync failures and shows a self-clearing parent dashboard warning. |
| App/update version | Complete | Hardcoded status version fixed in v1.0.38. |
| Device diagnostics | Partial | v1.0.49 adds shared data-sync health to the device-health view; broader diagnostics remain distributed. |

## 12. Remote Commands and Device Control

| Requirement | Status | Completion condition |
|---|---|---|
| Remote lock/unlock/ring | Device test | v1.0.55 atomically claims commands and reports Delivered, Applied, Failed, or Expired with result details. |
| Remote restrictions/limits/schedules | Partial | Several config paths exist; authoritative versioned config is missing. |
| Remote safe-zone update | Complete | Child repository now receives cloud zones in background service. |
| Offline command retry | Device test | v1.0.55 keeps commands queued while offline, rejects expired work on delivery, and atomically prevents duplicate execution; process-death tests remain. |
| Pending/delivered/applied/failed status | Complete | v1.0.55 provides live dashboard lifecycle badges, timestamps/result messages, legacy mapping, and client-side expiry presentation. |
| Command timestamps | Complete | Verify server-time consistency. |
| Parent-role authorization | Partial | Complete rules/Function tests. |

## 13. Firebase Backend and Real-time Sync

| Requirement | Status | Completion condition |
|---|---|---|
| Auth/family/child/device model | Complete | Document canonical paths and remove legacy duplicates. |
| Usage/location/alerts/commands | Partial | Core paths exist; consistency and retention need work. |
| Real-time critical data | Complete | Listener lifecycle/cost audit remains. |
| Periodic historical data | Partial | Workers exist; standardized durable queues are incomplete. |
| Tenant security rules | Partial | Add emulator tests for every collection/action. |
| Authoritative configuration | Partial | Multiple config models remain; version/ack required. |
| Offline consistency/conflict handling | Partial | Firestore cache exists; explicit conflict policy is missing. |

## 14. Admin/Internal Dashboard

| Requirement | Status | Completion condition |
|---|---|---|
| User/family/device overview | Partial | Routes exist; verify production data and authorization. |
| System analytics/alerts | Partial | Some UI is static/mock; backend metrics pipeline missing. |
| Subscription/customer management | Partial | UI/data exists in parts; payment lifecycle missing. |
| Device health/support context | Partial | Consolidated diagnostics incomplete. |
| Audit logs | Partial | Complete admin-action logging and viewer. |
| Support tools | Partial | Ticket routes exist; attachment/reply lifecycle requires E2E test. |
| Release management | Device test | Internal dashboard now supports audited Draft, Testing, Published, and Deprecated transitions; signed artifact creation remains external. |
| Strict admin access | Partial | Audit middleware/layout plus backend/rules enforcement. |

## 15. App Update and Release Management

| Requirement | Status | Completion condition |
|---|---|---|
| versionCode/versionName discipline | Complete | v1.0.56 current. |
| Release date/notes/APK/minimum version | Partial | Metadata system exists; mandatory enforcement requires verification. |
| GitHub release artifact | Partial | Manual workflow; current repository artifact is outdated. |
| Internal release states | Complete | Draft and Testing never change child config; confirmed Published transitions atomically activate a release, and only inactive releases can be Deprecated. |
| Periodic update check and popup | Complete | Device test required. |
| Optional versus mandatory update | Device test | v1.0.54 keeps optional releases dismissible, blocks mandatory dismissal/clear, persists the gate across restart/offline use, and exposes retry after failure. |
| Trusted APK/signature/hash | Device test | v1.0.53 release manager requires SHA-256 and Android verifies hash, package name, and signing-certificate continuity before install. |

## 16. Support, Diagnostics, and Error Reporting

| Requirement | Status | Completion condition |
|---|---|---|
| Support request/ticket/status | Partial | Web routes exist; full parent/admin workflow test required. |
| Screenshot/attachment | Missing | Add secure upload, validation, retention, and access rules. |
| Admin response/timeline | Partial | Verify production implementation. |
| Device diagnostic fields | Partial | Consolidate and expose permission/sync health. |
| Structured app error reports | Partial | Error repository exists; cloud pipeline/retention incomplete. |
| Per-stage sync diagnostics | Partial | Feature-specific logs exist; common schema/dashboard missing. |
| Sensitive-data-safe logging | Partial | Audit logs for tokens, URLs, personal data, and release builds. |

## 17. Legal, Privacy, and Consent

| Requirement | Status | Completion condition |
|---|---|---|
| Privacy Policy and Terms | Partial | Draft pages exist; legal review and versioned acceptance required. |
| Explicit parental consent | Missing | Implement recorded, versioned consent during child setup. |
| Purpose/legal-basis data inventory | Missing | Legal/business input and processing register required. |
| Child-friendly transparency | Missing | Add age-appropriate child disclosure. |
| Child/account deletion | Partial | Backend flows exist; legal retention and device unlink tests required. |
| Data access/correction/export | Partial | Export exists; correction/restriction workflows incomplete. |
| Retention policy | Missing | Decide and enforce per data category. |
| Cookie/processor documentation | Partial | Cookie UI exists; processor register/DPA list incomplete. |
| Breach-response procedure | Missing | Create operational process. |
| DPIA assessment | External | Legal/privacy assessment required before EU launch. |

## 18. Android Permissions and Background Services

| Requirement | Status | Completion condition |
|---|---|---|
| Usage Access | Complete | Explain purpose and surface revoked/stale status. |
| Foreground/background location | Complete | Android-version and OEM test matrix required. |
| Notification permission | Complete | Parent and child onboarding paths must both be verified. |
| Network access/state | Complete | Offline tests required. |
| Battery optimization handling | Partial | User guidance exists; restricted-state reporting incomplete. |
| Accessibility/overlay/device admin | Partial | v1.0.43 adds parent-approved protected-settings access; policy compliance and OEM tests remain. |
| WorkManager/foreground service | Complete | Battery and process-death tests required. |
| Permission revocation parent alert | Partial | v1.0.43 adds permission-change request approval and notification; post-revocation coverage for every type remains. |
| No silent failure | Partial | Standard unavailable/stale/error UI required per feature. |

## 19. Performance, Battery, and Cost Optimization

| Requirement | Status | Completion condition |
|---|---|---|
| Event/periodic instead of continuous upload | Partial | Several workers comply; status/location frequency needs measurement. |
| Network-constrained batching | Partial | WorkManager constraints exist; common queue/batching incomplete. |
| Avoid duplicate sync | Partial | Feature dedupe exists; standardized idempotency incomplete. |
| Idle-aware background work | Partial | WorkManager helps; foreground location remains a measured exception. |
| Firestore read/write minimization | Partial | Dashboard listeners are tab-scoped; raw histories, retention, and high-volume aggregation still need further cost controls. |
| Pagination | Partial | Several dashboard histories still use fixed/real-time lists. |
| Aggregated analytics | Partial | Models exist; reliable nightly aggregation not complete/deployed. |
| Local offline queue/retry | Partial | Feature-specific caches exist; generic durable queue missing. |
| Retention cleanup | Partial | Account cleanup exists; high-volume event cleanup missing. |
| Measured battery/RAM/cost targets | Missing | Define budgets and run 24-hour/scale tests. |

## 20. Testing, QA, and Production Release

| Requirement | Status | Completion condition |
|---|---|---|
| Feature/unit tests | Partial | Coverage is not sufficient for release claims. |
| Emulator tests | Partial | Plans exist; automated execution/CI is incomplete. |
| Real-device/Android-version tests | Device test | Owner devices and a documented matrix are required. |
| Wi-Fi/mobile/offline/background/battery tests | Device test | Execute and record results. |
| Full parent-to-child E2E | Device test | Execute after Functions/rules deployment. |
| Security/rules/RBAC tests | Partial | Complete automated negative test suite. |
| Notification duplicate/delivery tests | Device test | Test every alert class. |
| Fresh install and upgrade tests | Device test | Preserve pairing/settings/pending data. |
| Regression suite | Partial | Formal automated smoke suite required. |
| Version/build/install/release workflow | Partial | Build is manual; signed release and CI gates incomplete. |
| GitHub release/internal metadata | Partial | Internal metadata is lifecycle-gated and audited; GitHub artifact upload and formal QA evidence remain manual. |

## Release Gates

No release may be called production-complete until all of these are true:

1. No critical `Missing` item remains in security, pairing, enforcement, sync, or privacy.
2. Firestore emulator security tests pass.
3. Functions are deployed successfully and notification tests pass.
4. Android debug and signed release builds compile.
5. Fresh-install and upgrade E2E tests pass on real devices.
6. Parent/child notification, offline recovery, and command acknowledgement tests pass.
7. Legal consent, retention, deletion, and published policy decisions are complete.
