import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { randomUUID } from 'crypto';

import { ZipArchive } from 'archiver';

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();
const storageBucket = admin.storage().bucket();

function serializeExportValue(
  value: unknown
): unknown {
  if (
    value instanceof
    admin.firestore.Timestamp
  ) {
    return value.toDate().toISOString();
  }

  if (
    value instanceof
    admin.firestore.GeoPoint
  ) {
    return {
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeExportValue);
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>
      ).map(([key, nestedValue]) => [
        key,
        serializeExportValue(nestedValue),
      ])
    );
  }

  return value;
}

async function exportDocumentTree(
  documentRef:
    admin.firestore.DocumentReference
): Promise<Record<string, unknown> | null> {
  const documentSnapshot =
    await documentRef.get();

  if (!documentSnapshot.exists) {
    return null;
  }

  const exportedDocument:
    Record<string, unknown> = {
      id: documentSnapshot.id,
      path: documentSnapshot.ref.path,
      data: serializeExportValue(
        documentSnapshot.data() || {}
      ),
    };

  const subcollections =
    await documentRef.listCollections();

  if (subcollections.length > 0) {
    const exportedSubcollections:
      Record<string, unknown[]> = {};

    for (const subcollection of subcollections) {
      const subcollectionSnapshot =
        await subcollection.get();

      const exportedDocuments =
        await Promise.all(
          subcollectionSnapshot.docs.map(
            (nestedDocument) =>
              exportDocumentTree(
                nestedDocument.ref
              )
          )
        );

      exportedSubcollections[
        subcollection.id
      ] = exportedDocuments.filter(
        (
          value
        ): value is Record<string, unknown> =>
          value !== null
      );
    }

    exportedDocument.subcollections =
      exportedSubcollections;
  }

  return exportedDocument;
}

async function exportLinkedDocuments(
  collectionName: string,
  fieldName: string,
  fieldValue: string
): Promise<Record<string, unknown>[]> {
  const snapshot = await db
    .collection(collectionName)
    .where(fieldName, "==", fieldValue)
    .get();

  const exportedDocuments =
    await Promise.all(
      snapshot.docs.map((document) =>
        exportDocumentTree(document.ref)
      )
    );

  return exportedDocuments.filter(
    (
      value
    ): value is Record<string, unknown> =>
      value !== null
  );
}

async function getExportFamilyOwner(
  context: functions.https.CallableContext
): Promise<{
  uid: string;
  familyId: string;
  familyRef:
    admin.firestore.DocumentReference;
  familySnapshot:
    admin.firestore.DocumentSnapshot;
}> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  if (
    context.auth.token.email_verified !==
    true
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Your email must be verified."
    );
  }

  const uid = context.auth.uid;
  const parentSnapshot = await db
    .collection("parents")
    .doc(uid)
    .get();

  if (!parentSnapshot.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Parent profile not found."
    );
  }

  const familyId =
    parentSnapshot.data()?.familyId;

  if (
    typeof familyId !== "string" ||
    !familyId
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No family is connected to this account."
    );
  }

  const familyRef = db
    .collection("families")
    .doc(familyId);

  const familySnapshot =
    await familyRef.get();

  if (!familySnapshot.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Family not found."
    );
  }

  if (
    familySnapshot.data()?.ownerId !== uid
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the Family Owner can export family data."
    );
  }

  return {
    uid,
    familyId,
    familyRef,
    familySnapshot,
  };
}

function mergeExportDocuments(
  ...documentGroups:
    Record<string, unknown>[][]
): Record<string, unknown>[] {
  const uniqueDocuments = new Map<
    string,
    Record<string, unknown>
  >();

  for (const group of documentGroups) {
    for (const document of group) {
      const path =
        typeof document.path === "string"
          ? document.path
          : JSON.stringify(document);

      uniqueDocuments.set(path, document);
    }
  }

  return Array.from(
    uniqueDocuments.values()
  );
}


// --- Notification Triggers ---

/**
 * Triggered when a new activity event is created for a child.
 * Handles Safe Zone Entry/Exit.
 */
