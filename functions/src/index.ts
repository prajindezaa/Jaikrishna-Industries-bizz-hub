/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Cloud Functions v2
 * Scheduled Background Notification & Reminder Engine
 * Timezone: Asia/Kolkata (IST)
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

// Set global region to Asia/Kolkata (Mumbai) compatible region
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { executeRule7MorningPlan } from './rule_7_morning_plan';
export { executeRule7MorningPlan } from './rule_7_morning_plan';
import { executeRule2IdleLeadCheck } from './rule_2_idle_lead';
export { executeRule2IdleLeadCheck } from './rule_2_idle_lead';
import { executeRule3AutoStageCold } from './rule_3_auto_cold';
export { executeRule3AutoStageCold } from './rule_3_auto_cold';
import { executeRule4ColdRevival } from './rule_4_cold_revival';
export { executeRule4ColdRevival } from './rule_4_cold_revival';
import { executeRule5ReorderReminders } from './rule_5_reorder';
export { executeRule5ReorderReminders } from './rule_5_reorder';
import { executeRule6FestivalCampaignPrep } from './rule_6_festival';
export { executeRule6FestivalCampaignPrep } from './rule_6_festival';
import {
  routeNotificationIntent,
  isWithinQuietHours,
  getCurrentTimeIST,
  EMAIL_ENABLED,
} from './notification_router';
export {
  routeNotificationIntent,
  isWithinQuietHours,
  getCurrentTimeIST,
  EMAIL_ENABLED,
};
export type { NotificationIntent } from './notification_router';
export { sendResendEmail };

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// Canonical origin for deep links and email CTAs (configurable via environment variable)
const APP_URL = (process.env.APP_URL || 'https://jaikrishnabizzhub.in').replace(/\/+$/, '');

