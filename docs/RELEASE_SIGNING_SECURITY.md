# Android release signing security

KidsGuard release builds must use the original production signing key so that
Android can install updates over existing versions. Never create a replacement
key merely to build a new APK.

## Storage rules

- Keep the production keystore in at least two encrypted, access-controlled,
  offline backups.
- Never commit `.jks`, `.keystore`, `key.properties`, or signing passwords.
- Store CI signing material only in GitHub Actions secrets:
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`.
- Keep the keystore and its passwords in separate protected locations.
- Limit repository administration and Actions-secret access to trusted owners.

## Release verification

Before publishing an APK, compare its signing-certificate SHA-256 digest with a
previous trusted production APK:

```powershell
$apksigner = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Recurse -Filter apksigner.bat |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

& $apksigner verify --print-certs ".\app\build\outputs\apk\release\app-release.apk"
```

An unexpected certificate digest means the APK must not be published.

## Exposure response

If a keystore password may have been exposed, rotate all related passwords and
GitHub secrets immediately. Removing a keystore from the current branch does
not remove it from Git history; history removal requires a separately planned
repository rewrite and every clone must then be replaced or re-synchronized.
