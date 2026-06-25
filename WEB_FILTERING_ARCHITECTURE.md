# KidsGuard Web Filtering Architecture

This document details the current and future architecture for Internet & Content Protection in KidsGuard.

## Current Architecture: Accessibility-Based Monitoring (Phase AE)

The current implementation uses the **Android Accessibility Service** to monitor browser activity.

### How it works:
1.  **Event Listening**: The service listens for `TYPE_WINDOW_CONTENT_CHANGED` and `TYPE_WINDOW_STATE_CHANGED` events from supported browsers (Chrome, Samsung Internet, Firefox, Edge, Brave).
2.  **URL Extraction**: The engine recursively scans the accessibility node tree to find UI elements containing URLs (e.g., address bars).
3.  **Domain Checking**: Extracted URLs are parsed for domains and checked against:
    *   Parent-defined Allow List
    *   Parent-defined Block List
    *   Category-based filters (Social, Gaming, etc.)
    *   Adult Content heuristics
4.  **Enforcement**: If a violation is detected, KidsGuard immediately launches the `WebBlockedScreen` in the foreground, effectively covering the restricted content.
5.  **Synchronization**: Every web event (Allowed/Blocked) is synced to Firestore at the domain level for parent review.

### Limitations:
*   **Incognito Mode**: Some browsers hide URL bars in private modes from accessibility services.
*   **Encrypted Traffic**: Accessibility cannot see encrypted content inside the page, only the URL/Domain.
*   **Performance**: Deep tree scanning can impact UI smoothness if not optimized.

---

## Future Architecture: DNS & VPN Filtering (Roadmap)

To provide "unbreakable" protection that works system-wide and in Incognito mode, we will explore:

### 1. Android VPNService (Local Loopback)
*   **Mechanism**: All device traffic is routed through a local VPN tunnel.
*   **Filtering**: The app performs DNS inspection or SNI (Server Name Indication) filtering.
*   **Pros**: Works in all browsers, apps, and Incognito mode. No Accessibility dependency for basic domain blocking.
*   **Cons**: Higher battery impact, potential conflicts with other VPNs (e.g., AdBlockers).

### 2. Private DNS (Android 9+)
*   **Mechanism**: Configure the system to use a secure DNS provider (e.g., Cloudflare for Families, CleanBrowsing).
*   **Enforcement**: Managed via Device Owner (DPC) mode.
*   **Pros**: Zero battery impact, OS-level integration.

### 3. SafeSearch Enforcement
*   **Mechanism**: Appending `&safe=active` or using header injection via local VPN proxy.
*   **Current State**: UI implemented; enforcement relies on URL modification detection via Accessibility.

---

## Technical Compliance
KidsGuard strictly follows Android's **Non-Spyware Policy**:
*   **Transparency**: Browsing monitoring is disclosed during onboarding.
*   **Permission**: Requires explicit user/parent activation of Accessibility.
*   **Minimal Data**: Only domain-level data is collected; full URL parameters and page content are ignored.
