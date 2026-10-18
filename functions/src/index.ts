/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Cloud Functions v2
 * Scheduled Background Notification & Reminder Engine
 * Timezone: Asia/Kolkata (IST)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log peer alert notification for other members
        await db.collection('notifications').add({
          recipientEmail: 'prajindezaa142@gmail.com',
          title: `Task Missed: ${task.title}`,
          body: `Scheduled for ${task.customerName || 'factory'} at ${task.startTime}-${task.endTime} was not completed.`,
          type: 'missed',
          deepLink: `/tasks?id=${taskId}`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Group pending tasks for batched digest
      const assignee = task.assignedTo || 'prajindezaa142@gmail.com';
      if (!tasksByAssignee[assignee]) {
        tasksByAssignee[assignee] = [];
      }
      tasksByAssignee[assignee].push({ ...task, id: taskId });
    }

    // Process batched digest per member (Respecting daily email caps)
    for (const [memberEmail, pendingTasks] of Object.entries(tasksByAssignee)) {
      await sendMemberDigestEmail(memberEmail, pendingTasks);
    }
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
    const allowedMembers = ['prajindezaa142@gmail.com'];
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
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

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
        <a href="https://jaikrishnaindustries.com/tasks" style="background: #881337; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 12px;">Open Tasks in Hub</a>
      </p>
    </div>
  `;

  await sendResendEmail(email, `Pending Tasks Digest (${tasks.length} tasks) — Jaikrishna Industries`, html);

  // Increment counter
  await counterRef.set(
    { count: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
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
        from: process.env.RESEND_FROM_EMAIL || 'reminders@jaikrishnaindustries.com',
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
