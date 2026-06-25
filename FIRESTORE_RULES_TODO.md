# Firestore Rules Implementation Draft (Phase AH)

This document contains the production-ready Firestore rules to support role-based family management.

## New Helper Functions

```javascript
    function getFamilyData(familyId) {
      return get(/databases/$(database)/documents/families/$(familyId)).data;
    }

    function getUserMember(familyId) {
      return getFamilyData(familyId).members.filter(m => m.uid == request.auth.uid)[0];
    }

    function getUserRole(familyId) {
      return getUserMember(familyId).role;
    }

    function isOwner(familyId) {
      return getUserRole(familyId) == 'OWNER';
    }

    function isParentOrAbove(familyId) {
      let role = getUserRole(familyId);
      return role == 'OWNER' || role == 'PARENT';
    }

    function isGuardianOrAbove(familyId) {
      let role = getUserRole(familyId);
      return role == 'OWNER' || role == 'PARENT' || role == 'GUARDIAN';
    }
```

## Updated Collection Rules

### 1. Families
```javascript
    match /families/{familyId} {
      allow read: if isFamilyMember(familyId);
      allow create: if isSignedIn();
      // Only Owner can add/remove members or change roles
      allow update: if isOwner(familyId);
    }
```

### 2. Family Invitations
```javascript
    match /familyInvitations/{inviteId} {
      allow read: if isSignedIn(); // For acceptance page
      allow create: if isParentOrAbove(request.resource.data.familyId);
      allow update: if isOwner(get(/databases/$(database)/documents/familyInvitations/$(inviteId)).data.familyId) || (isSignedIn() && request.resource.data.status == 'ACCEPTED');
    }
```

### 3. Children Safety Settings
```javascript
    match /children/{childId} {
      match /safeZones/{zoneId} {
        allow read: if isGuardianOrAbove(getParentFamilyId());
        allow write: if isParentOrAbove(getParentFamilyId());
      }
      
      match /webRules/current {
        allow read: if isGuardianOrAbove(getParentFamilyId());
        allow write: if isParentOrAbove(getParentFamilyId());
      }

      match /remoteCommands/{docId} {
        allow read: if isSignedIn();
        allow create: if isParentOrAbove(getParentFamilyId());
        allow update: if isSignedIn();
      }
    }
```

## Implementation Notes
1. **Recursion Limit**: Be careful with `get()` calls in rules (limit is 10).
2. **Atomic Updates**: Some operations (like accepting an invite) involve multi-document writes which should ideally be handled via **Cloud Functions** to ensure atomicity.
3. **Data Redundancy**: We store `members` list inside `families/{id}` to allow role checks with a single `get()` call.
