// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyAjBIvgF7Bbq92FeO68QsB3xkeEDieTbXU",
  authDomain: "kidsguard-0626.firebaseapp.com",
  projectId: "kidsguard-0626",
  storageBucket: "kidsguard-0626.firebasestorage.app",
  messagingSenderId: "1079785670167",
  appId: "1:1079785670167:web:5f5c80a6254e609da43e52"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message",
    payload
  );
  if (payload.notification) {
    console.log(
      "[firebase-messaging-sw.js] Notification payload handled by browser",
      payload.notification
    );
    return;
  }

  const data = payload.data || {};

  const notificationTitle =
    data.title ||
    payload.notification?.title ||
    "KidsGuard";

  const notificationBody =
    data.body ||
    payload.notification?.body ||
    "You have a new KidsGuard alert.";

  const targetUrl =
    data.url ||
    data.clickAction ||
    data.route ||
    "/";

  const notificationOptions = {
    body: notificationBody,
    icon: "/logo.png",
    badge: "/symbol.png",
    data: {
      ...data,
      url: targetUrl
    }
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl =
    data.url ||
    data.clickUrl ||
    data.route ||
    "/";

  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(async (windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          // If the URL matches an existing client, just focus it and navigate
          // Otherwise, we navigate the first available client to the target URL
          await client.navigate(absoluteUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
