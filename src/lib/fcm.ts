/**
 * Jaikrishna Industries — Client-Side FCM & Push Device Registration
 * Handles Web Push permissions, service worker registration, token retrieval,
 * device ID lifecycle, and server synchronization.
 */

import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app } from './firebase';

const DEVICE_ID_KEY = 'jaikrishna_device_id';
const LAST_TOKEN_KEY = 'jaikrishna_last_fcm_token';
const LAST_SYNC_KEY = 'jaikrishna_last_token_sync';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (process.env as any || {});

// Public VAPID Key from environment
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY || 'BEm-LCljupHubcB9dIotcJlRFIe-ADCn6wVKJbuLkCN7FLvSjbHks7sR0d17R1yI-AD0ti2GXgHKI5ZKREQQfzg';

/**
 * Returns a stable unique identifier for this browser/device.
 * Stored in localStorage so it persists across sessions.
 */
let inMemoryDeviceId: string | null = null;

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    if (!inMemoryDeviceId) {
      inMemoryDeviceId = 'dev_node_' + Math.random().toString(36).substring(2, 10);
    }
    return inMemoryDeviceId;
  }
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Detects the client platform
 */
export function detectPlatform(): 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/win/.test(ua)) return 'windows';
  if (/mac/.test(ua)) return 'macos';
  if (/linux/.test(ua)) return 'linux';
  return 'unknown';
}

/**
 * Detects the client browser
 */
export function detectBrowser(): 'chrome' | 'edge' | 'firefox' | 'safari' | 'samsung' | 'opera' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/edg\//.test(ua)) return 'edge';
  if (/samsungbrowser/.test(ua)) return 'samsung';
  if (/opr\/|opera/.test(ua)) return 'opera';
  if (/chrome|crios/.test(ua)) return 'chrome';
  if (/firefox|fxios/.test(ua)) return 'firefox';
  if (/safari/.test(ua) && !/chrome/.test(ua)) return 'safari';
  return 'unknown';
}

/**
 * Detects if running as standalone installed PWA
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Checks if Web Push is supported in the current environment
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  
  // iOS Safari requires iOS 16.4+ and only works when added to Home Screen
  const platform = detectPlatform();
  if (platform === 'ios') {
    const isStandalone = isStandalonePwa();
    return isStandalone && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Gets the current notification permission state
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
}

/**
 * Registers the dedicated Firebase Cloud Messaging Service Worker
 */
export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    console.log('[FCM] Service Worker registered with scope:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('[FCM] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Initializes Firebase Messaging and requests an FCM Token
 */
export async function getFcmToken(): Promise<string | null> {
  if (!app || !isPushSupported()) {
    return null;
  }

  try {
    const swRegistration = await registerFcmServiceWorker();
    if (!swRegistration) {
      console.warn('[FCM] Cannot get token: Service Worker registration failed');
      return null;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      localStorage.setItem(LAST_TOKEN_KEY, token);
      return token;
    }
    return null;
  } catch (error) {
    console.error('[FCM] Error retrieving FCM token:', error);
    return null;
  }
}

/**
 * Registers the device with the backend (/api/devices/register)
 */
export async function syncDeviceWithServer(
  idToken: string,
  fcmToken?: string | null
): Promise<{ success: boolean; message?: string }> {
  try {
    const deviceId = getOrCreateDeviceId();
    const token = fcmToken || localStorage.getItem(LAST_TOKEN_KEY) || '';

    const payload = {
      deviceId,
      token,
      platform: detectPlatform(),
      browser: detectBrowser(),
      installedPwa: isStandalonePwa(),
      permissionState: getNotificationPermissionState(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    const response = await fetch('/api/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = { message: resText };
    }

    if (response.ok && data.success) {
      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      return { success: true, message: data.message || 'Device registered successfully' };
    } else {
      const errMsg = data.error || data.message || data.details || `Server responded with ${response.status}`;
      console.warn('[FCM] Device registration rejected:', response.status, errMsg);
      return { success: false, message: errMsg };
    }
  } catch (error: any) {
    console.error('[FCM] Error syncing device with server:', error);
    return { success: false, message: error?.message || 'Network request failed' };
  }
}

/**
 * Removes the device registration on logout
 */
export async function unregisterDeviceOnServer(idToken: string): Promise<void> {
  try {
    const deviceId = getOrCreateDeviceId();
    await fetch('/api/devices/unregister', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ deviceId }),
    });
    localStorage.removeItem(LAST_TOKEN_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  } catch (err) {
    console.warn('[FCM] Failed to unregister device on server:', err);
  }
}

/**
 * Sets up a listener for foreground FCM messages.
 * Foreground push notifications should NEVER show a duplicate OS notification;
 * instead they trigger an in-app banner/callback.
 */
export function setupForegroundMessageListener(
  onMessageReceived: (payload: any) => void
): (() => void) | null {
  if (!app || !isPushSupported()) return null;

  try {
    const messaging: Messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);
      onMessageReceived(payload);
    });
  } catch (err) {
    console.warn('[FCM] Error setting up foreground message listener:', err);
    return null;
  }
}
