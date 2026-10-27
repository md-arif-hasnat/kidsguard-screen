# KidsGuard Google Play release checklist

This checklist is for the Play-distributed Android package
`secure.kidsguard.app`. Complete every declaration truthfully before moving
an AAB beyond Internal testing.

## Release build safeguards

- Use the `release` AAB. Its merged manifest removes
  `REQUEST_INSTALL_PACKAGES`; updates open the Google Play listing.
- `QUERY_ALL_PACKAGES` remains because installed-app discovery and management
  are core parental-control features. Submit the Package Visibility
  declaration and explain why a finite package list cannot cover apps a child
  may install later.
- The manifest declares `isMonitoringTool=child_monitoring`.
- The app shows a persistent, identifiable KidsGuard notification while child
  protection runs.
- The setup wizard obtains separate affirmative consent before background
  location, Accessibility Service, notification access, and installed-app
  inventory collection. Collection is blocked until the relevant disclosure
  is accepted.

## Exact Play Console declarations

### App category and audience

- Category: Parenting
- Purpose: Parents or legal guardians manage their own child's Android device.
- Do not market KidsGuard for spouse, employee, adult, secret, or stealth
  monitoring.
- Select the truthful target-age range. If children are included, complete the
  Families policy questions and ensure every SDK/data practice is compatible.

### Accessibility Service

Suggested explanation:

> KidsGuard uses Accessibility Service only on a child device configured by a
> parent or legal guardian. It identifies the foreground app and relevant
> browser or YouTube screen content to enforce parent-selected app, website and
> screen-time restrictions and to detect attempts to disable protection. The
> app shows a separate in-app disclosure and requires affirmative consent
> before opening Android Accessibility settings. Monitoring data is shared
> only with the linked family account and is not used for advertising or sold.

Record the required declaration video showing: app launch, the complete
Accessibility disclosure, both Agree and Not now paths, Android permission
activation, and one parent-selected block being enforced.

### Background location

Declare one core feature: child safety safe-zone alerts.

Suggested explanation:

> KidsGuard uses precise location in the background, including when the app is
> closed or not in use, to notify the linked parent when their child enters or
> leaves a parent-defined safe zone. The same data supports live location and
> route history. A prominent in-app disclosure is displayed immediately before
> Android location settings. Location is not used for advertising or sold.

The declaration video must show the disclosure, the permission flow, the
persistent monitoring notification, and a safe-zone or live-location result.

### Package visibility

Suggested explanation:

> Installed-app discovery is a core parental-control feature. KidsGuard must
> discover launchable apps already installed and apps installed later so the
> linked parent can apply app-specific access and screen-time rules and receive
> new-install alerts. A finite package allowlist cannot provide this feature
> because the child may install any Play app. The app obtains affirmative
> in-app consent before the first scan. Inventory data is shared only with the
> linked family account and is not sold or used for advertising.

### Monitoring application

- Declare the app as child monitoring.
- Store listing and screenshots must visibly describe location, app, browser,
  YouTube and screen-time monitoring.
- Never use claims such as hidden, secret, stealth, invisible, spy, or “no data
  collection.”

## Data safety and privacy policy

Disclose the actual data used by enabled features, including:

- account and family identifiers;
- precise and background location;
- installed apps and app usage;
- browser and YouTube activity;
- device status, diagnostics and notification-derived media details;
- billing and subscription status.

For each type, state whether it is collected, shared with the linked parent,
encrypted in transit, deletable, required or optional, and its purpose. The
Play Data safety form, in-app disclosures, privacy policy, and product behavior
must agree exactly.

## Internal testing acceptance test

1. Upload the signed release AAB with a new version code.
2. Install only from the Internal testing link using a license-test account.
3. Complete child pairing and test every disclosure's Not now and Agree paths.
4. Confirm no location, Accessibility-derived activity, notifications, or app
   inventory is uploaded before its disclosure is accepted.
5. Confirm the ongoing KidsGuard monitoring notification cannot be mistaken
   for a hidden service.
6. Purchase monthly and annual test subscriptions, restore after reinstall,
   cancel, renew, enter grace period, and verify expiry through RTDN.
7. Confirm the release build opens Google Play for updates and never requests
   permission to install unknown apps.
