/**
 * Jaikrishna Industries — Unified Notification Router & Pipeline (functions/src/notification_router.ts)
 * 
 * Pipeline: Event / Scheduler Trigger -> Notification Intent ->
 *           ROUTER (Member Preferences, Quiet Hours in Asia/Kolkata, Snooze, Deduplication) ->
 *           CHANNELS (In-App, Push via FCM, Email [DISABLED]) ->
 *           AUDIT LOG (notification_log)
 *
 * Guaranteed Invariants:
 * 1. AI assistant has ZERO access to this engine (stays read-only).
 * 2. All times evaluated strictly against Asia/Kolkata timezone.
 * 3. EMAIL_ENABLED=false keeps email delivery disabled.
 * 4. In-app and Push delivery channels are independent.
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface NotificationIntent {
  recipientEmail: string;
  title: string;
  body: string;
  type: 'task' | 'followup' | 'planning' | 'missed' | 'meta_ad' | 'system' | 'morning_plan';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  deepLink?: string;
  dedupeKey: string;
  category?: string;
  bypassQuietHours?: boolean;
  data?: Record<string, string>;
}

export interface RouterResult {
  accepted: boolean;
  suppressionReason?: string;
  channelsDelivered: string[];
}

export const EMAIL_ENABLED = false; // Strictly disabled behind flag per architecture rule

/**
 * Checks if current time in Asia/Kolkata falls within user's Quiet Hours.
 * Supports overnight ranges (e.g. 21:00 to 08:00) as well as daytime ranges.
 */
export function isWithinQuietHours(
  currentTimeIST: string, // "HH:mm"
  start: string,           // "HH:mm"
  end: string             // "HH:mm"
): boolean {
  if (start === end) return false;

  if (start < end) {
    // Normal window: e.g. 13:00 to 14:00
    return currentTimeIST >= start && currentTimeIST < end;
  } else {
    // Overnight window: e.g. 21:00 to 08:00
    return currentTimeIST >= start || currentTimeIST < end;
  }
}

/**
 * Returns the current time formatted as "HH:mm" in Asia/Kolkata
 */
