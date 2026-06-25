import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

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
 * Triggered when an SOS event is created or updated.
 */
export const onSosChanged = functions.firestore
    .document('children/{childId}/sosEvents/{eventId}')
    .onWrite(async (change, context) => {
        const { childId } = context.params;
        const data = change.after.data();

        if (!data) return;

        // Only notify on active SOS
        if (data.status === 'ACTIVE') {
            await broadcastToParents(childId, {
                title: '🆘 SOS ACTIVATED',
                body: data.message || 'Emergency signal received!',
                type: 'SOS',
                childId: childId,
                clickAction: `/map` // Center on map
            });
        } else if (data.status === 'RESOLVED') {
            await broadcastToParents(childId, {
                title: '✅ SOS Resolved',
                body: 'Emergency situation has been marked as resolved.',
                type: 'SOS',
                childId: childId,
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
    type: 'SAFE_ZONE' | 'SOS' | 'BATTERY' | 'DEVICE' | 'PAIRING';
    childId: string;
    clickAction: string;
}

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

    const family = familyQuery.docs[0].data();
    const parentIds = family.parentIds as string[];

    // 2. Notify each parent
    const promises = parentIds.map(uid => notifyParent(uid, payload));
    await Promise.all(promises);
}

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
    const notificationId = db.collection('parents').doc(uid).collection('notifications').doc().id;
    await db.collection('parents').doc(uid).collection('notifications').doc(notificationId).set({
        id: notificationId,
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    // 3. Send FCM to all registered devices
    const devicesSnap = await db.collection('parents').doc(uid).collection('devices').get();
    if (devicesSnap.empty) return;

    const tokens = devicesSnap.docs.map(doc => doc.data().token).filter(t => !!t);
    if (tokens.length === 0) return;

    const messagingPayload: admin.messaging.MulticastMessage = {
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
                clickAction: 'FLUTTER_NOTIFICATION_CLICK' // For future Flutter if used, or just handled by standard intent
            }
        }
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(messagingPayload);
        console.log(`Successfully sent ${response.successCount} notifications for parent ${uid}`);

        // Clean up invalid tokens if any
        if (response.failureCount > 0) {
            const tokensToRemove: Promise<any>[] = [];
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
    } catch (error) {
        console.error(`Error sending FCM to parent ${uid}:`, error);
    }
}