// 1. Scheduled Reminder Engine (Every 5 Minutes)
export const checkRemindersScheduled = onSchedule(
  {
    schedule: '*/5 * * * *',
    timeZone: 'Asia/Kolkata',
    memory: '256MiB',
  },
  async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    console.log(`[Reminders Cron] Running check at ${currentTimeStr} IST for date: ${todayStr}`);

    // Query pending/in-progress tasks for today or overdue from past days
    const tasksSnap = await db
      .collection('tasks')
      .where('isDeleted', '==', false)
      .where('status', 'in', ['Pending', 'In progress'])
      .where('date', '<=', todayStr)
      .limit(100)
      .get();

    if (tasksSnap.empty) {
      console.log('[Reminders Cron] No pending tasks to process.');
      return;
    }

    const tasksByAssignee: Record<string, admin.firestore.DocumentData[]> = {};

    for (const doc of tasksSnap.docs) {
      const task = doc.data();
      const taskId = doc.id;

      // Auto-mark Missed if past end time
      const isPastDay = task.date < todayStr;
      const isPastEndTime = task.date === todayStr && task.endTime < currentTimeStr;

      if (isPastDay || isPastEndTime) {
        await doc.ref.update({
          status: 'Missed',
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Log peer alert notification for other team members (never the assignee)
        const teamEmails = [
          'prajindezaa142@gmail.com',
          'jaikrishnaindustries1@gmail.com',
          'srinisrkp@gmail.com',
        ];
        const taskAssignee = (task.assignedTo || '').toLowerCase().trim();
        for (const recipientEmail of teamEmails) {
          if (recipientEmail === taskAssignee) continue; // Exclude self
          await routeNotificationIntent(db, {
            recipientEmail,
            title: `Missed Task Alert: ${task.customerName || 'Customer'}`,
            body: `${task.assignedTo || 'Member'} missed task "${task.title}".`,
            type: 'task_missed_peer',
            priority: 'normal',
            deepLink: `/tasks?id=${taskId}`,
            dedupeKey: `task_missed_peer_${taskId}_${recipientEmail}_${todayStr}`,
          });
        }
      }

      // Group pending tasks for batched digest
      const assignee = task.assignedTo || 'prajindezaa142@gmail.com';
      if (!tasksByAssignee[assignee]) {
        tasksByAssignee[assignee] = [];
      }
      tasksByAssignee[assignee].push({ ...task, id: taskId });
    }

    // Concurrency Lease Lock: ensure no overlapping cron runs (lease expires in 4 minutes)
    const leaseRef = db.collection('system_settings').doc('cron_lease');
    const nowMs = Date.now();
    let acquiredLease = false;

    await db.runTransaction(async (transaction) => {
      const leaseDoc = await transaction.get(leaseRef);
      const leaseData = leaseDoc.data() || {};
      const expiresAt = leaseData.expiresAt || 0;

      if (nowMs < expiresAt) {
        console.log(`[Reminders Cron] Another cron execution is currently active (lease valid until ${new Date(expiresAt).toISOString()}). Skipping.`);
        return;
      }

      transaction.set(leaseRef, {
        lockedBy: 'checkRemindersScheduled',
        lockedAt: nowMs,
        expiresAt: nowMs + 4 * 60 * 1000, // 4-minute lease
      });
      acquiredLease = true;
    });

    if (!acquiredLease) return;

    // Heartbeat document for health monitoring
    await db.collection('system_settings').doc('automation_heartbeat').set({
      lastScheduledRun: new Date().toISOString(),
      lastCheckedTimeIST: `${currentTimeStr} IST`,
      lastDateIST: todayStr,
    }, { merge: true });

    // Process batched digest per member (Respecting daily email caps)
    for (const [memberEmail, pendingTasks] of Object.entries(tasksByAssignee)) {
      await sendMemberDigestEmail(memberEmail, pendingTasks);
    }

    // Helper: update error onto rule document rather than swallowing
    const recordRuleError = async (ruleId: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await db.collection('automation_rules').doc(ruleId).set({
          lastRunAt: new Date().toISOString(),
          lastResult: {
            status: 'error',
            createdCount: 0,
            skippedCount: 0,
            skipReasons: {},
            error: message,
            timestamp: new Date().toISOString(),
          },
        }, { merge: true });
      } catch (logErr) {
        console.error(`Failed to record error for ${ruleId}:`, logErr);
      }
    };

    // Process Rule 7 Daily Morning Plan for members whose chosen delivery time matches current IST time
    try {
      await executeRule7MorningPlan(db, sendResendEmail);
    } catch (err) {
      console.error('[Rule 7 Execution Error]:', err);
      await recordRuleError('rule_7_morning_plan', err);
    }

    // Process Rule 2 Idle Lead Re-Engagement
    try {
      await executeRule2IdleLeadCheck(db);
    } catch (err) {
      console.error('[Rule 2 Execution Error]:', err);
      await recordRuleError('rule_2_idle_lead_reengagement', err);
    }

    // Process Rule 3 Cold Lead Auto-Stage & Consecutive Unanswered Tagging
    try {
      await executeRule3AutoStageCold(db);
    } catch (err) {
      console.error('[Rule 3 Execution Error]:', err);
      await recordRuleError('rule_3_auto_stage_cold', err);
    }

    // Process Rule 4 Inactive Customer Revival
    try {
      await executeRule4ColdRevival(db);
    } catch (err) {
      console.error('[Rule 4 Execution Error]:', err);
      await recordRuleError('rule_4_cold_revival', err);
    }

    // Process Rule 5 Order Reorder Reminders
    try {
      await executeRule5ReorderReminders(db);
    } catch (err) {
      console.error('[Rule 5 Execution Error]:', err);
      await recordRuleError('rule_5_reorder_reminders', err);
    }

    // Process Rule 6 Festival Campaign Prep
    try {
      await executeRule6FestivalCampaignPrep(db);
    } catch (err) {
      console.error('[Rule 6 Execution Error]:', err);
      await recordRuleError('rule_6_festival_campaign_prep', err);
    }

    // Release lease
    await leaseRef.set({ expiresAt: 0, lockedBy: null, releasedAt: Date.now() }, { merge: true });
  }
);

