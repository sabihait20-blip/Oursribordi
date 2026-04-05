importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "gen-lang-client-0513016851",
  appId: "1:189713485292:web:f3f7102d311d7d70c3c4c9",
  apiKey: "AIzaSyAk9vWC9WXVVzuGTR8BjHDwXPnQzzaNHAw",
  authDomain: "gen-lang-client-0513016851.firebaseapp.com",
  messagingSenderId: "189713485292"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
