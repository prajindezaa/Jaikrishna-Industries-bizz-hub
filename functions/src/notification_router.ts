/**
 * Jaikrishna Industries — Hardened Notification Router & Pipeline
 * (functions/src/notification_router.ts)
 *
 * Pipeline: Event / Scheduler Trigger -> Notification Intent ->
 *           ROUTER (Atomic Dedupe, Quiet Hours IST, Snooze, Priority Spacing, Caps, Dead-Token Pruning) ->
 *           CHANNELS (In-App, Push via FCM, Email [DISABLED]) ->
 *           AUDIT LOG (notification_log)
 *
 * Guaranteed Invariants:
 * 1. AI assistant has ZERO write access to this engine.
 * 2. All times evaluated strictly against Asia/Kolkata timezone.
 * 3. Email delivery powered by Resend (when configured and opted-in by team member).
 * 4. Atomic create-if-not-exists deduplication prevents check-then-create race conditions.
 * 5. Automatic pruning of expired/unregistered FCM tokens.
 * 6. Bundling applied when > 3 items of same category arrive in single run.
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface NotificationIntent {
  recipientEmail: string;
  title: string;
  body: string;
  type: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  deepLink?: string;
  dedupeKey: string;
  category?: string;
  bypassQuietHours?: boolean;
  minSpacingMinutes?: number;
  data?: Record<string, string>;
  emailHtml?: string;
}

export interface RouterResult {
  accepted: boolean;
  suppressionReason?: string;
  channelsDelivered: string[];
}

export const EMAIL_ENABLED = true;

export function isWithinQuietHours(
  currentTimeIST: string,
  start: string,
  end: string
): boolean {
  if (start === end) return false;
  if (start < end) {
    return currentTimeIST >= start && currentTimeIST < end;
  } else {
    return currentTimeIST >= start || currentTimeIST < end;
  }
}

export function getCurrentTimeIST(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

export function getTodayDateIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

/**
 * Routes a single notification intent through deduplication, quiet hours, snooze, spacing, and channels.
 */