export const onActivityCreated = functions.firestore
    .document('children/{childId}/activities/{activityId}')
    .onCreate(async (snapshot, context) => {
        const activity = snapshot.data();
        const { childId } = context.params;

        if (activity.type === 'ENTER_ZONE' || activity.type === 'EXIT_ZONE') {
            await broadcastToParents(childId, {
                title: activity.title,
                body: activity.description,
                type: 'SAFE_ZONE',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

/**
* Triggered only when a genuinely new installed-app document is created.
* This avoids recursive notifications.
*/
export const onInstalledAppCreated = functions.firestore
.document("children/{childId}/installedApps/{packageName}")
.onCreate(async (snapshot, context) => {
const app = snapshot.data();
const childId = String(context.params.childId || "");
const packageName = String(context.params.packageName || "");

if (!childId || !packageName) {
console.warn("Missing childId or packageName");
return;
}

const appName = String(
app?.appName ||
app?.name ||
app?.applicationName ||
packageName
);

// Child document থেকে আসল child name নেওয়া
const childSnapshot = await db
.collection("children")
.doc(childId)
.get();

const childData = childSnapshot.data();

const childName = String(
childData?.childName ||
childData?.name ||
"Your child"
);

console.log("New app notification:", {
childId,
childName,
appName,
packageName,
});

await broadcastToParents(childId, {
title: "New app installed",
body: `${childName} installed ${appName}`,
type: "APP_INSTALLED",
childId,
packageName,
clickAction:
`/dashboard/${encodeURIComponent(childId)}` +
`?tab=installed-apps&pkg=${encodeURIComponent(packageName)}`,
});
});

/**
 * Triggered when an SOS event is created.
 */
export const onSosCreated = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onCreate(async (snapshot, context) => {
        const { childId, eventId } = context.params;
        const data = snapshot.data();

        if (!data) return;

        // Resolve child name
        const childSnap = await db.collection('children').doc(childId).get();
        const childName = childSnap.data()?.name || 'Your child';

        // 1. Create exactly one activity/history record for the SOS trigger
        await db.collection('children').doc(childId).collection('activities').doc(eventId).set({
            id: eventId,
            childId: childId,
            type: 'SOS',
            title: 'Emergency SOS Triggered',
            description: data.message || 'Manual trigger from device',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            accuracy: data.locationAccuracy || data.accuracy || null,
            timestamp: data.createdAt || data.timestamp || Date.now(),
            severity: 'critical'
        }, { merge: true });

        // 2. Broadcast high-priority notification to parents
        const notificationBody = data.message && data.message !== 'Emergency SOS Triggered'
            ? `${data.message}. Current location received.`
            : `${childName} may need help. Current location received.`;

        await broadcastToParents(childId, {
            title: `Emergency SOS from ${childName}`,
            body: notificationBody,
            type: 'SOS',
            childId: childId,
            eventId: eventId,
            clickAction: `/sos?childId=${childId}&eventId=${eventId}`
        });

        // 3. Reverse Geocoding (Asynchronous/Background)
        if (data.latitude && data.longitude) {
            try {
                const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAjBIvgF7Bbq92FeO68QsB3xkeEDieTbXU';
                const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${data.latitude},${data.longitude}&key=${apiKey}`;

                const response = await fetch(url);
                const result = await response.json();

                if (result.status === 'OK' && result.results.length > 0) {
                    const addressObj = result.results[0];
                    const components = addressObj.address_components;

                    let street = '';
                    let houseNumber = '';
                    let city = '';
                    let postalCode = '';
                    let country = '';

                    components.forEach((c: any) => {
                        if (c.types.includes('route')) street = c.long_name;
                        if (c.types.includes('street_number')) houseNumber = c.long_name;
                        if (c.types.includes('locality')) city = c.long_name;
                        if (c.types.includes('postal_code')) postalCode = c.long_name;
                        if (c.types.includes('country')) country = c.long_name;
                    });

                    const displayAddress = street
                        ? `${street}${houseNumber ? ' ' + houseNumber : ''}\n${postalCode}${city ? ' ' + city : ''}`
                        : addressObj.formatted_address;

                    await snapshot.ref.update({
                        address: displayAddress,
                        street,
                        houseNumber,
                        postalCode,
                        city,
                        country,
                        geocodedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (error) {
                console.error("Reverse geocoding failed", error);
            }
        }
    });

/**
 * Optional: Triggered when an SOS event is resolved.
 */
export const onSosResolved = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const { childId, eventId } = context.params;

        if (before.status !== 'RESOLVED' && after.status === 'RESOLVED') {
            const now = Date.now();

            // 1. Create SOS_RESOLVED activity record
            const resolutionId = `${eventId}_resolved`;
            await db.collection('children').doc(childId).collection('activities').doc(resolutionId).set({
                id: resolutionId,
                childId: childId,
                type: 'SOS_RESOLVED',
                title: 'SOS Resolved',
                description: 'The emergency signal was marked as resolved.',
                timestamp: now,
                severity: 'info'
            }, { merge: true });

            // 2. Broadcast resolution notification (optional)
            await broadcastToParents(childId, {
                title: 'SOS Resolved',
                body: 'Emergency situation has been marked as resolved.',
                type: 'SOS_RESOLVED',
                childId: childId,
                eventId: eventId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

/**
 * Triggered when child status (battery, online) changes.
 */
export const onStatusChanged = functions.firestore
    .document('children/{childId}/status/current')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const { childId } = context.params;

        if (!before || !after) return;

        const childName = after.childName || 'Child';

        // 1. Battery Alerts
        if (after.batteryPercent <= 10 && before.batteryPercent > 10) {
            await broadcastToParents(childId, {
                title: `🪫 Critical Battery: ${childName}`,
                body: `${childName}'s device is at ${after.batteryPercent}%. Charge immediately.`,
                type: 'BATTERY',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        } else if (after.batteryPercent <= 20 && before.batteryPercent > 20) {
            await broadcastToParents(childId, {
                title: `🔋 Low Battery: ${childName}`,
                body: `${childName}'s device is at ${after.batteryPercent}%.`,
                type: 'BATTERY',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }

        // 2. Online/Offline Alerts
        if (after.online === false && before.online === true) {
            await broadcastToParents(childId, {
                title: `☁️ ${childName} is Offline`,
                body: 'Connection to the child device was lost.',
                type: 'DEVICE',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        } else if (after.online === true && before.online === false) {
            await broadcastToParents(childId, {
                title: `🌐 ${childName} is Online`,
                body: 'Device has reconnected to the network.',
                type: 'DEVICE',
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

/**
 * Triggered when a new family invitation is created.
 */
export const onInviteCreated = functions.firestore
    .document('familyInvitations/{inviteId}')
    .onCreate(async (snapshot, context) => {
        const invite = snapshot.data();
        const { inviteId } = context.params;

        const inviteLink = `https://kidsguard-screen.vercel.app/invite/${inviteId}?token=${invite.tokenHash}`;

        console.log(`Sending invite email to ${invite.invitedEmail}`);

        await EmailService.sendInviteEmail({
            to: invite.invitedEmail,
            familyName: invite.familyName,
            invitedByName: invite.invitedByName || "A member",
            role: invite.invitedRole,
            link: inviteLink,
            expiresAt: invite.expiresAt.toDate().toLocaleDateString()
        });
    });

/**
 * Triggered when an invitation is accepted.
 */
export const onInviteAccepted = functions.firestore
    .document('familyInvitations/{inviteId}')
    .onUpdate(async (change, context) => {
        const after = change.after.data();
        const before = change.before.data();

        if (after.status === 'ACCEPTED' && before.status === 'PENDING') {
            // Notify owner
            await notifyParent(after.invitedByUid, {
                title: '🤝 Invitation Accepted',
                body: `${after.invitedEmail} has joined the family vault as a ${after.invitedRole}.`,
                type: 'PAIRING',
                childId: '',
                clickAction: '/settings/family'
            });
        }
    });

/**
 * Triggered when a new child is paired to a family.
 */
export const onFamilyUpdated = functions.firestore
    .document('families/{familyId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        if (!before || !after) return;

        // 1. Detect new children
        const newChildren = after.childDeviceIds.filter((id: string) => !before.childDeviceIds.includes(id));
        for (const childId of newChildren) {
            const childSnap = await db.collection('children').doc(childId).get();
            const childName = childSnap.data()?.name || 'New Device';

            const memberUids = (after.members as any[]).map(m => m.uid);
            for (const uid of memberUids) {
                await notifyParent(uid, {
                    title: '📱 New Child Paired',
                    body: `${childName} has been successfully linked to your family vault.`,
                    type: 'PAIRING',
                    childId: childId,
                    clickAction: '/'
                });
            }
        }
    });

/**
 * Triggered when a protection mode is created or updated.
 */
export const onProtectionModeChanged = functions.firestore
    .document('children/{childId}/protectionModes/{modeId}')
    .onWrite(async (change, context) => {
        const { childId } = context.params;
        const after = change.after.data();
        const before = change.before.data();

        if (!after) return; // Deleted

        if (after.enabled && (!before || !before.enabled)) {
            await broadcastToParents(childId, {
                title: `🛡️ Mode Activated: ${after.name}`,
                body: `Protection rules for ${after.type} are now active.`,
                type: 'SAFE_ZONE', // Reusing type or add new
                childId: childId,
                clickAction: `/dashboard/${childId}`
            });
        }
    });

// --- Helper Functions ---

class EmailService {
    static async sendInviteEmail(params: { to: string, familyName: string, invitedByName: string, role: string, link: string, expiresAt: string }) {
        // In production, integrate with SendGrid, Resend, etc.
        console.log(`
            --- MOCK EMAIL ---
            To: ${params.to}
            Subject: Invitation to join the ${params.familyName} Family on KidsGuard
            Body:
            Hello,
            ${params.invitedByName} has invited you to join their family vault as a ${params.role}.
            Click here to accept: ${params.link}
            This invitation expires on ${params.expiresAt}.
            ------------------
        `);
        return Promise.resolve();
    }
}

interface NotificationPayload {
    title: string;
    body: string;
    //type: 'SAFE_ZONE' | 'SOS' | 'SOS_RESOLVED' | 'BATTERY' | 'DEVICE' | 'DEVICE_BACK_ONLINE' | 'PAIRING' | 'APP_INSTALLED' | 'TAMPER_ALERT';
    type: 'SAFE_ZONE' | 'SOS' | 'SOS_RESOLVED' | 'BATTERY' | 'DEVICE' | 'DEVICE_OFFLINE' | 'DEVICE_BACK_ONLINE' | 'PAIRING' | 'APP_INSTALLED' | 'TAMPER_ALERT';
    childId: string;
    clickAction: string;
    packageName?: string;
    eventId?: string;
    familyId?: string;
    message?: string; // For explicit required field mapping
    route?: string;   // For explicit required field mapping
    skipHistory?: boolean;
}


function formatOfflineDuration(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${hours}h ${minutes}m`;
}

function formatBerlinTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString("en-GB", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Checks every child device every 5 minutes.
 *
 * Offline alerts follow each child's custom setting:
 * children/{childId}/settings/offlineAlert
 *
 * Runtime state is stored separately:
 * children/{childId}/system/offlineState
 */
export const checkOfflineChildren = functions.pubsub
  .schedule("every 5 minutes")
  .timeZone("Europe/Berlin")
  .onRun(async () => {
    const now = Date.now();
    const childrenSnapshot = await db.collection("children").get();

    for (const childDocument of childrenSnapshot.docs) {
      const childId = childDocument.id;

      try {
        const statusRef = db
          .collection("children")
          .doc(childId)
          .collection("status")
          .doc("current");

        const settingsRef = db
          .collection("children")
          .doc(childId)
          .collection("settings")
          .doc("offlineAlert");

        const offlineStateRef = db
          .collection("children")
          .doc(childId)
          .collection("system")
          .doc("offlineState");

        const [statusSnapshot, settingsSnapshot, stateSnapshot] =
          await Promise.all([
            statusRef.get(),
            settingsRef.get(),
            offlineStateRef.get(),
          ]);

        if (!statusSnapshot.exists) {
          console.warn(
            `Offline check skipped: no status found for child ${childId}`
          );
          continue;
        }

        const status = statusSnapshot.data() || {};
        const settings = settingsSnapshot.data() || {};
        const state = stateSnapshot.data() || {};

        const enabled = settings.enabled !== false;

        const requestedThreshold = Number(
          settings.thresholdMinutes
        );

        const thresholdMinutes =
          Number.isFinite(requestedThreshold) &&
          requestedThreshold >= 10
            ? requestedThreshold
            : 30;

        const lastSeen = Number(status.lastSeen || 0);
        const childName =
          status.childName ||
          childDocument.data().name ||
          "Child";

        if (!enabled || lastSeen <= 0) {
          continue;
        }

        const elapsedMs = now - lastSeen;
        const elapsedMinutes = Math.floor(
          elapsedMs / (60 * 1000)
        );

        const isPastOfflineThreshold =
          elapsedMinutes >= thresholdMinutes;

        const offlineAlertSent =
          state.offlineAlertSent === true;

        /*
         * Device has been offline longer than the configured threshold.
         * Send only one alert for this offline period.
         */
        if (
          isPastOfflineThreshold &&
          !offlineAlertSent
        ) {
          await offlineStateRef.set(
            {
              offlineAlertSent: true,
              offlineSince: lastSeen,
              offlineAlertSentAt:
                admin.firestore.FieldValue.serverTimestamp(),
              lastCheckedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          try {
            await broadcastToParents(childId, {
              title: `${childName} is offline`,
              body:
                `${childName}'s device has been offline since ` +
                `${formatBerlinTime(lastSeen)} ` +
                `(${formatOfflineDuration(elapsedMinutes)}).`,
              type: "DEVICE_OFFLINE",
              childId,
              eventId: `offline-${childId}-${lastSeen}`,
              clickAction: `/dashboard/${childId}`,
            });

            console.log(
              `Offline alert sent for ${childName} (${childId})`
            );
          } catch (error) {
            await offlineStateRef.set(
              {
                offlineAlertSent: false,
                offlineAlertErrorAt:
                  admin.firestore.FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            throw error;
          }

          continue;
        }

        /*
         * Send Back Online only when a real offline alert
         * had previously been sent.
         */
        if (
          !isPastOfflineThreshold &&
          offlineAlertSent
        ) {
          const offlineSince = Number(
            state.offlineSince || lastSeen
          );

          const offlineDurationMinutes = Math.max(
            1,
            Math.floor(
              (lastSeen - offlineSince) / (60 * 1000)
            )
          );

          await offlineStateRef.set(
            {
              offlineAlertSent: false,
              offlineSince:
                admin.firestore.FieldValue.delete(),
              backOnlineAt:
                admin.firestore.FieldValue.serverTimestamp(),
              lastCheckedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          try {
            await broadcastToParents(childId, {
              title: `${childName} is back online`,
              body:
                `${childName}'s device reconnected at ` +
                `${formatBerlinTime(lastSeen)} after being offline for ` +
                `${formatOfflineDuration(offlineDurationMinutes)}.`,
              type: "DEVICE_BACK_ONLINE",
              childId,
              eventId: `online-${childId}-${lastSeen}`,
              clickAction: `/dashboard/${childId}`,
            });

            console.log(
              `Back-online alert sent for ${childName} (${childId})`
            );
          } catch (error) {
            await offlineStateRef.set(
              {
                offlineAlertSent: true,
                offlineSince,
                backOnlineErrorAt:
                  admin.firestore.FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            throw error;
          }

          continue;
        }

        await offlineStateRef.set(
          {
            lastCheckedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      } catch (error) {
        console.error(
          `Offline check failed for child ${childId}:`,
          error
        );
      }
    }

    return null;
  });

/**
 * Sends a notification to all parents linked to a child.
 */
async function broadcastToParents(childId: string, payload: NotificationPayload) {
    // 1. Find family
    const familyQuery = await db.collection('families')
        .where('childDeviceIds', 'array-contains', childId)
        .limit(1)
        .get();

    if (familyQuery.empty) {
        console.warn(`No family found for child ${childId}`);
        return;
    }

    const familyDoc = familyQuery.docs[0];
    const familyId = familyDoc.id;
    const family = familyDoc.data();
    const members = family.members as any[] || [];
    const parentUids = members
        .filter(m => m.role === 'OWNER' || m.role === 'PARENT' || m.role === 'GUARDIAN')
        .map(m => m.uid);

    // 2. Notify each parent
    const promises = parentUids.map(uid => notifyParent(uid, { ...payload, familyId }));
    await Promise.all(promises);
}

export const onTamperAlertCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();

    if(data.generatedBy === "cloud_function"){
    return null;
    }

    if (data.type !== "TAMPER_ALERT") {
      return null;
    }

    const parentUid = data.userId;
    const childId = data.childId;

    if (!parentUid || !childId) {
      console.warn("Tamper alert missing parentUid or childId", {
        notificationId: context.params.notificationId,
        parentUid,
        childId,
      });
      return null;
    }

    await notifyParent(parentUid, {
      type: "TAMPER_ALERT",
      title: data.title || "Security Alert",
      body:
        data.body ||
        "Someone tried to disable or remove KidsGuard protection.",
      childId,
      eventId: context.params.notificationId,
      clickAction: data.clickAction || `/dashboard/${childId}`,
      familyId: data.familyId || "",
      skipHistory: true,
    });

    return null;
  });

/**
 * Sends a notification to a specific parent if child changes checklisfrom child phone app home or phone settings.
 */
 export const onPermissionAlertCreated = functions.firestore
   .document("notifications/{notificationId}")
   .onCreate(async (snapshot, context) => {
     const data = snapshot.data();

     if(data.generatedBy === "cloud_function"){
         return null;
         }

     const allowedTypes = [
       "LOCATION_PERMISSION_DISABLED",
       "BACKGROUND_LOCATION_DISABLED",
     ];

     if (!allowedTypes.includes(String(data.type || ""))) {
       return null;
     }

     const parentUid = String(data.userId || "");
     const childId = String(data.childId || "");

     if (!parentUid || !childId) {
       console.warn("Permission alert missing userId or childId", {
         notificationId: context.params.notificationId,
       });
       return null;
     }

     await notifyParent(parentUid, {
       type: String(data.type) as any,
       title: String(data.title || "Permission Alert"),
       body: String(data.body || "A required permission was disabled."),
       childId,
       eventId: context.params.notificationId,
       clickAction: String(
         data.clickAction || `/dashboard/${childId}`
       ),
       familyId: String(data.familyId || ""),
       skipHistory: true,
     });

     return null;
   });


/**
 * Sends a notification to a specific parent if their settings allow it.
 */
async function notifyParent(uid: string, payload: NotificationPayload) {
    // 1. Check settings
    const settingsSnap = await db.collection('parents').doc(uid).collection('notificationSettings').doc('current').get();
    const settings = settingsSnap.data();

    const typeMap: Record<string, string> = {

        'SAFE_ZONE': 'safeZone',
        'SOS': 'sos',
        'SOS_RESOLVED': 'sos',
        'BATTERY': 'battery',
        'DEVICE': 'deviceStatus',
        'PAIRING': 'pairing'
    };

    const settingKey = typeMap[payload.type];
    if (settings && settings[settingKey] === false) {
        console.log(`Parent ${uid} has disabled ${payload.type} notifications.`);
        return;
    }

    // 2. Record notification in history
    // Use a deterministic notification ID based on eventId and parent user ID to prevent duplicates.
    // New Path: notifications/{deterministicId}
    const notificationId = payload.eventId ? `${payload.eventId}_${uid}` : db.collection('notifications').doc().id;

    const notificationDoc = {
        id: notificationId,
        generatedBy: "cloud_function",
        userId: uid,
        familyId: payload.familyId || '',
        childId: payload.childId,
        eventId: payload.eventId || '',
        type: payload.type,
        title: payload.title,
        body: payload.body,
        message: payload.body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        clickAction: payload.clickAction,
        route: payload.clickAction
    };

    if (!payload.skipHistory) {
      await db
        .collection("notifications")
        .doc(notificationId)
        .set(notificationDoc, { merge: true });
    }

    // 3. Send FCM to all registered devices
    // New Path: users/{uid}/notificationTokens
    const devicesSnap = await db.collection('users').doc(uid).collection('notificationTokens').get();
    if (devicesSnap.empty) return;

    // Filter for enabled tokens
    // Filter enabled token documents
    const enabledDevices = devicesSnap.docs.filter(
      doc => doc.data().enabled !== false && !!doc.data().token
    );

    // iPhone / Web PWA tokens
    const webTokens = enabledDevices
      .filter(doc => {
        const platform = String(doc.data().platform || "").toLowerCase();
        return platform === "ios-pwa" || platform === "web";
      })
      .map(doc => String(doc.data().token));

    // Native Android/other tokens
    const nativeTokens = enabledDevices
      .filter(doc => {
        const platform = String(doc.data().platform || "").toLowerCase();
        return platform !== "ios-pwa" && platform !== "web";
      })
      .map(doc => String(doc.data().token));

    if (webTokens.length === 0 && nativeTokens.length === 0) return;

    console.log("Notification token groups", {
      webCount: webTokens.length,
      nativeCount: nativeTokens.length
    });


    console.log("sending FCM");
    console.log("webTokens:", webTokens.length);
    console.log("nativeTokens:", nativeTokens.length);

    const allTokens = [...webTokens, ...nativeTokens];

    const webPayload: admin.messaging.MulticastMessage = {
      tokens: webTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        childId: payload.childId,
        eventId: payload.eventId || "",
        clickAction: payload.clickAction,
        packageName: payload.packageName || "",
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: payload.clickAction,
        },
      },
    };

    const messagingPayload: admin.messaging.MulticastMessage = {
      tokens: nativeTokens,
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: {
        type: payload.type,
        childId: payload.childId,
        eventId: payload.eventId || "",
        clickAction: payload.clickAction,
        packageName: payload.packageName || "",
        title: payload.title,
        body: payload.body,
        },
        webpush: {
            fcmOptions: {
                link: payload.clickAction
            }
        },
        android: {
            priority: (payload.type === 'SOS') ? 'high' : 'normal',
            notification: {
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }

        }
    };

    try {
        let webResponse: admin.messaging.BatchResponse | null = null;
        let nativeResponse: admin.messaging.BatchResponse | null = null;

        if (webTokens.length > 0) {
          webResponse = await admin.messaging().sendEachForMulticast(webPayload);
        }

        if (nativeTokens.length > 0) {
          nativeResponse = await admin.messaging().sendEachForMulticast(messagingPayload);
        }
        const successCount =
          (webResponse?.successCount || 0) +
          (nativeResponse?.successCount || 0);

        console.log(
          `Successfully sent ${successCount} notifications for parent ${uid}`
        );
        console.log("FCM sent once")

        // Clean up invalid tokens if any
        // Clean up invalid tokens if any
        const tokensToRemove: Promise<any>[] = [];

        const removeInvalidTokens = (
          response: admin.messaging.BatchResponse | null,
          tokenList: string[]
        ) => {
          if (!response || response.failureCount === 0) return;

          response.responses.forEach((resp, idx) => {
            if (resp.success) return;

            const error = resp.error;

            if (
              error?.code === "messaging/invalid-registration-token" ||
              error?.code === "messaging/registration-token-not-registered"
            ) {
              const invalidToken = tokenList[idx];

              const matchingDoc = devicesSnap.docs.find(
                doc => String(doc.data().token) === invalidToken
              );

              if (matchingDoc) {
                tokensToRemove.push(matchingDoc.ref.delete());
              }
            }
          });
        };

        removeInvalidTokens(webResponse, webTokens);
        removeInvalidTokens(nativeResponse, nativeTokens);

        await Promise.all(tokensToRemove);
    } catch (error) {
        console.error(`Error sending FCM to parent ${uid}:`, error);
    }
}

function getAllowedChildSlots(familyData: any): number {
  const subscription = familyData?.subscription;

  const baseChildSlots =
    Number.isInteger(subscription?.baseChildSlots) &&
    subscription.baseChildSlots >= 1
      ? subscription.baseChildSlots
      : 1;

  const extraChildSlots =
    Number.isInteger(subscription?.extraChildSlots) &&
    subscription.extraChildSlots >= 0
      ? subscription.extraChildSlots
      : 0;

  const maxChildSlots =
    Number.isInteger(subscription?.maxChildSlots) &&
    subscription.maxChildSlots >= 1
      ? subscription.maxChildSlots
      : 10;

  const totalAllowedSlots =
    baseChildSlots + extraChildSlots;

  return Math.min(
    maxChildSlots,
    Math.max(1, totalAllowedSlots)
  );
}
export const acceptPairingCode = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to pair a child.'
      );
    }
    const pairingCode =
      typeof data?.pairingCode === 'string'
        ? data.pairingCode.trim()
        : '';

    const familyId =
      typeof data?.familyId === 'string'
        ? data.familyId.trim()
        : '';

    if (!/^\d{6}$/.test(pairingCode) || !familyId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid 6-digit pairing code and familyId are required.'
      );
    }

// authenticated user ওই family-এর Parent/Owner কি না, সেটা backend-এ যাচাই করব।
    const uid = context.auth.uid;
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();

    if (!familySnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Family not found.'
      );
    }

    const familyData = familySnapshot.data() || {};
    const members = Array.isArray(familyData.members)
      ? familyData.members
      : [];

    const canPairChild =
      familyData.ownerId === uid ||
      members.some(
        (member: any) =>
          member?.uid === uid &&
          (member?.role === 'OWNER' || member?.role === 'PARENT')
      );

    if (!canPairChild) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to add a child to this family.'
      );
    }

// pairing code Firestore-এ আছে, ব্যবহৃত হয়নি এবং expire করেনি—এগুলো যাচাই করব।

    const pairingRef = db.collection('pairingCodes').doc(pairingCode);
    const pairingSnapshot = await pairingRef.get();

    if (!pairingSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Pairing code not found.'
      );
    }

    const pairingData = pairingSnapshot.data() || {};

    if (pairingData.used === true) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This pairing code has already been used.'
      );
    }

    const expiresAtMillis =
      typeof pairingData.expiresAt?.toMillis === 'function'
        ? pairingData.expiresAt.toMillis()
        : 0;

    if (expiresAtMillis <= Date.now()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'This pairing code has expired.'
      );
    }

    if (
      typeof pairingData.childId !== 'string' ||
      !pairingData.childId ||
      typeof pairingData.firebaseUid !== 'string' ||
      !pairingData.firebaseUid
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Pairing code data is incomplete.'
      );
    }

