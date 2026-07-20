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
    type: 'SAFE_ZONE' | 'SOS' | 'SOS_RESOLVED' | 'BATTERY' | 'DEVICE' | 'PAIRING';
    childId: string;
    clickAction: string;
    eventId?: string;
    familyId?: string;
    message?: string; // For explicit required field mapping
    route?: string;   // For explicit required field mapping
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

    await db.collection('notifications').doc(notificationId).set(notificationDoc, { merge: true });

    // 3. Send FCM to all registered devices
    // New Path: users/{uid}/notificationTokens
    const devicesSnap = await db.collection('users').doc(uid).collection('notificationTokens').get();
    if (devicesSnap.empty) return;

    // Filter for enabled tokens
    const tokens = devicesSnap.docs
        .filter(doc => doc.data().enabled !== false)
        .map(doc => doc.data().token)
        .filter(t => !!t);

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
            eventId: payload.eventId || '',
            clickAction: payload.clickAction
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
