import test, {
  after,
  before
} from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";

import {
  readFileSync
} from "node:fs";

const PROJECT_ID = "kidsguard-rules-test";

let testEnv;

before(async () => {
  const rules = readFileSync(
    new URL(
      "../../firestore.rules.production",
      import.meta.url
    ),
    "utf8"
  );

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules
    }
  });

  await testEnv.withSecurityRulesDisabled(
    async context => {
      const adminDb = context.firestore();

      await setDoc(
        doc(adminDb, "parents", "owner-uid"),
        {
          uid: "owner-uid",
          email: "owner@example.com",
          role: "OWNER",
          familyId: "family-1"
        }
      );

      await setDoc(
        doc(adminDb, "parents", "viewer-uid"),
        {
          uid: "viewer-uid",
          email: "viewer@example.com",
          role: "VIEWER",
          familyId: "family-1"
        }
      );

      await setDoc(
        doc(adminDb, "parents", "manager-uid"),
        {
          uid: "manager-uid",
          email: "manager@example.com",
          role: "MANAGER",
          familyId: "family-1"
        }
      );

      await setDoc(
        doc(adminDb, "platformAdmins", "admin-uid"),
        {
          uid: "admin-uid",
          email: "admin@example.com",
          role: "PLATFORM_ADMIN",
          active: true
        }
      );

      await setDoc(
        doc(adminDb, "platformAdmins", "inactive-admin-uid"),
        {
          uid: "inactive-admin-uid",
          email: "inactive@example.com",
          role: "PLATFORM_ADMIN",
          active: false
        }
      );

      await setDoc(
        doc(adminDb, "platformAdmins", "legacy-admin-uid"),
        {
          uid: "legacy-admin-uid",
          email: "legacy@example.com",
          role: "ADMIN",
          active: true
        }
      );

      await setDoc(
        doc(adminDb, "families", "family-1"),
        {
          ownerId: "owner-uid",
          memberUids: [
            "owner-uid",
            "manager-uid",
            "viewer-uid"
          ],
          managerUids: [
            "owner-uid",
            "manager-uid"
          ],
          childDeviceIds: [
            "child-1"
          ],
          members: [],
          subscription: {
            baseChildSlots: 2,
            extraChildSlots: 0,
            status: "PENDING"
          }
        }
      );

      await setDoc(
        doc(adminDb, "children", "child-1"),
        {
          childId: "child-1",
          familyId: "family-1",
          firebaseUid: "child-auth-uid"
        }
      );

      await setDoc(
        doc(adminDb, "parents", "family-2-owner"),
        {
          uid: "family-2-owner",
          email: "family2@example.com",
          role: "OWNER",
          familyId: "family-2"
        }
      );

      await setDoc(
        doc(adminDb, "families", "family-2"),
        {
          ownerId: "family-2-owner",
          memberUids: ["family-2-owner"],
          managerUids: ["family-2-owner"],
          childDeviceIds: ["child-2"],
          members: [],
          subscription: {
            baseChildSlots: 2,
            extraChildSlots: 0,
            status: "PENDING"
          }
        }
      );

      await setDoc(
        doc(adminDb, "children", "child-2"),
        {
          childId: "child-2",
          familyId: "family-2",
          firebaseUid: "child-2-auth"
        }
      );

      await setDoc(
        doc(adminDb, "devices", "foreign-device"),
        {
          deviceId: "foreign-device",
          firebaseUid: "family-2-owner"
        }
      );

      const isolatedChildPaths = [
        ["status", "current"],
        ["safeZones", "zone-1"],
        ["locations", "latest"],
        ["activities", "activity-1"],
        ["sosEvents", "sos-1"],
        ["dailySummaries", "2026-09-28"],
        ["routeDeviations", "deviation-1"],
        ["remoteCommands", "command-1"],
        ["installedApps", "app-1"],
        ["youtubeHistory", "video-1"],
        ["appControls", "control-1"],
        ["appRestrictionEvents", "restriction-1"],
        ["errorReports", "error-1"],
        ["settings", "main"],
        ["permissionChangeRequests", "permission-1"],
        ["webRules", "rule-1"],
        ["protectionModes", "mode-1"],
        ["accessRequests", "access-1"],
        ["appAccessRequests", "app-access-1"],
        ["analytics", "summary"]
      ];

      for (const [collectionName, documentId] of isolatedChildPaths) {
        await setDoc(
          doc(
            adminDb,
            "children",
            "child-2",
            collectionName,
            documentId
          ),
          {
            childId: "child-2",
            familyId: "family-2",
            seeded: true
          }
        );
      }

      await setDoc(
        doc(
          adminDb,
          "children",
          "child-2",
          "appUsage",
          "2026-09-28",
          "apps",
          "app-1"
        ),
        { childId: "child-2", packageName: "example.app" }
      );

      await setDoc(
        doc(
          adminDb,
          "children",
          "child-2",
          "webActivity",
          "2026-09-28",
          "events",
          "event-1"
        ),
        { childId: "child-2", url: "https://example.com" }
      );

      await setDoc(
        doc(
          adminDb,
          "families",
          "family-2",
          "children",
          "child-2",
          "youtubeHistory",
          "video-1"
        ),
        { childId: "child-2", videoTitle: "Private video" }
      );

      await setDoc(
        doc(
          adminDb,
          "families",
          "family-2",
          "children",
          "child-2",
          "browserHistory",
          "page-1"
        ),
        { childId: "child-2", title: "Private page" }
      );
      await setDoc(
        doc(
          adminDb,
          "children",
          "child-1",
          "appControls",
          "com_example_game"
        ),
        {
          childId: "child-1",
          packageName: "com.example.game",
          appName: "Example Game",
          blocked: true,
          dailyLimitMinutes: 30,
          revision: 1,
          applyStatus: "PENDING",
          updatedBy: "owner-uid"
        }
      );
    await setDoc(
      doc(
        adminDb,
        "notifications",
        "notification-1"
      ),
      {
        userId: "owner-uid",
        title: "Test alert",
        body: "Test notification",
        read: false,
        createdAt: new Date()
      }
    );
    });
    }
  );


