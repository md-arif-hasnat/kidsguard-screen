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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.paddleBillingWebhook = exports.generateWeeklySafetyReports = exports.generateWeeklySafetyReportNow = exports.sendAdminSevenDaySubscriptionPush = exports.onAdminSubscriptionChangedPush = exports.onAdminDeviceWarningPush = exports.onAdminSupportActivityPush = exports.onAdminIssueCreatedPush = exports.monitorReleaseRollout = exports.sendAdminOpenNotificationReminder = exports.onFamilyMembershipSync = exports.removeFamilyMember = exports.removeChildFromFamily = exports.sendFamilyInvitationEmail = exports.cleanupDeletedFamilies = exports.cleanupFamilyRetentionData = exports.cleanupExpiredFamilyExports = exports.reconcileExpiredSubscriptionCancellations = exports.resumeScheduledSubscription = exports.requestSubscriptionCancellation = exports.removeExtraChildSlot = exports.purchaseExtraChildSlot = exports.ensureParentFamily = exports.cancelFamilyDeletion = exports.requestFamilyDeletion = exports.requestFamilyDataExport = exports.cleanupUnverifiedAccounts = exports.acceptFamilyInvitation = exports.checkInvitationEmail = exports.acceptPairingCode = exports.onPermissionAlertCreated = exports.onTamperAlertCreated = exports.checkOfflineChildren = exports.onProtectionModeChanged = exports.onFamilyUpdated = exports.onInviteAccepted = exports.onInviteCreated = exports.verifyReleaseArtifact = exports.onAppUpdatePublished = exports.onCriticalSyncFailure = exports.onStatusChanged = exports.onSosResolved = exports.onSosCreated = exports.onAppRestrictionEventCreated = exports.onRemoteControlOverrideCreated = exports.onAppAccessRequestCreated = exports.onPermissionChangeRequestCreated = exports.onInstalledAppCreated = exports.onSupportAdminAction = exports.onActivityCreated = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const crypto_1 = require("crypto");
const params_1 = require("firebase-functions/params");
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();
const storageBucket = admin.storage().bucket();
const paddleWebhookSecret = (0, params_1.defineSecret)('PADDLE_WEBHOOK_SECRET');
const paddleApiKey = (0, params_1.defineSecret)('PADDLE_API_KEY');
function paddleApiBaseUrl(apiKey) {
    return apiKey.includes('_sdbx_')
        ? 'https://sandbox-api.paddle.com'
        : 'https://api.paddle.com';
}
async function callPaddleSubscriptionApi(subscriptionId, action) {
    const apiKey = paddleApiKey.value().trim();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Paddle billing is not configured.');
    }
    const isCancel = action === 'cancel';
    const endpoint = isCancel
        ? `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`
        : `/subscriptions/${encodeURIComponent(subscriptionId)}`;
    const response = await fetch(`${paddleApiBaseUrl(apiKey)}${endpoint}`, {
        method: isCancel ? 'POST' : 'PATCH',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(isCancel
            ? { effective_from: 'next_billing_period' }
            : { scheduled_change: null })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const detail = payload?.error?.detail ||
            `Paddle returned HTTP ${response.status}.`;
        console.error(`Paddle subscription ${action} failed for ${subscriptionId}:`, detail);
        throw new functions.https.HttpsError('unavailable', 'Paddle could not update the subscription. Please try again.');
    }
    return payload?.data || {};
}
async function getPaddleSubscription(subscriptionId) {
    const apiKey = paddleApiKey.value().trim();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Paddle billing is not configured.');
    }
    const response = await fetch(`${paddleApiBaseUrl(apiKey)}/subscriptions/${encodeURIComponent(subscriptionId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.data) {
        console.error(`Paddle subscription lookup failed for ${subscriptionId}:`, payload?.error?.detail || response.status);
        throw new functions.https.HttpsError('unavailable', 'Paddle could not read the subscription. Please try again.');
    }
    return payload.data;
}
async function changePaddleExtraChildSlots(subscriptionId, extraChildPriceId, delta) {
    const apiKey = paddleApiKey.value().trim();
    const subscription = await getPaddleSubscription(subscriptionId);
    const existingItems = Array.isArray(subscription.items)
        ? subscription.items
        : [];
    let nextExtraQuantity = delta > 0 ? 1 : 0;
    let foundExtraPrice = false;
    const items = [];
    for (const item of existingItems) {
        const priceId = item.price?.id || item.price_id;
        if (!priceId) {
            throw new functions.https.HttpsError('failed-precondition', 'Paddle returned an incomplete subscription item.');
        }
        const quantity = Number.isInteger(item.quantity) && Number(item.quantity) > 0
            ? Number(item.quantity)
            : 1;
        if (priceId === extraChildPriceId) {
            foundExtraPrice = true;
            nextExtraQuantity = Math.max(0, quantity + delta);
            if (nextExtraQuantity > 0) {
                items.push({ price_id: priceId, quantity: nextExtraQuantity });
            }
            continue;
        }
        items.push({ price_id: priceId, quantity });
    }
    if (!foundExtraPrice && delta > 0) {
        items.push({ price_id: extraChildPriceId, quantity: 1 });
    }
    if (!foundExtraPrice && delta < 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No paid extra child slot is available to remove.');
    }
    const response = await fetch(`${paddleApiBaseUrl(apiKey)}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            items,
            proration_billing_mode: 'prorated_immediately',
            on_payment_failure: 'prevent_change'
        })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        console.error(`Paddle extra-child update failed for ${subscriptionId}:`, payload?.error?.detail || response.status);
        throw new functions.https.HttpsError('unavailable', 'Paddle could not update the extra child slots. No billing change was made.');
    }
    return nextExtraQuantity;
}
function normalizeFamilyRole(role) {
    if (role === 'OWNER')
        return 'OWNER';
    if (role === 'MANAGER' || role === 'PARENT')
        return 'MANAGER';
    if (role === 'VIEWER' || role === 'GUARDIAN')
        return 'VIEWER';
    return null;
}
function isManagerRole(role) {
    const normalized = normalizeFamilyRole(role);
    return normalized === 'OWNER' || normalized === 'MANAGER';
}
const RETENTION_BATCH_SIZE = 400;
const RETENTION_MAX_BATCHES = 5;
const RETENTION_MAX_DATED_TREES = 100;
const ALLOWED_RETENTION_DAYS = new Set([30, 90, 365]);
async function deleteExpiredByField(collectionRef, field, cutoff, preserveIds = []) {
    let deletedCount = 0;
    const preserved = new Set(preserveIds);
    for (let batchNumber = 0; batchNumber < RETENTION_MAX_BATCHES; batchNumber += 1) {
        const snapshot = await collectionRef
            .where(field, '<', cutoff)
            .limit(RETENTION_BATCH_SIZE)
            .get();
        if (snapshot.empty)
            break;
        const deletable = snapshot.docs.filter(document => !preserved.has(document.id));
        if (deletable.length === 0)
            break;
        const batch = db.batch();
        deletable.forEach(document => batch.delete(document.ref));
        await batch.commit();
        deletedCount += deletable.length;
        if (snapshot.size < RETENTION_BATCH_SIZE)
            break;
    }
    return deletedCount;
}
function isIsoDayDocumentId(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
async function deleteExpiredDatedTrees(childRef, collectionName, cutoffDay) {
    const documentRefs = await childRef
        .collection(collectionName)
        .listDocuments();
    const expiredRefs = documentRefs
        .filter(documentRef => isIsoDayDocumentId(documentRef.id) &&
        documentRef.id < cutoffDay)
        .sort((first, second) => first.id.localeCompare(second.id))
        .slice(0, RETENTION_MAX_DATED_TREES);
    for (const documentRef of expiredRefs) {
        await db.recursiveDelete(documentRef);
    }
    return expiredRefs.length;
}
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
function escapeEmailHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
exports.onSupportAdminAction = functions.firestore
    .document('supportTickets/{ticketId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const action = after.lastAdminAction;
    if (!action || typeof action !== 'object') {
        return;
    }
    const beforeAction = before.lastAdminAction;
    const sameAction = beforeAction?.actorUid === action.actorUid &&
        beforeAction?.type === action.type &&
        beforeAction?.occurredAt?.toMillis?.() ===
            action.occurredAt?.toMillis?.();
    if (sameAction) {
        return;
    }
    const actorUid = typeof action.actorUid === 'string'
        ? action.actorUid
        : '';
    const actionType = action.type === 'REPLY' ||
        action.type === 'STATUS_CHANGE'
        ? action.type
        : '';
    if (!actorUid || !actionType) {
        console.warn('Skipping malformed support admin audit action', context.params.ticketId);
        return;
    }
    await db.collection('auditLogs').add({
        actorUid,
        actorEmail: typeof action.actorEmail === 'string'
            ? action.actorEmail
            : null,
        familyId: typeof after.familyId === 'string'
            ? after.familyId
            : null,
        action: actionType === 'REPLY'
            ? 'SUPPORT_ADMIN_REPLIED'
            : 'SUPPORT_STATUS_CHANGED',
        targetType: 'SUPPORT_TICKET',
        targetId: context.params.ticketId,
        severity: 'NOTICE',
        metadata: {
            previousStatus: before.status || null,
            currentStatus: after.status || null
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
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
    if (app?.notifyParent !== true) {
        console.log("Skipping baseline app notification:", {
            childId,
            packageName
        });
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
exports.onPermissionChangeRequestCreated = functions.firestore
    .document("children/{childId}/permissionChangeRequests/{requestId}")
    .onCreate(async (snapshot, context) => {
    const request = snapshot.data();
    const childId = String(context.params.childId || "");
    const requestId = String(context.params.requestId || "");
    if (!childId || !requestId || request?.status !== "PENDING") {
        return;
    }
    const childName = String(request?.childName || "Your child");
    const permissionName = String(request?.permissionName || "a protection permission");
    await broadcastToParents(childId, {
        title: "Permission change requested",
        body: `${childName} wants to change ${permissionName}. Approve or deny it from Device Health.`,
        type: "PERMISSION_CHANGE_REQUEST",
        childId,
        eventId: requestId,
        clickAction: `/dashboard/${encodeURIComponent(childId)}` +
            `?tab=overview&permissionRequest=${encodeURIComponent(requestId)}` +
            "#permission-approvals",
    });
});
exports.onAppAccessRequestCreated = functions.firestore
    .document("children/{childId}/appAccessRequests/{requestId}")
    .onCreate(async (snapshot, context) => {
    const request = snapshot.data();
    const childId = String(context.params.childId || "");
    const requestId = String(context.params.requestId || "");
    if (!childId || !requestId || request?.status !== "PENDING") {
        return;
    }
    const childName = String(request?.childName || "Your child");
    const appName = String(request?.appName || request?.packageName || "an app");
    await broadcastToParents(childId, {
        title: "More screen time requested",
        body: `${childName} requested more time for ${appName}.`,
        type: "APP_ACCESS_REQUEST",
        childId,
        packageName: String(request?.packageName || ""),
        eventId: requestId,
        clickAction: `/dashboard/${encodeURIComponent(childId)}` +
            `?tab=overview&screenTimeRequest=${encodeURIComponent(requestId)}` +
            "#screen-time-requests",
    });
});
exports.onRemoteControlOverrideCreated = functions.firestore
    .document("children/{childId}/remoteControlOverrides/{eventId}")
    .onCreate(async (snapshot, context) => {
    const event = snapshot.data();
    const childId = String(context.params.childId || "");
    const eventId = String(context.params.eventId || "");
    if (!childId || !eventId || event?.status !== "APPLIED") {
        return;
    }
    await broadcastToParents(childId, {
        title: String(event?.title || "Remote control priority applied"),
        body: String(event?.message ||
            "The Remote Control command took priority over scheduled settings."),
        type: "REMOTE_CONTROL_OVERRIDE",
        childId,
        eventId,
        clickAction: `/dashboard/${encodeURIComponent(childId)}` +
            "?tab=overview#remote-control-override",
    });
});
exports.onAppRestrictionEventCreated = functions.firestore
    .document("children/{childId}/appRestrictionEvents/{eventId}")
    .onCreate(async (snapshot, context) => {
    const event = snapshot.data();
    const childId = String(context.params.childId || "");
    const eventId = String(context.params.eventId || "");
    if (!childId || !eventId || event?.notifyParent !== true) {
        console.log("Skipping invalid app restriction event", { childId, eventId });
        return;
    }
    const reason = String(event?.reason || "STATIC_BLOCK");
    const appName = String(event?.appName || event?.packageName || "an app");
    const packageName = String(event?.packageName || "");
    const isTotalLimit = reason === "TOTAL_LIMIT_REACHED";
    const isLimit = reason === "LIMIT_REACHED" || isTotalLimit;
    const title = isTotalLimit
        ? "Daily screen time finished"
        : isLimit
            ? "App time limit reached"
            : "Blocked app attempt";
    const body = isTotalLimit
        ? "The daily total screen-time limit was reached. Non-essential apps are now blocked."
        : isLimit
            ? `${appName} reached today's time limit and was blocked.`
            : `${appName} was opened on the child device and KidsGuard blocked it.`;
    await broadcastToParents(childId, {
        title,
        body,
        type: isLimit ? "APP_LIMIT_REACHED" : "BLOCKED_APP_ATTEMPT",
        childId,
        packageName,
        eventId,
        clickAction: isTotalLimit
            ? `/dashboard/${encodeURIComponent(childId)}?tab=wellbeing`
            : `/dashboard/${encodeURIComponent(childId)}` +
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
exports.onCriticalSyncFailure = functions.firestore
    .document('children/{childId}/status/current')
    .onWrite(async (change, context) => {
    const after = change.after.data();
    if (!after)
        return;
    const before = change.before.exists ? change.before.data() : undefined;
    const { childId } = context.params;
    const failureCount = Number(after.syncFailureCount || 0);
    const previousFailureCount = Number(before?.syncFailureCount || 0);
    const isCritical = after.syncHealthy === false && failureCount >= 3;
    const wasCritical = before?.syncHealthy === false && previousFailureCount >= 3;
    if (!isCritical || wasCritical)
        return;
    const childName = String(after.childName || 'Child');
    const rawSource = String(after.syncFailureSource || 'DATA');
    const sourceNames = {
        APP_USAGE: 'app usage',
        YOUTUBE: 'YouTube history',
        BROWSER: 'browser history'
    };
    const sourceName = sourceNames[rawSource] || 'data';
    const failureAt = Number(after.lastSyncFailureAt || Date.now());
    await broadcastToParents(childId, {
        title: `Sync problem on ${childName}'s device`,
        body: `${sourceName} failed to sync ${failureCount} times. Open Device Health for details.`,
        type: 'SYNC_ERROR',
        childId,
        eventId: `sync-error-${childId}-${failureAt}`,
        clickAction: `/dashboard/${childId}?tab=overview#device-health`
    });
});
exports.onAppUpdatePublished = functions.firestore
    .document('appConfig/update')
    .onWrite(async (change) => {
    const after = change.after.data();
    if (!after)
        return;
    const before = change.before.exists ? change.before.data() : undefined;
    const versionCode = Number(after.latestVersionCode || 0);
    const previousVersionCode = Number(before?.latestVersionCode || 0);
    if (!Number.isFinite(versionCode) || versionCode <= previousVersionCode) {
        return;
    }
    const versionName = String(after.latestVersionName || versionCode);
    const mandatory = after.mandatoryUpdate === true || after.forceUpdate === true;
    const parentsSnapshot = await db.collection('parents').get();
    await Promise.all(parentsSnapshot.docs.map(parentDocument => notifyParent(parentDocument.id, {
        title: mandatory
            ? `KidsGuard v${versionName} update required`
            : `KidsGuard v${versionName} is available`,
        body: mandatory
            ? 'A mandatory child-app update has been published. Open Downloads to install it.'
            : 'A new child-app version is ready. Open Downloads to view the release notes.',
        type: 'APP_UPDATE',
        childId: '',
        eventId: `app-update-${versionCode}`,
        clickAction: '/download'
    })));
});
const RELEASE_DOWNLOAD_HOSTS = new Set([
    'github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
    'raw.githubusercontent.com',
    'firebasestorage.googleapis.com',
    'storage.googleapis.com'
]);
exports.verifyReleaseArtifact = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('unauthenticated', 'Verified administrator sign-in required.');
    }
    const adminSnapshot = await db
        .collection('platformAdmins')
        .doc(context.auth.uid)
        .get();
    const adminData = adminSnapshot.data();
    const allowedRoles = new Set([
        'SUPER_ADMIN',
        'PLATFORM_ADMIN',
        'DEV_ADMIN'
    ]);
    if (!adminSnapshot.exists ||
        adminData?.active !== true ||
        !allowedRoles.has(String(adminData?.role || ''))) {
        throw new functions.https.HttpsError('permission-denied', 'Active platform administrator access required.');
    }
    const downloadUrl = String(data?.apkDownloadUrl || '').trim();
    const expectedSha256 = String(data?.apkSha256 || '')
        .trim()
        .toLowerCase();
    let parsedUrl;
    try {
        parsedUrl = new URL(downloadUrl);
    }
    catch {
        throw new functions.https.HttpsError('invalid-argument', 'A valid APK download URL is required.');
    }
    if (parsedUrl.protocol !== 'https:' ||
        !RELEASE_DOWNLOAD_HOSTS.has(parsedUrl.hostname)) {
        throw new functions.https.HttpsError('invalid-argument', 'APK must be hosted on an approved HTTPS release host.');
    }
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid APK SHA-256 is required.');
    }
    const response = await fetch(downloadUrl, { redirect: 'follow' });
    if (!response.ok) {
        throw new functions.https.HttpsError('failed-precondition', `APK download failed with HTTP ${response.status}.`);
    }
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' ||
        !RELEASE_DOWNLOAD_HOSTS.has(finalUrl.hostname)) {
        throw new functions.https.HttpsError('failed-precondition', 'APK download redirected to an unapproved host.');
    }
    const maximumBytes = 250 * 1024 * 1024;
    const declaredBytes = Number(response.headers.get('content-length') || 0);
    if (declaredBytes > maximumBytes) {
        throw new functions.https.HttpsError('resource-exhausted', 'APK is larger than the 250 MB verification limit.');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maximumBytes) {
        throw new functions.https.HttpsError('failed-precondition', 'Downloaded APK is empty or exceeds the verification limit.');
    }
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new functions.https.HttpsError('failed-precondition', 'Downloaded file is not a valid APK/ZIP artifact.');
    }
    const actualSha256 = (0, crypto_1.createHash)('sha256').update(bytes).digest('hex');
    return {
        verified: actualSha256 === expectedSha256,
        expectedSha256,
        actualSha256,
        fileSizeBytes: bytes.length,
        finalUrl: response.url
    };
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
            const enabled = settings.configuredByParent === true &&
                settings.enabled === true;
            const requestedThreshold = Number(settings.thresholdMinutes);
            const thresholdMinutes = Number.isFinite(requestedThreshold) &&
                requestedThreshold >= 5
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
        .filter(m => normalizeFamilyRole(m.role) !== null)
        .map(m => m.uid);
    const promises = parentUids.map(uid => notifyParent(uid, { ...payload, familyId }));
    await Promise.all(promises);
}
exports.onTamperAlertCreated = functions.firestore
    .document("children/{childId}/tamperEvents/{eventId}")
    .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    if (data.type !== "TAMPER_ALERT") {
        return null;
    }
    const childId = String(context.params.childId || data.childId || "");
    const eventId = String(context.params.eventId || "");
    if (!childId) {
        console.warn("Tamper alert missing childId", {
            eventId,
            childId,
        });
        return null;
    }
    const payload = {
        type: "TAMPER_ALERT",
        title: data.title || "Security Alert",
        body: data.body ||
            "Someone tried to disable or remove KidsGuard protection.",
        childId,
        eventId,
        clickAction: data.clickAction || `/dashboard/${childId}`,
        familyId: data.familyId || "",
    };
    const parentUid = data.userId;
    if (parentUid) {
        await notifyParent(parentUid, payload);
    }
    else {
        console.warn("Tamper alert missing parentUid; using family fallback", {
            eventId,
            childId,
        });
        await broadcastToParents(childId, payload);
    }
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
        'DEVICE_OFFLINE': 'deviceStatus',
        'DEVICE_BACK_ONLINE': 'deviceStatus',
        'SYNC_ERROR': 'syncErrors',
        'APP_UPDATE': 'appUpdates',
        'PERMISSION_CHANGE_REQUEST': 'permissionChanges',
        'TAMPER_ALERT': 'securityAlerts',
        'PAIRING': 'pairing',
        'APP_INSTALLED': 'appUsage',
        'APP_ACCESS_REQUEST': 'appUsage',
        'APP_LIMIT_REACHED': 'appUsage',
        'BLOCKED_APP_ATTEMPT': 'appUsage',
        'REMOTE_CONTROL_OVERRIDE': 'deviceStatus',
        'WEEKLY_REPORT': 'appUsage'
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
        subscription.baseChildSlots >= 2
        ? subscription.baseChildSlots
        : 2;
    const extraChildSlots = Number.isInteger(subscription?.extraChildSlots) &&
        subscription.extraChildSlots >= 0
        ? subscription.extraChildSlots
        : 0;
    const maxChildSlots = Number.isInteger(subscription?.maxChildSlots) &&
        subscription.maxChildSlots >= 2
        ? subscription.maxChildSlots
        : 10;
    const totalAllowedSlots = baseChildSlots + extraChildSlots;
    return Math.min(maxChildSlots, Math.max(2, totalAllowedSlots));
}
exports.acceptPairingCode = functions.https.onCall(async (data, context) => {
    const parentalConsentVersion = '2026-09-27';
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to pair a child.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified before pairing a child device.');
    }
    const pairingCode = typeof data?.pairingCode === 'string'
        ? data.pairingCode.trim()
        : '';
    const familyId = typeof data?.familyId === 'string'
        ? data.familyId.trim()
        : '';
    const parentalConsentAccepted = data?.parentalConsentAccepted === true;
    const submittedConsentVersion = typeof data?.parentalConsentVersion === 'string'
        ? data.parentalConsentVersion.trim()
        : '';
    if (!parentalConsentAccepted ||
        submittedConsentVersion !== parentalConsentVersion) {
        throw new functions.https.HttpsError('failed-precondition', 'Current parental consent is required before pairing a child device.');
    }
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
            isManagerRole(member?.role));
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
        throw new functions.https.HttpsError('resource-exhausted', `Your current plan allows up to ${allowedChildSlots} child devices. Remove an existing child or add an extra child slot to continue.`);
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
                isManagerRole(member?.role));
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
            throw new functions.https.HttpsError('resource-exhausted', `Your current plan allows up to ${latestAllowedSlots} child devices. Remove an existing child or add an extra child slot to continue.`);
        }
        const childRef = db
            .collection('children')
            .doc(latestChildId);
        const consentRef = db
            .collection('parentalConsents')
            .doc(`${familyId}_${uid}_${latestChildId}`);
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
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            parentalConsentVersion,
            parentalConsentAt: admin.firestore.FieldValue.serverTimestamp(),
            parentalConsentBy: uid
        }, { merge: true });
        transaction.set(consentRef, {
            consentVersion: parentalConsentVersion,
            accepted: true,
            consentedAt: admin.firestore.FieldValue.serverTimestamp(),
            parentUid: uid,
            parentEmail: typeof context.auth?.token.email === 'string'
                ? context.auth.token.email
                : '',
            parentName,
            familyId,
            childId: latestChildId,
            deviceId: latestDeviceId,
            source: 'web_pairing',
            scope: [
                'device_monitoring',
                'location',
                'app_usage',
                'web_and_youtube_activity',
                'safety_alerts',
                'parental_controls'
            ]
        });
        transaction.update(pairingRef, {
            used: true,
            familyId,
            parentUid: uid,
            parentName,
            parentalConsentAccepted: true,
            parentalConsentVersion,
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
exports.checkInvitationEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError("permission-denied", "Your email must be verified.");
    }
    const email = typeof data?.email === "string"
        ? data.email.trim().toLowerCase()
        : "";
    if (!email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError("invalid-argument", "Please enter a valid email address.");
    }
    try {
        await admin.auth().getUserByEmail(email);
        return {
            available: false,
            message: "This email is already linked to another family. Please use a different email address."
        };
    }
    catch (error) {
        if (error?.code === "auth/user-not-found") {
            return {
                available: true
            };
        }
        console.error("Invitation email check failed:", error);
        throw new functions.https.HttpsError("internal", "Could not verify this email address.");
    }
});
exports.acceptFamilyInvitation = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to accept an invitation.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified before accepting an invitation.');
    }
    const inviteId = typeof data?.inviteId === 'string'
        ? data.inviteId.trim()
        : '';
    const token = typeof data?.token === 'string'
        ? data.token.trim()
        : '';
    const displayName = typeof data?.displayName === 'string'
        ? data.displayName.trim()
        : '';
    const dateOfBirth = typeof data?.dateOfBirth === 'string'
        ? data.dateOfBirth.trim()
        : '';
    const email = typeof context.auth?.token.email ===
        'string'
        ? context.auth.token.email
            .trim()
            .toLowerCase()
        : '';
    const parsedBirthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    const isValidBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
        !Number.isNaN(parsedBirthDate.getTime()) &&
        parsedBirthDate
            .toISOString()
            .slice(0, 10) === dateOfBirth &&
        parsedBirthDate.getTime() <=
            Date.now();
    if (displayName.length < 2 ||
        displayName.length > 80 ||
        !isValidBirthDate) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid full name and date of birth are required.');
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
    if (typeof inviteData.tokenHash !== 'string' ||
        inviteData.tokenHash !== token) {
        throw new functions.https.HttpsError('permission-denied', 'Invitation token is invalid.');
    }
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
    const role = normalizeFamilyRole(inviteData.role);
    if (typeof familyId !== 'string' ||
        !familyId ||
        role === null ||
        role === 'OWNER') {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation data is incomplete or invalid.');
    }
    const acceptedFamilyId = await db.runTransaction(async (transaction) => {
        const latestInviteSnapshot = await transaction.get(inviteRef);
        const familyRef = db
            .collection('families')
            .doc(familyId);
        const parentRef = db
            .collection('parents')
            .doc(uid);
        const familySnapshot = await transaction.get(familyRef);
        const parentSnapshot = await transaction.get(parentRef);
        if (!latestInviteSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation no longer exists.');
        }
        if (!familySnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Family not found.');
        }
        const existingParentData = parentSnapshot.exists
            ? parentSnapshot.data() || {}
            : {};
        const existingFamilyId = existingParentData.familyId ||
            existingParentData.activeFamilyId;
        if (typeof existingFamilyId === 'string' &&
            existingFamilyId &&
            existingFamilyId !== familyId) {
            throw new functions.https.HttpsError('already-exists', 'This account is already linked to another family.');
        }
        const latestInviteData = latestInviteSnapshot.data() || {};
        if (typeof latestInviteData.tokenHash !== 'string' ||
            latestInviteData.tokenHash !== token) {
            throw new functions.https.HttpsError('permission-denied', 'Invitation token is invalid.');
        }
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
        if (role === 'MANAGER') {
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
        transaction.set(parentRef, {
            uid,
            email,
            familyId,
            familyIds: admin.firestore.FieldValue.arrayUnion(familyId),
            activeFamilyId: familyId,
            role,
            displayName,
            dateOfBirth,
            lastLoginAt: admin.firestore.FieldValue
                .serverTimestamp(),
            updatedAt: admin.firestore.FieldValue
                .serverTimestamp()
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
    if (familySnapshot.data()?.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can export all family data.');
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
        const { ZipArchive } = await Promise.resolve().then(() => __importStar(require('archiver')));
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
        });
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/` +
            `${encodeURIComponent(bucket.name)}/o/` +
            `${encodeURIComponent(storagePath)}` +
            `?alt=media&token=` +
            `${encodeURIComponent(downloadToken)}`;
        await db.collection('auditLogs').add({
            actorUid: uid,
            actorEmail: context.auth?.token.email || null,
            familyId,
            action: 'DATA_EXPORTED',
            targetType: 'FAMILY',
            targetId: familyId,
            severity: 'NOTICE',
            metadata: {
                exportVersion: 1,
                fileName,
                expiresAt: expiresAt.toISOString()
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            familyId,
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
exports.ensureParentFamily = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const authenticatedUser = context.auth;
    const uid = authenticatedUser.uid;
    const parentRef = db.collection('parents').doc(uid);
    const familyId = (0, crypto_1.randomUUID)();
    const familyRef = db.collection('families').doc(familyId);
    return db.runTransaction(async (transaction) => {
        const parentSnapshot = await transaction.get(parentRef);
        if (!parentSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Parent profile not found.');
        }
        const parentData = parentSnapshot.data() || {};
        const existingFamilyId = typeof parentData.familyId === 'string' &&
            parentData.familyId
            ? parentData.familyId
            : typeof parentData.ownedFamilyId === 'string' &&
                parentData.ownedFamilyId
                ? parentData.ownedFamilyId
                : null;
        if (existingFamilyId) {
            return {
                success: true,
                familyId: existingFamilyId,
                created: false
            };
        }
        const displayName = typeof parentData.displayName === 'string' &&
            parentData.displayName.trim()
            ? parentData.displayName.trim()
            : 'New';
        const email = typeof authenticatedUser.token.email === 'string'
            ? authenticatedUser.token.email
            : null;
        transaction.create(familyRef, {
            familyId,
            ownerId: uid,
            members: [{
                    uid,
                    email,
                    displayName,
                    role: 'OWNER',
                    joinedAt: admin.firestore.Timestamp.now(),
                    assignedChildren: ['*']
                }],
            memberUids: [uid],
            managerUids: [uid],
            childDeviceIds: [],
            subscription: {
                status: 'PENDING',
                baseChildSlots: 2,
                extraChildSlots: 0,
                billingInterval: 'MONTHLY',
                currency: 'EUR',
                basePriceCents: 299,
                extraChildPriceCents: 199
            },
            settings: {
                name: `${displayName} Family`,
                timezone: 'Europe/Berlin',
                country: 'DE',
                language: 'en',
                dataRetentionDays: 365
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        transaction.update(parentRef, {
            familyId,
            ownedFamilyId: familyId,
            activeFamilyId: familyId,
            role: 'OWNER',
            familyProvisionedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            familyId,
            created: true
        };
    });
});
exports.purchaseExtraChildSlot = functions
    .runWith({ secrets: [paddleApiKey] })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const uid = context.auth.uid;
    const parentSnapshot = await db.collection('parents').doc(uid).get();
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== 'string' || !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const familyData = familySnapshot.data() || {};
    if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can purchase child slots.');
    }
    const subscription = familyData.subscription || {};
    const status = String(subscription.status || 'NONE').toUpperCase();
    if (status !== 'ACTIVE' && status !== 'TRIALING') {
        throw new functions.https.HttpsError('failed-precondition', 'An active subscription is required before adding a child slot.');
    }
    if (subscription.cancelAtPeriodEnd === true) {
        throw new functions.https.HttpsError('failed-precondition', 'Keep the subscription active before adding a child slot.');
    }
    const subscriptionId = subscription.paddleSubscriptionId;
    const extraChildPriceId = process.env.PADDLE_EXTRA_CHILD_PRICE_ID;
    if (typeof subscriptionId !== 'string' ||
        !subscriptionId ||
        !extraChildPriceId) {
        throw new functions.https.HttpsError('failed-precondition', 'Extra-child billing is not configured for this subscription.');
    }
    const maxSlots = Number.isInteger(subscription.maxChildSlots)
        ? Math.max(2, subscription.maxChildSlots)
        : 10;
    if (getAllowedChildSlots(familyData) >= maxSlots) {
        throw new functions.https.HttpsError('resource-exhausted', `This family has reached the maximum of ${maxSlots} child slots.`);
    }
    await db.runTransaction(async (transaction) => {
        const latestSnapshot = await transaction.get(familyRef);
        const latestData = latestSnapshot.data() || {};
        const latestSubscription = latestData.subscription || {};
        const pendingAt = Number(latestSubscription.extraChildPurchasePendingAt || 0);
        if (pendingAt > Date.now() - 5 * 60 * 1000) {
            throw new functions.https.HttpsError('aborted', 'An extra-child purchase is already processing.');
        }
        if (getAllowedChildSlots(latestData) >= maxSlots) {
            throw new functions.https.HttpsError('resource-exhausted', `This family has reached the maximum of ${maxSlots} child slots.`);
        }
        transaction.update(familyRef, {
            'subscription.extraChildPurchasePendingAt': Date.now(),
            'subscription.extraChildPurchasePendingBy': uid,
            'subscription.extraChildPurchaseStatus': 'PROCESSING'
        });
    });
    try {
        const expectedQuantity = await changePaddleExtraChildSlots(subscriptionId, extraChildPriceId, 1);
        await familyRef.update({
            'subscription.extraChildPurchaseExpectedQuantity': expectedQuantity,
            'subscription.extraChildPurchaseStatus': 'AWAITING_WEBHOOK'
        });
        await db.collection('auditLogs').add({
            actorUid: uid,
            actorEmail: context.auth.token.email || null,
            familyId,
            action: 'EXTRA_CHILD_SLOT_PURCHASED',
            targetType: 'SUBSCRIPTION',
            targetId: subscriptionId,
            severity: 'NOTICE',
            metadata: { expectedQuantity },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, expectedQuantity };
    }
    catch (error) {
        await familyRef.update({
            'subscription.extraChildPurchasePendingAt': admin.firestore.FieldValue.delete(),
            'subscription.extraChildPurchasePendingBy': admin.firestore.FieldValue.delete(),
            'subscription.extraChildPurchaseStatus': 'FAILED'
        });
        throw error;
    }
});
exports.removeExtraChildSlot = functions
    .runWith({ secrets: [paddleApiKey] })
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const uid = context.auth.uid;
    const parentSnapshot = await db.collection('parents').doc(uid).get();
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== 'string' || !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    const familyData = familySnapshot.data() || {};
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can remove child slots.');
    }
    const subscription = familyData.subscription || {};
    const extraSlots = Number(subscription.extraChildSlots || 0);
    const baseSlots = Number(subscription.baseChildSlots || 2);
    const connectedChildren = Array.isArray(familyData.childDeviceIds)
        ? familyData.childDeviceIds.length
        : 0;
    if (!Number.isInteger(extraSlots) || extraSlots < 1) {
        throw new functions.https.HttpsError('failed-precondition', 'There is no paid child slot to remove.');
    }
    if (connectedChildren > baseSlots + extraSlots - 1) {
        throw new functions.https.HttpsError('failed-precondition', 'Remove an unused child device before reducing the paid slot count.');
    }
    const subscriptionId = subscription.paddleSubscriptionId;
    const extraChildPriceId = process.env.PADDLE_EXTRA_CHILD_PRICE_ID;
    if (typeof subscriptionId !== 'string' || !subscriptionId || !extraChildPriceId) {
        throw new functions.https.HttpsError('failed-precondition', 'Extra-child billing is not configured for this subscription.');
    }
    await db.runTransaction(async (transaction) => {
        const latestSnapshot = await transaction.get(familyRef);
        const latestData = latestSnapshot.data() || {};
        const latestSubscription = latestData.subscription || {};
        const latestExtraSlots = Number(latestSubscription.extraChildSlots || 0);
        const latestBaseSlots = Number(latestSubscription.baseChildSlots || 2);
        const latestChildCount = Array.isArray(latestData.childDeviceIds)
            ? latestData.childDeviceIds.length
            : 0;
        const pendingAt = Number(latestSubscription.extraChildPurchasePendingAt || 0);
        if (pendingAt > Date.now() - 5 * 60 * 1000) {
            throw new functions.https.HttpsError('aborted', 'A child-slot billing change is already processing.');
        }
        if (latestExtraSlots < 1 || latestChildCount > latestBaseSlots + latestExtraSlots - 1) {
            throw new functions.https.HttpsError('failed-precondition', 'The slot is currently in use. Remove a child device first.');
        }
        transaction.update(familyRef, {
            'subscription.extraChildPurchasePendingAt': Date.now(),
            'subscription.extraChildPurchasePendingBy': uid,
            'subscription.extraChildPurchaseStatus': 'PROCESSING_REMOVAL'
        });
    });
    try {
        const expectedQuantity = await changePaddleExtraChildSlots(subscriptionId, extraChildPriceId, -1);
        await familyRef.update({
            'subscription.extraChildPurchaseExpectedQuantity': expectedQuantity,
            'subscription.extraChildPurchaseStatus': 'AWAITING_WEBHOOK'
        });
        await db.collection('auditLogs').add({
            actorUid: uid,
            actorEmail: context.auth.token.email || null,
            familyId,
            action: 'EXTRA_CHILD_SLOT_REMOVED',
            targetType: 'SUBSCRIPTION',
            targetId: subscriptionId,
            severity: 'NOTICE',
            metadata: { expectedQuantity },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, expectedQuantity };
    }
    catch (error) {
        await familyRef.update({
            'subscription.extraChildPurchasePendingAt': admin.firestore.FieldValue.delete(),
            'subscription.extraChildPurchasePendingBy': admin.firestore.FieldValue.delete(),
            'subscription.extraChildPurchaseStatus': 'FAILED'
        });
        throw error;
    }
});
exports.requestSubscriptionCancellation = functions
    .runWith({ secrets: [paddleApiKey] })
    .https.onCall(async (data, context) => {
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
    if (typeof familyId !== 'string' || !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const familyData = familySnapshot.data() || {};
    if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can cancel the subscription.');
    }
    const subscription = familyData.subscription || {};
    const status = String(subscription.status || 'NONE').toUpperCase();
    const cancellationConfirmed = status === 'CANCELED' ||
        status === 'CANCELLED' ||
        (subscription.cancelAtPeriodEnd === true &&
            subscription.cancellationStatus === 'CONFIRMED');
    if (cancellationConfirmed) {
        return {
            success: true,
            alreadyCanceled: true,
            requestId: subscription.cancellationRequestId || null,
            effectiveAt: subscription.cancellationEffectiveAt || null,
            pendingProviderConfirmation: false
        };
    }
    if (subscription.stripeSubscriptionId) {
        throw new functions.https.HttpsError('failed-precondition', 'This legacy subscription must be managed through support.');
    }
    const providerSubscriptionId = typeof subscription.paddleSubscriptionId === 'string'
        ? subscription.paddleSubscriptionId
        : null;
    const requestedAt = admin.firestore.Timestamp.now();
    const requestRef = db.collection('subscriptionCancellationRequests').doc();
    const reason = typeof data?.reason === 'string'
        ? data.reason.trim().slice(0, 500)
        : '';
    const subscribedAtMs = typeof subscription.subscribedAt?.toMillis === 'function'
        ? subscription.subscribedAt.toMillis()
        : typeof subscription.subscribedAt === 'number'
            ? subscription.subscribedAt
            : Number.NaN;
    let effectiveAt = subscription.trialEndsAt ||
        subscription.currentPeriodEndsAt ||
        (status === 'TRIALING' && Number.isFinite(subscribedAtMs)
            ? admin.firestore.Timestamp.fromMillis(subscribedAtMs + 7 * 24 * 60 * 60 * 1000)
            : requestedAt);
    let providerStatus = null;
    if (providerSubscriptionId) {
        const paddleSubscription = await callPaddleSubscriptionApi(providerSubscriptionId, 'cancel');
        providerStatus = paddleSubscription.status || null;
        const paddleEffectiveAt = paddleSubscription.scheduled_change?.effective_at ||
            paddleSubscription.trial_dates?.ends_at ||
            paddleSubscription.current_billing_period?.ends_at ||
            paddleSubscription.next_billed_at;
        if (paddleEffectiveAt) {
            const parsedEffectiveAt = admin.firestore.Timestamp.fromDate(new Date(paddleEffectiveAt));
            effectiveAt = parsedEffectiveAt;
        }
    }
    await db.runTransaction(async (transaction) => {
        transaction.set(requestRef, {
            requestId: requestRef.id,
            familyId,
            requestedBy: uid,
            requesterEmail: context.auth?.token.email || null,
            requestedAt,
            effectiveAt,
            subscriptionStatusAtRequest: status,
            providerSubscriptionId,
            provider: providerSubscriptionId ? 'PADDLE' : null,
            providerStatus,
            reason: reason || null,
            status: 'CONFIRMED',
            source: 'WEB_CANCELLATION_PAGE'
        });
        transaction.update(familyRef, {
            'subscription.cancelAtPeriodEnd': true,
            'subscription.cancellationRequestedAt': requestedAt,
            'subscription.cancellationRequestedBy': uid,
            'subscription.cancellationRequestId': requestRef.id,
            'subscription.cancellationEffectiveAt': effectiveAt,
            'subscription.cancellationStatus': 'CONFIRMED'
        });
    });
    await db.collection('auditLogs').add({
        actorUid: uid,
        actorEmail: context.auth?.token.email || null,
        familyId,
        action: 'SUBSCRIPTION_CANCELLATION_CONFIRMED',
        targetType: 'SUBSCRIPTION',
        targetId: requestRef.id,
        severity: 'NOTICE',
        metadata: {
            effectiveAt,
            provider: providerSubscriptionId ? 'PADDLE' : null
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        alreadyCanceled: false,
        requestId: requestRef.id,
        effectiveAt,
        pendingProviderConfirmation: false
    };
});
exports.resumeScheduledSubscription = functions
    .runWith({ secrets: [paddleApiKey] })
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
    const familyId = parentSnapshot.data()?.familyId;
    if (typeof familyId !== 'string' || !familyId) {
        throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
    }
    const familyRef = db.collection('families').doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Family not found.');
    }
    const familyData = familySnapshot.data() || {};
    if (familyData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the family owner can manage the subscription.');
    }
    const subscription = familyData.subscription || {};
    const cancellationEffectiveAt = subscription.cancellationEffectiveAt;
    const cancellationEffectiveAtMs = typeof cancellationEffectiveAt?.toMillis === 'function'
        ? cancellationEffectiveAt.toMillis()
        : typeof cancellationEffectiveAt === 'number'
            ? cancellationEffectiveAt
            : typeof cancellationEffectiveAt === 'string'
                ? Date.parse(cancellationEffectiveAt)
                : Number.NaN;
    if (Number.isFinite(cancellationEffectiveAtMs) &&
        cancellationEffectiveAtMs <= Date.now()) {
        await familyRef.update({
            'subscription.status': 'CANCELED',
            'subscription.cancelAtPeriodEnd': false,
            'subscription.cancellationStatus': 'COMPLETED',
            'subscription.cancelledAt': admin.firestore.FieldValue.serverTimestamp()
        });
        throw new functions.https.HttpsError('failed-precondition', 'This subscription has already ended. Start a new subscription instead.');
    }
    if (subscription.cancelAtPeriodEnd !== true) {
        return {
            success: true,
            wasScheduled: false
        };
    }
    const status = String(subscription.status || 'NONE').toUpperCase();
    if (status === 'CANCELED' ||
        status === 'CANCELLED' ||
        status === 'EXPIRED') {
        throw new functions.https.HttpsError('failed-precondition', 'This subscription has already ended. Start a new subscription instead.');
    }
    const providerSubscriptionId = typeof subscription.paddleSubscriptionId === 'string'
        ? subscription.paddleSubscriptionId
        : null;
    if (providerSubscriptionId) {
        await callPaddleSubscriptionApi(providerSubscriptionId, 'resume');
    }
    else if (subscription.stripeSubscriptionId) {
        throw new functions.https.HttpsError('failed-precondition', 'This legacy subscription must be managed through support.');
    }
    const requestId = subscription.cancellationRequestId;
    await db.runTransaction(async (transaction) => {
        transaction.update(familyRef, {
            'subscription.cancelAtPeriodEnd': false,
            'subscription.cancellationRequestedAt': admin.firestore.FieldValue.delete(),
            'subscription.cancellationRequestedBy': admin.firestore.FieldValue.delete(),
            'subscription.cancellationRequestId': admin.firestore.FieldValue.delete(),
            'subscription.cancellationEffectiveAt': admin.firestore.FieldValue.delete(),
            'subscription.cancellationStatus': admin.firestore.FieldValue.delete()
        });
        if (typeof requestId === 'string' && requestId) {
            transaction.set(db.collection('subscriptionCancellationRequests').doc(requestId), {
                status: 'REVOKED',
                revokedAt: admin.firestore.FieldValue.serverTimestamp(),
                revokedBy: uid
            }, { merge: true });
        }
    });
    await db.collection('auditLogs').add({
        actorUid: uid,
        actorEmail: context.auth?.token.email || null,
        familyId,
        action: 'SUBSCRIPTION_CANCELLATION_REVOKED',
        targetType: 'SUBSCRIPTION',
        targetId: requestId || familyId,
        severity: 'NOTICE',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        wasScheduled: true
    };
});
exports.reconcileExpiredSubscriptionCancellations = functions.pubsub
    .schedule('every 5 minutes')
    .timeZone('Europe/Berlin')
    .onRun(async () => {
    const snapshot = await db
        .collection('families')
        .where('subscription.cancelAtPeriodEnd', '==', true)
        .limit(500)
        .get();
    const now = Date.now();
    const batch = db.batch();
    let updated = 0;
    snapshot.docs.forEach((familyDoc) => {
        const subscription = familyDoc.data().subscription || {};
        const effectiveAt = subscription.cancellationEffectiveAt;
        const effectiveAtMs = typeof effectiveAt?.toMillis === 'function'
            ? effectiveAt.toMillis()
            : typeof effectiveAt === 'number'
                ? effectiveAt
                : typeof effectiveAt === 'string'
                    ? Date.parse(effectiveAt)
                    : Number.NaN;
        if (!Number.isFinite(effectiveAtMs) || effectiveAtMs > now)
            return;
        batch.update(familyDoc.ref, {
            'subscription.status': 'CANCELED',
            'subscription.cancelAtPeriodEnd': false,
            'subscription.cancellationStatus': 'COMPLETED',
            'subscription.cancelledAt': admin.firestore.FieldValue.serverTimestamp(),
            'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp()
        });
        updated += 1;
    });
    if (updated > 0)
        await batch.commit();
    console.log(`Reconciled ${updated} expired subscription cancellations.`);
    return null;
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
exports.cleanupFamilyRetentionData = (0, scheduler_1.onSchedule)({
    schedule: 'every day 04:30',
    timeZone: 'Europe/Berlin',
    timeoutSeconds: 540,
    memory: '1GiB'
}, async () => {
    const familiesSnapshot = await db
        .collection('families')
        .get();
    for (const familyDocument of familiesSnapshot.docs) {
        const familyId = familyDocument.id;
        const familyData = familyDocument.data() || {};
        const retentionDays = familyData.settings?.dataRetentionDays;
        if (typeof retentionDays !== 'number' ||
            !Number.isInteger(retentionDays) ||
            !ALLOWED_RETENTION_DAYS.has(retentionDays)) {
            continue;
        }
        try {
            const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
            const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(cutoffMs);
            const cutoffDay = new Date(cutoffMs)
                .toISOString()
                .slice(0, 10);
            const childIds = new Set(Array.isArray(familyData.childDeviceIds)
                ? familyData.childDeviceIds.filter((value) => typeof value === 'string' && value.length > 0)
                : []);
            const childrenSnapshot = await db
                .collection('children')
                .where('familyId', '==', familyId)
                .get();
            childrenSnapshot.docs.forEach(childDocument => childIds.add(childDocument.id));
            let deletedCount = 0;
            for (const childId of childIds) {
                const childRef = db
                    .collection('children')
                    .doc(childId);
                deletedCount += await deleteExpiredByField(childRef.collection('locations'), 'timestamp', cutoffMs, ['latest']);
                deletedCount += await deleteExpiredByField(childRef.collection('activities'), 'timestamp', cutoffMs);
                deletedCount += await deleteExpiredByField(childRef.collection('sosEvents'), 'timestamp', cutoffMs);
                deletedCount += await deleteExpiredByField(childRef.collection('routeDeviations'), 'timestamp', cutoffMs);
                deletedCount += await deleteExpiredByField(childRef.collection('appRestrictionEvents'), 'occurredAt', cutoffTimestamp);
                deletedCount += await deleteExpiredByField(childRef.collection('errorReports'), 'capturedAt', cutoffMs);
                deletedCount += await deleteExpiredDatedTrees(childRef, 'appUsage', cutoffDay);
                deletedCount += await deleteExpiredDatedTrees(childRef, 'webActivity', cutoffDay);
                const familyChildRef = db
                    .collection('families')
                    .doc(familyId)
                    .collection('children')
                    .doc(childId);
                deletedCount += await deleteExpiredByField(familyChildRef.collection('youtubeHistory'), 'capturedAt', cutoffMs);
                deletedCount += await deleteExpiredByField(familyChildRef.collection('browserHistory'), 'capturedAt', cutoffMs);
            }
            if (deletedCount > 0) {
                await db.collection('auditLogs').add({
                    actorUid: 'SYSTEM',
                    actorEmail: null,
                    familyId,
                    action: 'RETENTION_CLEANUP_COMPLETED',
                    targetType: 'FAMILY',
                    targetId: familyId,
                    severity: 'NOTICE',
                    metadata: {
                        retentionDays,
                        cutoffDay,
                        deletedCount
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            console.info(`Retention cleanup family=${familyId} ` +
                `days=${retentionDays} deleted=${deletedCount}`);
        }
        catch (error) {
            console.error(`Retention cleanup failed for family ${familyId}:`, error);
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
exports.sendFamilyInvitationEmail = functions
    .runWith({
    secrets: ['RESEND_API_KEY']
})
    .firestore
    .document('familyInvitations/{inviteId}')
    .onCreate(async (snapshot, context) => {
    const invitation = snapshot.data();
    const email = typeof invitation.email === 'string'
        ? invitation.email.trim()
        : '';
    const token = typeof invitation.tokenHash === 'string'
        ? invitation.tokenHash.trim()
        : '';
    if (!email ||
        !token ||
        invitation.status !== 'PENDING') {
        console.warn('Invitation email skipped:', context.params.inviteId);
        return;
    }
    const familyName = invitation.familyName ||
        'KidsGuard Family';
    const inviterName = invitation.invitedByName ||
        'A family member';
    const role = invitation.role ||
        'VIEWER';
    const inviteLink = `https://kidsguard-screen.vercel.app/` +
        `invite/${context.params.inviteId}` +
        `?token=${encodeURIComponent(token)}`;
    const { Resend } = await Promise.resolve().then(() => __importStar(require('resend')));
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
        from: 'KidsGuard <onboarding@resend.dev>',
        to: [email],
        subject: `${inviterName} invited you to ${familyName}`,
        html: `
              <div style="
                max-width:600px;
                margin:auto;
                padding:32px;
                font-family:Arial,sans-serif;
                color:#172033;
              ">
                <h1 style="color:#2457d6;">
                  KidsGuard Family Invitation
                </h1>

                <p>
                  <strong>
                    ${escapeEmailHtml(inviterName)}
                  </strong>
                  invited you to join
                  <strong>
                    ${escapeEmailHtml(familyName)}
                  </strong>.
                </p>

                <p>
                  Assigned role:
                  <strong>
                    ${escapeEmailHtml(role)}
                  </strong>
                </p>

                <a
                  href="${escapeEmailHtml(inviteLink)}"
                  style="
                    display:inline-block;
                    margin:20px 0;
                    padding:14px 24px;
                    background:#2457d6;
                    color:white;
                    text-decoration:none;
                    border-radius:10px;
                    font-weight:bold;
                  "
                >
                  View Invitation
                </a>

                <p style="
                  color:#64748b;
                  font-size:13px;
                ">
                  This invitation expires in 7 days.
                  Please sign in using the email address
                  that received this invitation.
                </p>
              </div>
            `
    });
    if (error) {
        console.error('Invitation email failed:', error);
        throw new Error(`Resend failed: ${error.message}`);
    }
    console.log('Invitation email sent:', {
        inviteId: context.params.inviteId,
        email,
        resendId: data?.id
    });
});
exports.removeChildFromFamily = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const uid = context.auth.uid;
    const childId = typeof data?.childId === 'string'
        ? data.childId.trim()
        : '';
    if (!childId) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid child ID is required.');
    }
    const parentRef = db
        .collection('parents')
        .doc(uid);
    const childRef = db
        .collection('children')
        .doc(childId);
    const auditRef = db
        .collection('auditLogs')
        .doc();
    await db.runTransaction(async (transaction) => {
        const parentSnapshot = await transaction.get(parentRef);
        if (!parentSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Parent profile not found.');
        }
        const parentData = parentSnapshot.data() || {};
        const familyId = parentData.familyId ||
            parentData.activeFamilyId;
        if (typeof familyId !== 'string' ||
            !familyId) {
            throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
        }
        const familyRef = db
            .collection('families')
            .doc(familyId);
        const familySnapshot = await transaction.get(familyRef);
        const childSnapshot = await transaction.get(childRef);
        if (!familySnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Family not found.');
        }
        if (!childSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Child not found.');
        }
        const familyData = familySnapshot.data() || {};
        const childData = childSnapshot.data() || {};
        if (familyData.ownerId !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the family owner can remove a child.');
        }
        if (childData.familyId !== familyId) {
            throw new functions.https.HttpsError('failed-precondition', 'This child is not connected to your family.');
        }
        const childIds = Array.isArray(familyData.childDeviceIds)
            ? familyData.childDeviceIds
            : [];
        transaction.update(familyRef, {
            childDeviceIds: childIds.filter((id) => id !== childId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        transaction.update(childRef, {
            familyId: null,
            removedAt: admin.firestore.FieldValue.serverTimestamp(),
            removedBy: uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        transaction.set(auditRef, {
            actorUid: uid,
            actorEmail: context.auth?.token.email || null,
            familyId,
            action: 'CHILD_REMOVED',
            targetType: 'CHILD',
            targetId: childId,
            severity: 'WARNING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    return {
        success: true,
        childId
    };
});
exports.removeFamilyMember = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Your email must be verified.');
    }
    const uid = context.auth.uid;
    const memberUid = typeof data?.memberUid === 'string'
        ? data.memberUid.trim()
        : '';
    if (!memberUid) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid member UID is required.');
    }
    if (memberUid === uid) {
        throw new functions.https.HttpsError('failed-precondition', 'The family owner cannot remove themselves.');
    }
    const ownerParentRef = db
        .collection('parents')
        .doc(uid);
    const memberParentRef = db
        .collection('parents')
        .doc(memberUid);
    const auditRef = db
        .collection('auditLogs')
        .doc();
    await db.runTransaction(async (transaction) => {
        const ownerParentSnapshot = await transaction.get(ownerParentRef);
        if (!ownerParentSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Owner profile not found.');
        }
        const ownerParentData = ownerParentSnapshot.data() || {};
        const familyId = ownerParentData.familyId ||
            ownerParentData.activeFamilyId;
        if (typeof familyId !== 'string' ||
            !familyId) {
            throw new functions.https.HttpsError('failed-precondition', 'No family is connected to this account.');
        }
        const familyRef = db
            .collection('families')
            .doc(familyId);
        const familySnapshot = await transaction.get(familyRef);
        const memberParentSnapshot = await transaction.get(memberParentRef);
        if (!familySnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Family not found.');
        }
        const familyData = familySnapshot.data() || {};
        if (familyData.ownerId !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the family owner can remove a member.');
        }
        const members = Array.isArray(familyData.members)
            ? familyData.members
            : [];
        const memberUids = Array.isArray(familyData.memberUids)
            ? familyData.memberUids
            : [];
        const managerUids = Array.isArray(familyData.managerUids)
            ? familyData.managerUids
            : [];
        if (!members.some((member) => member?.uid === memberUid) &&
            !memberUids.includes(memberUid)) {
            throw new functions.https.HttpsError('not-found', 'Family member not found.');
        }
        transaction.update(familyRef, {
            members: members.filter((member) => member?.uid !== memberUid),
            memberUids: memberUids.filter((id) => id !== memberUid),
            managerUids: managerUids.filter((id) => id !== memberUid),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        if (memberParentSnapshot.exists) {
            transaction.set(memberParentRef, {
                familyId: admin.firestore.FieldValue.delete(),
                activeFamilyId: admin.firestore.FieldValue.delete(),
                familyIds: admin.firestore.FieldValue.arrayRemove(familyId),
                role: 'VIEWER',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        transaction.set(auditRef, {
            actorUid: uid,
            actorEmail: context.auth?.token.email || null,
            familyId,
            action: 'MEMBER_REMOVED',
            targetType: 'MEMBER',
            targetId: memberUid,
            severity: 'WARNING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    return {
        success: true,
        memberUid
    };
});
exports.onFamilyMembershipSync = functions.firestore
    .document('families/{familyId}')
    .onUpdate(async (change, context) => {
    const familyId = context.params.familyId;
    const after = change.after.data() || {};
    const rawMembers = Array.isArray(after.members)
        ? after.members
        : [];
    const memberMap = new Map();
    for (const member of rawMembers) {
        if (member &&
            typeof member.uid === 'string' &&
            member.uid) {
            memberMap.set(member.uid, member);
        }
    }
    const members = Array.from(memberMap.values());
    const expectedMemberUids = Array.from(memberMap.keys());
    const expectedManagerUids = Array.from(new Set([
        after.ownerId,
        ...members
            .filter((member) => isManagerRole(member.role))
            .map((member) => member.uid)
    ].filter((uid) => typeof uid === 'string' && uid.length > 0)));
    const currentMemberUids = Array.isArray(after.memberUids)
        ? after.memberUids
        : [];
    const currentManagerUids = Array.isArray(after.managerUids)
        ? after.managerUids
        : [];
    const sameUidSet = (first, second) => {
        if (first.length !== second.length) {
            return false;
        }
        const secondSet = new Set(second);
        return first.every(value => secondSet.has(value));
    };
    const familyNeedsUpdate = !sameUidSet(currentMemberUids, expectedMemberUids) ||
        !sameUidSet(currentManagerUids, expectedManagerUids);
    const allKnownUids = Array.from(new Set([
        ...currentMemberUids.filter((uid) => typeof uid === 'string'),
        ...expectedMemberUids
    ]));
    const parentSnapshots = await Promise.all(allKnownUids.map(uid => db
        .collection('parents')
        .doc(uid)
        .get()));
    const batch = db.batch();
    let operationCount = 0;
    if (familyNeedsUpdate) {
        batch.update(change.after.ref, {
            members,
            memberUids: expectedMemberUids,
            managerUids: expectedManagerUids,
            updatedAt: admin.firestore.FieldValue
                .serverTimestamp()
        });
        operationCount += 1;
    }
    for (let index = 0; index < allKnownUids.length; index += 1) {
        const memberUid = allKnownUids[index];
        const parentSnapshot = parentSnapshots[index];
        if (!parentSnapshot.exists) {
            continue;
        }
        const parentRef = parentSnapshot.ref;
        const parentData = parentSnapshot.data() || {};
        const validMember = memberMap.get(memberUid);
        if (validMember) {
            const familyIds = Array.isArray(parentData.familyIds)
                ? parentData.familyIds
                : [];
            const needsParentUpdate = parentData.familyId !== familyId ||
                parentData.activeFamilyId !==
                    familyId ||
                parentData.role !==
                    validMember.role ||
                !familyIds.includes(familyId);
            if (needsParentUpdate) {
                batch.set(parentRef, {
                    familyId,
                    activeFamilyId: familyId,
                    familyIds: admin.firestore.FieldValue
                        .arrayUnion(familyId),
                    role: validMember.role,
                    updatedAt: admin.firestore.FieldValue
                        .serverTimestamp()
                }, { merge: true });
                operationCount += 1;
            }
        }
        else {
            const familyIds = Array.isArray(parentData.familyIds)
                ? parentData.familyIds
                : [];
            const isStillLinked = parentData.familyId === familyId ||
                parentData.activeFamilyId ===
                    familyId ||
                familyIds.includes(familyId);
            if (isStillLinked) {
                batch.set(parentRef, {
                    familyId: admin.firestore.FieldValue
                        .delete(),
                    activeFamilyId: admin.firestore.FieldValue
                        .delete(),
                    familyIds: admin.firestore.FieldValue
                        .arrayRemove(familyId),
                    role: 'VIEWER',
                    updatedAt: admin.firestore.FieldValue
                        .serverTimestamp()
                }, { merge: true });
                operationCount += 1;
            }
        }
    }
    if (operationCount > 0) {
        await batch.commit();
    }
});
function adminNotificationMillis(value) {
    if (typeof value === "number")
        return value;
    if (value instanceof Date)
        return value.getTime();
    if (typeof value?.toMillis === "function")
        return value.toMillis();
    if (typeof value?.seconds === "number")
        return value.seconds * 1000;
    return 0;
}
function adminNotificationEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function adminReminderDocumentId(key) {
    return Buffer.from(key)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
exports.sendAdminOpenNotificationReminder = functions
    .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 120 })
    .pubsub.schedule("every 5 minutes")
    .timeZone("Europe/Berlin")
    .onRun(async () => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const dashboardBase = "https://kidsguard-screen.vercel.app";
    const items = [];
    const [reportSnapshot, triageSnapshot, ticketSnapshot, childrenSnapshot] = await Promise.all([
        db.collectionGroup("errorReports").limit(500).get(),
        db.collection("issueTriage").get(),
        db.collection("supportTickets").get(),
        db.collection("children").limit(500).get()
    ]);
    const triage = new Map();
    triageSnapshot.docs.forEach(document => triage.set(document.id, document.data()));
    const issueReports = new Map();
    reportSnapshot.docs.forEach(document => {
        const report = document.data();
        const fingerprint = report.fingerprint || document.id;
        const existing = issueReports.get(fingerprint) || [];
        existing.push(report);
        issueReports.set(fingerprint, existing);
    });
    issueReports.forEach((reports, fingerprint) => {
        const state = triage.get(fingerprint);
        const stateUpdatedAt = adminNotificationMillis(state?.updatedAt);
        const reportsAfterResolution = state?.status === "RESOLVED"
            ? reports.filter(report => adminNotificationMillis(report.capturedAt) > stateUpdatedAt)
            : reports;
        if (state?.status === "ACKNOWLEDGED" || reportsAfterResolution.length === 0) {
            return;
        }
        const ordered = [...reportsAfterResolution].sort((a, b) => adminNotificationMillis(a.capturedAt) -
            adminNotificationMillis(b.capturedAt));
        const firstSeen = adminNotificationMillis(ordered[0]?.capturedAt);
        if (!firstSeen || firstSeen > oneHourAgo)
            return;
        const latest = ordered[ordered.length - 1];
        items.push({
            key: `issue:${fingerprint}:${firstSeen}`,
            type: "Issue",
            title: latest.tag || "Open application issue",
            detail: latest.message || "An application error needs review.",
            href: `/internal/issues?fingerprint=${encodeURIComponent(fingerprint)}`,
            activeSince: firstSeen
        });
    });
    ticketSnapshot.docs.forEach(document => {
        const ticket = document.data();
        if (!["OPEN", "IN_PROGRESS"].includes(ticket.status))
            return;
        const parentReplies = Array.isArray(ticket.replies)
            ? ticket.replies.filter((reply) => reply.authorRole === "PARENT")
            : [];
        const latestParentReply = parentReplies.sort((a, b) => adminNotificationMillis(b.createdAt) -
            adminNotificationMillis(a.createdAt))[0];
        const activeSince = adminNotificationMillis(latestParentReply?.createdAt || ticket.updatedAt || ticket.createdAt);
        if (!activeSince || activeSince > oneHourAgo)
            return;
        const ticketId = ticket.ticketId || document.id;
        items.push({
            key: `support:${ticketId}:${activeSince}`,
            type: "Support",
            title: ticket.subject || "Open support ticket",
            detail: latestParentReply?.message ||
                ticket.message ||
                "A support conversation needs a response.",
            href: `/internal/support?ticket=${encodeURIComponent(ticketId)}`,
            activeSince
        });
    });
    const deviceStatuses = await Promise.all(childrenSnapshot.docs.map(async (childDocument) => {
        const status = await db
            .collection("children")
            .doc(childDocument.id)
            .collection("status")
            .doc("current")
            .get();
        return {
            childId: childDocument.id,
            child: childDocument.data(),
            status: status.exists ? status.data() || {} : {}
        };
    }));
    deviceStatuses.forEach(({ childId, child, status }) => {
        const lastSeen = adminNotificationMillis(status.lastSeen);
        const syncFailureAt = adminNotificationMillis(status.lastSyncFailureAt);
        const syncFailure = status.syncHealthy === false;
        const stale = !lastSeen || lastSeen <= oneHourAgo;
        const offline = status.online === false;
        const activeSince = syncFailure
            ? (syncFailureAt || lastSeen)
            : lastSeen;
        if (!syncFailure && !stale && !offline)
            return;
        if (activeSince && activeSince > oneHourAgo)
            return;
        const childName = status.childName || child.name || child.childName || "Unknown child";
        const reason = syncFailure
            ? status.syncErrorMessage || "Device sync is unhealthy."
            : stale
                ? "Device has not reported for at least one hour."
                : "Device remains offline.";
        items.push({
            key: `device:${childId}:${activeSince || "never"}:${syncFailure ? "sync" : "offline"}`,
            type: "Device",
            title: `${childName} device warning`,
            detail: reason,
            href: `/internal/devices?child=${encodeURIComponent(childId)}`,
            activeSince: activeSince || 0
        });
    });
    const reminders = db.collection("adminNotificationReminders");
    const reminderSnapshot = await reminders.get();
    const activeKeys = new Set(items.map(item => item.key));
    const cleanupBatch = db.batch();
    reminderSnapshot.docs.forEach(document => {
        const key = document.data().key;
        if (!activeKeys.has(key))
            cleanupBatch.delete(document.ref);
    });
    await cleanupBatch.commit();
    const existingKeys = new Set(reminderSnapshot.docs.map(document => document.data().key));
    const unsent = items.filter(item => !existingKeys.has(item.key));
    if (unsent.length === 0) {
        console.log("Admin reminder: no newly eligible notifications.");
        return null;
    }
    const { Resend } = await Promise.resolve().then(() => __importStar(require("resend")));
    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows = unsent.map(item => {
        const url = `${dashboardBase}${item.href}`;
        return `
        <div style="padding:16px 0;border-bottom:1px solid #e2e8f0">
          <div style="font-size:12px;font-weight:700;color:#e11d48;text-transform:uppercase">
            ${adminNotificationEscape(item.type)}
          </div>
          <h3 style="margin:6px 0;color:#0f172a">
            ${adminNotificationEscape(item.title)}
          </h3>
          <p style="margin:0 0 10px;color:#475569">
            ${adminNotificationEscape(item.detail)}
          </p>
          <a href="${adminNotificationEscape(url)}" style="color:#e11d48;font-weight:700">
            Open exact item
          </a>
        </div>`;
    }).join("");
    const result = await resend.emails.send({
        from: "KidsGuard <onboarding@resend.dev>",
        to: ["arifhasnat07@gmail.com"],
        subject: `[KidsGuard Admin] ${unsent.length} item${unsent.length === 1 ? "" : "s"} open for 1 hour`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">
          <h2 style="color:#0f172a">KidsGuard admin attention required</h2>
          <p style="color:#475569">
            The following notification${unsent.length === 1 ? " has" : "s have"} remained open for at least one hour.
          </p>
          ${rows}
          <p style="margin-top:20px;color:#94a3b8;font-size:12px">
            This reminder is sent once per unresolved occurrence.
          </p>
        </div>`
    });
    if (result.error) {
        throw new Error(`Admin reminder email failed: ${result.error.message}`);
    }
    const sentBatch = db.batch();
    unsent.forEach(item => {
        sentBatch.set(reminders.doc(adminReminderDocumentId(item.key)), {
            key: item.key,
            type: item.type,
            title: item.title,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            recipient: "arifhasnat07@gmail.com"
        });
    });
    await sentBatch.commit();
    console.log(`Admin reminder sent for ${unsent.length} item(s).`);
    return null;
});
async function notifyPlatformAdmins(payload) {
    await db.collection("adminNotifications").doc(payload.eventId).set({
        type: payload.type,
        title: payload.title,
        body: payload.body,
        clickAction: payload.clickAction,
        eventId: payload.eventId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    const adminSnapshot = await db
        .collection("platformAdmins")
        .where("active", "==", true)
        .get();
    const allowedRoles = new Set(["SUPER_ADMIN", "PLATFORM_ADMIN", "DEV_ADMIN"]);
    const dashboardBase = "https://kidsguard-screen.vercel.app";
    const targetUrl = new URL(payload.clickAction, dashboardBase).href;
    for (const adminDocument of adminSnapshot.docs) {
        if (!allowedRoles.has(String(adminDocument.data().role || "")))
            continue;
        const tokenSnapshot = await db
            .collection("users")
            .doc(adminDocument.id)
            .collection("notificationTokens")
            .get();
        const tokenDocuments = tokenSnapshot.docs.filter(document => {
            const data = document.data();
            return data.enabled !== false && typeof data.token === "string" && data.token;
        });
        const tokens = tokenDocuments.map(document => String(document.data().token));
        if (tokens.length === 0)
            continue;
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: payload.title,
                body: payload.body
            },
            data: {
                type: payload.type,
                eventId: payload.eventId,
                title: payload.title,
                body: payload.body,
                clickAction: targetUrl,
                url: targetUrl
            },
            webpush: {
                notification: {
                    icon: `${dashboardBase}/app-icon.png`,
                    badge: `${dashboardBase}/symbol.png`
                },
                fcmOptions: {
                    link: targetUrl
                }
            }
        });
        const invalidDeletes = [];
        response.responses.forEach((item, index) => {
            const code = item.error?.code;
            if (code === "messaging/invalid-registration-token" ||
                code === "messaging/registration-token-not-registered") {
                invalidDeletes.push(tokenDocuments[index].ref.delete());
            }
        });
        await Promise.all(invalidDeletes);
    }
}
async function notifyPlatformAdminsOnce(payload) {
    const existing = await db.collection("adminNotifications").doc(payload.eventId).get();
    if (existing.exists)
        return;
    await notifyPlatformAdmins(payload);
}
const RELEASE_ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RELEASE_PENDING_ALERT_MS = 6 * 60 * 60 * 1000;
const RELEASE_LOW_ADOPTION_ALERT_MS = 24 * 60 * 60 * 1000;
exports.monitorReleaseRollout = functions.pubsub
    .schedule("every 60 minutes")
    .timeZone("Europe/Berlin")
    .onRun(async () => {
    const configSnapshot = await db.doc("appConfig/update").get();
    if (!configSnapshot.exists)
        return null;
    const config = configSnapshot.data() || {};
    const versionCode = Number(config.latestVersionCode || 0);
    const versionName = String(config.latestVersionName || versionCode);
    const releasedAt = adminNotificationMillis(config.releasedAt);
    if (!versionCode || !releasedAt || config.rolloutPaused === true)
        return null;
    const childrenSnapshot = await db.collection("children").limit(500).get();
    const statuses = await Promise.all(childrenSnapshot.docs.map(async (child) => {
        const statusSnapshot = await child.ref.collection("status").doc("current").get();
        return statusSnapshot.exists ? statusSnapshot.data() || {} : {};
    }));
    const activeCutoff = Date.now() - RELEASE_ACTIVE_WINDOW_MS;
    const activeStatuses = statuses.filter(status => adminNotificationMillis(status.lastSeen) >= activeCutoff);
    const reporting = activeStatuses.filter(status => String(status.appVersion || "").trim().length > 0);
    const normalize = (value) => String(value || "").trim().replace(/^v/i, "");
    const updated = reporting.filter(status => normalize(status.appVersion) === normalize(versionName)).length;
    const pending = reporting.length - updated;
    const unknown = activeStatuses.length - reporting.length;
    const age = Date.now() - releasedAt;
    const adoption = reporting.length > 0
        ? Math.round((updated / reporting.length) * 100)
        : 0;
    if (activeStatuses.length > 0 && updated === activeStatuses.length) {
        await notifyPlatformAdminsOnce({
            type: "ADMIN_RELEASE",
            eventId: `release-rollout-complete-${versionCode}`,
            title: `v${versionName} rollout complete`,
            body: `All ${activeStatuses.length} active devices are updated.`,
            clickAction: "/internal/releases"
        });
        return null;
    }
    if (age >= RELEASE_LOW_ADOPTION_ALERT_MS && adoption < 90) {
        await notifyPlatformAdminsOnce({
            type: "ADMIN_RELEASE",
            eventId: `release-low-adoption-${versionCode}`,
            title: `v${versionName} rollout needs attention`,
            body: `${adoption}% adoption after 24 hours: ${pending} pending and ${unknown} version unknown.`,
            clickAction: "/internal/releases"
        });
    }
    else if (age >= RELEASE_PENDING_ALERT_MS && (pending > 0 || unknown > 0)) {
        await notifyPlatformAdminsOnce({
            type: "ADMIN_RELEASE",
            eventId: `release-pending-${versionCode}`,
            title: `v${versionName} rollout is still pending`,
            body: `${pending} active devices need the update; ${unknown} have not reported a version.`,
            clickAction: "/internal/releases"
        });
    }
    return null;
});
exports.onAdminIssueCreatedPush = functions.firestore
    .document("children/{childId}/errorReports/{reportId}")
    .onCreate(async (snapshot, context) => {
    const report = snapshot.data();
    const fingerprint = String(report.fingerprint || context.params.reportId);
    await notifyPlatformAdmins({
        type: "ADMIN_ISSUE",
        eventId: `issue-${context.params.reportId}`,
        title: String(report.tag || "New KidsGuard issue"),
        body: String(report.message || "A new application issue needs review."),
        clickAction: `/internal/issues?fingerprint=${encodeURIComponent(fingerprint)}`
    });
    return null;
});
exports.onAdminSupportActivityPush = functions.firestore
    .document("supportTickets/{ticketId}")
    .onWrite(async (change, context) => {
    if (!change.after.exists)
        return null;
    const after = change.after.data() || {};
    const before = change.before.exists ? change.before.data() || {} : null;
    const afterReplies = Array.isArray(after.replies) ? after.replies : [];
    const beforeReplies = Array.isArray(before?.replies) ? before?.replies : [];
    const created = !change.before.exists;
    const newReply = afterReplies.length > beforeReplies.length
        ? afterReplies[afterReplies.length - 1]
        : null;
    const newParentMessage = newReply?.authorRole === "PARENT";
    const newAdminReply = newReply?.authorRole === "ADMIN" ||
        newReply?.authorRole === "SUPPORT";
    if (created || newParentMessage) {
        await notifyPlatformAdmins({
            type: "ADMIN_SUPPORT",
            eventId: `support-${context.params.ticketId}-${afterReplies.length}`,
            title: String(after.subject || "New support message"),
            body: String(newParentMessage
                ? newReply.message
                : after.message || "A new support ticket needs a response."),
            clickAction: `/internal/support?ticket=${encodeURIComponent(context.params.ticketId)}`
        });
    }
    if (newAdminReply && typeof after.parentUid === "string" && after.parentUid) {
        await notifyParent(after.parentUid, {
            type: "SUPPORT_REPLY",
            title: "New support reply",
            body: String(newReply.message || "KidsGuard Support replied to your ticket."),
            childId: "",
            eventId: `support-reply-${context.params.ticketId}-${newReply.replyId || afterReplies.length}`,
            clickAction: `/support/${encodeURIComponent(context.params.ticketId)}`,
            familyId: String(after.familyId || "")
        });
    }
    return null;
});
exports.onAdminDeviceWarningPush = functions.firestore
    .document("children/{childId}/status/current")
    .onWrite(async (change, context) => {
    if (!change.after.exists)
        return null;
    const after = change.after.data() || {};
    const before = change.before.exists ? change.before.data() || {} : {};
    const syncBecameUnhealthy = after.syncHealthy === false && before.syncHealthy !== false;
    const deviceWentOffline = after.online === false && before.online !== false;
    if (!syncBecameUnhealthy && !deviceWentOffline)
        return null;
    const childSnapshot = await db
        .collection("children")
        .doc(context.params.childId)
        .get();
    const child = childSnapshot.data() || {};
    const childName = String(after.childName || child.name || child.childName || "Child");
    const body = syncBecameUnhealthy
        ? String(after.syncErrorMessage || "Device sync is unhealthy.")
        : `${childName}'s device went offline.`;
    await notifyPlatformAdmins({
        type: "ADMIN_DEVICE",
        eventId: `device-${context.params.childId}-${Date.now()}`,
        title: `${childName} device warning`,
        body,
        clickAction: `/internal/devices?child=${encodeURIComponent(context.params.childId)}`
    });
    return null;
});
function normalizedSubscriptionStatus(value) {
    return String(value || "").trim().toUpperCase();
}
function isActiveSubscriptionStatus(value) {
    return ["ACTIVE", "TRIAL", "TRIALING", "SUBSCRIBED"].includes(normalizedSubscriptionStatus(value));
}
function isCancelledSubscriptionStatus(value) {
    return ["CANCELLED", "CANCELED"].includes(normalizedSubscriptionStatus(value));
}
async function subscriptionCustomerLabel(family) {
    const ownerId = typeof family.ownerId === "string" ? family.ownerId : "";
    if (ownerId) {
        const ownerSnapshot = await db.collection("parents").doc(ownerId).get();
        const owner = ownerSnapshot.data() || {};
        return String(owner.displayName ||
            owner.email ||
            family.settings?.name ||
            family.name ||
            "New customer");
    }
    return String(family.settings?.name || family.name || "New customer");
}
exports.onAdminSubscriptionChangedPush = functions.firestore
    .document("families/{familyId}")
    .onWrite(async (change, context) => {
    if (!change.after.exists)
        return null;
    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};
    const beforeStatus = normalizedSubscriptionStatus(before.subscription?.status);
    const afterStatus = normalizedSubscriptionStatus(after.subscription?.status);
    if (beforeStatus === afterStatus)
        return null;
    const becameActive = isActiveSubscriptionStatus(afterStatus) &&
        !isActiveSubscriptionStatus(beforeStatus);
    const becameCancelled = isCancelledSubscriptionStatus(afterStatus) &&
        !isCancelledSubscriptionStatus(beforeStatus);
    if (!becameActive && !becameCancelled)
        return null;
    const familyId = context.params.familyId;
    const customer = await subscriptionCustomerLabel(after);
    const trackingRef = db
        .collection("adminSubscriptionNotifications")
        .doc(familyId);
    if (becameActive) {
        await trackingRef.set({
            familyId,
            customer,
            subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
            retentionNotified: false,
            cancelledAt: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await notifyPlatformAdmins({
            type: "ADMIN_SUBSCRIPTION",
            eventId: `subscription-started-${familyId}-${context.eventId}`,
            title: "New customer subscribed",
            body: `${customer} started a subscription.`,
            clickAction: `/internal/customers?family=${encodeURIComponent(familyId)}`
        });
    }
    if (becameCancelled) {
        await trackingRef.set({
            familyId,
            customer,
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await notifyPlatformAdmins({
            type: "ADMIN_SUBSCRIPTION",
            eventId: `subscription-cancelled-${familyId}-${context.eventId}`,
            title: "Customer cancelled subscription",
            body: `${customer} cancelled their subscription.`,
            clickAction: `/internal/customers?family=${encodeURIComponent(familyId)}`
        });
    }
    return null;
});
exports.sendAdminSevenDaySubscriptionPush = functions.pubsub
    .schedule("every 60 minutes")
    .timeZone("Europe/Berlin")
    .onRun(async () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const trackingSnapshot = await db
        .collection("adminSubscriptionNotifications")
        .limit(500)
        .get();
    for (const trackingDocument of trackingSnapshot.docs) {
        const tracking = trackingDocument.data();
        if (tracking.retentionNotified === true)
            continue;
        const subscribedAt = adminNotificationMillis(tracking.subscribedAt);
        if (!subscribedAt || subscribedAt > sevenDaysAgo)
            continue;
        const familySnapshot = await db
            .collection("families")
            .doc(trackingDocument.id)
            .get();
        if (!familySnapshot.exists)
            continue;
        const family = familySnapshot.data() || {};
        if (!isActiveSubscriptionStatus(family.subscription?.status))
            continue;
        const customer = tracking.customer || await subscriptionCustomerLabel(family);
        await notifyPlatformAdmins({
            type: "ADMIN_SUBSCRIPTION",
            eventId: `subscription-seven-days-${trackingDocument.id}-${subscribedAt}`,
            title: "Customer active after 7 days",
            body: `${customer} kept their subscription active for 7 days.`,
            clickAction: `/internal/customers?family=${encodeURIComponent(trackingDocument.id)}`
        });
        await trackingDocument.ref.set({
            retentionNotified: true,
            retentionNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
    return null;
});
function weeklyDateKey(value) {
    return value.toISOString().slice(0, 10);
}
function weeklyDateKeys(startMs, count) {
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(startMs + index * 24 * 60 * 60 * 1000);
        return weeklyDateKey(date);
    });
}
async function weeklyAppUsage(childId, dateKeys) {
    const snapshots = await Promise.all(dateKeys.map(dateKey => db.collection("children")
        .doc(childId)
        .collection("appUsage")
        .doc(dateKey)
        .collection("apps")
        .get()));
    const appTotals = new Map();
    let total = 0;
    snapshots.forEach(snapshot => snapshot.docs.forEach(document => {
        const data = document.data();
        const totalTimeMs = Number(data.totalTimeMs || 0);
        if (totalTimeMs <= 0)
            return;
        total += totalTimeMs;
        const packageName = String(data.packageName || document.id);
        const current = appTotals.get(packageName) || {
            appName: String(data.appName || "Unknown app"),
            packageName,
            totalTimeMs: 0
        };
        current.totalTimeMs += totalTimeMs;
        appTotals.set(packageName, current);
    }));
    return {
        total,
        apps: [...appTotals.values()]
            .sort((first, second) => second.totalTimeMs - first.totalTimeMs)
            .slice(0, 5)
    };
}
async function buildWeeklySafetyReport(familyId, periodStart, periodEnd) {
    const familyRef = db.collection("families").doc(familyId);
    const familySnapshot = await familyRef.get();
    if (!familySnapshot.exists)
        throw new Error(`Family ${familyId} not found`);
    const currentKeys = weeklyDateKeys(periodStart, 7);
    const previousStart = periodStart - 7 * 24 * 60 * 60 * 1000;
    const previousKeys = weeklyDateKeys(previousStart, 7);
    const childSnapshot = await db.collection("children")
        .where("familyId", "==", familyId)
        .get();
    const childReports = await Promise.all(childSnapshot.docs.map(async (childDocument) => {
        const childId = childDocument.id;
        const child = childDocument.data();
        const childRef = db.collection("children").doc(childId);
        const familyChildRef = familyRef.collection("children").doc(childId);
        const [currentUsage, previousUsage, youtubeSnapshot, browserSnapshot, installedSnapshot, restrictionSnapshot, statusSnapshot] = await Promise.all([
            weeklyAppUsage(childId, currentKeys),
            weeklyAppUsage(childId, previousKeys),
            familyChildRef.collection("youtubeHistory")
                .where("capturedAt", ">=", periodStart)
                .where("capturedAt", "<=", periodEnd)
                .get(),
            familyChildRef.collection("browserHistory")
                .where("capturedAt", ">=", periodStart)
                .where("capturedAt", "<=", periodEnd)
                .get(),
            childRef.collection("installedApps").get(),
            childRef.collection("appRestrictionEvents")
                .where("occurredAt", ">=", periodStart)
                .where("occurredAt", "<=", periodEnd)
                .get(),
            childRef.collection("status").doc("current").get()
        ]);
        const installedApps = installedSnapshot.docs.filter(document => {
            const data = document.data();
            const installedAt = adminNotificationMillis(data.installedAt || data.firstInstallTime || data.createdAt);
            return installedAt >= periodStart && installedAt <= periodEnd;
        }).length;
        const status = statusSnapshot.data() || {};
        return {
            childId,
            childName: String(status.childName || child.name || child.childName || "Child"),
            screenTimeMs: currentUsage.total,
            previousScreenTimeMs: previousUsage.total,
            youtubeViews: youtubeSnapshot.size,
            browserVisits: browserSnapshot.size,
            installedApps,
            blockedAttempts: restrictionSnapshot.size,
            deviceOnline: status.online === true,
            topApps: currentUsage.apps
        };
    }));
    const notificationSnapshot = await db.collection("notifications")
        .where("familyId", "==", familyId)
        .limit(1000)
        .get();
    const safetyTypes = new Set([
        "SOS",
        "TAMPER_ALERT",
        "PERMISSION_CHANGE_REQUEST",
        "SYNC_ERROR",
        "BATTERY",
        "DEVICE_OFFLINE"
    ]);
    const safetyAlerts = notificationSnapshot.docs.filter(document => {
        const data = document.data();
        const createdAt = adminNotificationMillis(data.createdAt);
        return createdAt >= periodStart && createdAt <= periodEnd &&
            safetyTypes.has(String(data.type || ""));
    }).length;
    const screenTimeMs = childReports.reduce((sum, child) => sum + child.screenTimeMs, 0);
    const previousScreenTimeMs = childReports.reduce((sum, child) => sum + child.previousScreenTimeMs, 0);
    const changePercent = previousScreenTimeMs > 0
        ? Math.round(((screenTimeMs - previousScreenTimeMs) / previousScreenTimeMs) * 100)
        : screenTimeMs > 0 ? 100 : 0;
    const totals = {
        screenTimeMs,
        previousScreenTimeMs,
        screenTimeChangePercent: changePercent,
        youtubeViews: childReports.reduce((sum, child) => sum + child.youtubeViews, 0),
        browserVisits: childReports.reduce((sum, child) => sum + child.browserVisits, 0),
        installedApps: childReports.reduce((sum, child) => sum + child.installedApps, 0),
        blockedAttempts: childReports.reduce((sum, child) => sum + child.blockedAttempts, 0),
        safetyAlerts,
        offlineDevices: childReports.filter(child => !child.deviceOnline).length
    };
    const highlights = [];
    if (totals.blockedAttempts > 0) {
        highlights.push(`${totals.blockedAttempts} blocked-app attempt${totals.blockedAttempts === 1 ? "" : "s"} need review.`);
    }
    if (totals.safetyAlerts > 0) {
        highlights.push(`${totals.safetyAlerts} safety alert${totals.safetyAlerts === 1 ? "" : "s"} were recorded.`);
    }
    if (totals.offlineDevices > 0) {
        highlights.push(`${totals.offlineDevices} child device${totals.offlineDevices === 1 ? " is" : "s are"} currently offline.`);
    }
    highlights.push(changePercent === 0
        ? "Screen time is unchanged from the previous seven days."
        : `Screen time is ${Math.abs(changePercent)}% ${changePercent > 0 ? "higher" : "lower"} than the previous seven days.`);
    if (totals.installedApps > 0) {
        highlights.push(`${totals.installedApps} new app${totals.installedApps === 1 ? " was" : "s were"} installed.`);
    }
    if (highlights.length === 1) {
        highlights.unshift("No urgent safety event was recorded this week.");
    }
    const reportId = weeklyDateKey(new Date(periodEnd));
    const report = {
        familyId,
        periodStart,
        periodEnd,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        childReports,
        totals,
        highlights,
        version: 1
    };
    await familyRef.collection("weeklyReports").doc(reportId).set(report, { merge: true });
    return { reportId, report };
}
exports.generateWeeklySafetyReportNow = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError("unauthenticated", "Verified sign-in required.");
    }
    const familyId = typeof data?.familyId === "string" ? data.familyId : "";
    if (!familyId) {
        throw new functions.https.HttpsError("invalid-argument", "familyId is required.");
    }
    const familySnapshot = await db.collection("families").doc(familyId).get();
    const family = familySnapshot.data() || {};
    const members = new Set([
        family.ownerId,
        ...(Array.isArray(family.memberUids) ? family.memberUids : []),
        ...(Array.isArray(family.managerUids) ? family.managerUids : [])
    ].filter((value) => typeof value === "string" && value.length > 0));
    if (!familySnapshot.exists || !members.has(context.auth.uid)) {
        throw new functions.https.HttpsError("permission-denied", "Family access denied.");
    }
    const periodEnd = Date.now();
    const periodStart = periodEnd - 7 * 24 * 60 * 60 * 1000;
    const result = await buildWeeklySafetyReport(familyId, periodStart, periodEnd);
    return { reportId: result.reportId };
});
exports.generateWeeklySafetyReports = functions
    .runWith({ secrets: ["RESEND_API_KEY"], timeoutSeconds: 540, memory: "1GB" })
    .pubsub.schedule("0 8 * * 1")
    .timeZone("Europe/Berlin")
    .onRun(async () => {
    const now = new Date();
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const periodEnd = todayStart - 1;
    const periodStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const familiesSnapshot = await db.collection("families").limit(500).get();
    const { Resend } = await Promise.resolve().then(() => __importStar(require("resend")));
    const resend = new Resend(process.env.RESEND_API_KEY);
    for (const familyDocument of familiesSnapshot.docs) {
        try {
            const family = familyDocument.data();
            const result = await buildWeeklySafetyReport(familyDocument.id, periodStart, periodEnd);
            const memberIds = [...new Set([
                    family.ownerId,
                    ...(Array.isArray(family.memberUids) ? family.memberUids : []),
                    ...(Array.isArray(family.managerUids) ? family.managerUids : [])
                ].filter((value) => typeof value === "string" && value.length > 0))];
            for (const parentId of memberIds) {
                const parentSnapshot = await db.collection("parents").doc(parentId).get();
                if (!parentSnapshot.exists)
                    continue;
                const parent = parentSnapshot.data() || {};
                await notifyParent(parentId, {
                    type: "WEEKLY_REPORT",
                    title: "Your weekly safety report is ready",
                    body: `${result.report.totals.screenTimeChangePercent > 0 ? "+" : ""}${result.report.totals.screenTimeChangePercent}% screen-time change · ${result.report.totals.safetyAlerts} safety alerts`,
                    childId: "",
                    familyId: familyDocument.id,
                    eventId: `weekly-report-${familyDocument.id}-${result.reportId}`,
                    clickAction: `/reports?week=${encodeURIComponent(result.reportId)}`
                });
                if (typeof parent.email === "string" && parent.email) {
                    await resend.emails.send({
                        from: "KidsGuard <onboarding@resend.dev>",
                        to: [parent.email],
                        subject: "Your KidsGuard weekly safety report",
                        html: `
                <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a">
                  <h2>Your weekly safety report is ready</h2>
                  <p>Screen time: <strong>${Math.round(result.report.totals.screenTimeMs / 60000)} minutes</strong></p>
                  <p>YouTube: <strong>${result.report.totals.youtubeViews}</strong> · Web visits: <strong>${result.report.totals.browserVisits}</strong></p>
                  <p>Blocked attempts: <strong>${result.report.totals.blockedAttempts}</strong> · Safety alerts: <strong>${result.report.totals.safetyAlerts}</strong></p>
                  <p><a href="https://kidsguard-screen.vercel.app/reports?week=${encodeURIComponent(result.reportId)}" style="color:#2563eb;font-weight:700">Open full weekly report</a></p>
                </div>`
                    });
                }
            }
        }
        catch (error) {
            console.error(`Weekly report failed for family ${familyDocument.id}:`, error);
        }
    }
    return null;
});
function verifyPaddleWebhookSignature(rawBody, signatureHeader, secret) {
    const parts = signatureHeader.split(';');
    const timestamp = parts
        .find((part) => part.startsWith('ts='))
        ?.slice(3);
    const signatures = parts
        .filter((part) => part.startsWith('h1='))
        .map((part) => part.slice(3))
        .filter(Boolean);
    if (!timestamp || signatures.length === 0) {
        return false;
    }
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) ||
        Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
        return false;
    }
    const signedPayload = `${timestamp}:${rawBody.toString('utf8')}`;
    const expected = (0, crypto_1.createHmac)('sha256', secret)
        .update(signedPayload)
        .digest();
    return signatures.some((signature) => {
        if (!/^[a-f0-9]{64}$/i.test(signature)) {
            return false;
        }
        const supplied = Buffer.from(signature, 'hex');
        return supplied.length === expected.length &&
            (0, crypto_1.timingSafeEqual)(supplied, expected);
    });
}
function paddleStatus(value) {
    switch (String(value || '').toLowerCase()) {
        case 'trialing':
            return 'TRIALING';
        case 'active':
            return 'ACTIVE';
        case 'past_due':
            return 'PAST_DUE';
        case 'paused':
            return 'PAUSED';
        case 'canceled':
            return 'CANCELED';
        default:
            return 'NONE';
    }
}
function paddleDateMillis(value) {
    if (typeof value !== 'string' || !value)
        return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}
exports.paddleBillingWebhook = functions
    .runWith({
    secrets: [paddleWebhookSecret],
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.set('Allow', 'POST').status(405).send('Method Not Allowed');
        return;
    }
    const signatureHeader = req.get('paddle-signature') || '';
    const secret = paddleWebhookSecret.value();
    if (!secret ||
        !verifyPaddleWebhookSignature(req.rawBody, signatureHeader, secret)) {
        console.warn('Rejected Paddle webhook with invalid signature.');
        res.status(401).send('Invalid signature');
        return;
    }
    let payload;
    try {
        payload = JSON.parse(req.rawBody.toString('utf8'));
    }
    catch {
        res.status(400).send('Invalid JSON');
        return;
    }
    const eventId = typeof payload.event_id === 'string'
        ? payload.event_id.trim()
        : '';
    const eventType = typeof payload.event_type === 'string'
        ? payload.event_type.trim()
        : '';
    const data = payload.data || {};
    const customData = data.custom_data &&
        typeof data.custom_data === 'object'
        ? data.custom_data
        : {};
    const familyId = typeof customData.familyId === 'string'
        ? customData.familyId.trim()
        : '';
    const parentUid = typeof customData.parentUid === 'string'
        ? customData.parentUid.trim()
        : '';
    if (!eventId || !eventType) {
        res.status(400).send('Missing event identity');
        return;
    }
    if (!familyId) {
        console.error(`Paddle event ${eventId} is missing custom_data.familyId.`);
        res.status(422).send('Missing family mapping');
        return;
    }
    const eventRef = db
        .collection('paddleWebhookEvents')
        .doc(eventId);
    const familyRef = db
        .collection('families')
        .doc(familyId);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const [eventSnapshot, familySnapshot] = await Promise.all([
                transaction.get(eventRef),
                transaction.get(familyRef)
            ]);
            if (eventSnapshot.exists) {
                return 'duplicate';
            }
            if (!familySnapshot.exists) {
                throw new Error('FAMILY_NOT_FOUND');
            }
            const familyData = familySnapshot.data() || {};
            if (parentUid &&
                familyData.ownerId &&
                familyData.ownerId !== parentUid) {
                throw new Error('OWNER_MISMATCH');
            }
            const subscription = familyData.subscription || {};
            const patch = {
                'subscription.provider': 'PADDLE',
                'subscription.lastPaddleEventId': eventId,
                'subscription.lastPaddleEventType': eventType,
                'subscription.lastProviderSyncAt': admin.firestore.FieldValue.serverTimestamp()
            };
            if (typeof data.customer_id === 'string') {
                patch['subscription.paddleCustomerId'] =
                    data.customer_id;
            }
            if (typeof data.id === 'string' &&
                eventType.startsWith('subscription.')) {
                patch['subscription.paddleSubscriptionId'] =
                    data.id;
            }
            if (typeof data.subscription_id === 'string') {
                patch['subscription.paddleSubscriptionId'] =
                    data.subscription_id;
            }
            if (eventType.startsWith('subscription.')) {
                patch['subscription.status'] =
                    paddleStatus(data.status);
                if (!subscription.subscribedAt) {
                    const subscribedAt = paddleDateMillis(data.started_at) ||
                        paddleDateMillis(data.created_at) ||
                        paddleDateMillis(payload.occurred_at);
                    if (subscribedAt !== null) {
                        patch['subscription.subscribedAt'] =
                            subscribedAt;
                    }
                }
                const periodEnd = paddleDateMillis(data.current_billing_period?.ends_at);
                if (periodEnd !== null) {
                    patch['subscription.currentPeriodEndsAt'] =
                        periodEnd;
                }
                const trialStart = paddleDateMillis(data.trial_dates?.starts_at);
                if (trialStart !== null) {
                    patch['subscription.trialStartsAt'] = trialStart;
                }
                const trialEnd = paddleDateMillis(data.trial_dates?.ends_at);
                if (trialEnd !== null) {
                    patch['subscription.trialEndsAt'] = trialEnd;
                }
                const nextBilledAt = paddleDateMillis(data.next_billed_at);
                if (nextBilledAt !== null) {
                    patch['subscription.nextBilledAt'] = nextBilledAt;
                }
                const scheduledChange = data.scheduled_change;
                const cancellationScheduled = scheduledChange?.action === 'cancel';
                patch['subscription.cancelAtPeriodEnd'] =
                    cancellationScheduled;
                const effectiveAt = paddleDateMillis(scheduledChange?.effective_at);
                if (effectiveAt !== null) {
                    patch['subscription.cancellationEffectiveAt'] =
                        effectiveAt;
                }
                else if (!cancellationScheduled) {
                    patch['subscription.cancellationEffectiveAt'] =
                        admin.firestore.FieldValue.delete();
                }
                if (!cancellationScheduled) {
                    patch['subscription.cancellationRequestedAt'] =
                        admin.firestore.FieldValue.delete();
                    patch['subscription.cancellationRequestedBy'] =
                        admin.firestore.FieldValue.delete();
                    patch['subscription.cancellationRequestId'] =
                        admin.firestore.FieldValue.delete();
                    patch['subscription.cancellationStatus'] =
                        admin.firestore.FieldValue.delete();
                }
                const extraPriceId = process.env.PADDLE_EXTRA_CHILD_PRICE_ID;
                if (extraPriceId && Array.isArray(data.items)) {
                    const paidExtraSlots = data.items.reduce((total, item) => {
                        const itemPriceId = item?.price?.id ||
                            item?.price_id;
                        if (itemPriceId !== extraPriceId) {
                            return total;
                        }
                        const quantity = Number(item?.quantity || 0);
                        return total +
                            (Number.isInteger(quantity) && quantity > 0
                                ? quantity
                                : 0);
                    }, 0);
                    patch['subscription.extraChildSlots'] =
                        paidExtraSlots;
                    patch['subscription.extraChildPurchasePendingAt'] =
                        admin.firestore.FieldValue.delete();
                    patch['subscription.extraChildPurchasePendingBy'] =
                        admin.firestore.FieldValue.delete();
                    patch['subscription.extraChildPurchaseExpectedQuantity'] =
                        admin.firestore.FieldValue.delete();
                    patch['subscription.extraChildPurchaseStatus'] =
                        'CONFIRMED';
                }
            }
            transaction.update(familyRef, patch);
            transaction.create(eventRef, {
                eventId,
                eventType,
                familyId,
                parentUid: parentUid || null,
                occurredAt: paddleDateMillis(payload.occurred_at) ||
                    Date.now(),
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'PROCESSED'
            });
            return 'processed';
        });
        res.status(200).json({
            received: true,
            duplicate: result === 'duplicate'
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'UNKNOWN_ERROR';
        console.error(`Paddle webhook ${eventId} failed:`, error);
        if (message === 'FAMILY_NOT_FOUND' ||
            message === 'OWNER_MISMATCH') {
            res.status(422).send(message);
            return;
        }
        res.status(500).send('Webhook processing failed');
    }
});
//# sourceMappingURL=index.js.map