//subscription slot check
    const childId = pairingData.childId;
        const deviceId =
          typeof pairingData.deviceId === 'string' &&
          pairingData.deviceId
            ? pairingData.deviceId
            : pairingData.childDeviceId;

        if (typeof deviceId !== 'string' || !deviceId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Pairing code does not contain a valid deviceId.'
          );
        }

        const parentName =
          typeof data?.parentName === 'string' &&
          data.parentName.trim()
            ? data.parentName.trim()
            : 'Parent';

    const currentChildIds = Array.isArray(familyData.childDeviceIds)
      ? familyData.childDeviceIds.filter(
          (id: unknown): id is string => typeof id === 'string'
        )
      : [];

    const childAlreadyPaired = currentChildIds.includes(childId);
    const allowedChildSlots = getAllowedChildSlots(familyData);

    if (
      !childAlreadyPaired &&
      currentChildIds.length >= allowedChildSlots
    ) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Your subscription allows ${allowedChildSlots} child device(s).`
      );
    }
    const pairingResult = await db.runTransaction(async (transaction) => {
      const latestFamilySnapshot = await transaction.get(familyRef);
      const latestPairingSnapshot = await transaction.get(pairingRef);

      if (!latestFamilySnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Family not found during pairing.'
        );
      }

      if (!latestPairingSnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Pairing code not found during pairing.'
        );
      }
          const latestFamilyData = latestFamilySnapshot.data() || {};
          const latestPairingData = latestPairingSnapshot.data() || {};

          const latestMembers = Array.isArray(latestFamilyData.members)
            ? latestFamilyData.members
            : [];

          const stillAllowedToPair =
            latestFamilyData.ownerId === uid ||
            latestMembers.some(
              (member: any) =>
                member?.uid === uid &&
                (member?.role === 'OWNER' || member?.role === 'PARENT')
            );

          if (!stillAllowedToPair) {
            throw new functions.https.HttpsError(
              'permission-denied',
              'You no longer have permission to add a child.'
            );
          }

          if (latestPairingData.used === true) {
            throw new functions.https.HttpsError(
              'already-exists',
              'This pairing code has already been used.'
            );
          }

          const latestExpiry =
            typeof latestPairingData.expiresAt?.toMillis === 'function'
              ? latestPairingData.expiresAt.toMillis()
              : 0;

          if (latestExpiry <= Date.now()) {
            throw new functions.https.HttpsError(
              'deadline-exceeded',
              'This pairing code has expired.'
            );
          }

          const latestChildId = latestPairingData.childId;
          const latestDeviceId =
            latestPairingData.deviceId ||
            latestPairingData.childDeviceId;

          if (
            typeof latestChildId !== 'string' ||
            !latestChildId ||
            typeof latestDeviceId !== 'string' ||
            !latestDeviceId ||
            latestPairingData.firebaseUid !== pairingData.firebaseUid
          ) {
            throw new functions.https.HttpsError(
              'failed-precondition',
              'Pairing data changed or is incomplete.'
            );
          }

          const latestChildIds = Array.isArray(
            latestFamilyData.childDeviceIds
          )
            ? latestFamilyData.childDeviceIds.filter(
                (id: unknown): id is string => typeof id === 'string'
              )
            : [];

          const latestAllowedSlots =
            getAllowedChildSlots(latestFamilyData);

          if (
            !latestChildIds.includes(latestChildId) &&
            latestChildIds.length >= latestAllowedSlots
          ) {
            throw new functions.https.HttpsError(
              'resource-exhausted',
              `Your subscription allows ${latestAllowedSlots} child device(s).`
            );
          }
            const childRef = db
              .collection('children')
              .doc(latestChildId);

                    const existingChildSnapshot =
                      await transaction.get(childRef);

                    if (existingChildSnapshot.exists) {
                      const existingChildData =
                        existingChildSnapshot.data() || {};

                      if (
                        typeof existingChildData.familyId === 'string' &&
                        existingChildData.familyId &&
                        existingChildData.familyId !== familyId
                      ) {
                        throw new functions.https.HttpsError(
                          'already-exists',
                          'This child is already paired with another family.'
                        );
                      }
                    }

            transaction.update(familyRef, {
              childDeviceIds:
                admin.firestore.FieldValue.arrayUnion(latestChildId)
            });

            transaction.set(
              childRef,
              {
                childId: latestChildId,
                deviceId: latestDeviceId,
                firebaseUid: latestPairingData.firebaseUid,
                name: latestPairingData.childName || 'Unnamed Child',
                avatarId: latestPairingData.avatarId || 'avatar_1',
                familyId,
                pairedAt:
                  admin.firestore.FieldValue.serverTimestamp(),
                lastSeen:
                  admin.firestore.FieldValue.serverTimestamp()
              },
              { merge: true }
            );

            transaction.update(pairingRef, {
              used: true,
              familyId,
              parentUid: uid,
              parentName,
              pairedAt:
                admin.firestore.FieldValue.serverTimestamp()
            });

            return {
              childId: latestChildId,
              deviceId: latestDeviceId,
              childName:
                latestPairingData.childName || 'Unnamed Child'
            };
    });

        return {
          success: true,
          ...pairingResult
        };
  }
);

export const acceptFamilyInvitation =
  functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to accept an invitation.'
      );
    }

    const inviteId =
      typeof data?.inviteId === 'string'
        ? data.inviteId.trim()
        : '';
    const token =
      typeof data?.token === 'string'
        ? data.token.trim()
        : '';

    const displayName =
      typeof data?.displayName === 'string'
        ? data.displayName.trim()
        : '';

    const dateOfBirth =
      typeof data?.dateOfBirth === 'string'
        ? data.dateOfBirth.trim()
        : '';

    const email =
      typeof context.auth?.token.email ===
        'string'
        ? context.auth.token.email
            .trim()
            .toLowerCase()
        : '';

    const parsedBirthDate =
      new Date(
        `${dateOfBirth}T00:00:00.000Z`
      );

    const isValidBirthDate =
      /^\d{4}-\d{2}-\d{2}$/.test(
        dateOfBirth
      ) &&
      !Number.isNaN(
        parsedBirthDate.getTime()
      ) &&
      parsedBirthDate
        .toISOString()
        .slice(0, 10) === dateOfBirth &&
      parsedBirthDate.getTime() <=
        Date.now();

    if (
      displayName.length < 2 ||
      displayName.length > 80 ||
      !isValidBirthDate
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'A valid full name and date of birth are required.'
      );
    }

    const uid = context.auth.uid;
    const inviteRef = db
      .collection('familyInvitations')
      .doc(inviteId);

    const inviteSnapshot = await inviteRef.get();

    if (!inviteSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Invitation not found.'
      );
    }

    const inviteData = inviteSnapshot.data() || {};
    if (
      typeof inviteData.tokenHash !== 'string' ||
      inviteData.tokenHash !== token
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Invitation token is invalid.'
      );
    }

    if (inviteData.status !== 'PENDING') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Invitation is ${inviteData.status || 'invalid'}.`
      );
    }

    if (
      typeof inviteData.email !== 'string' ||
      inviteData.email.toLowerCase() !== email
    ) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This invitation was sent to another email address.'
      );
    }

    const expiresAtMillis =
      typeof inviteData.expiresAt?.toMillis === 'function'
        ? inviteData.expiresAt.toMillis()
        : 0;

    if (expiresAtMillis <= Date.now()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'This invitation has expired.'
      );
    }

    const familyId = inviteData.familyId;
    const role = inviteData.role;

    if (
      typeof familyId !== 'string' ||
      !familyId ||
      !['PARENT', 'GUARDIAN', 'VIEWER'].includes(role)
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Invitation data is incomplete or invalid.'
      );
    }

        const acceptedFamilyId = await db.runTransaction(
          async (transaction) => {
            const latestInviteSnapshot =
              await transaction.get(inviteRef);

            const familyRef = db
              .collection('families')
              .doc(familyId);

            const familySnapshot =
              await transaction.get(familyRef);

            if (!latestInviteSnapshot.exists) {
              throw new functions.https.HttpsError(
                'not-found',
                'Invitation no longer exists.'
              );
            }

            if (!familySnapshot.exists) {
              throw new functions.https.HttpsError(
                'not-found',
                'Family not found.'
              );
            }

            const latestInviteData =
              latestInviteSnapshot.data() || {};

            if (
              typeof latestInviteData.tokenHash !== 'string' ||
              latestInviteData.tokenHash !== token
            ) {
              throw new functions.https.HttpsError(
                'permission-denied',
                'Invitation token is invalid.'
              );
            }

            if (
              latestInviteData.status !== 'PENDING' ||
              latestInviteData.familyId !== familyId ||
              typeof latestInviteData.email !== 'string' ||
              latestInviteData.email.toLowerCase() !== email
            ) {
              throw new functions.https.HttpsError(
                'failed-precondition',
                'Invitation changed or is no longer valid.'
              );
            }

            const latestExpiry =
              typeof latestInviteData.expiresAt?.toMillis ===
              'function'
                ? latestInviteData.expiresAt.toMillis()
                : 0;

            if (latestExpiry <= Date.now()) {
              throw new functions.https.HttpsError(
                'deadline-exceeded',
                'This invitation has expired.'
              );
            }

            const familyData =
              familySnapshot.data() || {};

            const memberUids = Array.isArray(
              familyData.memberUids
            )
              ? familyData.memberUids
              : [];

            const familyInvites = Array.isArray(
              familyData.invites
            )
              ? familyData.invites
              : [];

            const updatedInvites = familyInvites.map(
              (invite: any) =>
                invite?.id === inviteId
                  ? {
                      ...invite,
                      status: 'ACCEPTED'
                    }
                  : invite
            );

            const familyUpdate: any = {
              memberUids:
                admin.firestore.FieldValue.arrayUnion(uid),
              invites: updatedInvites
            };
                if (role !== 'VIEWER') {
                  familyUpdate.managerUids =
                    admin.firestore.FieldValue.arrayUnion(uid);
                }

            if (!memberUids.includes(uid)) {
              familyUpdate.members =
                admin.firestore.FieldValue.arrayUnion({
                  uid,
                  email,
                  displayName,
                  role,
                  joinedAt:
                    admin.firestore.Timestamp.now(),
                  invitedBy:
                    latestInviteData.invitedBy || null,
                  assignedChildren: ['*']
                });
            }

            transaction.update(familyRef, familyUpdate);

            transaction.update(inviteRef, {
              status: 'ACCEPTED',
              acceptedAt:
                admin.firestore.FieldValue.serverTimestamp(),
              acceptedByUid: uid
            });

            const parentRef = db
              .collection('parents')
              .doc(uid);

            transaction.set(
              parentRef,
              {
                uid,
                email,
                familyId,
                role,
                displayName,
                dateOfBirth,
                lastLoginAt:
                  admin.firestore.FieldValue
                    .serverTimestamp(),
                updatedAt:
                  admin.firestore.FieldValue
                    .serverTimestamp()
              },
              { merge: true }
            );

            return familyId;
          }
        );

        return {
          success: true,
          familyId: acceptedFamilyId
        };
  });