after(async () => {
  await testEnv.cleanup();
});

test(
  "support parent can append only an authentic parent reply",
  async () => {
    const ticketId = "SUPPORT01";

    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(
        doc(context.firestore(), "supportTickets", ticketId),
        {
          ticketId,
          familyId: "family-1",
          parentUid: "owner-uid",
          parentEmail: "owner@example.com",
          subject: "Help",
          message: "Initial message",
          category: "GENERAL",
          status: "OPEN",
          replies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
    });

    const ownerDb = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      updateDoc(
        doc(ownerDb, "supportTickets", ticketId),
        {
          replies: [{
            replyId: "reply-0001",
            authorUid: "owner-uid",
            authorEmail: "owner@example.com",
            authorRole: "PARENT",
            message: "Parent follow-up",
            createdAt: new Date()
          }],
          status: "OPEN",
          updatedAt: serverTimestamp()
        }
      )
    );
  }
);

test(
  "support parent cannot impersonate admin or close ticket",
  async () => {
    const ticketId = "SUPPORT02";

    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(
        doc(context.firestore(), "supportTickets", ticketId),
        {
          ticketId,
          familyId: "family-1",
          parentUid: "owner-uid",
          parentEmail: "owner@example.com",
          subject: "Help",
          message: "Initial message",
          category: "GENERAL",
          status: "OPEN",
          replies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
    });

    const ownerDb = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );
    const ticketRef = doc(
      ownerDb,
      "supportTickets",
      ticketId
    );

    await assertFails(updateDoc(ticketRef, {
      replies: [{
        replyId: "reply-0002",
        authorUid: "owner-uid",
        authorEmail: "owner@example.com",
        authorRole: "ADMIN",
        message: "Forged admin reply",
        createdAt: new Date()
      }],
      status: "OPEN",
      updatedAt: serverTimestamp()
    }));

    await assertFails(updateDoc(ticketRef, {
      status: "CLOSED",
      updatedAt: serverTimestamp()
    }));
  }
);

