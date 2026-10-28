# KidsGuard Android Parent Pairing — Release Candidate QA

Status: **BLOCKED ON PHYSICAL-DEVICE QA**. This document is a test plan, not a claim that real pairing has passed.

## Build provenance
- Candidate branch: `fix/android-parent-secure-pairing`
- PR: #50 (draft, main unchanged)
- Release currently: v1.0.86 (version code 86); **do not publish or reuse a production version code**.
- GitHub Actions `Production Readiness Gate` run #44: passed.
- CI debug APK is for internal QA only, not a signed Play release.
- Record **exact commit SHA and artifact hash** from the Android CI run before testing. Re-run CI for any subsequent source changes.

## Device preparation
- Use two authorized test devices: one parent phone, one child phone.
- Have a verified parent Firebase account; use a child account/device created with appropriate guardian consent.
- Record Android versions, app build identity, environment/project, and test time.
- Never paste real pairing codes, credentials, child locations, or personal identifiers into GitHub issues or logs.

## Pairing test matrix
| ID | Scenario | Expected outcome | Result |
|---|---|---|---|
| P01 | Verified parent signs in | Login succeeds and parent setup is accessible | NOT RUN |
| P02 | Unverified parent attempts pairing | Denied with meaningful error | NOT RUN |
| P03 | Child generates a fresh six-digit pairing code | Code is generated and shown | NOT RUN |
| P04 | Parent setup initially has consent unchecked | Connect disabled until affirmative consent | NOT RUN |
| P05 | Enter fresh six-digit code, accept consent and tap Connect | Server pairs once; parent dashboard displays correct child | NOT RUN |
| P06 | Close and reopen parent app | Paired child remains linked to same family | NOT RUN |
| P07 | Invalid code | Denied without creating family-child link | NOT RUN |
| P08 | Expired code | Denied; no linkage created | NOT RUN |
| P09 | Already used code | Denied without duplicate linkage | NOT RUN |
| P10 | Unauthorized account or family tries to pair | Denied by server authorization | NOT RUN |
| P11 | Plan's child-device limit is reached | Denied with slot-limit message | NOT RUN |
| P12 | Network interrupted while pairing | No duplicate or inconsistent linkage; retry outcome explained | NOT RUN |
| P13 | Child and parent view child status | Correct family/child identifiers, device status synchronized | NOT RUN |
| P14 | Parent explicitly declines consent | No server pairing request made | NOT RUN |

## Verification gates before release candidate
- [x] Source changes isolated in PR #50.
- [x] Production Readiness Gate #44 passed.
- [ ] Android CI for the **final candidate SHA** passed and debug APK artifact available.
- [ ] P01–P14 recorded with evidence (redacted).
- [ ] Check Firestore family/child consistency and parental consent record using an authorized test environment.
- [ ] Confirm Firebase Cloud Functions are deployed at a compatible revision in the actual QA environment.
- [ ] Verify actual Google Cloud Pub/Sub RTDN topic against configuration before any production changes.
- [ ] Generate a uniquely versioned signed release AAB only after manual QA and signing checks.
- [ ] Google Play Internal testing and policy declarations reviewed.
- [ ] Explicit release approval.

Do not merge or deploy production until blockers are cleared.
