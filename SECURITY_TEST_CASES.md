# KidsGuard - Security Test Cases

## 1. Authentication
| Case ID | Scenario | Expected Result |
|---------|----------|-----------------|
| AUTH-01 | Anonymous login with valid config | Success, UID generated |
| AUTH-02 | Attempt write without login | Permission Denied (403) |
| AUTH-03 | 30 minutes without internal-dashboard activity | Automatic sign-out, inactivity message, prompt relogin |
| AUTH-04 | Internal session reaches 8 hours | Dashboard, Firestore, and privileged callable access denied; prompt relogin |
| AUTH-05 | Browser closes during an internal session | Local internal login is not restored in the next browser session |
| AUTH-06 | Existing child app starts with a legacy plaintext parent PIN | PIN is migrated to a salted PBKDF2 credential and the plaintext value is deleted |
| AUTH-07 | Five consecutive wrong parent PIN attempts | PIN entry is locked for 30 seconds; repeated failures increase the lockout up to 15 minutes |
| AUTH-08 | Release backup or device transfer is attempted | Shared preferences, databases, and app files are excluded; Android backup is disabled |
| AUTH-09 | Correct parent PIN is entered after lockout expires | Access succeeds and the failure counter is cleared |

## 2. Family Isolation
| Case ID | Scenario | Expected Result |
|---------|----------|-----------------|
| ISO-01 | Parent A reads Child A (Family A) | Allowed |
| ISO-02 | Parent A reads Child B (Family B) | Permission Denied |
| ISO-03 | Parent A sends command to Child B | Permission Denied |
| ISO-04 | Child A reads Child B data | Permission Denied |

## 3. Pairing Flow
| Case ID | Scenario | Expected Result |
|---------|----------|-----------------|
| PAIR-01 | Valid code entry | Family link created, code deleted |
| PAIR-02 | Expired code entry | Validation fails in app/rules |
| PAIR-03 | Non-existent code entry | Validation fails |
| PAIR-04 | Parent A uses Parent B's code | Resulting family is isolated to Parent A |

## 4. Remote Commands
| Case ID | Scenario | Expected Result |
|---------|----------|-----------------|
| CMD-01 | Parent writes LOCK_NOW | Success, status PENDING |
| CMD-02 | Child reads own commands | Allowed |
| CMD-03 | Child updates status to EXECUTED | Allowed |
| CMD-04 | Child B updates Child A's command | Permission Denied |

## 5. Telemetry Sync (Location & Activity)
| Case ID | Scenario | Expected Result |
|---------|----------|-----------------|
| SYNC-01 | Child writes location to own path | Allowed |
| SYNC-02 | Child writes location to Child B path | Permission Denied |
| SYNC-03 | Parent reads child history | Allowed |
| SYNC-04 | Unauthorized UID writes to history | Permission Denied |

## 6. SOS Management
| Case ID | Scenario | Expected Result |
|---------|----------|-----------------|
| SOS-01 | Child creates SOS event | Success |
| SOS-02 | Parent resolves SOS event | Allowed |
| SOS-03 | Unrelated User resolves SOS | Permission Denied |