test(
  "platform admin can read and manage support tickets",
  async () => {
    const ticketId = "SUPPORT03";

    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(
        doc(context.firestore(), "supportTickets", ticketId),
        {
          ticketId,
          parentUid: "owner-uid",
          status: "OPEN",
          replies: []
        }
      );
    });

    const adminDb = verifiedDb(
      "admin-uid",
      "admin@example.com"
    );
    const ticketRef = doc(
      adminDb,
      "supportTickets",
      ticketId
    );

    await assertSucceeds(getDoc(ticketRef));
    await assertSucceeds(updateDoc(ticketRef, {
      status: "RESOLVED"
    }));
  }
);

function verifiedDb(uid, email) {
  return testEnv
    .authenticatedContext(uid, {
      email,
      email_verified: true
    })
    .firestore();
}

test(
  "active platform admin can read internal analytics collections",
  async () => {
    const adminDb = verifiedDb(
      "admin-uid",
      "admin@example.com"
    );

    await assertSucceeds(getDocs(collection(adminDb, "parents")));
    await assertSucceeds(getDocs(collection(adminDb, "families")));
    await assertSucceeds(getDocs(collection(adminDb, "children")));
    await assertSucceeds(getDocs(collection(adminDb, "auditLogs")));
    await assertSucceeds(
      getDocs(collectionGroup(adminDb, "errorReports"))
    );
    await assertSucceeds(
      getDoc(
        doc(adminDb, "children", "child-1", "status", "current")
      )
    );
  }
);

test(
  "inactive or unapproved admin roles cannot read internal data",
  async () => {
    const inactiveDb = verifiedDb(
      "inactive-admin-uid",
      "inactive@example.com"
    );
    const legacyDb = verifiedDb(
      "legacy-admin-uid",
      "legacy@example.com"
    );

    await assertFails(getDocs(collection(inactiveDb, "parents")));
    await assertFails(getDocs(collection(legacyDb, "parents")));
  }
);

test(
  "family cannot read another family's child data matrix",
  async () => {
    const ownerDb = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    const foreignPaths = [
      ["children", "child-2"],
      ["children", "child-2", "status", "current"],
      ["children", "child-2", "safeZones", "zone-1"],
      ["children", "child-2", "locations", "latest"],
      ["children", "child-2", "activities", "activity-1"],
      ["children", "child-2", "sosEvents", "sos-1"],
      ["children", "child-2", "dailySummaries", "2026-09-28"],
      ["children", "child-2", "routeDeviations", "deviation-1"],
      ["children", "child-2", "remoteCommands", "command-1"],
      ["children", "child-2", "installedApps", "app-1"],
      ["children", "child-2", "appUsage", "2026-09-28", "apps", "app-1"],
      ["children", "child-2", "youtubeHistory", "video-1"],
      ["children", "child-2", "webActivity", "2026-09-28", "events", "event-1"],
      ["children", "child-2", "appControls", "control-1"],
      ["children", "child-2", "appRestrictionEvents", "restriction-1"],
      ["children", "child-2", "errorReports", "error-1"],
      ["children", "child-2", "settings", "main"],
      ["children", "child-2", "permissionChangeRequests", "permission-1"],
      ["children", "child-2", "webRules", "rule-1"],
      ["children", "child-2", "protectionModes", "mode-1"],
      ["children", "child-2", "accessRequests", "access-1"],
      ["children", "child-2", "appAccessRequests", "app-access-1"],
      ["children", "child-2", "analytics", "summary"],
      ["families", "family-2", "children", "child-2", "youtubeHistory", "video-1"],
      ["families", "family-2", "children", "child-2", "browserHistory", "page-1"]
    ];

    for (const path of foreignPaths) {
      await assertFails(getDoc(doc(ownerDb, ...path)));
    }
  }
);