export const cleanupUnverifiedAccounts = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "Europe/Berlin",
  },
  async () => {
    const authService = admin.auth();
    const firestore = admin.firestore();
    const cutoffTime = Date.now() - 48 * 60 * 60 * 1000;

    let pageToken: string | undefined;

    do {
      const result = await authService.listUsers(1000, pageToken);

      for (const user of result.users) {
        const isPasswordUser = user.providerData.some(
          (provider) => provider.providerId === "password"
        );

        const createdAt = new Date(
          user.metadata.creationTime
        ).getTime();

        const shouldDelete =
          isPasswordUser &&
          !user.emailVerified &&
          createdAt < cutoffTime;

        if (!shouldDelete) continue;

        try {
          await firestore
            .collection("parents")
            .doc(user.uid)
            .delete();

          await authService.deleteUser(user.uid);

          console.log(
            `Deleted unverified account: ${user.uid}`
          );
        } catch (error) {
          console.error(
            `Failed to delete unverified account: ${user.uid}`,
            error
          );
        }
      }

      pageToken = result.pageToken;
    } while (pageToken);
  }
);

async function deleteLinkedDocuments(
  collectionName: string,
  fieldName: string,
  value: string
): Promise<void> {
  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where(fieldName, '==', value)
      .limit(100)
      .get();

    if (snapshot.empty) {
      break;
    }

    for (const document of snapshot.docs) {
      await db.recursiveDelete(document.ref);
    }
  }
}
async function deleteAuthUserIfExists(
  uid: string
): Promise<void> {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
  }
}

function escapeExportHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatExportLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatExportDisplayValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Not provided';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function renderExportFields(
  data: Record<string, any>,
  excludedKeys: string[] = []
): string {
  const rows = Object.entries(data)
    .filter(([key]) =>
      !excludedKeys.includes(key)
    )
    .filter(([, value]) =>
      !Array.isArray(value) &&
      (
        value === null ||
        typeof value !== 'object'
      )
    )
    .map(([key, value]) => `
      <div class="field-row">
        <div class="field-label">
          ${escapeExportHtml(
            formatExportLabel(key)
          )}
        </div>

        <div class="field-value">
          ${escapeExportHtml(
            formatExportDisplayValue(value)
          )}
        </div>
      </div>
    `)
    .join('');

  return rows || `
    <p class="empty">
      No general information available.
    </p>
  `;
}

function renderExportDocumentCards(
  documents: any[],
  emptyMessage: string
): string {
  if (
    !Array.isArray(documents) ||
    documents.length === 0
  ) {
    return `
      <p class="empty">
        ${escapeExportHtml(emptyMessage)}
      </p>
    `;
  }

  return documents
    .map((document, index) => {
      const data =
        document?.data &&
        typeof document.data === 'object'
          ? document.data
          : {};

      const displayName =
        data.displayName ||
        data.name ||
        data.childName ||
        data.deviceName ||
        data.email ||
        `Record ${index + 1}`;

      return `
        <article class="record-card">
          <h3>
            ${escapeExportHtml(displayName)}
          </h3>

          ${renderExportFields(data)}

          <div class="field-row">
            <div class="field-label">
              Record ID
            </div>

            <div class="field-value">
              ${escapeExportHtml(
                document?.id || 'Not provided'
              )}
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderNotificationReport(
  notifications: any[]
): string {
  if (
    !Array.isArray(notifications) ||
    notifications.length === 0
  ) {
    return `
      <p class="empty">
        No notifications or alerts found.
      </p>
    `;
  }

  const typeCounts: Record<string, number> = {};

  for (const notification of notifications) {
    const data =
      notification?.data &&
      typeof notification.data === 'object'
        ? notification.data
        : {};

    const type =
      typeof data.type === 'string' &&
      data.type.trim()
        ? data.type
        : 'OTHER';

    typeCounts[type] =
      (typeCounts[type] || 0) + 1;
  }

  const summaryRows = Object.entries(typeCounts)
    .sort((first, second) =>
      second[1] - first[1]
    )
    .map(([type, count]) => `
      <div class="type-row">
        <span>
          ${escapeExportHtml(
            formatExportLabel(type)
          )}
        </span>

        <strong>
          ${count}
        </strong>
      </div>
    `)
    .join('');

  const recentNotifications =
    notifications.slice(0, 100);

  const notificationCards =
    recentNotifications
      .map((notification, index) => {
        const data =
          notification?.data &&
          typeof notification.data === 'object'
            ? notification.data
            : {};

        const title =
          data.title ||
          data.type ||
          `Notification ${index + 1}`;

        return `
          <article class="record-card">
            <h3>
              ${escapeExportHtml(
                formatExportLabel(
                  String(title)
                )
              )}
            </h3>

            ${renderExportFields(data)}

            <div class="field-row">
              <div class="field-label">
                Record ID
              </div>

              <div class="field-value">
                ${escapeExportHtml(
                  notification?.id ||
                  'Not provided'
                )}
              </div>
            </div>
          </article>
        `;
      })
      .join('');

  return `
    <h3>Alert summary by type</h3>

    <div class="type-summary">
      ${summaryRows}
    </div>

    <h3 class="subheading">
      First ${recentNotifications.length}
      notification records
    </h3>

    <p class="note">
      The complete set of
      ${notifications.length} notification records
      is available in the JSON file included in
      this ZIP archive.
    </p>

    <div class="record-grid">
      ${notificationCards}
    </div>
  `;
}


function createReadableExportHtml(
  exportPayload: Record<string, any>
): string {
  const familyData =
    exportPayload.family?.data &&
    typeof exportPayload.family.data === 'object'
      ? exportPayload.family.data
      : {};

  const parents =
    Array.isArray(exportPayload.parents)
      ? exportPayload.parents
      : [];

  const children =
    Array.isArray(exportPayload.children)
      ? exportPayload.children
      : [];

  const devices =
    Array.isArray(exportPayload.devices)
      ? exportPayload.devices
      : [];

  const notifications =
    Array.isArray(exportPayload.notifications)
      ? exportPayload.notifications
      : [];


const childCount = children.length;
const parentCount = parents.length;
const deviceCount = devices.length;
const notificationCount = notifications.length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>KidsGuard Family Data Export</title>
  <style>
    body {
      margin: 0;
      background: #f4f7fb;
      color: #172033;
      font-family: Arial, sans-serif;
      line-height: 1.5;
    }

    main {
      max-width: 1000px;
      margin: 0 auto;
      padding: 32px 18px 60px;
    }

    header,
    details {
      background: white;
      border: 1px solid #dce3ee;
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, .05);
    }

    header {
      padding: 26px;
      margin-bottom: 18px;
    }

    h1 {
      margin: 0 0 8px;
      color: #2457d6;
    }

    .warning {
      padding: 12px;
      border-radius: 8px;
      background: #fff4e5;
      color: #7a4700;
    }

    .summary {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 18px 0;
    }

    .card {
      background: #edf3ff;
      border-radius: 10px;
      padding: 14px;
    }

    .number {
      display: block;
      font-size: 24px;
      font-weight: bold;
      color: #2457d6;
    }

    details {
      margin-top: 14px;
      padding: 18px;
    }

    summary {
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      color: #172033;
    }

    .section-content {
      margin-top: 18px;
    }

    .record-grid {
      display: grid;
      gap: 14px;
    }

    .record-card {
      padding: 18px;
      border: 1px solid #dce3ee;
      border-radius: 12px;
      background: #f8faff;
    }

    .record-card h3 {
      margin: 0 0 14px;
      color: #2457d6;
    }

    .field-row {
      display: grid;
      grid-template-columns: minmax(130px, 220px) 1fr;
      gap: 14px;
      padding: 9px 0;
      border-bottom: 1px solid #e6ebf2;
    }

    .field-row:last-child {
      border-bottom: 0;
    }

    .field-label {
      font-weight: bold;
      color: #536079;
    }

    .field-value {
      overflow-wrap: anywhere;
      color: #172033;
    }

    .type-summary {
      display: grid;
      gap: 8px;
      margin-bottom: 22px;
    }

    .type-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #edf3ff;
    }

    .subheading {
      margin-top: 26px;
    }

    .note {
      padding: 12px;
      border-radius: 8px;
      background: #eef8ff;
      color: #31536f;
    }

    .empty {
      color: #68758a;
      font-style: italic;
    }

    @media (max-width: 600px) {
      .field-row {
        grid-template-columns: 1fr;
        gap: 3px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>KidsGuard Family Data Export</h1>
      <p>
        Generated:
        ${escapeExportHtml(exportPayload.generatedAt)}
      </p>

      <p class="warning">
        This report contains private family and child data.
        Store it securely and do not share it publicly.
      </p>

      <div class="summary">
        <div class="card">
          <span class="number">${parentCount}</span>
          Parents
        </div>
        <div class="card">
          <span class="number">${childCount}</span>
          Children
        </div>
        <div class="card">
          <span class="number">${deviceCount}</span>
          Devices
        </div>
        <div class="card">
          <span class="number">${notificationCount}</span>
          Notifications
        </div>
      </div>
    </header>

    <details open>
      <summary>Family information</summary>

      <div class="section-content">
        <article class="record-card">
          ${renderExportFields(
            familyData,
            [
              'members',
              'invites',
              'childDeviceIds',
              'memberUids',
              'managerUids'
            ]
          )}
        </article>
      </div>
    </details>

    <details>
      <summary>
        Parent profiles (${parentCount})
      </summary>

      <div class="section-content record-grid">
        ${renderExportDocumentCards(
          parents,
          'No parent profiles found.'
        )}
      </div>
    </details>

    <details>
      <summary>
        Child profiles and activity (${childCount})
      </summary>

      <div class="section-content record-grid">
        ${renderExportDocumentCards(
          children,
          'No child profiles found.'
        )}
      </div>
    </details>

    <details>
      <summary>
        Registered devices (${deviceCount})
      </summary>

      <div class="section-content record-grid">
        ${renderExportDocumentCards(
          devices,
          'No registered devices found.'
        )}
      </div>
    </details>

    <details>
      <summary>
        Notifications and alerts
        (${notificationCount})
      </summary>

      <div class="section-content">
        ${renderNotificationReport(
          notifications
        )}
      </div>
    </details>
  </main>
</body>
</html>`;
}



function makeExportValueJsonSafe(value: any): any {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof admin.firestore.GeoPoint) {
    return {
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  if (
    value instanceof
    admin.firestore.DocumentReference
  ) {
    return value.path;
  }

  if (Array.isArray(value)) {
    return value.map(makeExportValueJsonSafe);
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, nestedValue]) => [
          key,
          makeExportValueJsonSafe(nestedValue)
        ]
      )
    );
  }

  return value;
}

