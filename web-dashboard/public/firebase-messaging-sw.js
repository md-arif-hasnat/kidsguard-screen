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
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/shield.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