test(
  "child can create sanitized error report and outsider cannot",
  async () => {
    const childDb = verifiedDb(
      "child-auth-uid",
      "child@example.com"
    );
    const outsiderDb = verifiedDb(
      "family-2-owner",
      "family2@example.com"
    );
    const report = {
      errorId: "error-report-1",
      familyId: "family-1",
      childId: "child-1",
      deviceId: "device-1",
      tag: "YT_SYNC",
      message: "Upload failed",
      fingerprint: "abc123",
      capturedAt: Date.now(),
      status: "OPEN"
    };

    await assertSucceeds(
      setDoc(
        doc(
          childDb,
          "children",
          "child-1",
          "errorReports",
          "error-report-1"
        ),
        report
      )
    );

    await assertFails(
      setDoc(
        doc(
          outsiderDb,
          "children",
          "child-1",
          "errorReports",
          "foreign-error"
        ),
        { ...report, errorId: "foreign-error" }
      )
    );
  }
);

test(
  "foreign device owner cannot write another child's status",
  async () => {
    const foreignDb = verifiedDb(
      "family-2-owner",
      "family2@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          foreignDb,
          "children",
          "child-1",
          "status",
          "foreign-write"
        ),
        {
          childId: "child-1",
          deviceId: "foreign-device",
          online: true
        }
      )
    );
  }
);

test(
  "verified owner can read own family",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      getDoc(
        doc(db, "families", "family-1")
      )
    );
  }
);

test(
  "outsider cannot read another family",
  async () => {
    const db = verifiedDb(
      "outsider-uid",
      "outsider@example.com"
    );

    await assertFails(
      getDoc(
        doc(db, "families", "family-1")
      )
    );
  }
);

test(
  "viewer can read family",
  async () => {
    const db = verifiedDb(
      "viewer-uid",
      "viewer@example.com"
    );

    await assertSucceeds(
      getDoc(
        doc(db, "families", "family-1")
      )
    );
  }
);

test(
  "viewer cannot create remote command",
  async () => {
    const db = verifiedDb(
      "viewer-uid",
      "viewer@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "remoteCommands",
          "viewer-command"
        ),
        {
          type: "LOCK",
          status: "PENDING"
        }
      )
    );
  }
);

test(
  "owner can create remote command",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "remoteCommands",
          "owner-command"
        ),
        {
          type: "LOCK",
          status: "PENDING"
        }
      )
    );
  }
);

test(
  "manager can create remote command",
  async () => {
    const db = verifiedDb(
      "manager-uid",
      "manager@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "remoteCommands",
          "manager-command"
        ),
        {
          type: "LOCK",
          status: "PENDING"
        }
      )
    );
  }
);

test(
  "owner can invite a manager but manager cannot invite members",
  async () => {
    const ownerDb = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );
    const managerDb = verifiedDb(
      "manager-uid",
      "manager@example.com"
    );
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await assertSucceeds(setDoc(
      doc(ownerDb, "familyInvitations", "owner-manager-invite"),
      {
        familyId: "family-1",
        invitedBy: "owner-uid",
        status: "PENDING",
        email: "new-manager@example.com",
        expiresAt: expiry,
        role: "MANAGER"
      }
    ));

    await assertFails(setDoc(
      doc(managerDb, "familyInvitations", "manager-viewer-invite"),
      {
        familyId: "family-1",
        invitedBy: "manager-uid",
        status: "PENDING",
        email: "new-viewer@example.com",
        expiresAt: expiry,
        role: "VIEWER"
      }
    ));
  }
);

test(
  "unverified user cannot create parent profile",
  async () => {
    const db = testEnv
      .authenticatedContext(
        "unverified-uid",
        {
          email: "unverified@example.com",
          email_verified: false
        }
      )
      .firestore();

    await assertFails(
      setDoc(
        doc(
          db,
          "parents",
          "unverified-uid"
        ),
        {
          uid: "unverified-uid",
          email: "unverified@example.com",
          role: "PARENT"
        }
      )
    );
  }
);
test(
  "verified parent can create valid empty family",
  async () => {
    const db = verifiedDb(
      "new-parent-uid",
      "newparent@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(db, "families", "family-valid"),
        {
          ownerId: "new-parent-uid",
          memberUids: [
            "new-parent-uid"
          ],
          managerUids: [
            "new-parent-uid"
          ],
          childDeviceIds: [],
          members: [],
          subscription: {
            baseChildSlots: 2,
            extraChildSlots: 0,
            status: "PENDING"
          }
        }
      )
    );
  }
);

