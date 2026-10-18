/**
 * Jaikrishna Industries — Firebase Cloud Messaging Background Service Worker
 * Handles background push notifications when the PWA is closed or in the background.
 *
 * NOTE: Firebase public client config is embedded here because Service Workers cannot
 * access import.meta.env, and passing params through the SW registration URL is fragile.
 * These are public Firebase identifiers (not server secrets).
 */

/* global importScripts, firebase */

// Import Firebase compat libraries inside the Service Worker environment
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDjrggOuhTuHZQa-YJtfs2_md3Lz7ba5_4",
  authDomain: "jaikrishna-industries.firebaseapp.com",
  projectId: "jaikrishna-industries",
  storageBucket: "jaikrishna-industries.firebasestorage.app",
  messagingSenderId: "441381846190",
  appId: "1:441381846190:web:9877871d5ee62c1d86013f"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background push payload:', payload);

    const title = payload.notification?.title || payload.data?.title || 'Jaikrishna Industries';
    const body = payload.notification?.body || payload.data?.body || 'New business update received.';
    const icon = payload.notification?.icon || payload.data?.icon || '/icon.svg';
    const tag = payload.data?.tag || payload.data?.collapseKey || 'jaikrishna-general';

    // Build notification options - clean and without non-standard iOS action buttons
    const notificationOptions = {
      body,
      icon,
      badge: '/icon.svg',
      data: payload.data || {},
      tag,
      renotify: true,
      requireInteraction: payload.data?.priority === 'critical' || payload.data?.priority === 'high'
    };

    self.registration.showNotification(title, notificationOptions);
  });
} catch (err) {
  console.error('[firebase-messaging-sw.js] Error initializing messaging in service worker:', err);
}

// Notification click event: opens the relevant deep link in the PWA window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink || event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(deepLink);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLink);
      }
    })
  );
});
