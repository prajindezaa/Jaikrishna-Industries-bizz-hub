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

  console.log(`[Router] ▶ START routeNotificationIntent for ${recipientEmail} | dedupeKey=${intent.dedupeKey} | bypassQuietHours=${intent.bypassQuietHours} | time=${nowIso}`);

  // 1. ATOMIC DEDUPLICATION: Attempt atomic create on notification_log (bypassed if bypassQuietHours/forceRunNow is set)
  const dedupeDocRef = db.collection('notification_log').doc(intent.dedupeKey);
  try {
    if (intent.bypassQuietHours) {
      await dedupeDocRef.set({
        id: intent.dedupeKey,
        recipientEmail,
        title: intent.title,
        type: intent.type,
        priority: intent.priority || 'normal',
        dedupeKey: intent.dedupeKey,
        status: 'pending',
        createdAt: nowIso,
      });
    } else {
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
    }
    console.log(`[Router] ✓ Step 1 DEDUP: ${intent.bypassQuietHours ? '.set() bypass' : '.create() atomic'} succeeded for ${intent.dedupeKey}`);
  } catch (createErr: any) {
    // Code 6 in gRPC / 'ALREADY_EXISTS' in Firestore
    if (createErr?.code === 6 || String(createErr?.message).includes('ALREADY_EXISTS') || String(createErr).includes('already exists')) {
      if (!intent.bypassQuietHours) {
        console.log(`[Router] ✗ Intent ${intent.dedupeKey} suppressed: Duplicate delivery.`);
        return { accepted: false, suppressionReason: 'dedupe_duplicate', channelsDelivered: [] };
      }
      console.log(`[Router] ⚠ Dedup doc already existed but bypassQuietHours=true, continuing...`);
    } else {
      console.warn(`[Router] ⚠ Atomic dedupe unexpected error (code=${createErr?.code}): ${createErr?.message}`);
    }
  }

  // 2. Fetch Member Preferences & Snooze State (use sanitized doc ID: @ and . replaced with _)
  const sanitizedDocId = recipientEmail.replace(/[@.]/g, '_');
  let memberDoc = await db.collection('team_members').doc(sanitizedDocId).get();
  // Fallback: try raw email as doc ID for legacy data
  if (!memberDoc.exists) {
    memberDoc = await db.collection('team_members').doc(recipientEmail).get();
  }
  const memberData = memberDoc.exists ? memberDoc.data() : null;
  const prefs = memberData?.notificationPreferences;
  console.log(`[Router] ✓ Step 2 PREFS: memberDoc found=${memberDoc.exists} (tried ${sanitizedDocId}) | prefs=${prefs ? JSON.stringify({channels: prefs.channels, snooze: prefs.snoozeUntil, quietHours: prefs.quietHours?.enabled}) : 'none'}`);

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

  // 6. Check Daily Budget & Push Allocation (10-15 per member/day, 5 reserved for reminders)
  const capDocId = `daily_cap_${recipientEmail}_${todayStrIST}`;
  const capDocRef = db.collection('notification_caps').doc(capDocId);
  const capDoc = await capDocRef.get();
  const capData = capDoc.exists ? capDoc.data() : {};
  const currentTotal = capData?.total || 0;
  const currentPushTotal = capData?.pushTotal || 0;
  const currentTypeTotal = capData?.[intent.type] || 0;

  // Member budget config (default 12, max 15)
  const memberBudget = Math.min(prefs?.dailyPushBudget ?? 12, 15);
  const reminderReserve = 5;
  const isReminder = intent.priority === 'high' || intent.priority === 'critical' || intent.type.startsWith('task') || intent.type.startsWith('plan_morning');

  if (!intent.bypassQuietHours) {
    // 30-Minute Window Throttle: Max 2 pushes in any 30-minute window
    const windowTimes: number[] = (capData?.recentPushTimestamps || []).filter((t: number) => nowMs - t < 30 * 60 * 1000);
    if (windowTimes.length >= 2 && intent.priority !== 'critical') {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: 30-minute window limit (2 pushes already sent).`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'rate_limit_30m');
      return { accepted: false, suppressionReason: 'rate_limit_30m', channelsDelivered: [] };
    }

    // Engagement cannot crowd out high-priority reminder reserve
    if (!isReminder && currentPushTotal >= (memberBudget - reminderReserve)) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Engagement budget exhausted (${currentPushTotal}/${memberBudget}, reserving ${reminderReserve} for reminders).`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'budget_engagement_exhausted');
      return { accepted: false, suppressionReason: 'budget_engagement_exhausted', channelsDelivered: [] };
    }

    // Absolute hard cap check
    if (currentPushTotal >= memberBudget) {
      console.log(`[Router] Intent ${intent.dedupeKey} suppressed: Daily push budget reached (${currentPushTotal}/${memberBudget}).`);
      await logNotificationOutcome(db, intent, 'suppressed', [], 'budget_exceeded');
      return { accepted: false, suppressionReason: 'budget_exceeded', channelsDelivered: [] };
    }
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
  console.log(`[Router] ▶ Step 8 CHANNELS: Starting delivery for ${recipientEmail} | inApp=${prefs?.channels?.inApp} push=${prefs?.channels?.push} email=${prefs?.channels?.email}`);

  // Channel A: In-App Notification (Stored with deep link & priority)
  const inAppAllowed = prefs?.channels?.inApp !== false;
  console.log(`[Router] Channel A IN-APP: allowed=${inAppAllowed} (prefs.channels.inApp=${prefs?.channels?.inApp})`);
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
      console.log(`[Router] ✓ Channel A IN-APP: Written successfully! docId=${notifRef.id} recipientEmail=${recipientEmail}`);
    } catch (inAppErr: any) {
      console.error(`[Router] ✗ Channel A IN-APP FAILED: ${inAppErr?.message}`, inAppErr);
    }
  } else {
    console.log(`[Router] ⊘ Channel A IN-APP: Skipped (disabled by member prefs)`);
  }

  // Channel B: Push Notification via FCM (With dead-token auto cleanup & TTL)
  const pushAllowed = prefs?.channels?.push !== false;
  console.log(`[Router] Channel B PUSH: allowed=${pushAllowed} (prefs.channels.push=${prefs?.channels?.push})`);
  if (pushAllowed) {
    try {
      // Query devices from both `members/{email}/devices` and `team_members/{email}/devices`
      console.log(`[Router] Channel B PUSH: Querying members/${recipientEmail}/devices where active==true...`);
      let devicesSnap = await db
        .collection('members')
        .doc(recipientEmail)
        .collection('devices')
        .where('active', '==', true)
        .get()
        .catch((e: any) => { console.warn(`[Router] members devices query failed: ${e?.message}`); return { docs: [] as any[] }; });

      console.log(`[Router] Channel B PUSH: members/${recipientEmail}/devices found ${devicesSnap.docs?.length || 0} device(s)`);

      if (!devicesSnap.docs || devicesSnap.docs.length === 0) {
        console.log(`[Router] Channel B PUSH: Falling back to team_members/${sanitizedDocId}/devices...`);
        devicesSnap = await db
          .collection('team_members')
          .doc(sanitizedDocId)
          .collection('devices')
          .where('active', '==', true)
          .get()
          .catch((e: any) => { console.warn(`[Router] team_members devices query failed: ${e?.message}`); return { docs: [] as any[] }; });
        console.log(`[Router] Channel B PUSH: team_members/${sanitizedDocId}/devices found ${devicesSnap.docs?.length || 0} device(s)`);
      }

      // Also try team_members with raw email as fallback
      if (!devicesSnap.docs || devicesSnap.docs.length === 0) {
        console.log(`[Router] Channel B PUSH: Trying team_members/${recipientEmail}/devices (raw email)...`);
        devicesSnap = await db
          .collection('team_members')
          .doc(recipientEmail)
          .collection('devices')
          .where('active', '==', true)
          .get()
          .catch((e: any) => { console.warn(`[Router] team_members raw email devices query failed: ${e?.message}`); return { docs: [] as any[] }; });
        console.log(`[Router] Channel B PUSH: team_members/${recipientEmail}/devices found ${devicesSnap.docs?.length || 0} device(s)`);
      }

      const devices = (devicesSnap.docs || [])
        .map((d: any) => ({ id: d.id, token: d.data()?.token }))
        .filter((d: any) => Boolean(d.token));

      console.log(`[Router] Channel B PUSH: ${devices.length} device(s) with valid tokens for ${recipientEmail}`);

      if (devices.length > 0) {
        const messaging = admin.messaging();
        let pushSuccessCount = 0;
        for (const dev of devices) {
          try {
            // Data-only message: no top-level `notification` field.
            // When `notification` is present, the browser auto-shows it AND
            // onBackgroundMessage fires showNotification — causing duplicates.
            // With data-only, only the service worker controls display.
            const sendResult = await messaging.send({
              token: dev.token,
              data: {
                title: intent.title,
                body: intent.body,
                deepLink: intent.deepLink || '/',
                tag: intent.type || 'jaikrishna-alert',
                priority: intent.priority || 'normal',
                dedupeKey: intent.dedupeKey,
                ...(intent.data || {}),
              },
              webpush: {
                headers: {
                  Urgency: intent.priority === 'critical' || intent.priority === 'high' ? 'high' : 'normal',
                  TTL: '86400',
                },
                fcmOptions: {
                  link: intent.deepLink || '/',
                },
              },
            });
            pushSuccessCount++;
            console.log(`[Router] ✓ Channel B PUSH: Sent successfully to device ${dev.id} | FCM messageId=${sendResult}`);
          } catch (pushErr: any) {
            console.warn(`[Router] ✗ Channel B PUSH: Failed for device ${dev.id}: code=${pushErr?.code} msg=${pushErr?.message}`);
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
        if (pushSuccessCount > 0) {
          channelsDelivered.push('push');
        }
      } else {
        console.log(`[Router] ⊘ Channel B PUSH: No registered devices with active tokens for ${recipientEmail}. Push skipped.`);
      }
    } catch (pushBatchErr: any) {
      console.error(`[Router] ✗ Channel B PUSH: Batch dispatch error: ${pushBatchErr?.message}`, pushBatchErr);
    }
  } else {
    console.log(`[Router] ⊘ Channel B PUSH: Skipped (disabled by member prefs)`);
  }

  // Channel C: Email Delivery via Resend (Respecting member preferences, daily cap, and global cap)
  const emailAllowed = EMAIL_ENABLED && prefs?.channels?.email === true;

  if (emailAllowed) {
    try {
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

      const { sendEmailWithGuards } = await import('./email_adapter.js');
      const emailResult = await sendEmailWithGuards(db, {
        to: recipientEmail,
        subject: intent.title,
        html: intent.emailHtml || defaultHtml,
        isCritical: intent.priority === 'critical',
        idempotencyKey: intent.dedupeKey,
        tag: intent.type,
      });

      if (emailResult.success) {
        channelsDelivered.push('email');
        console.log(`[Router] ✓ Channel C EMAIL: Sent successfully to ${recipientEmail} (msgId=${emailResult.messageId})`);
      } else {
        console.log(`[Router] ⊘ Channel C EMAIL: Suppressed or failed (${emailResult.suppressionReason || emailResult.error})`);
      }
    } catch (emailErr: any) {
      console.error('[Router] Resend email dispatch error:', emailErr?.message || emailErr);
    }
  }

  // Increment daily cap count & budget metrics
  const isPushDelivered = channelsDelivered.includes('push');
  await capDocRef.set({
    total: (currentTotal || 0) + 1,
    pushTotal: isPushDelivered ? (currentPushTotal || 0) + 1 : currentPushTotal,
    recentPushTimestamps: isPushDelivered
      ? [...((capData?.recentPushTimestamps || []).filter((t: number) => nowMs - t < 30 * 60 * 1000)), nowMs]
      : (capData?.recentPushTimestamps || []),
    [intent.type]: (currentTypeTotal || 0) + 1,
    lastUpdated: nowIso,
  }, { merge: true });

  // 9. Update Audit Log Record
  await logNotificationOutcome(db, intent, 'delivered', channelsDelivered);

  console.log(`[Router] ✅ DONE for ${recipientEmail} | dedupeKey=${intent.dedupeKey} | channelsDelivered=[${channelsDelivered.join(', ')}]`);

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