async function exportDocumentWithSubcollections(
  documentSnapshot:
    admin.firestore.DocumentSnapshot
): Promise<Record<string, any>> {
  const exportedDocument: Record<string, any> = {
    id: documentSnapshot.id,
    data: makeExportValueJsonSafe(
      documentSnapshot.data() || {}
    ),
    subcollections: {}
  };

  const subcollections =
    await documentSnapshot.ref.listCollections();

  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get();

    exportedDocument.subcollections[
      subcollection.id
    ] = snapshot.docs.map(
      (nestedDocument) => ({
        id: nestedDocument.id,
        data: makeExportValueJsonSafe(
          nestedDocument.data()
        )
      })
    );
  }

  return exportedDocument;
}

export const requestFamilyDataExport =
  functions
    .runWith({
      timeoutSeconds: 300,
      memory: '1GB'
    })
    .https.onCall(
        async (_data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be signed in.'
        );
      }

      if (
        context.auth.token.email_verified !== true
      ) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Your email must be verified.'
        );
      }

      const uid = context.auth.uid;

      const parentSnapshot = await db
        .collection('parents')
        .doc(uid)
        .get();

      if (!parentSnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Parent profile not found.'
        );
      }

      const familyId =
        parentSnapshot.data()?.familyId;

      if (
        typeof familyId !== 'string' ||
        !familyId
      ) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No family is connected to this account.'
        );
      }

      const familySnapshot = await db
        .collection('families')
        .doc(familyId)
        .get();

      if (!familySnapshot.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Family not found.'
        );
      }

      const exportRateLimitRef = db
        .collection('familyExportRateLimits')
        .doc(uid);

      const exportRateLimitMs =
        15 * 60 * 1000;

      await db.runTransaction(
        async (transaction) => {
          const rateLimitSnapshot =
            await transaction.get(
              exportRateLimitRef
            );

          const lastRequestedAt =
            rateLimitSnapshot
              .data()
              ?.lastRequestedAt;

          if (
            lastRequestedAt instanceof
              admin.firestore.Timestamp
          ) {
            const elapsedMs =
              Date.now() -
              lastRequestedAt.toMillis();

            if (elapsedMs < exportRateLimitMs) {
              const remainingMinutes =
                Math.max(
                  1,
                  Math.ceil(
                    (
                      exportRateLimitMs -
                      elapsedMs
                    ) /
                    60000
                  )
                );

              throw new functions.https.HttpsError(
                'resource-exhausted',
                `Please wait ${remainingMinutes} minute(s) before requesting another export.`
              );
            }
          }

          transaction.set(
            exportRateLimitRef,
            {
              uid,
              familyId,
              lastRequestedAt:
                admin.firestore.Timestamp.now()
            },
            {
              merge: true
            }
          );
        }
      );