test(
  "parent cannot create family with extra slots",
  async () => {
    const db = verifiedDb(
      "new-parent-uid-2",
      "newparent2@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "families",
          "family-invalid-slots"
        ),
        {
          ownerId: "new-parent-uid-2",
          memberUids: [
            "new-parent-uid-2"
          ],
          managerUids: [
            "new-parent-uid-2"
          ],
          childDeviceIds: [],
          members: [],
          subscription: {
            baseChildSlots: 2,
            extraChildSlots: 10,
            status: "PENDING"
          }
        }
      )
    );
  }
);

test(
  "child identity can create own location",
  async () => {
    const db = verifiedDb(
      "child-auth-uid",
      "child@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "locations",
          "location-1"
        ),
        {
          latitude: 51.0,
          longitude: 6.0,
          createdAt: new Date()
        }
      )
    );
  }
);

test(
  "outsider cannot create child location",
  async () => {
    const db = verifiedDb(
      "outsider-uid",
      "outsider@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "locations",
          "fake-location"
        ),
        {
          latitude: 51.0,
          longitude: 6.0,
          createdAt: new Date()
        }
      )
    );
  }
);

test(
  "owner can create app control",
  async () => {
    const db = verifiedDb("owner-uid", "owner@example.com");

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "appControls",
          "com_example_video"
        ),
        {
          childId: "child-1",
          packageName: "com.example.video",
          appName: "Example Video",
          blocked: false,
          dailyLimitMinutes: 20,
          applyStatus: "PENDING",
          updatedBy: "owner-uid"
        }
      )
    );
  }
);

test(
  "child can acknowledge app control without changing policy",
  async () => {
    const db = verifiedDb("child-auth-uid", "child@example.com");

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "appControls",
          "com_example_game"
        ),
        {
          applyStatus: "APPLIED",
          appliedByDeviceId: "device-1",
          appliedVersion: "1.0.40",
          applyMessage: "Rule cached and active on child device"
        },
        { merge: true }
      )
    );
  }
);

test(
  "child cannot change parent app control policy",
  async () => {
    const db = verifiedDb("child-auth-uid", "child@example.com");

    await assertFails(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "appControls",
          "com_example_game"
        ),
        { blocked: false },
        { merge: true }
      )
    );
  }
);

test(
  "child can create own app restriction event",
  async () => {
    const db = verifiedDb("child-auth-uid", "child@example.com");

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "appRestrictionEvents",
          "2026-09-25_com_example_game_STATIC_BLOCK"
        ),
        {
          childId: "child-1",
          packageName: "com.example.game",
          reason: "STATIC_BLOCK",
          notifyParent: true
        }
      )
    );
  }
);

test(
  "outsider cannot create app restriction event",
  async () => {
    const db = verifiedDb("outsider-uid", "outsider@example.com");

    await assertFails(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "appRestrictionEvents",
          "fake-event"
        ),
        {
          childId: "child-1",
          packageName: "com.example.game",
          reason: "STATIC_BLOCK",
          notifyParent: true
        }
      )
    );
  }
);

test(
  "user can read own notification",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      getDoc(
        doc(
          db,
          "notifications",
          "notification-1"
        )
      )
    );
  }
);

test(
  "outsider cannot read another notification",
  async () => {
    const db = verifiedDb(
      "outsider-uid",
      "outsider@example.com"
    );

    await assertFails(
      getDoc(
        doc(
          db,
          "notifications",
          "notification-1"
        )
      )
    );
  }
);

test(
  "user can mark own notification as read",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "notifications",
          "notification-1"
        ),
        {
          read: true
        },
        {
          merge: true
        }
      )
    );
  }
);

test(
  "user cannot change notification content",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "notifications",
          "notification-1"
        ),
        {
          title: "Changed title"
        },
        {
          merge: true
        }
      )
    );
  }
);

