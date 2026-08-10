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
  doc,
  getDoc,
  setDoc
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
        doc(adminDb, "families", "family-1"),
        {
          ownerId: "owner-uid",
          memberUids: [
            "owner-uid",
            "viewer-uid"
          ],
          managerUids: [
            "owner-uid"
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

function verifiedDb(uid, email) {
  return testEnv
    .authenticatedContext(uid, {
      email,
      email_verified: true
    })
    .firestore();
}

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