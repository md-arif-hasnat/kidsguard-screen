param (
    [Parameter(Mandatory=$true)]
    [string]$versionName,

    [Parameter(Mandatory=$true)]
    [bool]$mandatoryUpdate,

    [Parameter(Mandatory=$true)]
    [string]$updateMessage
)

$ErrorActionPreference = "Stop"

Write-Host "--- KidsGuard Android Release Automation ---" -ForegroundColor Cyan

# 1. Verify Git Status
Write-Host "[1/5] Verifying Git working tree..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Warning: Your working tree is not clean." -ForegroundColor Red
    Write-Host $gitStatus
    $confirm = Read-Host "Do you want to continue anyway? (y/n)"
    if ($confirm -ne "y") { exit }
}

# 2. Remind user about version codes
Write-Host "[2/5] Verification Checklist" -ForegroundColor Yellow
Write-Host "  - Have you updated 'versionCode' in app/build.gradle.kts? (Must increase)"
Write-Host "  - Have you updated 'versionName' in app/build.gradle.kts? (Current: $versionName)"
$confirmVersion = Read-Host "Confirm versions are updated? (y/n)"
if ($confirmVersion -ne "y") { exit }

# 3. Build Signed APK
Write-Host "[3/5] Building Signed Release APK..." -ForegroundColor Yellow
try {
    .\gradlew.bat :app:assembleRelease
} catch {
    Write-Host "Error: Gradle build failed." -ForegroundColor Red
    exit
}

# 4. Copy APK to releases folder
Write-Host "[4/5] Archiving APK..." -ForegroundColor Yellow
$sourceApk = "app/build/outputs/apk/release/app-release.apk" # Adjusted path based on standard layout
if (-not (Test-Path $sourceApk)) {
    # Try alternative path if first one fails
    $sourceApk = "app/release/app-release.apk"
}

if (Test-Path $sourceApk) {
    $destination = "releases/KidsGuard-v$versionName.apk"
    Copy-Item $sourceApk $destination -Force
    Write-Host "Success: APK copied to $destination" -ForegroundColor Green
} else {
    Write-Host "Error: Could not find built APK at $sourceApk" -ForegroundColor Red
    Write-Host "Please check app/build/outputs/apk/release/ folder manually."
    exit
}

# 5. Print Next Steps
Write-Host "`n[5/5] Build Complete! Final Manual Steps:" -ForegroundColor Cyan
Write-Host "--------------------------------------------------"
Write-Host "1. Create GitHub Release:"
Write-Host "   - Tag: v$versionName"
Write-Host "   - Title: KidsGuard v$versionName"
Write-Host "2. Upload Asset:"
Write-Host "   - File: releases/KidsGuard-v$versionName.apk"
Write-Host "3. Copy APK Download URL from GitHub."
Write-Host "4. Update Firestore 'appConfig/update':"
Write-Host "   - latestVersionCode: (The code you set in build.gradle)"
Write-Host "   - latestVersionName: `"$versionName`""
Write-Host "   - apkDownloadUrl: `"(The GitHub URL)`""
Write-Host "   - mandatoryUpdate: $($mandatoryUpdate.ToString().ToLower())"
Write-Host "   - updateMessage: `"$updateMessage`""
Write-Host "   - releaseNotes: (Update manually in Firebase Console)"
Write-Host "--------------------------------------------------"
Write-Host "Done!" -ForegroundColor Green
