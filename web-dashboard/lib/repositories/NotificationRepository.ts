import { db, messaging } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  increment,
  where,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";

export interface NotificationSettings {
  safeZone: boolean;
  sos: boolean;
  battery: boolean;
  deviceStatus: boolean;
  pairing: boolean;
  appUsage: boolean;
  permissionChanges: boolean;
  syncErrors: boolean;
  appUpdates: boolean;
  securityAlerts: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  safeZone: true,
  sos: true,
  battery: true,
  deviceStatus: true,
  pairing: true,
  appUsage: true,
  permissionChanges: true,
  syncErrors: true,
  appUpdates: true,
  securityAlerts: true
};

export interface ParentDevice {
  deviceId: string;
  token: string;
  platform: 'Web' | 'Android' | 'iOS';
  deviceName: string;
  lastSeen: any;
  appVersion: string;
}

export interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  type: 'SAFE_ZONE' | 'SOS' | 'SOS_RESOLVED' | 'BATTERY' | 'DEVICE' |
    'DEVICE_OFFLINE' | 'DEVICE_BACK_ONLINE' | 'PAIRING' | 'APP_INSTALLED' |
    'APP_LIMIT_REACHED' | 'BLOCKED_APP_ATTEMPT' | 'TAMPER_ALERT' |
    'PERMISSION_CHANGE_REQUEST' | 'SYNC_ERROR' | 'APP_UPDATE' | 'SUPPORT_REPLY';
  childId?: string;
  clickAction?: string;
  createdAt: any;
  read: boolean;
}

export class NotificationRepository {
  static async getNotificationSettings(uid: string): Promise<NotificationSettings> {
    if (!db) throw new Error("Firestore not initialized");
    const ref = doc(db, "parents", uid, "notificationSettings", "current");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...snap.data()
      } as NotificationSettings;
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  static async updateNotificationSettings(uid: string, settings: NotificationSettings): Promise<void> {
    if (!db) return;
    const ref = doc(db, "parents", uid, "notificationSettings", "current");
    await setDoc(ref, settings, { merge: true });
  }

  static async registerDevice(uid: string, deviceName: string): Promise<boolean> {
    if (!db || !messaging || typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Notification permission denied.");
        return false;
      }

      const serviceWorkerRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration
      });

      if (!token) return false;

      const deviceId = window.navigator.userAgent
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 50);
      const deviceRef = doc(db, "users", uid, "notificationTokens", deviceId);
      const now = serverTimestamp();

      await setDoc(deviceRef, {
        token,
        platform: "ios-pwa",
        deviceName,
        enabled: true,
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      console.log("Web FCM token registered (ios-pwa).");
      return true;
    } catch (error) {
      console.error("Error registering device for FCM:", error);
      return false;
    }
  }

  static listenForForegroundMessages(
    onNotification: (payload: { title: string; body: string; url: string }) => void
  ): () => void {
    if (!messaging) return () => {};

    return onMessage(messaging, payload => {
      const data = payload.data || {};
      onNotification({
        title: payload.notification?.title || data.title || "KidsGuard Admin",
        body: payload.notification?.body || data.body || "A new alert needs attention.",
        url: data.clickAction || data.url || "/internal"
      });
    });
  }

  static listenToNotifications(uid: string, onUpdate: (notifications: NotificationHistoryItem[]) => void) {
    if (!db || !uid) return () => {};

    // New Path: Root notifications collection filtered by userId
    const ref = collection(db, "notifications");
    const q = query(ref, where("userId", "==", uid), orderBy("createdAt", "desc"), limit(500));

    return onSnapshot(q, (snapshot) => {
        console.log(
            "NOTIFICATION_SNAPSHOT",
            snapshot.docs.map(doc => ({
                id: doc.id,
                type: doc.data().type,
                userId: doc.data().userId,
                title: doc.data().title
            }))
        );
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as NotificationHistoryItem));
      onUpdate(notifications);
    }, (error) => {
      console.error("Error listening to notifications:", error);
      onUpdate([]);
    });
  }

  static listenToUnreadCount(uid: string, onUpdate: (count: number) => void) {
      if (!db || !uid) return () => {};

      const ref = collection(db, "notifications");
      const q = query(
          ref,
          where("userId", "==", uid),
          where("read", "==", false)
      );

      return onSnapshot(q, (snapshot) => {
          onUpdate(snapshot.size);
      });
  }

  static listenToUnreadCountByType(
    uid: string,
    type: NotificationHistoryItem["type"],
    onUpdate: (count: number) => void
  ) {
    if (!db || !uid) return () => {};

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      where("read", "==", false)
    );

    return onSnapshot(q, snapshot => {
      onUpdate(snapshot.docs.filter(item => item.data().type === type).length);
    });
  }

  static async markAllAsReadByType(
    uid: string,
    type: NotificationHistoryItem["type"]
  ): Promise<void> {
    if (!db || !uid) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    const matching = snapshot.docs.filter(item => item.data().type === type);
    if (matching.length === 0) return;

    const batch = writeBatch(db);
    matching.forEach(item => batch.update(item.ref, { read: true }));
    await batch.commit();
  }

  static async markAsRead(uid: string, notificationId: string): Promise<void> {
    if (!db) return;
    const ref = doc(db, "notifications", notificationId);
    await updateDoc(ref, { read: true });
  }

  static async markAllAsRead(uid: string): Promise<void> {
    if (!db) return;
    const ref = collection(db, "notifications");
    const q = query(ref, where("userId", "==", uid), where("read", "==", false));
    const snap = await getDocs(q);

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  }
}
