# Data Retention Enforcement

KidsGuard runs `cleanupFamilyRetentionData` daily at 04:30 Europe/Berlin.
It reads `families/{familyId}.settings.dataRetentionDays` and applies the
Family Owner's dashboard selection.

- `0`, missing, invalid, or out-of-range values do not delete anything.
- Positive whole-day values from 1 through 3650 are enforced.
- Cleanup is bounded per run so a large backlog cannot monopolize the worker.
- The canonical `children/{childId}/locations/latest` document is preserved.
- Child/family profiles, current status, settings, controls, safe zones,
  installed apps, and audit logs are not retention targets.
- A `RETENTION_CLEANUP_COMPLETED` audit event is written only when records
  were actually removed.

## Retention targets

| Path | Retention field |
|---|---|
| `children/{childId}/locations` | numeric `timestamp` |
| `children/{childId}/activities` | numeric `timestamp` |
| `children/{childId}/sosEvents` | numeric `timestamp` |
| `children/{childId}/routeDeviations` | numeric `timestamp` |
| `children/{childId}/appRestrictionEvents` | Timestamp `occurredAt` |
| `children/{childId}/errorReports` | numeric `capturedAt` |
| `children/{childId}/appUsage/{YYYY-MM-DD}` | document date |
| `children/{childId}/webActivity/{YYYY-MM-DD}` | document date |
| `families/{familyId}/children/{childId}/youtubeHistory` | numeric `capturedAt` |
| `families/{familyId}/children/{childId}/browserHistory` | numeric `capturedAt` |

This is technical enforcement, not a substitute for the final legal retention
schedule. Legal review must confirm which choices are offered before launch.
