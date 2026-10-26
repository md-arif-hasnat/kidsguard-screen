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

async function assertFamilyHasNoData(familyRef, family) {
  const childIds = Array.isArray(family.childDeviceIds)
    ? family.childDeviceIds.filter(Boolean)
    : [];
  if (childIds.length > 0) {
    fail(`Target family ${familyRef.id} already has child devices.`);
  }

  const subscription = family.subscription || {};
  if (
    subscription.paddleCustomerId ||
    subscription.paddleSubscriptionId ||
    ![undefined, null, "", "PENDING"].includes(subscription.status)
  ) {
    fail(`Target family ${familyRef.id} has billing activity.`);
  }

  const collections = await familyRef.listCollections();
  for (const collection of collections) {
    const sample = await collection.limit(1).get();
    if (!sample.empty) {
      fail(
        `Target family ${familyRef.id} contains data in ${collection.id}.`
      );
    }
  }
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

  const sourceFamilies = await db
    .collection("families")
    .where("ownerId", "==", sourceUser.uid)
    .limit(2)
    .get();

  if (sourceFamilies.empty) {
    const completed = await db
      .collection("families")
      .where("ownerId", "==", targetUser.uid)
      .where("ownershipTransfer.sourceUid", "==", sourceUser.uid)
      .limit(1)
      .get();
    if (!completed.empty) {
      console.log(
        `Ownership was already transferred to ${targetEmail}; nothing to do.`
      );
      return;
    }
    fail("No source family is owned by the Super Admin account.");
  }
  if (sourceFamilies.size !== 1) {
    fail("Source account owns more than one family; automatic transfer stopped.");
  }

  const sourceFamilyRef = sourceFamilies.docs[0].ref;
  const sourceFamily = sourceFamilies.docs[0].data() || {};
  const childIds = Array.isArray(sourceFamily.childDeviceIds)
    ? sourceFamily.childDeviceIds.filter(Boolean)
    : [];

  const targetFamilies = await db
    .collection("families")
    .where("ownerId", "==", targetUser.uid)
    .limit(2)
    .get();
  if (targetFamilies.size > 1) {
    fail("Target account owns more than one family; automatic transfer stopped.");
  }

  const targetFamilyRef = targetFamilies.empty
    ? null
    : targetFamilies.docs[0].ref;
  if (targetFamilyRef && targetFamilyRef.id !== sourceFamilyRef.id) {
    await assertFamilyHasNoData(
      targetFamilyRef,
      targetFamilies.docs[0].data() || {}
    );
  }

  const plan = {
    dryRun,
    sourceEmail,
    targetEmail,
    sourceFamilyId: sourceFamilyRef.id,
    disposableTargetFamilyId:
      targetFamilyRef && targetFamilyRef.id !== sourceFamilyRef.id
        ? targetFamilyRef.id
        : null,
    childCount: childIds.length,
    childIds,
    subscriptionStatus: sourceFamily.subscription?.status || null,
  };
  console.log("Validated ownership transfer plan:", JSON.stringify(plan));

  if (dryRun) return;

  const sourceParentRef = db.collection("parents").doc(sourceUser.uid);
  const targetParentRef = db.collection("parents").doc(targetUser.uid);
  const auditRef = db.collection("auditLogs").doc();
  const disposableFamilyId =
    targetFamilyRef && targetFamilyRef.id !== sourceFamilyRef.id
      ? targetFamilyRef.id
      : null;

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
        familyIds: oldFamilyIds.filter((id) => id !== sourceFamilyRef.id),
        role: "VIEWER",
        ownershipTransferredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const targetData = targetParent.data() || {};
    const targetFamilyIds = Array.isArray(targetData.familyIds)
      ? targetData.familyIds.filter((id) => id !== disposableFamilyId)
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

  if (targetFamilyRef && targetFamilyRef.id !== sourceFamilyRef.id) {
    await db.recursiveDelete(targetFamilyRef);
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