try {
      const parentsSnapshot = await db
        .collection('parents')
        .where('familyId', '==', familyId)
        .get();

      const childrenSnapshot = await db
        .collection('children')
        .where('familyId', '==', familyId)
        .get();

      const devicesSnapshot = await db
        .collection('devices')
        .where('familyId', '==', familyId)
        .get();

      const familyExport =
        await exportDocumentWithSubcollections(
          familySnapshot
        );

      const parentsExport = await Promise.all(
        parentsSnapshot.docs.map(
          exportDocumentWithSubcollections
        )
      );

      const childrenExport = await Promise.all(
        childrenSnapshot.docs.map(
          exportDocumentWithSubcollections
        )
      );

      const devicesExport = await Promise.all(
        devicesSnapshot.docs.map(
          exportDocumentWithSubcollections
        )
      );

      const parentNotifications =
        await Promise.all(
          parentsSnapshot.docs.map(
            async (parentDocument) => {
              const snapshot = await db
                .collection('notifications')
                .where(
                  'userId',
                  '==',
                  parentDocument.id
                )
                .get();

              return Promise.all(
                snapshot.docs.map(
                  exportDocumentWithSubcollections
                )
              );
            }
          )
        );

      const generatedAt = new Date();
      const expiresAt = new Date(
        generatedAt.getTime() +
          15 * 60 * 1000
      );

      const exportPayload = {
        exportVersion: 1,
        generatedAt:
          generatedAt.toISOString(),
        requestedBy: uid,
        familyId,
        family: familyExport,
        parents: parentsExport,
        children: childrenExport,
        devices: devicesExport,
        notifications:
          parentNotifications.flat()
      };

const jsonContent =
  JSON.stringify(exportPayload, null, 2);

const htmlContent =
  createReadableExportHtml(exportPayload);


      const timestamp =
        generatedAt
          .toISOString()
          .replace(/[:.]/g, '-');

      const fileName =
        `kidsguard-family-data-${timestamp}.zip`;

      const storagePath =
        `family-exports/${familyId}/${uid}/${fileName}`;

      const file = bucket.file(storagePath);
      const downloadToken = randomUUID();

      await new Promise<void>(
        (resolve, reject) => {
          const output =
            file.createWriteStream({
              resumable: false,
              metadata: {
                contentType: 'application/zip',
                cacheControl:
                  'private, no-store, max-age=0',
                metadata: {
                  temporary: 'true',
                  expiresAt:
                    expiresAt.toISOString(),
                  familyId,
                  requestedBy: uid,
                  firebaseStorageDownloadTokens:
                    downloadToken
                }
              }
            });

         const archive = new ZipArchive({
           zlib: {
             level: 9
           }
         });

          output.on('finish', resolve);
          output.on('error', reject);
          archive.on('error', reject);

          archive.pipe(output);

          archive.append(htmlContent, {
            name: 'KidsGuard-Family-Data.html'
          });

          archive.append(jsonContent, {
            name: 'KidsGuard-Family-Data.json'
          });

          void archive.finalize();
        }
      );



      const downloadUrl =
        `https://firebasestorage.googleapis.com/v0/b/` +
        `${encodeURIComponent(bucket.name)}/o/` +
        `${encodeURIComponent(storagePath)}` +
        `?alt=media&token=` +
        `${encodeURIComponent(downloadToken)}`;

      return {
        success: true,
        fileName,
        downloadUrl,
        expiresAt:
          expiresAt.toISOString()
      };
      } catch (error) {
        try {
          await exportRateLimitRef.delete();
        } catch (cleanupError) {
          console.error(
            'Failed to clear export rate limit:',
            cleanupError
          );
        }

        console.error(
          'Family data export failed:',
          error
        );

        if (
          error instanceof
            functions.https.HttpsError
        ) {
          throw error;
        }

        throw new functions.https.HttpsError(
          'internal',
          'The family data export could not be completed. Please try again.'
        );
      }
      }
      );


