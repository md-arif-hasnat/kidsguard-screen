const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  FieldValue,
  Timestamp,
  getFirestore,
} = require("firebase-admin/firestore");

const sourceEmail = String(process.env.SOURCE_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();
const targetEmail = String(process.env.TARGET_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();
const confirmation = String(process.env.TRANSFER_CONFIRMATION || "").trim();
const dryRun = String(process.env.DRY_RUN || "true").toLowerCase() !== "false";

function fail(message) {
  throw new Error(message);
}

if (!sourceEmail || !targetEmail || sourceEmail === targetEmail) {
  fail("Distinct source and target owner emails are required.");
}

const expectedConfirmation = `TRANSFER ${sourceEmail} TO ${targetEmail}`;
if (confirmation !== expectedConfirmation) {
  fail(`TRANSFER_CONFIRMATION must exactly equal: ${expectedConfirmation}`);
}

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ""
);

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const auth = getAuth();
const db = getFirestore();

function normalizedMembers(family, sourceUser, targetUser) {
  const existing = Array.isArray(family.members) ? family.members : [];
  const retained = existing.filter(
    (member) =>
      member &&
      typeof member.uid === "string" &&
      member.uid !== sourceUser.uid &&
      member.uid !== targetUser.uid
  );

  retained.push({
    uid: targetUser.uid,
    email: targetUser.email,
    displayName: targetUser.displayName || targetUser.email.split("@")[0],
    role: "OWNER",
    joinedAt: Timestamp.now(),
    assignedChildren: ["*"],
  });

  return retained;
}

async function assertFamilyHasNoData(record) {
  const { ref: familyRef, family, childIds } = record;
  if (childIds.length > 0) {
    fail(`Disposable family ${familyRef.id} already has child devices.`);
  }

  const subscription = family.subscription || {};
  if (
    subscription.paddleCustomerId ||
    subscription.paddleSubscriptionId ||
    ![undefined, null, "", "PENDING"].includes(subscription.status)
  ) {
    fail(`Disposable family ${familyRef.id} has billing activity.`);
  }

  const collections = await familyRef.listCollections();
  for (const collection of collections) {
    const sample = await collection.limit(1).get();
    if (!sample.empty) {
      fail(
        `Disposable family ${familyRef.id} contains data in ${collection.id}.`
      );
    }
  }
}

async function describeOwnedFamily(document) {
  const family = document.data() || {};
  const listedChildIds = Array.isArray(family.childDeviceIds)
    ? family.childDeviceIds.filter(Boolean)
    : [];
  const linkedChildren = await db
    .collection("children")
    .where("familyId", "==", document.id)
    .get();
  const childIds = Array.from(
    new Set([...listedChildIds, ...linkedChildren.docs.map((child) => child.id)])
  );

  return {
    document,
    ref: document.ref,
    family,
    childIds,
    subscriptionStatus: family.subscription?.status || null,
  };
}

async function main() {
  const [sourceUser, targetUser] = await Promise.all([
    auth.getUserByEmail(sourceEmail),
    auth.getUserByEmail(targetEmail),
  ]);

  if (!sourceUser.emailVerified) {
    fail("Source owner email is not verified.");
  }
  if (!targetUser.emailVerified) {
    fail("Target owner email is not verified.");
  }

  const platformAdmin = await db
    .collection("platformAdmins")
    .doc(sourceUser.uid)
    .get();
  const platformAdminData = platformAdmin.data() || {};
  if (
    !platformAdmin.exists ||
    platformAdminData.active !== true ||
    platformAdminData.role !== "SUPER_ADMIN"
  ) {
    fail("Source account is not the active platform Super Admin.");
  }

  const sourceParentRef = db.collection("parents").doc(sourceUser.uid);
  const targetParentRef = db.collection("parents").doc(targetUser.uid);
  const [sourceParentSnapshot, sourceFamilies, targetFamilies] =
    await Promise.all([
      sourceParentRef.get(),
      db.collection("families").where("ownerId", "==", sourceUser.uid).get(),
      db.collection("families").where("ownerId", "==", targetUser.uid).get(),
    ]);

  const targetOwnedFamilies = await Promise.all(
    targetFamilies.docs.map(describeOwnedFamily)
  );

  if (sourceFamilies.empty) {
    const completed = targetOwnedFamilies.find(
      (record) =>
        record.family.ownershipTransfer?.sourceUid === sourceUser.uid
    );
    if (completed) {
      console.log(
        `Ownership was already transferred to ${targetEmail}; ` +
          `family=${completed.ref.id}, children=${completed.childIds.length}.`
      );
      return;
    }
    fail("No source family is owned by the Super Admin account.");
  }

  if (!sourceParentSnapshot.exists) {
    fail("Source parent profile does not exist.");
  }

  const sourceOwnedFamilies = await Promise.all(
    sourceFamilies.docs.map(describeOwnedFamily)
  );
  const sourceParentData = sourceParentSnapshot.data() || {};
  const preferredFamilyIds = new Set(
    [
      sourceParentData.ownedFamilyId,
      sourceParentData.activeFamilyId,
      sourceParentData.familyId,
    ].filter((id) => typeof id === "string" && id)
  );
  const familiesWithChildren = sourceOwnedFamilies.filter(
    (record) => record.childIds.length > 0
  );
  const preferredFamilies = sourceOwnedFamilies.filter((record) =>
    preferredFamilyIds.has(record.ref.id)
  );

  let selectedSource;
  if (familiesWithChildren.length === 1) {
    selectedSource = familiesWithChildren[0];
  } else if (
    familiesWithChildren.length === 0 &&
    preferredFamilies.length === 1
  ) {
    selectedSource = preferredFamilies[0];
  } else if (
    familiesWithChildren.length === 0 &&
    sourceOwnedFamilies.length === 1
  ) {
    selectedSource = sourceOwnedFamilies[0];
  } else {
    fail(
      "Could not select exactly one source family: " +
        JSON.stringify(
          sourceOwnedFamilies.map((record) => ({
            familyId: record.ref.id,
            childCount: record.childIds.length,
            preferred: preferredFamilyIds.has(record.ref.id),
            subscriptionStatus: record.subscriptionStatus,
          }))
        )
    );
  }

  const sourceFamilyRef = selectedSource.ref;
  const sourceFamily = selectedSource.family;
  const childIds = selectedSource.childIds;
  const disposableFamilies = [
    ...sourceOwnedFamilies.filter(
      (record) => record.ref.id !== sourceFamilyRef.id
    ),
    ...targetOwnedFamilies.filter(
      (record) => record.ref.id !== sourceFamilyRef.id
    ),
  ];

  for (const record of disposableFamilies) {
    await assertFamilyHasNoData(record);
  }

  const disposableFamilyIds = disposableFamilies.map(
    (record) => record.ref.id
  );
  const sourceOwnedFamilyIds = sourceOwnedFamilies.map(
    (record) => record.ref.id
  );

  const plan = {
    dryRun,
    sourceEmail,
    targetEmail,
    sourceFamilyId: sourceFamilyRef.id,
    disposableFamilyIds,
    childCount: childIds.length,
    childIds,
    subscriptionStatus: sourceFamily.subscription?.status || null,
  };
  console.log("Validated ownership transfer plan:", JSON.stringify(plan));

  if (dryRun) return;

  const auditRef = db.collection("auditLogs").doc();

  await db.runTransaction(async (transaction) => {
    const [freshSourceFamily, sourceParent, targetParent] = await Promise.all([
      transaction.get(sourceFamilyRef),
      transaction.get(sourceParentRef),
      transaction.get(targetParentRef),
    ]);

    if (!freshSourceFamily.exists) fail("Source family disappeared.");
    const family = freshSourceFamily.data() || {};
    if (family.ownerId !== sourceUser.uid) {
      fail("Source family ownership changed before the transaction.");
    }

    const members = normalizedMembers(family, sourceUser, targetUser);
    const memberUids = members.map((member) => member.uid);
    const managerUids = Array.from(
      new Set([
        targetUser.uid,
        ...members
          .filter((member) => ["OWNER", "MANAGER"].includes(member.role))
          .map((member) => member.uid),
      ])
    );

    transaction.update(sourceFamilyRef, {
      ownerId: targetUser.uid,
      members,
      memberUids,
      managerUids,
      ownershipTransfer: {
        sourceUid: sourceUser.uid,
        sourceEmail,
        targetUid: targetUser.uid,
        targetEmail,
        transferredAt: FieldValue.serverTimestamp(),
        method: "VERIFIED_ONE_TIME_MIGRATION",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    const oldFamilyIds = Array.isArray(sourceParent.data()?.familyIds)
      ? sourceParent.data().familyIds
      : [];
    transaction.set(
      sourceParentRef,
      {
        familyId: FieldValue.delete(),
        activeFamilyId: FieldValue.delete(),
        ownedFamilyId: FieldValue.delete(),
        familyIds: oldFamilyIds.filter(
          (id) => !sourceOwnedFamilyIds.includes(id)
        ),
        role: "VIEWER",
        ownershipTransferredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const targetData = targetParent.data() || {};
    const targetFamilyIds = Array.isArray(targetData.familyIds)
      ? targetData.familyIds.filter(
          (id) => !disposableFamilyIds.includes(id)
        )
      : [];
    transaction.set(
      targetParentRef,
      {
        uid: targetUser.uid,
        email: targetUser.email,
        displayName:
          targetData.displayName ||
          targetUser.displayName ||
          targetUser.email.split("@")[0],
        provider: targetData.provider || "password",
        familyId: sourceFamilyRef.id,
        ownedFamilyId: sourceFamilyRef.id,
        activeFamilyId: sourceFamilyRef.id,
        familyIds: Array.from(new Set([...targetFamilyIds, sourceFamilyRef.id])),
        role: "OWNER",
        ownershipReceivedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(auditRef, {
      actorUid: sourceUser.uid,
      actorEmail: sourceEmail,
      action: "FAMILY_OWNERSHIP_TRANSFERRED",
      targetType: "FAMILY",
      targetId: sourceFamilyRef.id,
      familyId: sourceFamilyRef.id,
      sourceOwnerUid: sourceUser.uid,
      sourceOwnerEmail: sourceEmail,
      targetOwnerUid: targetUser.uid,
      targetOwnerEmail: targetEmail,
      preservedChildIds: childIds,
      severity: "WARNING",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  for (const record of disposableFamilies) {
    await db.recursiveDelete(record.ref);
  }

  console.log(
    `Transferred family ${sourceFamilyRef.id} to ${targetEmail}; ` +
      `${childIds.length} child device(s) preserved.`
  );
}

main().catch((error) => {
  console.error("Family ownership transfer failed:", error);
  process.exit(1);
});