// 2. Daily Summary Scheduled (Every Evening at 08:00 PM IST)
export const sendDailySummaryScheduled = onSchedule(
  {
    schedule: '0 20 * * *',
    timeZone: 'Asia/Kolkata',
    memory: '256MiB',
  },
  async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    console.log(`[Daily Summary Cron] Compiling end-of-day summary for ${todayStr}`);

    const doneSnap = await db
      .collection('tasks')
      .where('date', '==', todayStr)
      .where('status', '==', 'Done')
      .get();

    const missedSnap = await db
      .collection('tasks')
      .where('date', '==', todayStr)
      .where('status', '==', 'Missed')
      .get();

    const summaryHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #881337;">Jaikrishna Industries — Daily Operations Summary</h2>
        <p>Summary for <strong>${todayStr}</strong></p>
        <div style="margin: 20px 0; padding: 15px; background: #fdfbf7; border-left: 4px solid #d97706;">
          <p><strong>Tasks Completed:</strong> ${doneSnap.size}</p>
          <p><strong>Tasks Missed / Follow-up Needed:</strong> ${missedSnap.size}</p>
        </div>
        <p style="font-size: 12px; color: #737373;">Sent from Jaikrishna Industries Automated Business Hub.</p>
      </div>
    `;

    // Send summary to allowlisted members
    const allowedMembers = [
      'prajindezaa142@gmail.com',
      'jaikrishnaindustries1@gmail.com',
      'srinisrkp@gmail.com',
    ];
    for (const email of allowedMembers) {
      await sendResendEmail(email, `Jaikrishna Daily Summary — ${todayStr}`, summaryHtml);
    }
  }
);

// 3. Automated 30-Day Trash Purge (Every Night at 02:00 AM IST)
export const purgeExpiredTrashScheduled = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'Asia/Kolkata',
    memory: '256MiB',
  },
  async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    console.log(`[Trash Purge Cron] Purging records soft-deleted before: ${thirtyDaysAgo.toISOString()}`);

    const collections = ['customers', 'tasks', 'orders', 'plans'];
    for (const col of collections) {
      const snap = await db
        .collection(col)
        .where('isDeleted', '==', true)
        .where('deletedAt', '<=', cutoffTimestamp)
        .limit(200)
        .get();

      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        console.log(`[Trash Purge Cron] Permanently purged ${snap.size} expired items from ${col}`);
      }
    }
  }
);

/**
 * Sends a single batched digest email listing pending tasks individually
 */
async function sendMemberDigestEmail(email: string, tasks: admin.firestore.DocumentData[]) {
  // Check member daily cap
  const todayStr = new Date().toISOString().slice(0, 10);
  const counterRef = db.collection('system_settings').doc(`email_counter_${todayStr}`);
  const counterDoc = await counterRef.get();

  const currentCount = counterDoc.exists ? (counterDoc.data()?.count || 0) : 0;
  if (currentCount >= 80) {
    console.warn(`[Resend Cap Guard] Global daily cap reached (${currentCount}/80). Skipping email to reserve free buffer.`);
    return;
  }

  const taskListHtml = tasks
    .map(
      (t) => `
      <li style="margin-bottom: 10px;">
        <strong>${t.title}</strong><br/>
        <span style="font-size: 12px; color: #555;">Due: ${t.startTime} – ${t.endTime} · Priority: ${t.priority} ${t.customerName ? `· Customer: ${t.customerName}` : ''}</span>
      </li>
    `
    )
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
      <h2 style="color: #881337;">Jaikrishna Industries — Pending Tasks Digest</h2>
      <p>You have <strong>${tasks.length} pending task(s)</strong> scheduled for today:</p>
      <ul style="padding-left: 20px;">
        ${taskListHtml}
      </ul>
      <p style="margin-top: 20px;">
        <a href="${APP_URL}/tasks" style="background: #881337; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 12px;">Open Tasks in Hub</a>
      </p>
    </div>
  `;

  await sendResendEmail(email, `Pending Tasks Digest (${tasks.length} tasks) — Jaikrishna Industries`, html);

  // Increment counter
  await counterRef.set(
    { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Dispatches an email via Resend API
 */
async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Resend Mock/Log] API key not set. Email to: ${to}, subject: "${subject}"`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'reminders@jaikrishnabizzhub.in',
        to: [to],
        subject,
        html,
      }),
    });
    const result = await res.json();
    console.log('[Resend Email Dispatched]', result);
  } catch (err) {
    console.error('Failed to dispatch Resend email:', err);
  }
}

// ==============================================================================
// AUTOMATION HUB — SERVER-SIDE DETERMINISTIC ENGINES (STEP A: RULE 1 & RULE 7)
// ==============================================================================

/**
 * Calculates due date in 'Asia/Kolkata' timezone:
 * Base date + N calendar days. If that day lands on a non-working day, shifts to next working day.
 * Example: Friday + 2 days = Sunday -> Shifts to Monday.
 * Example: Saturday (Oct 31) + 2 days = Monday Nov 2.
 */
export {
  calculateWorkingDayDate,
  isTaskUntouched,
  executeRule1CustomerStageChange,
} from './rule_1_stage_followup';
import {
  calculateWorkingDayDate,
  isTaskUntouched,
  executeRule1CustomerStageChange,
} from './rule_1_stage_followup';

/**
 * RULE 1: Auto Follow-Up Tasks When Customer Stage Changes (Create & Update)
 * Trigger: Firestore onDocumentWritten on customers/{customerId}
 */
export async function handleCustomerStageChangeRule1Core(
  customerId: string,
  beforeData: admin.firestore.DocumentData | null,
  afterData: admin.firestore.DocumentData | null,
  eventId: string = 'evt_' + Date.now()
): Promise<{ status: string; reason?: string; taskId?: string }> {
  return executeRule1CustomerStageChange(db, {
    customerId,
    beforeStage: beforeData?.leadStage,
    newStage: afterData?.leadStage,
    customerData: afterData,
    eventId,
    lastWriteSource: afterData?.lastWriteSource,
  });
}

export const onCustomerStageChangeRule1 = onDocumentWritten(
  'customers/{customerId}',
  async (event) => {
    const beforeSnap = event.data?.before;
    const afterSnap = event.data?.after;

    if (!afterSnap || !afterSnap.exists) return;

    const beforeData = (beforeSnap && beforeSnap.exists) ? (beforeSnap.data() as admin.firestore.DocumentData) : null;
    const afterData = (afterSnap && afterSnap.exists) ? (afterSnap.data() as admin.firestore.DocumentData) : null;
    await handleCustomerStageChangeRule1Core(event.params.customerId, beforeData, afterData, event.id);
  }
);

/**
 * Processes automation_pending queue:
 * Executed in ONE place: during the first morning run of the day (Asia/Kolkata).
 */
export async function processPendingAutomationQueue() {
  const pendingSnap = await db
    .collection('automation_pending')
    .where('status', '==', 'queued')
    .limit(30)
    .get();

  if (pendingSnap.empty) return;

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  console.log(`[Automation Pending Queue] Processing ${pendingSnap.size} deferred items for ${todayStr}.`);

  for (const doc of pendingSnap.docs) {
    const item = doc.data();

    // Re-check: customer still in stage, not deleted, not ordered
    const custDoc = await db.collection('customers').doc(item.customerId).get();
    if (!custDoc.exists || custDoc.data()?.isDeleted || custDoc.data()?.leadStage !== item.stage || custDoc.data()?.status === 'Old customer') {
      await doc.ref.update({ status: 'cancelled', cancelledReason: 'Customer stage changed or deleted' });
      continue;
    }

    const dueDateStr = calculateWorkingDayDate(now, 1);
    const taskDocRef = db.collection('tasks').doc(item.id);

    await db.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskDocRef);
      if (!taskDoc.exists) {
        transaction.set(taskDocRef, {
          id: item.id,
          title: `Follow up with ${item.customerName}`,
          description: `Created from deferred queue (Daily Cap Overflow).`,
          customerId: item.customerId,
          customerName: item.customerName,
          type: 'Call',
          assignedTo: item.assignedTo,
          priority: 'Medium',
          date: dueDateStr,
          startTime: '10:00',
          endTime: '10:30',
          repeat: 'None',
          status: 'Pending',
          isDeleted: false,
          createdBy: 'automation',
          isAutomation: true,
          automationRuleId: item.ruleId,
          automationKey: item.id,
          automationStage: item.stage,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastEditedBy: null,
          lastEditedAt: null,
        });
      }
      transaction.update(doc.ref, { status: 'processed', processedAt: FieldValue.serverTimestamp() });
    });
  }
}

/**
 * RULE 7: Daily Morning Plan Generator
 * Called within scheduled reminder cycle, evaluates members with chosen delivery time in Asia/Kolkata.
 */
export async function executeMorningPlanCheck() {
  const now = new Date();
  const kolkataHours = now.getHours();
  const kolkataMinutes = now.getMinutes();
  const kolkataCurrentTimeStr = `${String(kolkataHours).padStart(2, '0')}:${String(kolkataMinutes).padStart(2, '0')}`;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  // First morning run of day (e.g. around 08:00): process deferred pending queue
  if (kolkataHours >= 8 && kolkataHours < 9 && kolkataMinutes < 10) {
    try {
      await processPendingAutomationQueue();
    } catch (err) {
      console.error('[Pending Queue Error]', err);
    }
  }

  // Fetch Rule 7 settings
  const ruleRef = db.collection('automation_rules').doc('rule_7_morning_plan');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) return;

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const memberConfigs = params.memberSettings || {};
  const maxLatenessMinutes = params.maxLatenessMinutes || 120; // 2 hours

  // Find allowlisted members
  const allowedSnap = await db.collection('allowed_emails').get();
  const members = allowedSnap.docs.map((d) => d.id);

  for (const email of members) {
    const memberCfg = memberConfigs[email] || {
      enabled: true,
      deliveryTime: '08:30',
      channels: { push: true, inApp: true, email: true },
      sendIfEmpty: false,
    };

    if (!memberCfg.enabled) continue;

    const chosenTime = memberCfg.deliveryTime || '08:30';
    const [cHours, cMins] = chosenTime.split(':').map(Number);
    const chosenTotalMins = cHours * 60 + cMins;
    const currentTotalMins = kolkataHours * 60 + kolkataMinutes;

    // Delivery Condition: serverTime >= chosenTime AND within lateness window
    if (currentTotalMins < chosenTotalMins || currentTotalMins > chosenTotalMins + maxLatenessMinutes) {
      continue;
    }

    // Quiet Hours Validation: chosen time must fall outside quiet hours
    const memberProfile = await db.collection('team_members').doc(email.replace(/[@.]/g, '_')).get();
    const quietHours = memberProfile.data()?.notificationPreferences?.quietHours;
    if (quietHours?.enabled) {
      const [qStartH] = (quietHours.start || '21:00').split(':').map(Number);
      const [qEndH] = (quietHours.end || '08:00').split(':').map(Number);
      if (kolkataHours >= qStartH || kolkataHours < qEndH) {
        console.log(`[Rule 7] Suppressed for ${email}: current time is inside quiet hours.`);
        continue;
      }
    }

    // Deduplication check: Send once per member per date
    const dedupeKey = `morning_plan_${email}_${todayStr}`;
    const dedupeRef = db.collection('notification_log').doc(dedupeKey);
    const dedupeDoc = await dedupeRef.get();
    if (dedupeDoc.exists) continue;

    // 1. Today's Tasks
    const tasksTodaySnap = await db
      .collection('tasks')
      .where('assignedTo', '==', email)
      .where('date', '==', todayStr)
      .where('isDeleted', '==', false)
      .limit(15)
      .get();

    // 2. Overdue Tasks
    const overdueTasksSnap = await db
      .collection('tasks')
      .where('assignedTo', '==', email)
      .where('date', '<', todayStr)
      .where('status', 'in', ['Pending', 'In progress'])
      .where('isDeleted', '==', false)
      .limit(10)
      .get();

    // 3. New Leads since yesterday
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const newLeadsSnap = await db
      .collection('customers')
      .where('createdAt', '>=', yesterday.toISOString())
      .where('isDeleted', '==', false)
      .limit(5)
      .get();

    // 4. Meta Ads Waiting for Result
    const adsWaitingSnap = await db
      .collection('meta_ads')
      .where('stage', '==', 'Waiting for result')
      .where('isDeleted', '==', false)
      .limit(5)
      .get();

    // 5. WhatsApp Queues Pending
    const queuesPendingSnap = await db
      .collection('whatsapp_queues')
      .where('status', '==', 'Processing')
      .limit(5)
      .get();

    // 6. Upcoming Festivals (next 7 days)
    const futureDateStr = calculateWorkingDayDate(now, 7);
    const festivalsSnap = await db
      .collection('festival_events')
      .where('date', '>=', todayStr)
      .where('date', '<=', futureDateStr)
      .where('isDeleted', '==', false)
      .limit(5)
      .get();

    const totalItems =
      tasksTodaySnap.size +
      overdueTasksSnap.size +
      newLeadsSnap.size +
      adsWaitingSnap.size +
      queuesPendingSnap.size +
      festivalsSnap.size;

    if (totalItems === 0 && !memberCfg.sendIfEmpty) {
      console.log(`[Rule 7] No items for ${email} today and sendIfEmpty is false.`);
      continue;
    }

    // Mark deduplicated
    await dedupeRef.set({
      deliveredAt: FieldValue.serverTimestamp(),
      memberEmail: email,
      date: todayStr,
    });

    // Route through notification router
    await routeNotificationIntent(db, {
      recipientEmail: email,
      title: `Daily Morning Plan — ${todayStr}`,
      body: `You have ${tasksTodaySnap.size} task(s) today and ${overdueTasksSnap.size} overdue task(s).`,
      type: 'plan_morning_brief',
      priority: 'high',
      deepLink: '/planning',
      dedupeKey: `morning_plan_${email}_${todayStr}`,
    });

    // Email Dispatch via Resend (with Cap Fallback to Push/In-App)
    if (memberCfg.channels?.email) {
      const taskListHtml = tasksTodaySnap.docs
        .map((d) => `<li><a href="${APP_URL}/tasks?id=${d.id}"><strong>${d.data().title}</strong></a> (${d.data().startTime || '10:00'})</li>`)
        .join('');

      const overdueHtml = overdueTasksSnap.docs
        .map((d) => `<li style="color: #b91c1c;"><a href="${APP_URL}/tasks?id=${d.id}"><strong>${d.data().title}</strong></a> (Due: ${d.data().date})</li>`)
        .join('');

      const adsHtml = adsWaitingSnap.docs
        .map((d) => `<li><a href="${APP_URL}/planning">Campaign: <strong>${d.data().name}</strong></a> (Waiting for result)</li>`)
        .join('');

      const festHtml = festivalsSnap.docs
        .map((d) => `<li>Festival: <strong>${d.data().name}</strong> on ${d.data().date}</li>`)
        .join('');

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
          <h2 style="color: #881337; margin-top: 0;">Vanakkam! Your Daily Morning Plan</h2>
          <p style="color: #666;">Operations Briefing for <strong>${todayStr} (Asia/Kolkata)</strong></p>
          <h3 style="color: #1f2937; margin-top: 20px; border-bottom: 2px solid #881337;">Today's Tasks (${tasksTodaySnap.size})</h3>
          ${tasksTodaySnap.empty ? '<p style="color: #888;">No tasks scheduled for today.</p>' : `<ul>${taskListHtml}</ul>`}
          ${overdueTasksSnap.empty ? '' : `<h3 style="color: #b91c1c;">⚠️ Overdue Tasks (${overdueTasksSnap.size})</h3><ul>${overdueHtml}</ul>`}
          ${adsWaitingSnap.empty ? '' : `<h3 style="color: #d97706;">📢 Meta Ads Needing Action</h3><ul>${adsHtml}</ul>`}
          ${festHtml ? `<h3 style="color: #4b5563;">🪔 Upcoming Festivals</h3><ul>${festHtml}</ul>` : ''}
          <p style="margin-top: 25px;">
            <a href="${APP_URL}/tasks" style="background: #881337; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Jaikrishna Business Hub</a>
          </p>
        </div>
      `;

      await sendResendEmail(email, `Daily Morning Plan — ${todayStr}`, emailHtml);
    }
  }
}