export const requestFamilyDeletion =
  functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in.'
      );
    }

    if (context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Your email must be verified.'
      );
    }

    const uid = context.auth.uid;
    const authTime = Number(
      context.auth.token.auth_time || 0
    );
    const tokenAgeSeconds =
      Math.floor(Date.now() / 1000) - authTime;

    if (tokenAgeSeconds > 600) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Please sign in again before deleting your account.'
      );
    }

    const parentRef = db.collection('parents').doc(uid);
    const parentSnapshot = await parentRef.get();

    if (!parentSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Parent profile not found.'
      );
    }

    const familyId = parentSnapshot.data()?.familyId;

    if (
      typeof familyId !== 'string' ||
      !familyId
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No family is connected to this account.'
      );
    }

    const familyRef =
      db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();

    if (!familySnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Family not found.'
      );
    }

    const familyData = familySnapshot.data() || {};

    if (familyData.ownerId !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only the family owner can delete the family.'
      );
    }

    if (
      familyData.deletionStatus ===
      'PENDING_DELETION'
    ) {
      return {
        success: true,
        alreadyPending: true,
        deletionScheduledAt:
          familyData.deletionScheduledAt
      };
    }

    const requestedAt =
      admin.firestore.Timestamp.now();
    const scheduledAt =
      admin.firestore.Timestamp.fromMillis(
        requestedAt.toMillis() +
          30 * 24 * 60 * 60 * 1000
      );

    await familyRef.update({
      deletionStatus: 'PENDING_DELETION',
      deletionRequestedAt: requestedAt,
      deletionScheduledAt: scheduledAt,
      deletionRequestedBy: uid
    });

    return {
      success: true,
      alreadyPending: false,
      deletionScheduledAt: scheduledAt
    };
  });

// if parent login again the naccount will stay remain
export const cancelFamilyDeletion =
  functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in.'
      );
    }

    const uid = context.auth.uid;
    const parentSnapshot = await db
      .collection('parents')
      .doc(uid)
      .get();

    if (!parentSnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Parent profile not found.'
      );
    }

    const familyId = parentSnapshot.data()?.familyId;

    if (
      typeof familyId !== 'string' ||
      !familyId
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No family is connected to this account.'
      );
    }

    const familyRef =
      db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();

    if (!familySnapshot.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Family not found.'
      );
    }

    const familyData = familySnapshot.data() || {};

    if (familyData.ownerId !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only the family owner can cancel family deletion.'
      );
    }

    if (
      familyData.deletionStatus !==
      'PENDING_DELETION'
    ) {
      return {
        success: true,
        wasPending: false
      };
    }

    await familyRef.update({
      deletionStatus: 'ACTIVE',
      deletionRequestedAt:
        admin.firestore.FieldValue.delete(),
      deletionScheduledAt:
        admin.firestore.FieldValue.delete(),
      deletionRequestedBy:
        admin.firestore.FieldValue.delete()
    });

    return {
      success: true,
      wasPending: true
    };
  });

export const cleanupExpiredFamilyExports =
onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Europe/Berlin",
  },
  async () => {
    const [files] =
      await storageBucket.getFiles({
        prefix: "family-exports/",
      });

    const now = Date.now();

    for (const file of files) {
      try {
        const [metadata] =
          await file.getMetadata();

        const expiresAt =
          metadata.metadata?.expiresAt;

        if (
          typeof expiresAt !== "string"
        ) {
          console.warn(
            `Export file has no expiry: ${file.name}`
          );
          continue;
        }

        const expiryTime =
          new Date(expiresAt).getTime();

        if (
          Number.isNaN(expiryTime) ||
          expiryTime > now
        ) {
          continue;
        }

        await file.delete();

        console.log(
          `Expired export deleted: ${file.name}`
        );
      } catch (error: any) {
        if (error?.code === 404) {
          continue;
        }

        console.error(
          `Failed to delete export ${file.name}:`,
          error
        );
      }
    }
  }
);



// account scheduled cleanup
export const cleanupDeletedFamilies = onSchedule(
  {
    schedule: "every day 04:00",
    timeZone: "Europe/Berlin",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const pendingFamilies = await db
      .collection("families")
      .where(
        "deletionStatus",
        "==",
        "PENDING_DELETION"
      )
      .limit(100)
      .get();

    for (const familyDocument of pendingFamilies.docs) {
      try {
        const familyData =
          familyDocument.data() || {};
        const scheduledAt =
          familyData.deletionScheduledAt;

        if (
          typeof scheduledAt?.toMillis !==
            "function" ||
          scheduledAt.toMillis() > now.toMillis()
        ) {
          continue;
        }

        const familyId = familyDocument.id;
        const ownerUid = familyData.ownerId;

        if (
          typeof ownerUid !== "string" ||
          !ownerUid
        ) {
          console.error(
            `Deletion skipped: family ${familyId} has no ownerId.`
          );
          continue;
        }

        const pairingSnapshot = await db
          .collection("pairingCodes")
          .where("familyId", "==", familyId)
          .get();

        const childIds = new Set<string>(
          Array.isArray(familyData.childDeviceIds)
            ? familyData.childDeviceIds.filter(
                (id: unknown): id is string =>
                  typeof id === "string"
              )
            : []
        );

        const childAuthUids = new Set<string>();
        const deviceIds = new Set<string>();

        for (const pairingDocument of
          pairingSnapshot.docs) {
          const pairingData =
            pairingDocument.data();

          if (
            typeof pairingData.childId ===
            "string"
          ) {
            childIds.add(pairingData.childId);
          }

          if (
            typeof pairingData.firebaseUid ===
            "string"
          ) {
            childAuthUids.add(
              pairingData.firebaseUid
            );
          }

          if (
            typeof pairingData.deviceId ===
            "string"
          ) {
            deviceIds.add(pairingData.deviceId);
          }
        }

        for (const childId of childIds) {
          const childRef = db
            .collection("children")
            .doc(childId);

          const [childSnapshot, statusSnapshot] =
            await Promise.all([
              childRef.get(),
              childRef
                .collection("status")
                .doc("current")
                .get(),
            ]);

          const childData =
            childSnapshot.data() || {};
          const statusData =
            statusSnapshot.data() || {};

          const childFirebaseUid =
            childData.firebaseUid ||
            statusData.firebaseUid;

          const childDeviceId =
            childData.deviceId ||
            statusData.deviceId;

          if (
            typeof childFirebaseUid === "string"
          ) {
            childAuthUids.add(childFirebaseUid);
          }

          if (
            typeof childDeviceId === "string"
          ) {
            deviceIds.add(childDeviceId);
          }

          if (childSnapshot.exists) {
            await db.recursiveDelete(childRef);
          }

          const childLinkedCollections = [
            "notifications",
            "sosEvents",
            "dailySummaries",
            "routeDeviations",
            "auditLogs",
          ];

          for (const collectionName of
            childLinkedCollections) {
            await deleteLinkedDocuments(
              collectionName,
              "childId",
              childId
            );
          }
        }

        for (const deviceId of deviceIds) {
          const deviceRef = db
            .collection("devices")
            .doc(deviceId);

          const deviceSnapshot =
            await deviceRef.get();

          if (deviceSnapshot.exists) {
            await db.recursiveDelete(deviceRef);
          }
        }

        const familyLinkedCollections = [
          "pairingCodes",
          "notifications",
          "auditLogs",
          "supportTickets",
          "familyInvitations",
          "safeZones",
          "sosEvents",
          "dailySummaries",
          "routeDeviations",
        ];

        for (const collectionName of
          familyLinkedCollections) {
          await deleteLinkedDocuments(
            collectionName,
            "familyId",
            familyId
          );
        }

        const members = Array.isArray(
          familyData.members
        )
          ? familyData.members
          : [];

        for (const member of members) {
          const memberUid = member?.uid;

          if (
            typeof memberUid !== "string" ||
            !memberUid ||
            memberUid === ownerUid
          ) {
            continue;
          }

          const memberRef = db
            .collection("parents")
            .doc(memberUid);
          const memberSnapshot =
            await memberRef.get();

          if (
            memberSnapshot.exists &&
            memberSnapshot.data()?.familyId ===
              familyId
          ) {
            await memberRef.update({
              familyId: null,
              role:
                admin.firestore.FieldValue.delete(),
            });
          }
        }

        await deleteLinkedDocuments(
          "notifications",
          "userId",
          ownerUid
        );

        for (const childUid of childAuthUids) {
          await deleteAuthUserIfExists(childUid);
        }

        await db.recursiveDelete(
          familyDocument.ref
        );

        const ownerRef = db
          .collection("parents")
          .doc(ownerUid);
        const ownerSnapshot = await ownerRef.get();

        if (ownerSnapshot.exists) {
          await db.recursiveDelete(ownerRef);
        }

        await deleteAuthUserIfExists(ownerUid);

        console.log(
          `Family ${familyId} permanently deleted.`
        );
      } catch (error) {
        console.error(
          `Failed to permanently delete family ${familyDocument.id}:`,
          error
        );
      }
    }
  }
);