export async function routeNotificationIntent(
  db: admin.firestore.Firestore,
  intent: NotificationIntent
): Promise<RouterResult> {
  const recipientEmail = intent.recipientEmail.toLowerCase().trim();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const currentTimeIST = getCurrentTimeIST(now);
  const todayStrIST = getTodayDateIST(now);

  // 1. ATOMIC DEDUPLICATION: Attempt atomic create on notification_log
  const dedupeDocRef = db.collection('notification_log').doc(intent.dedupeKey);
  try {
    await dedupeDocRef.create({
      id: intent.dedupeKey,
      recipientEmail,
      title: intent.title,
      type: intent.type,
      priority: intent.priority || 'normal',
      dedupeKey: intent.dedupeKey,
      status: 'pending',
      createdAt: nowIso,
    });
  } catch (createErr: any) {
    // Code 6 in gRPC / 'ALREADY_EXISTS' in Firestore
    if (createErr?.code === 6 || String(createErr?.message).includes('ALREADY_EXISTS') || String(createErr).includes('already exists')) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Duplicate delivery.`);
      return { accepted: false, suppressionReason: 'dedupe_duplicate', channelsDelivered: [] };
    }
    console.warn(`[Router] Atomic dedupe check error: ${createErr?.message}`);
  }

  // 2. Fetch Member Preferences & Snooze State
  const memberDoc = await db.collection('team_members').doc(recipientEmail).get();
  const memberData = memberDoc.exists ? memberDoc.data() : null;
  const prefs = memberData?.notificationPreferences;

  // 3. Check Snooze
  if (prefs?.snoozeUntil) {
    const snoozeTime = new Date(prefs.snoozeUntil).getTime();
    if (nowMs < snoozeTime && !intent.bypassQuietHours) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Member snoozed until ${prefs.snoozeUntil}`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'snoozed');
      return { accepted: false, suppressionReason: 'snoozed', channelsDelivered: [] };
    }
  }

  // 4. Check Type Preference
  if (prefs?.types) {
    let typeAllowed = true;
    if (intent.type.startsWith('task') && prefs.types.perTask === false) typeAllowed = false;
    if (intent.type.includes('missed') && prefs.types.missedTaskAlert === false) typeAllowed = false;
    if (intent.type.startsWith('plan') && prefs.types.planningNotDone === false) typeAllowed = false;
    if (intent.type.startsWith('cust') && prefs.types.followUpDue === false) typeAllowed = false;

    if (!typeAllowed && !intent.bypassQuietHours) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Member disabled notification type ${intent.type}`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'user_disabled_type');
      return { accepted: false, suppressionReason: 'user_disabled_type', channelsDelivered: [] };
    }
  }

  // 5. Check Spacing (e.g. min 45m between overdue nudges on same task)
  if (intent.minSpacingMinutes && intent.minSpacingMinutes > 0) {
    const spacingKey = `last_spacing_${intent.category || intent.type}_${recipientEmail}`;
    const spacingDocRef = db.collection('system_settings').doc(spacingKey);
    const spacingSnap = await spacingDocRef.get();
    if (spacingSnap.exists) {
      const lastSentMs = spacingSnap.data()?.lastSentMs || 0;
      const elapsedMins = (nowMs - lastSentMs) / (60 * 1000);
      if (elapsedMins < intent.minSpacingMinutes && !intent.bypassQuietHours) {
        console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Spacing limit (${Math.round(elapsedMins)}m < ${intent.minSpacingMinutes}m)`);
        await logNotificationOutcome(db, intent, 'suppressed', [], 'spacing_limit');
        return { accepted: false, suppressionReason: 'spacing_limit', channelsDelivered: [] };
      }
    }
    // Update last sent time for spacing
    await spacingDocRef.set({ lastSentMs: nowMs, lastDedupe: intent.dedupeKey }, { merge: true });
  }

  // 6. Check Daily Cap (default 10 for task_overdue, 30 total)
  const capDocId = `daily_cap_${recipientEmail}_${todayStrIST}`;
  const capDocRef = db.collection('notification_caps').doc(capDocId);
  const capDoc = await capDocRef.get();
  const capData = capDoc.exists ? capDoc.data() : {};
  const currentTotal = capData?.total || 0;
  const currentTypeTotal = capData?.[intent.type] || 0;
  const typeMax = prefs?.caps?.[intent.type] ?? 10;
  const totalMax = prefs?.caps?.total ?? 35;

  if ((currentTypeTotal >= typeMax || currentTotal >= totalMax) && !intent.bypassQuietHours) {
    console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Daily cap reached (${currentTypeTotal}/${typeMax} for ${intent.type})`);
    await logNotificationOutcome(db, intent, 'suppressed', [], 'cap_exceeded');
    return { accepted: false, suppressionReason: 'cap_exceeded', channelsDelivered: [] };
  }

  // 7. Check Quiet Hours (Asia/Kolkata)
  const quietHours = prefs?.quietHours;
  if (quietHours?.enabled && !intent.bypassQuietHours) {
    const isQuiet = isWithinQuietHours(currentTimeIST, quietHours.start || '21:00', quietHours.end || '08:00');
    if (isQuiet) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: In quiet hours (${currentTimeIST} IST).`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'quiet_hours');
      return { accepted: false, suppressionReason: 'quiet_hours', channelsDelivered: [] };
    }
  }

  // 8. Deliver to Active Channels
  const channelsDelivered: string[] = [];

  // Channel A: In-App Notification (Stored with deep link & priority)
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
        createdAt: nowIso,
      });
      channelsDelivered.push('in_app');
    } catch (inAppErr) {
      console.error('[Router] Failed to write in-app notification:', inAppErr);
    }
  }

  // Channel B: Push Notification via FCM (With dead-token auto cleanup & TTL)
  const pushAllowed = prefs?.channels?.push !== false;
  if (pushAllowed) {
    try {
      // Query devices from both `members/{email}/devices` and `team_members/{email}/devices`
      let devicesSnap = await db
        .collection('members')
        .doc(recipientEmail)
        .collection('devices')
        .where('active', '==', true)
        .get()
        .catch(() => ({ docs: [] as any[] }));

      if (!devicesSnap.docs || devicesSnap.docs.length === 0) {
        devicesSnap = await db
          .collection('team_members')
          .doc(recipientEmail)
          .collection('devices')
          .where('active', '==', true)
          .get()
          .catch(() => ({ docs: [] as any[] }));
      }

      const devices = (devicesSnap.docs || [])
        .map((d: any) => ({ id: d.id, token: d.data()?.token }))
        .filter((d: any) => Boolean(d.token));

      if (devices.length > 0) {
        const messaging = admin.messaging();
        for (const dev of devices) {
          try {
            await messaging.send({
              token: dev.token,
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
                  TTL: '86400', // 24-hour expiration prevents ancient notification storms on wake
                },
                fcmOptions: {
                  link: intent.deepLink || '/',
                },
              },
            });
          } catch (pushErr: any) {
            console.warn(`[Router] Push to token failed:`, pushErr?.message);
            // Automatic Dead-Token Pruning
            if (
              pushErr?.code === 'messaging/registration-token-not-registered' ||
              pushErr?.code === 'messaging/invalid-registration-token' ||
              String(pushErr?.message).includes('not registered')
            ) {
              console.log(`[Router] Pruning dead token for ${recipientEmail}: ${dev.id}`);
              await db
                .collection('members')
                .doc(recipientEmail)
                .collection('devices')
                .doc(dev.id)
                .delete()
                .catch(() => null);
            }
          }
        }
        channelsDelivered.push('push');
      }
    } catch (pushBatchErr) {
      console.error('[Router] Push dispatch error:', pushBatchErr);
    }
  }

  // Channel C: Email Delivery via Resend (Respecting member preferences, daily cap, and global cap)
  const emailAllowed = EMAIL_ENABLED && prefs?.channels?.email === true;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (emailAllowed && resendApiKey) {
    try {
      const emailCapDoc = await db.collection('system_settings').doc(`email_counter_${todayStrIST}`).get();
      const globalEmailCount = emailCapDoc.exists ? (emailCapDoc.data()?.count || 0) : 0;

      // 80/day cap reserve for safety buffer (free tier limit 100/day)
      if (globalEmailCount < 80) {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'reminders@jaikrishnabizzhub.in';
        const defaultHtml = `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <h2 style="color: #881337; margin-top: 0;">${intent.title}</h2>
            <p style="color: #374151; font-size: 14px; line-height: 1.5;">${intent.body}</p>
            ${
              intent.deepLink
                ? `<p style="margin-top: 20px;">
                    <a href="${(process.env.APP_URL || 'https://jaikrishnabizzhub.in').replace(/\/+$/, '')}${intent.deepLink}"
                       style="background: #881337; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-block;">
                      Open in Jaikrishna Hub
                    </a>
                   </p>`
                : ''
            }
            <hr style="border: none; border-top: 1px solid #eee; margin-top: 24px;" />
            <p style="font-size: 11px; color: #9ca3af; margin: 0;">Jaikrishna Industries Automated Business Hub · Salem, Tamil Nadu</p>
          </div>
        `;

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipientEmail],
            subject: intent.title,
            html: intent.emailHtml || defaultHtml,
          }),
        });

        if (res.ok) {
          channelsDelivered.push('email');
          await db.collection('system_settings').doc(`email_counter_${todayStrIST}`).set(
            { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        } else {
          const errText = await res.text();
          console.warn(`[Router] Resend API responded ${res.status}:`, errText);
        }
      } else {
        console.warn(`[Router] Global Resend email cap reached (${globalEmailCount}/80). Skipping email for ${recipientEmail}.`);
      }
    } catch (emailErr) {
      console.error('[Router] Resend email dispatch error:', emailErr);
    }
  }

  // Increment daily cap count
  await capDocRef.set({
    total: (currentTotal || 0) + 1,
    [intent.type]: (currentTypeTotal || 0) + 1,
    lastUpdated: nowIso,
  }, { merge: true });

  // 9. Update Audit Log Record
  await logNotificationOutcome(db, intent, 'delivered', channelsDelivered);

  return {
    accepted: true,
    channelsDelivered,
  };
}

