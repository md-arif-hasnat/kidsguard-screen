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
exports.onProtectionModeChanged = exports.onFamilyUpdated = exports.onInviteAccepted = exports.onInviteCreated = exports.onStatusChanged = exports.onSosChanged = exports.onActivityCreated = void 0;
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
exports.onSosChanged = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onWrite(async (change, context) => {
    const { childId } = context.params;
    const data = change.after.data();
    if (!data)
        return;
    if (data.status === 'ACTIVE') {
        await broadcastToParents(childId, {
            title: '🆘 SOS ACTIVATED',
            body: data.message || 'Emergency signal received!',
            type: 'SOS',
            childId: childId,
            clickAction: `/map`
        });
    }
    else if (data.status === 'RESOLVED') {
        await broadcastToParents(childId, {
            title: '✅ SOS Resolved',
            body: 'Emergency situation has been marked as resolved.',
            type: 'SOS',
            childId: childId,
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
    const family = familyQuery.docs[0].data();
    const members = family.members || [];
    const parentUids = members
        .filter(m => m.role === 'OWNER' || m.role === 'PARENT')
        .map(m => m.uid);
    const promises = parentUids.map(uid => notifyParent(uid, payload));
    await Promise.all(promises);
}
async function notifyParent(uid, payload) {
    const settingsSnap = await db.collection('parents').doc(uid).collection('notificationSettings').doc('current').get();
    const settings = settingsSnap.data();
    const typeMap = {
        'SAFE_ZONE': 'safeZone',
        'SOS': 'sos',
        'BATTERY': 'battery',
        'DEVICE': 'deviceStatus',
        'PAIRING': 'pairing'
    };
    const settingKey = typeMap[payload.type];
    if (settings && settings[settingKey] === false) {
        console.log(`Parent ${uid} has disabled ${payload.type} notifications.`);
        return;
    }
    const notificationId = db.collection('parents').doc(uid).collection('notifications').doc().id;
    await db.collection('parents').doc(uid).collection('notifications').doc(notificationId).set({
        id: notificationId,
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
    });
    const devicesSnap = await db.collection('parents').doc(uid).collection('devices').get();
    if (devicesSnap.empty)
        return;
    const tokens = devicesSnap.docs.map(doc => doc.data().token).filter(t => !!t);
    if (tokens.length === 0)
        return;
    const messagingPayload = {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: {
            type: payload.type,
            childId: payload.childId,
            clickAction: payload.clickAction
        },
        webpush: {
            fcmOptions: {
                link: payload.clickAction
            }
        },
        android: {
            priority: payload.type === 'SOS' ? 'high' : 'normal',
            notification: {
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
        }
    };
    try {
        const response = await admin.messaging().sendEachForMulticast(messagingPayload);
        console.log(`Successfully sent ${response.successCount} notifications for parent ${uid}`);
        if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (error?.code === 'messaging/invalid-registration-token' ||
                        error?.code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(devicesSnap.docs[idx].ref.delete());
                    }
                }
            });
            await Promise.all(tokensToRemove);
        }
    }
    catch (error) {
        console.error(`Error sending FCM to parent ${uid}:`, error);
    }
}
//# sourceMappingURL=index.js.map