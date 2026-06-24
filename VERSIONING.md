# Versioning Strategy

KidsGuard follows a structured versioning system to ensure compatibility between the Android App, Web Dashboard, and Cloud Functions.

## Android VersionCode
The `versionCode` is an integer that increments with every internal release or Play Store upload.

- **Range**: 1 - 2,100,000,000
- **Rule**: Never decrement.
- **Example**: `42`

## VersionName (Semantic Versioning)
The `versionName` follows [SemVer 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH[-PRERELEASE]`.

- **MAJOR**: Significant platform changes or breaking API updates.
- **MINOR**: New features or major module additions (e.g., Safe Zones).
- **PATCH**: Bug fixes, production hardening, and small improvements.
- **PRERELEASE**: Appended for beta or release candidates (e.g., `1.0.0-beta`).

### Examples:
- `0.1.0`: Initial prototype.
- `0.5.0`: Feature-complete tracking engine.
- `1.0.0-rc1`: Release candidate for v1.

---

## Release Workflow

1. **Development**: Feature branches merged into `dev`.
2. **QA/Testing**: `dev` merged into `beta`. Build distributed to internal testers.
3. **Release Prep**: `beta` merged into `main`. Documentation (Changelog) updated.
4. **Tagging**: Tag the commit with the version name (e.g., `v1.0.0`).
5. **Deployment**: Trigger Vercel and Play Store deployment.