export function getCurrentTimeIST(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Routes a Notification Intent through deduplication, quiet hours, snooze, and channel filters.
 */
export async function routeNotificationIntent(
  db: admin.firestore.Firestore,
  intent: NotificationIntent
): Promise<RouterResult> {
  const recipientEmail = intent.recipientEmail.toLowerCase().trim();
  const now = new Date();
  const nowIso = now.toISOString();
  const currentTimeIST = getCurrentTimeIST(now);

  // 1. Deduplication Check via notification_log collection
  const dedupeDocRef = db.collection('notification_log').doc(intent.dedupeKey);
  const dedupeSnap = await dedupeDocRef.get();

  if (dedupeSnap.exists) {
    console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Duplicate delivery.`);
    return { accepted: false, suppressionReason: 'dedupe_duplicate', channelsDelivered: [] };
  }

  // 2. Fetch Member Preferences & Snooze State
  const memberDoc = await db.collection('team_members').doc(recipientEmail).get();
  const memberData = memberDoc.exists ? memberDoc.data() : null;
  const prefs = memberData?.notificationPreferences;

  // 3. Check Snooze
  if (prefs?.snoozeUntil) {
    const snoozeTime = new Date(prefs.snoozeUntil).getTime();
    if (now.getTime() < snoozeTime && !intent.bypassQuietHours) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Member snoozed until ${prefs.snoozeUntil}`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'snoozed');
      return { accepted: false, suppressionReason: 'snoozed', channelsDelivered: [] };
    }
  }

  // 4. Check Type Preference (e.g. perTask, missedTaskAlert)
  if (prefs?.types) {
    let typeAllowed = true;
    if (intent.type === 'task' && prefs.types.perTask === false) typeAllowed = false;
    if (intent.type === 'missed' && prefs.types.missedTaskAlert === false) typeAllowed = false;
    if (intent.type === 'planning' && prefs.types.planningNotDone === false) typeAllowed = false;
    if (intent.type === 'followup' && prefs.types.followUpDue === false) typeAllowed = false;

    if (!typeAllowed && !intent.bypassQuietHours) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Member disabled notification type ${intent.type}`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'user_disabled_type');
      return { accepted: false, suppressionReason: 'user_disabled_type', channelsDelivered: [] };
    }
  }

  // 5. Check Quiet Hours (Asia/Kolkata)
  const quietHours = prefs?.quietHours;
  if (quietHours?.enabled && !intent.bypassQuietHours) {
    const isQuiet = isWithinQuietHours(currentTimeIST, quietHours.start || '21:00', quietHours.end || '08:00');
    if (isQuiet) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: In quiet hours (${currentTimeIST} IST).`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'quiet_hours');
      return { accepted: false, suppressionReason: 'quiet_hours', channelsDelivered: [] };
    }
  }

  // 6. Deliver to Active Channels
  const channelsDelivered: string[] = [];

  // Channel A: In-App Notification (Always enabled unless explicitly toggled off)
  const inAppAllowed = prefs?.channels?.inApp !== false;
  if (inAppAllowed) {
    try {
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        id: notifRef.id,
        recipientEmail,
        title: intent.title,
        body: intent.body,
        type: intent.type,
        priority: intent.priority || 'normal',
        deepLink: intent.deepLink || '/',
        dedupeKey: intent.dedupeKey,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      channelsDelivered.push('in_app');
    } catch (inAppErr) {
      console.error('[Router] Failed to write in-app notification:', inAppErr);
    }
  }

  // Channel B: Push Notification via FCM
  const pushAllowed = prefs?.channels?.push !== false;
  if (pushAllowed) {
    try {
      const devicesSnap = await db
        .collection('members')
        .doc(recipientEmail)
        .collection('devices')
        .where('active', '==', true)
        .get();

      const tokens = devicesSnap.docs.map((d) => d.data()?.token).filter(Boolean);

      if (tokens.length > 0) {
        const messaging = admin.messaging();
        for (const token of tokens) {
          try {
            await messaging.send({
              token,
              notification: {
                title: intent.title,
                body: intent.body,
              },
              data: {
                deepLink: intent.deepLink || '/',
                tag: intent.type || 'jaikrishna-alert',
                priority: intent.priority || 'normal',
                dedupeKey: intent.dedupeKey,
                ...(intent.data || {}),
              },
              webpush: {
                headers: {
                  Urgency: intent.priority === 'critical' || intent.priority === 'high' ? 'high' : 'normal',
                },
                fcmOptions: {
                  link: intent.deepLink || '/',
                },
              },
            });
          } catch (pushErr: any) {
            console.warn(`[Router] Push to token failed:`, pushErr?.message);
          }
        }
        channelsDelivered.push('push');
      }
    } catch (pushBatchErr) {
      console.error('[Router] Push dispatch error:', pushBatchErr);
    }
  }

  // Channel C: Email (Strictly Disabled)
  if (EMAIL_ENABLED) {
    // Adapter kept disabled per architecture contract
  }

  // 7. Audit Log Record (notification_log)
  await logNotificationOutcome(db, intent, 'delivered', channelsDelivered);

  return {
    accepted: true,
    channelsDelivered,
  };
}

/**
 * Records final delivery or suppression in notification_log
 */
async function logNotificationOutcome(
  db: admin.firestore.Firestore,
  intent: NotificationIntent,
  status: 'delivered' | 'suppressed' | 'failed',
  channelsDelivered: string[],
  suppressionReason?: string
) {
  try {
    await db.collection('notification_log').doc(intent.dedupeKey).set({
      id: intent.dedupeKey,
      recipientEmail: intent.recipientEmail.toLowerCase().trim(),
      title: intent.title,
      type: intent.type,
      priority: intent.priority || 'normal',
      dedupeKey: intent.dedupeKey,
      channelsDelivered,
      status,
      suppressionReason: suppressionReason || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Router] Failed to write notification_log audit:', err);
  }
}