test(
  "parent cannot register as ADMIN",
  async () => {
    const db = verifiedDb(
      "fake-admin-uid",
      "fakeadmin@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "parents",
          "fake-admin-uid"
        ),
        {
          uid: "fake-admin-uid",
          email: "fakeadmin@example.com",
          role: "ADMIN"
        }
      )
    );
  }
);

test(
  "parent cannot change own role to ADMIN",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "parents",
          "owner-uid"
        ),
        {
          role: "ADMIN"
        },
        {
          merge: true
        }
      )
    );
  }
);

test(
  "owner cannot increase own extra child slots",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "families",
          "family-1"
        ),
        {
          subscription: {
            baseChildSlots: 2,
            extraChildSlots: 10,
            status: "ACTIVE"
          }
        },
        {
          merge: true
        }
      )
    );
  }
);

test(
  "owner cannot directly add child id",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "families",
          "family-1"
        ),
        {
          childDeviceIds: [
            "child-1",
            "child-2",
            "child-3"
          ]
        },
        {
          merge: true
        }
      )
    );
  }
);

test(
  "parent can write own nested device",
  async () => {
    const db = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "parents",
          "owner-uid",
          "devices",
          "device-1"
        ),
        {
          deviceId: "device-1",
          platform: "Web"
        }
      )
    );
  }
);

test(
  "parent cannot write another parent nested device",
  async () => {
    const db = verifiedDb(
      "outsider-uid",
      "outsider@example.com"
    );

    await assertFails(
      setDoc(
        doc(
          db,
          "parents",
          "owner-uid",
          "devices",
          "fake-device"
        ),
        {
          deviceId: "fake-device",
          platform: "Web"
        }
      )
    );
  }
);


test(
  "child can request a protected permission change",
  async () => {
    const db = verifiedDb(
      "child-auth-uid",
      "child@example.com"
    );

    await assertSucceeds(
      setDoc(
        doc(
          db,
          "children",
          "child-1",
          "permissionChangeRequests",
          "permission-request-1"
        ),
        {
          requestId: "permission-request-1",
          childId: "child-1",
          familyId: "family-1",
          deviceId: "device-1",
          childName: "Child",
          permissionType: "ACCESSIBILITY",
          permissionName: "Accessibility Service",
          status: "PENDING",
          requestedAt: new Date()
        }
      )
    );
  }
);

test(
  "parent manager can approve a permission change",
  async () => {
    const childDb = verifiedDb(
      "child-auth-uid",
      "child@example.com"
    );

    await setDoc(
      doc(
        childDb,
        "children",
        "child-1",
        "permissionChangeRequests",
        "permission-request-2"
      ),
      {
        requestId: "permission-request-2",
        childId: "child-1",
        familyId: "family-1",
        deviceId: "device-1",
        childName: "Child",
        permissionType: "USAGE_STATS",
        permissionName: "Usage Statistics",
        status: "PENDING",
        requestedAt: new Date()
      }
    );

    const ownerDb = verifiedDb(
      "owner-uid",
      "owner@example.com"
    );

    await assertSucceeds(
      updateDoc(
        doc(
          ownerDb,
          "children",
          "child-1",
          "permissionChangeRequests",
          "permission-request-2"
        ),
        {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedBy: "owner-uid",
          expiresAt: new Date(Date.now() + 600000)
        }
      )
    );
  }
);

test(
  "child cannot approve its own permission change",
  async () => {
    const childDb = verifiedDb(
      "child-auth-uid",
      "child@example.com"
    );

    await setDoc(
      doc(
        childDb,
        "children",
        "child-1",
        "permissionChangeRequests",
        "permission-request-3"
      ),
      {
        requestId: "permission-request-3",
        childId: "child-1",
        familyId: "family-1",
        deviceId: "device-1",
        childName: "Child",
        permissionType: "OVERLAY",
        permissionName: "Display Over Other Apps",
        status: "PENDING",
        requestedAt: new Date()
      }
    );

    await assertFails(
      updateDoc(
        doc(
          childDb,
          "children",
          "child-1",
          "permissionChangeRequests",
          "permission-request-3"
        ),
        {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedBy: "child-auth-uid",
          expiresAt: new Date(Date.now() + 600000)
        }
      )
    );
  }
);
