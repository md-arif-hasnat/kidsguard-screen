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
exports.onPermissionAlertCreated = exports.onTamperAlertCreated = exports.onProtectionModeChanged = exports.onFamilyUpdated = exports.onInviteAccepted = exports.onInviteCreated = exports.onStatusChanged = exports.onSosResolved = exports.onSosCreated = exports.onInstalledAppCreated = exports.onActivityCreated = void 0;
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
//# sourceMappingURL=index.js.map