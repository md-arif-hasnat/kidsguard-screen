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
}

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
  type: 'SAFE_ZONE' | 'SOS' | 'BATTERY' | 'DEVICE' | 'PAIRING';
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
      return snap.data() as NotificationSettings;
    }
    // Default settings
    return {
      safeZone: true,
      sos: true,
      battery: true,
      deviceStatus: true,
      pairing: true
    };
  }

  static async updateNotificationSettings(uid: string, settings: NotificationSettings): Promise<void> {
    if (!db) return;
    const ref = doc(db, "parents", uid, "notificationSettings", "current");
    await setDoc(ref, settings, { merge: true });
  }

  static async registerDevice(uid: string, deviceName: string): Promise<void> {
    if (!db || !messaging) return;

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn("Notification permission denied.");
        return;
      }

      // Get token
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });

      if (token) {
        const deviceId = window.navigator.userAgent.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50);
        // New Path: users/{uid}/notificationTokens/{tokenId}
        const deviceRef = doc(db, "users", uid, "notificationTokens", deviceId);

        const now = serverTimestamp();
        await setDoc(deviceRef, {
          token,
          platform: 'ios-pwa',
          enabled: true,
          createdAt: now,
          updatedAt: now
        }, { merge: true });

        console.log("Web FCM token registered (ios-pwa):", token);
      }
    } catch (error) {
      console.error("Error registering device for FCM:", error);
    }
  }

  static listenToNotifications(uid: string, onUpdate: (notifications: NotificationHistoryItem[]) => void) {
    if (!db || !uid) return () => {};

    // New Path: Root notifications collection filtered by userId
    const ref = collection(db, "notifications");
    const q = query(ref, where("userId", "==", uid), orderBy("createdAt", "desc"), limit(50));

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
