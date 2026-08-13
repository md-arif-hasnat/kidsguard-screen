"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDeletedFamilies = exports.cleanupExpiredFamilyExports = exports.cancelFamilyDeletion = exports.requestFamilyDeletion = exports.requestFamilyDataExport = exports.cleanupUnverifiedAccounts = exports.acceptFamilyInvitation = exports.acceptPairingCode = exports.onPermissionAlertCreated = exports.onTamperAlertCreated = exports.checkOfflineChildren = exports.onProtectionModeChanged = exports.onFamilyUpdated = exports.onInviteAccepted = exports.onInviteCreated = exports.onStatusChanged = exports.onSosResolved = exports.onSosCreated = exports.onInstalledAppCreated = exports.onActivityCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const crypto_1 = require("crypto");
const archiver_1 = require("archiver");
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();
const storageBucket = admin.storage().bucket();
function serializeExportValue(value) {
    if (value instanceof
        admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }
    if (value instanceof
        admin.firestore.GeoPoint) {
        return {
            latitude: value.latitude,
            longitude: value.longitude,
        };
    }
    if (Array.isArray(value)) {
        return value.map(serializeExportValue);
    }
    if (value !== null &&
        typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
            key,
            serializeExportValue(nestedValue),
        ]));
    }
    return value;
}
async function exportDocumentTree(documentRef) {
    const documentSnapshot = await documentRef.get();
    if (!documentSnapshot.exists) {
        return null;
    }
    const exportedDocument = {
        id: documentSnapshot.id,
        path: documentSnapshot.ref.path,
        data: serializeExportValue(documentSnapshot.data() || {}),
    };
    const subcollections = await documentRef.listCollections();
    if (subcollections.length > 0) {
        const exportedSubcollections = {};
        for (const subcollection of subcollections) {
            const subcollectionSnapshot = await subcollection.get();
            const exportedDocuments = await Promise.all(subcollectionSnapshot.docs.map((nestedDocument) => exportDocumentTree(nestedDocument.ref)));
            exportedSubcollections[subcollection.id] = exportedDocuments.filter((value) => value !== null);
        }
        exportedDocument.subcollections =
            exportedSubcollections;
    }
    return exportedDocument;
}
async function exportLinkedDocuments(collectionName, fieldName, fieldValue) {
    const snapshot = await db
        .collection(collectionName)
        .where(fieldName, "==", fieldValue)
        .get();
    const exportedDocuments = await Promise.all(snapshot.docs.map((document) => exportDocumentTree(document.ref)));
    return exportedDocuments.filter((value) => value !== null);
}
async function getExportFamilyOwner(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
    }
    if (context.auth.token.email_verified !==
        true) {
        throw new functions.https.HttpsError("permission-denied", "Your email must be verified.");
    }
    const uid = context.auth.uid;
    const parentSnapshot = await db
        .collection("parents")
        .doc(uid)
        .get();
    if (!parentSnapshot.exists) {
        throw new functions.https.HttpsError("not-found", "Parent profile not found.");
    }
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== "string" ||
        !familyId) {
        throw new functions.https.HttpsError("failed-precondition", "No family is connected to this account.");
    }
    const familyRef = db
        .collection("families")
        .doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError("not-found", "Family not found.");
    }
    if (familySnapshot.data()?.ownerId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Only the Family Owner can export family data.");
    }
    return {
        uid,
        familyId,
        familyRef,
        familySnapshot,
    };
}
function mergeExportDocuments(...documentGroups) {
    const uniqueDocuments = new Map();
    for (const group of documentGroups) {
        for (const document of group) {
            const path = typeof document.path === "string"
                ? document.path
                : JSON.stringify(document);
            uniqueDocuments.set(path, document);
        }
    }
    return Array.from(uniqueDocuments.values());
}
exports.onActivityCreated = functions.firestore
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
exports.onInstalledAppCreated = functions.firestore
    .document("children/{childId}/installedApps/{packageName}")
    .onCreate(async (snapshot, context) => {
    const app = snapshot.data();
    const childId = String(context.params.childId || "");
    const packageName = String(context.params.packageName || "");
    if (!childId || !packageName) {
        console.warn("Missing childId or packageName");
        return;
    }
    const appName = String(app?.appName ||
        app?.name ||
        app?.applicationName ||
        packageName);
    const childSnapshot = await db
        .collection("children")
        .doc(childId)
        .get();
    const childData = childSnapshot.data();
    const childName = String(childData?.childName ||
        childData?.name ||
        "Your child");
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
        clickAction: `/dashboard/${encodeURIComponent(childId)}` +
            `?tab=installed-apps&pkg=${encodeURIComponent(packageName)}`,
    });
});
exports.onSosCreated = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onCreate(async (snapshot, context) => {
    const { childId, eventId } = context.params;
    const data = snapshot.data();
    if (!data)
        return;
    const childSnap = await db.collection('children').doc(childId).get();
    const childName = childSnap.data()?.name || 'Your child';
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
                components.forEach((c) => {
                    if (c.types.includes('route'))
                        street = c.long_name;
                    if (c.types.includes('street_number'))
                        houseNumber = c.long_name;
                    if (c.types.includes('locality'))
                        city = c.long_name;
                    if (c.types.includes('postal_code'))
                        postalCode = c.long_name;
                    if (c.types.includes('country'))
                        country = c.long_name;
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
        }
        catch (error) {
            console.error("Reverse geocoding failed", error);
        }
    }
});
exports.onSosResolved = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { childId, eventId } = context.params;
    if (before.status !== 'RESOLVED' && after.status === 'RESOLVED') {
        const now = Date.now();
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
exports.onStatusChanged = functions.firestore
    .document('children/{childId}/status/current')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { childId } = context.params;
    if (!before || !after)
        return;
    const childName = after.childName || 'Child';
    if (after.batteryPercent <= 10 && before.batteryPercent > 10) {
        await broadcastToParents(childId, {
            title: `🪫 Critical Battery: ${childName}`,
            body: `${childName}'s device is at ${after.batteryPercent}%. Charge immediately.`,
            type: 'BATTERY',
            childId: childId,
            clickAction: `/dashboard/${childId}`
        });
    }
    else if (after.batteryPercent <= 20 && before.batteryPercent > 20) {
        await broadcastToParents(childId, {
            title: `🔋 Low Battery: ${childName}`,
            body: `${childName}'s device is at ${after.batteryPercent}%.`,
            type: 'BATTERY',
            childId: childId,
            clickAction: `/dashboard/${childId}`
        });
    }
    if (after.online === false && before.online === true) {
        await broadcastToParents(childId, {
            title: `☁️ ${childName} is Offline`,
            body: 'Connection to the child device was lost.',
            type: 'DEVICE',
            childId: childId,
            clickAction: `/dashboard/${childId}`
        });
    }
    else if (after.online === true && before.online === false) {
        await broadcastToParents(childId, {
            title: `🌐 ${childName} is Online`,
            body: 'Device has reconnected to the network.',
            type: 'DEVICE',
            childId: childId,
            clickAction: `/dashboard/${childId}`
        });
    }
});
exports.onInviteCreated = functions.firestore
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
exports.onInviteAccepted = functions.firestore
    .document('familyInvitations/{inviteId}')
    .onUpdate(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();
    if (after.status === 'ACCEPTED' && before.status === 'PENDING') {
        await notifyParent(after.invitedByUid, {
            title: '🤝 Invitation Accepted',
            body: `${after.invitedEmail} has joined the family vault as a ${after.invitedRole}.`,
            type: 'PAIRING',
            childId: '',
            clickAction: '/settings/family'
        });
    }
});
exports.onFamilyUpdated = functions.firestore
    .document('families/{familyId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after)
        return;
    const newChildren = after.childDeviceIds.filter((id) => !before.childDeviceIds.includes(id));
    for (const childId of newChildren) {
        const childSnap = await db.collection('children').doc(childId).get();
        const childName = childSnap.data()?.name || 'New Device';
        const memberUids = after.members.map(m => m.uid);
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
exports.onProtectionModeChanged = functions.firestore
    .document('children/{childId}/protectionModes/{modeId}')
    .onWrite(async (change, context) => {
    const { childId } = context.params;
    const after = change.after.data();
    const before = change.before.data();
    if (!after)
        return;
    if (after.enabled && (!before || !before.enabled)) {
        await broadcastToParents(childId, {
            title: `🛡️ Mode Activated: ${after.name}`,
            body: `Protection rules for ${after.type} are now active.`,
            type: 'SAFE_ZONE',
            childId: childId,
            clickAction: `/dashboard/${childId}`
        });
    }
});
class EmailService {
    static async sendInviteEmail(params) {
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
function formatOfflineDuration(totalMinutes) {
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
function formatBerlinTime(timestampMs) {
    return new Date(timestampMs).toLocaleString("en-GB", {
        timeZone: "Europe/Berlin",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
exports.checkOfflineChildren = functions.pubsub
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
            const [statusSnapshot, settingsSnapshot, stateSnapshot] = await Promise.all([
                statusRef.get(),
                settingsRef.get(),
                offlineStateRef.get(),
            ]);
            if (!statusSnapshot.exists) {
                console.warn(`Offline check skipped: no status found for child ${childId}`);
                continue;
            }
            const status = statusSnapshot.data() || {};
            const settings = settingsSnapshot.data() || {};
            const state = stateSnapshot.data() || {};
            const enabled = settings.enabled !== false;
            const requestedThreshold = Number(settings.thresholdMinutes);
            const thresholdMinutes = Number.isFinite(requestedThreshold) &&
                requestedThreshold >= 10
                ? requestedThreshold
                : 30;
            const lastSeen = Number(status.lastSeen || 0);
            const childName = status.childName ||
                childDocument.data().name ||
                "Child";
            if (!enabled || lastSeen <= 0) {
                continue;
            }
            const elapsedMs = now - lastSeen;
            const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
            const isPastOfflineThreshold = elapsedMinutes >= thresholdMinutes;
            const offlineAlertSent = state.offlineAlertSent === true;
            if (isPastOfflineThreshold &&
                !offlineAlertSent) {
                await offlineStateRef.set({
                    offlineAlertSent: true,
                    offlineSince: lastSeen,
                    offlineAlertSentAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, {
                    merge: true,
                });
                try {
                    await broadcastToParents(childId, {
                        title: `${childName} is offline`,
                        body: `${childName}'s device has been offline since ` +
                            `${formatBerlinTime(lastSeen)} ` +
                            `(${formatOfflineDuration(elapsedMinutes)}).`,
                        type: "DEVICE_OFFLINE",
                        childId,
                        eventId: `offline-${childId}-${lastSeen}`,
                        clickAction: `/dashboard/${childId}`,
                    });
                    console.log(`Offline alert sent for ${childName} (${childId})`);
                }
                catch (error) {
                    await offlineStateRef.set({
                        offlineAlertSent: false,
                        offlineAlertErrorAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, {
                        merge: true,
                    });
                    throw error;
                }
                continue;
            }
            if (!isPastOfflineThreshold &&
                offlineAlertSent) {
                const offlineSince = Number(state.offlineSince || lastSeen);
                const offlineDurationMinutes = Math.max(1, Math.floor((lastSeen - offlineSince) / (60 * 1000)));
                await offlineStateRef.set({
                    offlineAlertSent: false,
                    offlineSince: admin.firestore.FieldValue.delete(),
                    backOnlineAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, {
                    merge: true,
                });
                try {
                    await broadcastToParents(childId, {
                        title: `${childName} is back online`,
                        body: `${childName}'s device reconnected at ` +
                            `${formatBerlinTime(lastSeen)} after being offline for ` +
                            `${formatOfflineDuration(offlineDurationMinutes)}.`,
                        type: "DEVICE_BACK_ONLINE",
                        childId,
                        eventId: `online-${childId}-${lastSeen}`,
                        clickAction: `/dashboard/${childId}`,
                    });
                    console.log(`Back-online alert sent for ${childName} (${childId})`);
                }
                catch (error) {
                    await offlineStateRef.set({
                        offlineAlertSent: true,
                        offlineSince,
                        backOnlineErrorAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, {
                        merge: true,
                    });
                    throw error;
                }
                continue;
            }
            await offlineStateRef.set({
                lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {
                merge: true,
            });
        }
        catch (error) {
            console.error(`Offline check failed for child ${childId}:`, error);
        }
    }
    return null;
});
async function broadcastToParents(childId, payload) {
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
    const members = family.members || [];
    const parentUids = members
        .filter(m => m.role === 'OWNER' || m.role === 'PARENT' || m.role === 'GUARDIAN')
        .map(m => m.uid);
    const promises = parentUids.map(uid => notifyParent(uid, { ...payload, familyId }));
    await Promise.all(promises);
}
exports.onTamperAlertCreated = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    if (data.generatedBy === "cloud_function") {
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
        body: data.body ||
            "Someone tried to disable or remove KidsGuard protection.",
        childId,
        eventId: context.params.notificationId,
        clickAction: data.clickAction || `/dashboard/${childId}`,
        familyId: data.familyId || "",
        skipHistory: true,
    });
    return null;
});
exports.onPermissionAlertCreated = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    if (data.generatedBy === "cloud_function") {
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
        type: String(data.type),
        title: String(data.title || "Permission Alert"),
        body: String(data.body || "A required permission was disabled."),
        childId,
        eventId: context.params.notificationId,
        clickAction: String(data.clickAction || `/dashboard/${childId}`),
        familyId: String(data.familyId || ""),
        skipHistory: true,
    });
    return null;
});
async function notifyParent(uid, payload) {
    const settingsSnap = await db.collection('parents').doc(uid).collection('notificationSettings').doc('current').get();
    const settings = settingsSnap.data();
    const typeMap = {
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
    const devicesSnap = await db.collection('users').doc(uid).collection('notificationTokens').get();
    if (devicesSnap.empty)
        return;
    const enabledDevices = devicesSnap.docs.filter(doc => doc.data().enabled !== false && !!doc.data().token);
    const webTokens = enabledDevices
        .filter(doc => {
        const platform = String(doc.data().platform || "").toLowerCase();
        return platform === "ios-pwa" || platform === "web";
    })
        .map(doc => String(doc.data().token));
    const nativeTokens = enabledDevices
        .filter(doc => {
        const platform = String(doc.data().platform || "").toLowerCase();
        return platform !== "ios-pwa" && platform !== "web";
    })
        .map(doc => String(doc.data().token));
    if (webTokens.length === 0 && nativeTokens.length === 0)
        return;
    console.log("Notification token groups", {
        webCount: webTokens.length,
        nativeCount: nativeTokens.length
    });
    console.log("sending FCM");
    console.log("webTokens:", webTokens.length);
    console.log("nativeTokens:", nativeTokens.length);
    const allTokens = [...webTokens, ...nativeTokens];
    const webPayload = {
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
    const messagingPayload = {
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
        let webResponse = null;
        let nativeResponse = null;
        if (webTokens.length > 0) {
            webResponse = await admin.messaging().sendEachForMulticast(webPayload);
        }
        if (nativeTokens.length > 0) {
            nativeResponse = await admin.messaging().sendEachForMulticast(messagingPayload);
        }
        const successCount = (webResponse?.successCount || 0) +
            (nativeResponse?.successCount || 0);
        console.log(`Successfully sent ${successCount} notifications for parent ${uid}`);
        console.log("FCM sent once");
        const tokensToRemove = [];
        const removeInvalidTokens = (response, tokenList) => {
            if (!response || response.failureCount === 0)
                return;
            response.responses.forEach((resp, idx) => {
                if (resp.success)
                    return;
                const error = resp.error;
                if (error?.code === "messaging/invalid-registration-token" ||
                    error?.code === "messaging/registration-token-not-registered") {
                    const invalidToken = tokenList[idx];
                    const matchingDoc = devicesSnap.docs.find(doc => String(doc.data().token) === invalidToken);
                    if (matchingDoc) {
                        tokensToRemove.push(matchingDoc.ref.delete());
                    }
                }
            });
        };
        removeInvalidTokens(webResponse, webTokens);
        removeInvalidTokens(nativeResponse, nativeTokens);
        await Promise.all(tokensToRemove);
    }
    catch (error) {
        console.error(`Error sending FCM to parent ${uid}:`, error);
    }
}
function getAllowedChildSlots(familyData) {
    const subscription = familyData?.subscription;
    const baseChildSlots = Number.isInteger(subscription?.baseChildSlots) &&
        subscription.baseChildSlots >= 1
        ? subscription.baseChildSlots
        : 1;
    const extraChildSlots = Number.isInteger(subscription?.extraChildSlots) &&
        subscription.extraChildSlots >= 0
        ? subscription.extraChildSlots
        : 0;
    const maxChildSlots = Number.isInteger(subscription?.maxChildSlots) &&
        subscription.maxChildSlots >= 1
        ? subscription.maxChildSlots
        : 10;
    const totalAllowedSlots = baseChildSlots + extraChildSlots;
    return Math.min(maxChildSlots, Math.max(1, totalAllowedSlots));
}
exports.acceptPairingCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to pair a child.');
    }
    const pairingCode = typeof data?.pairingCode === 'string'
        ? data.pairingCode.trim()
        : '';
    const familyId = typeof data?.familyId === 'string'
        ? data.familyId.trim()
        : '';
    if (!/^\d{6}$/.test(pairingCode) || !familyId) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid 6-digit pairing code and familyId are required.');
    }
    const uid = context.auth.uid;
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const familyData = familySnapshot.data() || {};
    const members = Array.isArray(familyData.members)
        ? familyData.members
        : [];
    const canPairChild = familyData.ownerId === uid ||
        members.some((member) => member?.uid === uid &&
            (member?.role === 'OWNER' || member?.role === 'PARENT'));
    if (!canPairChild) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to add a child to this family.');
    }
    const pairingRef = db.collection('pairingCodes').doc(pairingCode);
    const pairingSnapshot = await pairingRef.get();
    if (!pairingSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Pairing code not found.');
    }
    const pairingData = pairingSnapshot.data() || {};
    if (pairingData.used === true) {
        throw new functions.https.HttpsError('already-exists', 'This pairing code has already been used.');
    }
    const expiresAtMillis = typeof pairingData.expiresAt?.toMillis === 'function'
        ? pairingData.expiresAt.toMillis()
        : 0;
    if (expiresAtMillis <= Date.now()) {
        throw new functions.https.HttpsError('deadline-exceeded', 'This pairing code has expired.');
    }
    if (typeof pairingData.childId !== 'string' ||
        !pairingData.childId ||
        typeof pairingData.firebaseUid !== 'string' ||
        !pairingData.firebaseUid) {
        throw new functions.https.HttpsError('failed-precondition', 'Pairing code data is incomplete.');
    }
    const childId = pairingData.childId;
    const deviceId = typeof pairingData.deviceId === 'string' &&
        pairingData.deviceId
        ? pairingData.deviceId
        : pairingData.childDeviceId;
    if (typeof deviceId !== 'string' || !deviceId) {
        throw new functions.https.HttpsError('failed-precondition', 'Pairing code does not contain a valid deviceId.');
    }
    const parentName = typeof data?.parentName === 'string' &&
        data.parentName.trim()
        ? data.parentName.trim()
        : 'Parent';
    const currentChildIds = Array.isArray(familyData.childDeviceIds)
        ? familyData.childDeviceIds.filter((id) => typeof id === 'string')
        : [];
    const childAlreadyPaired = currentChildIds.includes(childId);
    const allowedChildSlots = getAllowedChildSlots(familyData);
    if (!childAlreadyPaired &&
        currentChildIds.length >= allowedChildSlots) {
        throw new functions.https.HttpsError('resource-exhausted', `Your subscription allows ${allowedChildSlots} child device(s).`);
    }
    const pairingResult = await db.runTransaction(async (transaction) => {
        const latestFamilySnapshot = await transaction.get(familyRef);
        const latestPairingSnapshot = await transaction.get(pairingRef);
        if (!latestFamilySnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Family not found during pairing.');
        }
        if (!latestPairingSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Pairing code not found during pairing.');
        }
        const latestFamilyData = latestFamilySnapshot.data() || {};
        const latestPairingData = latestPairingSnapshot.data() || {};
        const latestMembers = Array.isArray(latestFamilyData.members)
            ? latestFamilyData.members
            : [];
        const stillAllowedToPair = latestFamilyData.ownerId === uid ||
            latestMembers.some((member) => member?.uid === uid &&
                (member?.role === 'OWNER' || member?.role === 'PARENT'));
        if (!stillAllowedToPair) {
            throw new functions.https.HttpsError('permission-denied', 'You no longer have permission to add a child.');
        }
        if (latestPairingData.used === true) {
            throw new functions.https.HttpsError('already-exists', 'This pairing code has already been used.');
        }
        const latestExpiry = typeof latestPairingData.expiresAt?.toMillis === 'function'
            ? latestPairingData.expiresAt.toMillis()
            : 0;
        if (latestExpiry <= Date.now()) {
            throw new functions.https.HttpsError('deadline-exceeded', 'This pairing code has expired.');
        }
        const latestChildId = latestPairingData.childId;
        const latestDeviceId = latestPairingData.deviceId ||
            latestPairingData.childDeviceId;
        if (typeof latestChildId !== 'string' ||
            !latestChildId ||
            typeof latestDeviceId !== 'string' ||
            !latestDeviceId ||
            latestPairingData.firebaseUid !== pairingData.firebaseUid) {
            throw new functions.https.HttpsError('failed-precondition', 'Pairing data changed or is incomplete.');
        }
        const latestChildIds = Array.isArray(latestFamilyData.childDeviceIds)
            ? latestFamilyData.childDeviceIds.filter((id) => typeof id === 'string')
            : [];
        const latestAllowedSlots = getAllowedChildSlots(latestFamilyData);
        if (!latestChildIds.includes(latestChildId) &&
            latestChildIds.length >= latestAllowedSlots) {
            throw new functions.https.HttpsError('resource-exhausted', `Your subscription allows ${latestAllowedSlots} child device(s).`);
        }
        const childRef = db
            .collection('children')
            .doc(latestChildId);
        const existingChildSnapshot = await transaction.get(childRef);
        if (existingChildSnapshot.exists) {
            const existingChildData = existingChildSnapshot.data() || {};
            if (typeof existingChildData.familyId === 'string' &&
                existingChildData.familyId &&
                existingChildData.familyId !== familyId) {
                throw new functions.https.HttpsError('already-exists', 'This child is already paired with another family.');
            }
        }
        transaction.update(familyRef, {
            childDeviceIds: admin.firestore.FieldValue.arrayUnion(latestChildId)
        });
        transaction.set(childRef, {
            childId: latestChildId,
            deviceId: latestDeviceId,
            firebaseUid: latestPairingData.firebaseUid,
            name: latestPairingData.childName || 'Unnamed Child',
            avatarId: latestPairingData.avatarId || 'avatar_1',
            familyId,
            pairedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        transaction.update(pairingRef, {
            used: true,
            familyId,
            parentUid: uid,
            parentName,
            pairedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            childId: latestChildId,
            deviceId: latestDeviceId,
            childName: latestPairingData.childName || 'Unnamed Child'
        };
    });
    return {
        success: true,
        ...pairingResult
    };
});
exports.acceptFamilyInvitation = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to accept an invitation.');
    }
    const inviteId = typeof data?.inviteId === 'string'
        ? data.inviteId.trim()
        : '';
    const displayName = typeof data?.displayName === 'string' &&
        data.displayName.trim()
        ? data.displayName.trim()
        : 'Parent';
    const email = typeof context.auth.token.email === 'string'
        ? context.auth.token.email.toLowerCase()
        : '';
    if (!inviteId ||
        !email ||
        context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'A verified email and valid invitation are required.');
    }
    const uid = context.auth.uid;
    const inviteRef = db
        .collection('familyInvitations')
        .doc(inviteId);
    const inviteSnapshot = await inviteRef.get();
    if (!inviteSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Invitation not found.');
    }
    const inviteData = inviteSnapshot.data() || {};
    if (inviteData.status !== 'PENDING') {
        throw new functions.https.HttpsError('failed-precondition', `Invitation is ${inviteData.status || 'invalid'}.`);
    }
    if (typeof inviteData.email !== 'string' ||
        inviteData.email.toLowerCase() !== email) {
        throw new functions.https.HttpsError('permission-denied', 'This invitation was sent to another email address.');
    }
    const expiresAtMillis = typeof inviteData.expiresAt?.toMillis === 'function'
        ? inviteData.expiresAt.toMillis()
        : 0;
    if (expiresAtMillis <= Date.now()) {
        throw new functions.https.HttpsError('deadline-exceeded', 'This invitation has expired.');
    }
    const familyId = inviteData.familyId;
    const role = inviteData.role;
    if (typeof familyId !== 'string' ||
        !familyId ||
        !['PARENT', 'GUARDIAN', 'VIEWER'].includes(role)) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation data is incomplete or invalid.');
    }
    const acceptedFamilyId = await db.runTransaction(async (transaction) => {
        const latestInviteSnapshot = await transaction.get(inviteRef);
        const familyRef = db
            .collection('families')
            .doc(familyId);
        const familySnapshot = await transaction.get(familyRef);
        if (!latestInviteSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation no longer exists.');
        }
        if (!familySnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Family not found.');
        }
        const latestInviteData = latestInviteSnapshot.data() || {};
        if (latestInviteData.status !== 'PENDING' ||
            latestInviteData.familyId !== familyId ||
            typeof latestInviteData.email !== 'string' ||
            latestInviteData.email.toLowerCase() !== email) {
            throw new functions.https.HttpsError('failed-precondition', 'Invitation changed or is no longer valid.');
        }
        const latestExpiry = typeof latestInviteData.expiresAt?.toMillis ===
            'function'
            ? latestInviteData.expiresAt.toMillis()
            : 0;
        if (latestExpiry <= Date.now()) {
            throw new functions.https.HttpsError('deadline-exceeded', 'This invitation has expired.');
        }
        const familyData = familySnapshot.data() || {};
        const memberUids = Array.isArray(familyData.memberUids)
            ? familyData.memberUids
            : [];
        const familyInvites = Array.isArray(familyData.invites)
            ? familyData.invites
            : [];
        const updatedInvites = familyInvites.map((invite) => invite?.id === inviteId
            ? {
                ...invite,
                status: 'ACCEPTED'
            }
            : invite);
        const familyUpdate = {
            memberUids: admin.firestore.FieldValue.arrayUnion(uid),
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
                    joinedAt: admin.firestore.Timestamp.now(),
                    invitedBy: latestInviteData.invitedBy || null,
                    assignedChildren: ['*']
                });
        }
        transaction.update(familyRef, familyUpdate);
        transaction.update(inviteRef, {
            status: 'ACCEPTED',
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            acceptedByUid: uid
        });
        const parentRef = db
            .collection('parents')
            .doc(uid);
        transaction.set(parentRef, {
            familyId
        }, { merge: true });
        return familyId;
    });
    return {
        success: true,
        familyId: acceptedFamilyId
    };
});
exports.cleanupUnverifiedAccounts = (0, scheduler_1.onSchedule)({
    schedule: "every day 03:00",
    timeZone: "Europe/Berlin",
}, async () => {
    const authService = admin.auth();
    const firestore = admin.firestore();
    const cutoffTime = Date.now() - 48 * 60 * 60 * 1000;
    let pageToken;
    do {
        const result = await authService.listUsers(1000, pageToken);
        for (const user of result.users) {
            const isPasswordUser = user.providerData.some((provider) => provider.providerId === "password");
            const createdAt = new Date(user.metadata.creationTime).getTime();
            const shouldDelete = isPasswordUser &&
                !user.emailVerified &&
                createdAt < cutoffTime;
            if (!shouldDelete)
                continue;
            try {
                await firestore
                    .collection("parents")
                    .doc(user.uid)
                    .delete();
                await authService.deleteUser(user.uid);
                console.log(`Deleted unverified account: ${user.uid}`);
            }
            catch (error) {
                console.error(`Failed to delete unverified account: ${user.uid}`, error);
            }
        }
        pageToken = result.pageToken;
    } while (pageToken);
});
async function deleteLinkedDocuments(collectionName, fieldName, value) {
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
async function deleteAuthUserIfExists(uid) {
    try {
        await admin.auth().deleteUser(uid);
    }
    catch (error) {
        if (error?.code !== 'auth/user-not-found') {
            throw error;
        }
    }
}
function escapeExportHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function formatExportLabel(key) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatExportDisplayValue(value) {
    if (value === null ||
        value === undefined ||
        value === '') {
        return 'Not provided';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'string' ||
        typeof value === 'number') {
        return String(value);
    }
    return JSON.stringify(value);
}
function renderExportFields(data, excludedKeys = []) {
    const rows = Object.entries(data)
        .filter(([key]) => !excludedKeys.includes(key))
        .filter(([, value]) => !Array.isArray(value) &&
        (value === null ||
            typeof value !== 'object'))
        .map(([key, value]) => `
      <div class="field-row">
        <div class="field-label">
          ${escapeExportHtml(formatExportLabel(key))}
        </div>

        <div class="field-value">
          ${escapeExportHtml(formatExportDisplayValue(value))}
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
function renderExportDocumentCards(documents, emptyMessage) {
    if (!Array.isArray(documents) ||
        documents.length === 0) {
        return `
      <p class="empty">
        ${escapeExportHtml(emptyMessage)}
      </p>
    `;
    }
    return documents
        .map((document, index) => {
        const data = document?.data &&
            typeof document.data === 'object'
            ? document.data
            : {};
        const displayName = data.displayName ||
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
              ${escapeExportHtml(document?.id || 'Not provided')}
            </div>
          </div>
        </article>
      `;
    })
        .join('');
}
function renderNotificationReport(notifications) {
    if (!Array.isArray(notifications) ||
        notifications.length === 0) {
        return `
      <p class="empty">
        No notifications or alerts found.
      </p>
    `;
    }
    const typeCounts = {};
    for (const notification of notifications) {
        const data = notification?.data &&
            typeof notification.data === 'object'
            ? notification.data
            : {};
        const type = typeof data.type === 'string' &&
            data.type.trim()
            ? data.type
            : 'OTHER';
        typeCounts[type] =
            (typeCounts[type] || 0) + 1;
    }
    const summaryRows = Object.entries(typeCounts)
        .sort((first, second) => second[1] - first[1])
        .map(([type, count]) => `
      <div class="type-row">
        <span>
          ${escapeExportHtml(formatExportLabel(type))}
        </span>

        <strong>
          ${count}
        </strong>
      </div>
    `)
        .join('');
    const recentNotifications = notifications.slice(0, 100);
    const notificationCards = recentNotifications
        .map((notification, index) => {
        const data = notification?.data &&
            typeof notification.data === 'object'
            ? notification.data
            : {};
        const title = data.title ||
            data.type ||
            `Notification ${index + 1}`;
        return `
          <article class="record-card">
            <h3>
              ${escapeExportHtml(formatExportLabel(String(title)))}
            </h3>

            ${renderExportFields(data)}

            <div class="field-row">
              <div class="field-label">
                Record ID
              </div>

              <div class="field-value">
                ${escapeExportHtml(notification?.id ||
            'Not provided')}
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
function createReadableExportHtml(exportPayload) {
    const familyData = exportPayload.family?.data &&
        typeof exportPayload.family.data === 'object'
        ? exportPayload.family.data
        : {};
    const parents = Array.isArray(exportPayload.parents)
        ? exportPayload.parents
        : [];
    const children = Array.isArray(exportPayload.children)
        ? exportPayload.children
        : [];
    const devices = Array.isArray(exportPayload.devices)
        ? exportPayload.devices
        : [];
    const notifications = Array.isArray(exportPayload.notifications)
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
          ${renderExportFields(familyData, [
        'members',
        'invites',
        'childDeviceIds',
        'memberUids',
        'managerUids'
    ])}
        </article>
      </div>
    </details>

    <details>
      <summary>
        Parent profiles (${parentCount})
      </summary>

      <div class="section-content record-grid">
        ${renderExportDocumentCards(parents, 'No parent profiles found.')}
      </div>
    </details>

    <details>
      <summary>
        Child profiles and activity (${childCount})
      </summary>

      <div class="section-content record-grid">
        ${renderExportDocumentCards(children, 'No child profiles found.')}
      </div>
    </details>

    <details>
      <summary>
        Registered devices (${deviceCount})
      </summary>

      <div class="section-content record-grid">
        ${renderExportDocumentCards(devices, 'No registered devices found.')}
      </div>
    </details>

    <details>
      <summary>
        Notifications and alerts
        (${notificationCount})
      </summary>

      <div class="section-content">
        ${renderNotificationReport(notifications)}
      </div>
    </details>
  </main>
</body>
</html>`;
}
function makeExportValueJsonSafe(value) {
    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }
    if (value instanceof admin.firestore.GeoPoint) {
        return {
            latitude: value.latitude,
            longitude: value.longitude
        };
    }
    if (value instanceof
        admin.firestore.DocumentReference) {
        return value.path;
    }
    if (Array.isArray(value)) {
        return value.map(makeExportValueJsonSafe);
    }
    if (value !== null &&
        typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
            key,
            makeExportValueJsonSafe(nestedValue)
        ]));
    }
    return value;
}
async function exportDocumentWithSubcollections(documentSnapshot) {
    const exportedDocument = {
        id: documentSnapshot.id,
        data: makeExportValueJsonSafe(documentSnapshot.data() || {}),
        subcollections: {}
    };
    const subcollections = await documentSnapshot.ref.listCollections();
    for (const subcollection of subcollections) {
        const snapshot = await subcollection.get();
        exportedDocument.subcollections[subcollection.id] = snapshot.docs.map((nestedDocument) => ({
            id: nestedDocument.id,
            data: makeExportValueJsonSafe(nestedDocument.data())
        }));
    }
    return exportedDocument;
}
exports.requestFamilyDataExport = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '1GB'
})
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const uid = context.auth.uid;
    const parentSnapshot = await db
        .collection('parents')
        .doc(uid)
        .get();
    if (!parentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Parent profile not found.');
    }
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== 'string' ||
        !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familySnapshot = await db
        .collection('families')
        .doc(familyId)
        .get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const exportRateLimitRef = db
        .collection('familyExportRateLimits')
        .doc(uid);
    const exportRateLimitMs = 15 * 60 * 1000;
    await db.runTransaction(async (transaction) => {
        const rateLimitSnapshot = await transaction.get(exportRateLimitRef);
        const lastRequestedAt = rateLimitSnapshot
            .data()
            ?.lastRequestedAt;
        if (lastRequestedAt instanceof
            admin.firestore.Timestamp) {
            const elapsedMs = Date.now() -
                lastRequestedAt.toMillis();
            if (elapsedMs < exportRateLimitMs) {
                const remainingMinutes = Math.max(1, Math.ceil((exportRateLimitMs -
                    elapsedMs) /
                    60000));
                throw new functions.https.HttpsError('resource-exhausted', `Please wait ${remainingMinutes} minute(s) before requesting another export.`);
            }
        }
        transaction.set(exportRateLimitRef, {
            uid,
            familyId,
            lastRequestedAt: admin.firestore.Timestamp.now()
        }, {
            merge: true
        });
    });
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
        const familyExport = await exportDocumentWithSubcollections(familySnapshot);
        const parentsExport = await Promise.all(parentsSnapshot.docs.map(exportDocumentWithSubcollections));
        const childrenExport = await Promise.all(childrenSnapshot.docs.map(exportDocumentWithSubcollections));
        const devicesExport = await Promise.all(devicesSnapshot.docs.map(exportDocumentWithSubcollections));
        const parentNotifications = await Promise.all(parentsSnapshot.docs.map(async (parentDocument) => {
            const snapshot = await db
                .collection('notifications')
                .where('userId', '==', parentDocument.id)
                .get();
            return Promise.all(snapshot.docs.map(exportDocumentWithSubcollections));
        }));
        const generatedAt = new Date();
        const expiresAt = new Date(generatedAt.getTime() +
            15 * 60 * 1000);
        const exportPayload = {
            exportVersion: 1,
            generatedAt: generatedAt.toISOString(),
            requestedBy: uid,
            familyId,
            family: familyExport,
            parents: parentsExport,
            children: childrenExport,
            devices: devicesExport,
            notifications: parentNotifications.flat()
        };
        const jsonContent = JSON.stringify(exportPayload, null, 2);
        const htmlContent = createReadableExportHtml(exportPayload);
        const timestamp = generatedAt
            .toISOString()
            .replace(/[:.]/g, '-');
        const fileName = `kidsguard-family-data-${timestamp}.zip`;
        const storagePath = `family-exports/${familyId}/${uid}/${fileName}`;
        const file = bucket.file(storagePath);
        const downloadToken = (0, crypto_1.randomUUID)();
        await new Promise((resolve, reject) => {
            const output = file.createWriteStream({
                resumable: false,
                metadata: {
                    contentType: 'application/zip',
                    cacheControl: 'private, no-store, max-age=0',
                    metadata: {
                        temporary: 'true',
                        expiresAt: expiresAt.toISOString(),
                        familyId,
                        requestedBy: uid,
                        firebaseStorageDownloadTokens: downloadToken
                    }
                }
            });
            const archive = new archiver_1.ZipArchive({
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
        });
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/` +
            `${encodeURIComponent(bucket.name)}/o/` +
            `${encodeURIComponent(storagePath)}` +
            `?alt=media&token=` +
            `${encodeURIComponent(downloadToken)}`;
        return {
            success: true,
            fileName,
            downloadUrl,
            expiresAt: expiresAt.toISOString()
        };
    }
    catch (error) {
        try {
            await exportRateLimitRef.delete();
        }
        catch (cleanupError) {
            console.error('Failed to clear export rate limit:', cleanupError);
        }
        console.error('Family data export failed:', error);
        if (error instanceof
            functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'The family data export could not be completed. Please try again.');
    }
});
exports.requestFamilyDeletion = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const uid = context.auth.uid;
    const authTime = Number(context.auth.token.auth_time || 0);
    const tokenAgeSeconds = Math.floor(Date.now() / 1000) - authTime;
    if (tokenAgeSeconds > 600) {
        throw new functions.https.HttpsError('failed-precondition', 'Please sign in again before deleting your account.');
    }
    const parentRef = db.collection('parents').doc(uid);
    const parentSnapshot = await parentRef.get();
    if (!parentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Parent profile not found.');
    }
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== 'string' ||
        !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const familyData = familySnapshot.data() || {};
    if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can delete the family.');
    }
    if (familyData.deletionStatus ===
        'PENDING_DELETION') {
        return {
            success: true,
            alreadyPending: true,
            deletionScheduledAt: familyData.deletionScheduledAt
        };
    }
    const requestedAt = admin.firestore.Timestamp.now();
    const scheduledAt = admin.firestore.Timestamp.fromMillis(requestedAt.toMillis() +
        30 * 24 * 60 * 60 * 1000);
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
exports.cancelFamilyDeletion = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const uid = context.auth.uid;
    const parentSnapshot = await db
        .collection('parents')
        .doc(uid)
        .get();
    if (!parentSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Parent profile not found.');
    }
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== 'string' ||
        !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const familyData = familySnapshot.data() || {};
    if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can cancel family deletion.');
    }
    if (familyData.deletionStatus !==
        'PENDING_DELETION') {
        return {
            success: true,
            wasPending: false
        };
    }
    await familyRef.update({
        deletionStatus: 'ACTIVE',
        deletionRequestedAt: admin.firestore.FieldValue.delete(),
        deletionScheduledAt: admin.firestore.FieldValue.delete(),
        deletionRequestedBy: admin.firestore.FieldValue.delete()
    });
    return {
        success: true,
        wasPending: true
    };
});
exports.cleanupExpiredFamilyExports = (0, scheduler_1.onSchedule)({
    schedule: "every 15 minutes",
    timeZone: "Europe/Berlin",
}, async () => {
    const [files] = await storageBucket.getFiles({
        prefix: "family-exports/",
    });
    const now = Date.now();
    for (const file of files) {
        try {
            const [metadata] = await file.getMetadata();
            const expiresAt = metadata.metadata?.expiresAt;
            if (typeof expiresAt !== "string") {
                console.warn(`Export file has no expiry: ${file.name}`);
                continue;
            }
            const expiryTime = new Date(expiresAt).getTime();
            if (Number.isNaN(expiryTime) ||
                expiryTime > now) {
                continue;
            }
            await file.delete();
            console.log(`Expired export deleted: ${file.name}`);
        }
        catch (error) {
            if (error?.code === 404) {
                continue;
            }
            console.error(`Failed to delete export ${file.name}:`, error);
        }
    }
});
exports.cleanupDeletedFamilies = (0, scheduler_1.onSchedule)({
    schedule: "every day 04:00",
    timeZone: "Europe/Berlin",
}, async () => {
    const now = admin.firestore.Timestamp.now();
    const pendingFamilies = await db
        .collection("families")
        .where("deletionStatus", "==", "PENDING_DELETION")
        .limit(100)
        .get();
    for (const familyDocument of pendingFamilies.docs) {
        try {
            const familyData = familyDocument.data() || {};
            const scheduledAt = familyData.deletionScheduledAt;
            if (typeof scheduledAt?.toMillis !==
                "function" ||
                scheduledAt.toMillis() > now.toMillis()) {
                continue;
            }
            const familyId = familyDocument.id;
            const ownerUid = familyData.ownerId;
            if (typeof ownerUid !== "string" ||
                !ownerUid) {
                console.error(`Deletion skipped: family ${familyId} has no ownerId.`);
                continue;
            }
            const pairingSnapshot = await db
                .collection("pairingCodes")
                .where("familyId", "==", familyId)
                .get();
            const childIds = new Set(Array.isArray(familyData.childDeviceIds)
                ? familyData.childDeviceIds.filter((id) => typeof id === "string")
                : []);
            const childAuthUids = new Set();
            const deviceIds = new Set();
            for (const pairingDocument of pairingSnapshot.docs) {
                const pairingData = pairingDocument.data();
                if (typeof pairingData.childId ===
                    "string") {
                    childIds.add(pairingData.childId);
                }
                if (typeof pairingData.firebaseUid ===
                    "string") {
                    childAuthUids.add(pairingData.firebaseUid);
                }
                if (typeof pairingData.deviceId ===
                    "string") {
                    deviceIds.add(pairingData.deviceId);
                }
            }
            for (const childId of childIds) {
                const childRef = db
                    .collection("children")
                    .doc(childId);
                const [childSnapshot, statusSnapshot] = await Promise.all([
                    childRef.get(),
                    childRef
                        .collection("status")
                        .doc("current")
                        .get(),
                ]);
                const childData = childSnapshot.data() || {};
                const statusData = statusSnapshot.data() || {};
                const childFirebaseUid = childData.firebaseUid ||
                    statusData.firebaseUid;
                const childDeviceId = childData.deviceId ||
                    statusData.deviceId;
                if (typeof childFirebaseUid === "string") {
                    childAuthUids.add(childFirebaseUid);
                }
                if (typeof childDeviceId === "string") {
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
                for (const collectionName of childLinkedCollections) {
                    await deleteLinkedDocuments(collectionName, "childId", childId);
                }
            }
            for (const deviceId of deviceIds) {
                const deviceRef = db
                    .collection("devices")
                    .doc(deviceId);
                const deviceSnapshot = await deviceRef.get();
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
            for (const collectionName of familyLinkedCollections) {
                await deleteLinkedDocuments(collectionName, "familyId", familyId);
            }
            const members = Array.isArray(familyData.members)
                ? familyData.members
                : [];
            for (const member of members) {
                const memberUid = member?.uid;
                if (typeof memberUid !== "string" ||
                    !memberUid ||
                    memberUid === ownerUid) {
                    continue;
                }
                const memberRef = db
                    .collection("parents")
                    .doc(memberUid);
                const memberSnapshot = await memberRef.get();
                if (memberSnapshot.exists &&
                    memberSnapshot.data()?.familyId ===
                        familyId) {
                    await memberRef.update({
                        familyId: null,
                        role: admin.firestore.FieldValue.delete(),
                    });
                }
            }
            await deleteLinkedDocuments("notifications", "userId", ownerUid);
            for (const childUid of childAuthUids) {
                await deleteAuthUserIfExists(childUid);
            }
            await db.recursiveDelete(familyDocument.ref);
            const ownerRef = db
                .collection("parents")
                .doc(ownerUid);
            const ownerSnapshot = await ownerRef.get();
            if (ownerSnapshot.exists) {
                await db.recursiveDelete(ownerRef);
            }
            await deleteAuthUserIfExists(ownerUid);
            console.log(`Family ${familyId} permanently deleted.`);
        }
        catch (error) {
            console.error(`Failed to permanently delete family ${familyDocument.id}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map