/**
 * Jaikrishna Industries — Permission Onboarding & Device Status Component
 * 
 * Educates users on why notifications are needed (reminders, follow-ups, alerts),
 * guides users on how to enable permissions across Chrome, Safari/iOS, Edge, Firefox,
 * provides explicit device test triggers, and includes an Android battery optimization guide.
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import {
  isPushSupported,
  getNotificationPermissionState,
  getFcmToken,
  syncDeviceWithServer,
  getOrCreateDeviceId,
  detectPlatform,
  detectBrowser,
  isStandalonePwa
} from '../../lib/fcm';
import { auth } from '../../lib/firebase';

export const PushOnboarding: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermissionState());
  const [supported, setSupported] = useState<boolean>(isPushSupported());
  const [loading, setLoading] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [showBatteryGuide, setShowBatteryGuide] = useState<boolean>(false);
  const [dismissedBanner, setDismissedBanner] = useState<boolean>(() => {
    return localStorage.getItem('jaikrishna_push_banner_dismissed') === 'true';
  });

  const platform = detectPlatform();
  const browser = detectBrowser();
  const isPwa = isStandalonePwa();
  const deviceId = getOrCreateDeviceId();

  useEffect(() => {
    // Re-check state on mount
    setPermission(getNotificationPermissionState());
    setSupported(isPushSupported());

    // If already granted, auto-sync token with backend
    if (getNotificationPermissionState() === 'granted' && auth?.currentUser) {
      auth.currentUser.getIdToken().then(async (idToken) => {
        const token = await getFcmToken();
        await syncDeviceWithServer(idToken, token);
      }).catch(console.error);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.');
      return;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const token = await getFcmToken();
        if (auth?.currentUser) {
          const idToken = await auth.currentUser.getIdToken();
          await syncDeviceWithServer(idToken, token);
        }
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    } finally {
      setLoading(false);
    }
  };

  const [hasToken, setHasToken] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('jaikrishna_last_fcm_token'));
  });

  const handleSyncToken = async () => {
    if (!auth?.currentUser) {
      alert('Please log in first to register device.');
      return;
    }
    setLoading(true);
    setTestStatus('Generating FCM token and registering device with server...');
    try {
      const idToken = await auth.currentUser.getIdToken();
      const token = await getFcmToken();
      if (!token) {
        setTestStatus('Could not generate FCM push token. Please check browser service worker / notification permissions.');
        return;
      }
      const ok = await syncDeviceWithServer(idToken, token);
      if (ok) {
        setHasToken(true);
        setTestStatus('Device & FCM push token registered successfully with server!');
      } else {
        setTestStatus('Failed to sync device with backend server.');
      }
    } catch (err: any) {
      setTestStatus(`Registration error: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async (targetAll: boolean = false) => {
    if (!auth?.currentUser) {
      alert('Please log in first to send test push.');
      return;
    }

    setLoading(true);
    setTestStatus('Preparing test push (verifying device token)...');
    try {
      const idToken = await auth.currentUser.getIdToken();

      // Ensure device and FCM token are synced with server
      let token = typeof localStorage !== 'undefined' ? localStorage.getItem('jaikrishna_last_fcm_token') : null;
      if (!token) {
        setTestStatus('Obtaining fresh FCM push token from Firebase...');
        token = await getFcmToken();
      }

      if (token) {
        setHasToken(true);
        await syncDeviceWithServer(idToken, token);
      } else {
        setTestStatus('Push delivery notice: Could not obtain FCM token. Ensure Notifications are allowed and Service Worker is active.');
        setLoading(false);
        return;
      }

      setTestStatus('Sending test notification to registered device(s)...');
      const response = await fetch('/api/devices/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          deviceId,
          targetAll,
          title: 'Jaikrishna Industries Test Alert',
          body: targetAll
            ? 'Broadcast push sent to all your active devices!'
            : 'Push notification confirmed working on this device!',
        }),
      });

      let data: any = null;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        setTestStatus(`Server error (${response.status}): ${text.slice(0, 150)}`);
        return;
      }

      if (data?.success) {
        setTestStatus(`🎉 Push delivered successfully! (${data.successfulCount}/${data.total} devices confirmed)`);
      } else {
        setTestStatus(`Push delivery failed: ${data?.message || data?.error || 'No active device tokens found.'}`);
      }
    } catch (err: any) {
      setTestStatus(`Error: ${err?.message || 'Network request failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissBanner = () => {
    setDismissedBanner(true);
    localStorage.setItem('jaikrishna_push_banner_dismissed', 'true');
  };

  return (
    <div className="space-y-6">
      {/* 1. Persistent Banner for Attention (if not granted & not dismissed) */}
      {permission !== 'granted' && !dismissedBanner && (
        <div className="bg-amber-900/40 border border-amber-600/40 rounded-xl p-4 flex items-start justify-between gap-3 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-amber-300">Push Notifications Not Enabled: </span>
              Enable notifications to get immediate reminders for high-priority customer tasks and follow-ups.
            </div>
          </div>
          <button
            onClick={handleDismissBanner}
            className="text-amber-400 hover:text-amber-200 transition-colors p-1"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Device Status Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">This Device Status</h3>
              <p className="text-xs text-slate-400">
                {platform.toUpperCase()} • {browser.toUpperCase()} {isPwa ? '• Installed PWA' : '• Browser Tab'}
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 ${
              permission === 'granted'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : permission === 'denied'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {permission === 'granted' && <CheckCircle className="w-3.5 h-3.5" />}
            {permission === 'denied' && <AlertTriangle className="w-3.5 h-3.5" />}
            {permission === 'default' && <Bell className="w-3.5 h-3.5" />}
            {permission}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {/* iOS Specific Instructions if not installed */}
          {platform === 'ios' && !isPwa && (
            <div className="p-4 bg-sky-950/40 border border-sky-800/40 rounded-xl text-sky-200 text-sm">
              <p className="font-semibold text-sky-300 mb-1">iOS Push Notification Requirement:</p>
              <p>
                Apple iOS requires the app to be added to your Home Screen to receive Web Push notifications. Tap the{' '}
                <strong>Share</strong> button in Safari and select <strong>"Add to Home Screen"</strong>.
              </p>
            </div>
          )}

          {/* Action buttons depending on permission */}
          {permission === 'default' && (
            <div>
              <p className="text-sm text-slate-300 mb-4">
                Receive instant real-time alerts for overdue follow-ups, daily tasks, and critical customer activities.
              </p>
              <button
                onClick={handleRequestPermission}
                disabled={loading || !supported}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Enable Push Notifications
              </button>
            </div>
          )}

          {permission === 'denied' && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-xl text-sm text-rose-200 space-y-2">
              <p className="font-semibold text-rose-300">Push Notifications are Blocked</p>
              <p>You previously blocked notifications for this site. To re-enable them:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-rose-200">
                {browser === 'chrome' && (
                  <li>Click the padlock/tune icon to the left of the website URL in the address bar → Reset "Notifications" to "Allow" → Refresh the page.</li>
                )}
                {browser === 'edge' && (
                  <li>Click the padlock icon next to the URL → Site permissions → Set "Notifications" to "Allow" → Refresh the page.</li>
                )}
                {platform === 'android' && (
                  <li>Open Android Settings → Apps → Chrome / Jaikrishna Hub → Notifications → Turn "All notifications" ON.</li>
                )}
                {platform === 'ios' && (
                  <li>Open iOS Settings → Notifications → Jaikrishna Hub → Allow Notifications.</li>
                )}
              </ul>
            </div>
          )}

          {permission === 'granted' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                  hasToken ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasToken ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {hasToken ? 'Push Token Active & Synced' : 'Device Registered (Token Sync Needed)'}
                </span>
                <button
                  onClick={handleSyncToken}
                  disabled={loading}
                  className="px-2.5 py-1 text-slate-400 hover:text-white transition flex items-center gap-1 underline underline-offset-2"
                  title="Force re-sync token with server"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Token
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleSendTestPush(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-sm font-medium shadow-md shadow-orange-500/10 transition flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Test to This Device
                </button>

                <button
                  onClick={() => handleSendTestPush(true)}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-sm font-medium transition flex items-center gap-2"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  Send Test to All My Devices
                </button>
              </div>

              {testStatus && (
                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-300">
                  {testStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Android Battery Optimization Guide Accordion */}
      {platform === 'android' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowBatteryGuide(!showBatteryGuide)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-sm font-medium text-slate-200">Notifications delayed on Android?</span>
                <p className="text-xs text-slate-400">Learn how to prevent Android battery saver from killing background push</p>
              </div>
            </div>
            {showBatteryGuide ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showBatteryGuide && (
            <div className="p-4 pt-0 border-t border-slate-800/60 text-xs text-slate-300 space-y-2 mt-3">
              <p>Modern Android phones (Samsung, Xiaomi, OnePlus, Vivo, Oppo) aggressively put apps to sleep:</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-slate-400">
                <li>Open <strong>Settings</strong> on your Android phone.</li>
                <li>Go to <strong>Apps</strong> → Select <strong>Chrome</strong> (or <strong>Jaikrishna Hub</strong> if installed).</li>
                <li>Tap <strong>Battery</strong> → Change from <em>"Optimized"</em> to <strong>"Unrestricted"</strong>.</li>
                <li>Ensure <strong>Background data</strong> is set to <strong>Allowed</strong>.</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
