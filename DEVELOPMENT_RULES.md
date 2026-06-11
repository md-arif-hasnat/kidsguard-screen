# KidsGuard Development Rules

## Core Rule

Never break existing working features.

## Stable Lock Engine

The following features are stable and must not be rewritten unless explicitly requested:

* Fake dead battery screen
* PIN unlock
* Custom PIN
* Secret 5-tap unlock
* Volume Up unlock
* Parent settings
* Scheduled Kid Mode
* Immersive full screen
* Hide status bar
* Hide navigation bar
* Back button protection
* Home button protection
* Auto re-lock

## AI Coding Rules

When using Android Studio Agent, Gemini, Cursor, Claude, Windsurf, or any other AI tool:

* Never rewrite working code.
* Never remove existing features.
* Never redesign the stable lock engine.
* Never modify Gradle files unless absolutely required.
* Never add spyware-like features.
* Always preserve backward compatibility.
* Always keep the build passing.
* Always use modular architecture.
* Always add new features as separate modules/screens when possible.
* Always explain what files were changed.
* Always avoid large uncontrolled rewrites.

## Git Rules

Before every new phase:

git add .
git commit -m "Before Phase X"

After every successful phase:

git add .
git commit -m "Phase X completed"

If AI breaks the project:
Use Git to return to the last stable commit.

## Phase Rules

One phase = one major feature.

Good:

* Add Safe Zone UI
* Add Activity Feed UI
* Add Parent Dashboard UI
* Add Firebase pairing

Bad:

* Add dashboard, maps, Firebase, notifications, SOS, and AI summary all at once

## Privacy and Safety Rules

Never implement:

* Secret camera
* Secret microphone
* Message reading
* Keylogger
* Password collection
* Hidden tracking
* Spyware behavior

Allowed family safety features:

* Location sharing with permission
* Safe zones
* Parent notifications
* SOS
* Battery alerts
* Remote lock where supported
* Activity feed
* Daily safety summary

## Build Requirement

Every completed phase must build with zero errors.

If errors happen:

1. Fix build first.
2. Do not add new features.
3. Do not continue until the build is stable.

## Project Direction

KidsGuard is a family safety platform.

It should focus on:

* Child safety
* Parent awareness
* Location safety
* Safe zones
* Emergency alerts
* Device protection
* Privacy-respecting parental control

Do not turn KidsGuard into a spying app.
