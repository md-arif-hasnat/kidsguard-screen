# Play Store Preparation Guide

## 1. App Store Listing
- [ ] **Title**: KidsGuard - Family Safety & Child Protection
- [ ] **Short Description**: Real-time tracking, app blocking, and web protection for your family.
- [ ] **Icons**: 512x512 High Res (PNG)
- [ ] **Screenshots**: Phone and 10-inch Tablet (at least 4 each)
- [ ] **Privacy URL**: Link to published PRIVACY_POLICY.md

## 2. Policy Compliance (Crucial)
- [ ] **Location**: Background location requires a disclosure video and a prominent in-app notification.
- [ ] **Accessibility Service**: Must explicitly state that it is used for App Blocking and URL filtering.
- [ ] **Kids Category**: Ensure compliance with Google's Families Policy.

## 3. Technical Requirements
- [ ] Generate signed Release APK/AAB.
- [ ] Perform `lintRelease` to check for missing translations or performance bottlenecks.
- [ ] Verify that non-debug logs are disabled.

## 4. Feature Review
- [ ] Test the "Unpair" functionality to ensure device can be cleaned from family.
- [ ] Verify that PIN protection on child Settings cannot be bypassed easily.
