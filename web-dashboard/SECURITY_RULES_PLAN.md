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

    // A user is a parent if their UID matches a parentDeviceId in any family doc
    // (Note: In production, we'd use a more optimized way or custom claims)
    function isParentOfChild(childId) {
      // Find a family where this user is parent and target is child
      // This is a placeholder for the logic implemented in firestore.rules.draft
      return isSignedIn(); 
    }

    // parents collection
    match /parents/{parentId} {
      allow read, write: if isSignedIn() && request.auth.uid == parentId;
    }

    // children collection (Status, Activity, Locations)
    match /children/{childId}/{document=**} {
      // PARENT ACCESS: Read-only access to child monitoring data
      allow read: if isParentOfChild(childId);
      
      // CHILD ACCESS: Write-only access to its own telemetry
      allow write: if request.auth != null && request.auth.uid == childId;
      
      // Prevent child from reading other children or its own command history (if restricted)
    }

    // remoteCommands
    match /children/{childId}/remoteCommands/{commandId} {
      // Parent can CREATE commands for their child
      allow create: if isParentOfChild(childId); 
      // Child can READ its commands and UPDATE status (mark as executed)
      allow read, update: if request.auth != null && request.auth.uid == childId;
    }
    
    // pairingCodes
    match /pairingCodes/{code} {
        // Child creates the code
        allow create: if request.auth != null; 
        // Parent reads it to pair
        allow read: if isSignedIn();
        // Clean up after use
        allow delete: if isSignedIn();
    }
  }
}
```

## Cloud Functions Integration (Future)
To increase security, we will migrate the following logic to Cloud Functions:
1. **Pairing Process:** Instead of the parent app writing to the `families` collection directly, it will call a `pairChild(code)` function. This function will validate the code, check expiration, and create the family link atomically on the server.
2. **Command Validation:** Validate that command payloads are safe before they are written to Firestore.
3. **Data Cleanup:** Automatically delete expired pairing codes and old location history points (e.g., points older than 30 days).

## Security Layers
1. **Firestore Rules:** Enforce fundamental data isolation.
2. **App Check:** Prevent unauthorized web scrapers or scripts from calling the Firebase backend.
3. **Audit Trails:** Log all parent dashboard logins and command executions for user safety.
