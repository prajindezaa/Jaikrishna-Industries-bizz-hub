/**
 * Jaikrishna Industries — Firebase Cloud Messaging Background Service Worker
 * Handles background push notifications when the PWA is closed or in the background.
 */

/* global importScripts, firebase */

// Import Firebase compat libraries inside the Service Worker environment
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Parse Firebase configuration from URL query params (passed during client registration)
const params = new URLSearchParams(location.search);

const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message:', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'Jaikrishna Industries';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'New business update received.',
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: payload.data || {},
        tag: payload.data?.tag || 'jaikrishna-alert',
        renotify: true,
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Failed to initialize Firebase Messaging:', err);
  }
}

// Notification click event: opens the relevant view in the PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(deepLink);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLink);
      }
    })
  );
});
