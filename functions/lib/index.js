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
exports.acceptFamilyInvitation = exports.acceptPairingCode = exports.onPermissionAlertCreated = exports.onTamperAlertCreated = exports.checkOfflineChildren = exports.onProtectionModeChanged = exports.onFamilyUpdated = exports.onInviteAccepted = exports.onInviteCreated = exports.onStatusChanged = exports.onSosResolved = exports.onSosCreated = exports.onInstalledAppCreated = exports.onActivityCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
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
        subscription.baseChildSlots >= 0
        ? subscription.baseChildSlots
        : 2;
    const extraChildSlots = Number.isInteger(subscription?.extraChildSlots) &&
        subscription.extraChildSlots >= 0
        ? subscription.extraChildSlots
        : 0;
    return baseChildSlots + extraChildSlots;
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
//# sourceMappingURL=index.js.map