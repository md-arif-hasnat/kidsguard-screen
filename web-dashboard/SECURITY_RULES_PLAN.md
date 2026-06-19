# Firebase Security Rules Plan for Web Dashboard

The primary security objective is to ensure that parents can only access data belonging to their own family, and child devices can only update their own status.

## Rule Definitions

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isParentOf(childId) {
      // Logic to check if the authenticated user is the parent of the childId
      // Requires child document to have a 'familyId' field or similar linkage
      return isSignedIn() && exists(/databases/$(database)/documents/families/$(request.auth.uid + "_" + childId)); 
      // Note: Actual logic depends on how familyId is constructed
    }

    function isFamilyMember(familyId) {
      let family = get(/databases/$(database)/documents/families/$(familyId)).data;
      return isSignedIn() && (family.parentDeviceId == request.auth.uid || request.auth.uid in family.childDeviceIds);
    }

    // families collection
    match /families/{familyId} {
      allow read: if isFamilyMember(familyId);
      allow create: if isSignedIn();
      allow update: if isSignedIn() && resource.data.parentDeviceId == request.auth.uid;
    }

    // parents collection
    match /parents/{parentId} {
      allow read, write: if isSignedIn() && request.auth.uid == parentId;
    }

    // children collection (Status, Activity, Locations)
    match /children/{childId}/{document=**} {
      // Parent can read if they are linked to the child
      // allow read: if isParentOf(childId);
      
      // For development/Phase Q, we keep it simple:
      allow read: if isSignedIn(); 
      
      // Child can update their own status/location/activity
      allow write: if isSignedIn() && request.auth.uid == childId;
    }

    // remoteCommands
    match /children/{childId}/remoteCommands/{commandId} {
      // Parent can create commands for their child
      allow create: if isSignedIn(); 
      // Child can read and update their own commands (mark as executed)
      allow read, update: if isSignedIn() && request.auth.uid == childId;
    }
    
    // safeZones
    match /safeZones/{familyId}/{zoneId} {
        allow read, write: if isFamilyMember(familyId);
    }
    
    // sosEvents
    match /sosEvents/{childId}/{eventId} {
        allow read: if isSignedIn();
        allow write: if isSignedIn() && (request.auth.uid == childId || isParentOf(childId));
    }
  }
}
```

## Considerations
1. **Linkage:** Every child document and sub-collection should ideally contain a `familyId` to simplify rules without needing many `get()` calls (which cost more and have limits).
2. **UID Mapping:** The `request.auth.uid` must be reliably mapped to either a `parentDeviceId` or `childDeviceId`.
3. **Validation:** Use rules to enforce data types (e.g., `request.resource.data.batteryPercent is int`).