/**
 * Batched Notification Producer with Automatic Bundling:
 * If > 3 intents of same category/type are provided, sends first 3 individually
 * and bundles remaining into a single summary notification.
 */
export async function routeBundledIntents(
  db: admin.firestore.Firestore,
  intents: NotificationIntent[],
  bundleSummaryBuilder: (remainingCount: number) => { title: string; body: string; deepLink: string }
): Promise<RouterResult[]> {
  const results: RouterResult[] = [];
  if (intents.length <= 3) {
    for (const intent of intents) {
      results.push(await routeNotificationIntent(db, intent));
    }
    return results;
  }

  // Send first 3 individually
  for (let i = 0; i < 3; i++) {
    results.push(await routeNotificationIntent(db, intents[i]));
  }

  // Bundle remainder
  const remaining = intents.slice(3);
  const summary = bundleSummaryBuilder(remaining.length);
  const bundleIntent: NotificationIntent = {
    recipientEmail: intents[0].recipientEmail,
    title: summary.title,
    body: summary.body,
    type: intents[0].type,
    priority: 'normal',
    deepLink: summary.deepLink,
    dedupeKey: `bundle_${intents[0].type}_${getTodayDateIST()}`,
  };

  results.push(await routeNotificationIntent(db, bundleIntent));
  return results;
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
    }, { merge: true });
  } catch (err) {
    console.warn('[Router] Failed to write notification_log audit:', err);
  }
}
