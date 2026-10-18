/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 7: Daily Morning Plan Generator Module
 * Evaluates individual members' chosen delivery times in Asia/Kolkata.
 * Runs once per member per date, respects quiet hours & email caps,
 * and falls back gracefully to Push and In-App notifications.
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface Rule7CheckOptions {
  simulatedTime?: Date; // Used for automated testing and simulation
}

/**
 * Executes the Rule 7 Morning Plan evaluation for all allowlisted members.
 * Reads each member's chosen delivery time from their settings.
 * Dispatches when server time (Asia/Kolkata) >= chosen time within lateness window (default 2 hours).
 */
export async function executeRule7MorningPlan(
  db: admin.firestore.Firestore,
  sendResendEmailFn: (to: string, subject: string, html: string) => Promise<void>,
  options?: Rule7CheckOptions
): Promise<{ evaluated: number; sent: string[]; skipped: { email: string; reason: string }[] }> {
  const now = options?.simulatedTime || new Date();

  // Convert current time to Asia/Kolkata explicitly
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const kolkataHours = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const kolkataMinutes = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const todayStr = `${year}-${month}-${day}`;

  const currentTotalMins = kolkataHours * 60 + kolkataMinutes;

  const result = {
    evaluated: 0,
    sent: [] as string[],
    skipped: [] as { email: string; reason: string }[],
  };

  // 1. Fetch Rule 7 settings
  const ruleRef = db.collection('automation_rules').doc('rule_7_morning_plan');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return result;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const memberConfigs = params.memberSettings || {};
  const maxLatenessMinutes = params.maxLatenessMinutes ?? 120; // 2 hours default

  // 2. Fetch allowlisted team members
  const allowedSnap = await db.collection('allowed_emails').get();
  const members = allowedSnap.docs.map((d) => d.id);
  result.evaluated = members.length;

  for (const email of members) {
    const memberCfg = memberConfigs[email] || {
      enabled: true,
      deliveryTime: '08:30',
      channels: { push: true, inApp: true, email: true },
      sendIfEmpty: false,
    };

    if (!memberCfg.enabled) {
      result.skipped.push({ email, reason: 'member_disabled' });
      continue;
    }

    const chosenTime = memberCfg.deliveryTime || '08:30';
    const [cHours, cMins] = chosenTime.split(':').map(Number);
    const chosenTotalMins = cHours * 60 + cMins;

    // Delivery Condition: serverTime >= chosenTime AND within lateness window
    if (currentTotalMins < chosenTotalMins) {
      result.skipped.push({ email, reason: `too_early (current ${kolkataHours}:${kolkataMinutes} < ${chosenTime})` });
      continue;
    }

    if (currentTotalMins > chosenTotalMins + maxLatenessMinutes) {
      result.skipped.push({ email, reason: `expired_lateness_window (${currentTotalMins - chosenTotalMins}m > ${maxLatenessMinutes}m)` });
      continue;
    }

    // Quiet Hours Validation: check member profile or default 21:00 - 08:00
    const memberProfile = await db.collection('team_members').doc(email.replace(/[@.]/g, '_')).get();
    const quietHours = memberProfile.data()?.notificationPreferences?.quietHours;
    if (quietHours?.enabled) {
      const [qStartH] = (quietHours.start || '21:00').split(':').map(Number);
      const [qEndH] = (quietHours.end || '08:00').split(':').map(Number);
      if (kolkataHours >= qStartH || kolkataHours < qEndH) {
        result.skipped.push({ email, reason: 'inside_quiet_hours' });
        continue;
      }
    }

    // Deduplication check: Send once per member per date
    const dedupeKey = `morning_plan_${email}_${todayStr}`;
    const dedupeRef = db.collection('notification_log').doc(dedupeKey);
    const dedupeDoc = await dedupeRef.get();
    if (dedupeDoc.exists) {
      result.skipped.push({ email, reason: 'already_sent_today' });
      continue;
    }

    // Fetch Plan Content
    // 1. Follow-ups due today for member
    const tasksTodaySnap = await db
      .collection('tasks')
      .where('assignedTo', '==', email)
      .where('date', '==', todayStr)
      .where('isDeleted', '==', false)
      .limit(10)
      .get();

    // 2. Overdue tasks for member
    const overdueTasksSnap = await db
      .collection('tasks')
      .where('assignedTo', '==', email)
      .where('date', '<', todayStr)
      .where('status', 'in', ['Pending', 'In progress'])
      .where('isDeleted', '==', false)
      .limit(10)
      .get();

    // 3. New leads created since yesterday
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const newLeadsSnap = await db
      .collection('customers')
      .where('createdAt', '>=', yesterdayDate.toISOString())
      .where('isDeleted', '==', false)
      .limit(5)
      .get();

    // 4. Pending automation tasks across system
    const pendingAutoSnap = await db
      .collection('tasks')
      .where('isAutomation', '==', true)
      .where('assignedTo', '==', email)
      .where('status', '==', 'Pending')
      .where('isDeleted', '==', false)
      .limit(5)
      .get();

    // 5. Meta ads waiting for result
    const adsWaitingSnap = await db
      .collection('meta_ads')
      .where('stage', '==', 'Waiting for result')
      .where('isDeleted', '==', false)
      .limit(5)
      .get();

    const totalCount =
      tasksTodaySnap.size +
      overdueTasksSnap.size +
      newLeadsSnap.size +
      pendingAutoSnap.size +
      adsWaitingSnap.size;

    // Empty day handling: skip if empty and sendIfEmpty is false
    if (totalCount === 0 && !memberCfg.sendIfEmpty) {
      result.skipped.push({ email, reason: 'empty_day_and_sendIfEmpty_false' });
      continue;
    }

    // Record deduplication receipt first
    await dedupeRef.set({
      deliveredAt: FieldValue.serverTimestamp(),
      memberEmail: email,
      date: todayStr,
      scheduledTime: chosenTime,
      totalCount,
    });

    // In-App Notification (Always delivered)
    await db.collection('notifications').add({
      recipientEmail: email,
      title: `Good Morning! Daily Plan — ${todayStr}`,
      body: totalCount > 0 
        ? `${tasksTodaySnap.size} task(s) today, ${overdueTasksSnap.size} overdue, ${newLeadsSnap.size} new lead(s).` 
        : 'Your schedule is clear for today.',
      type: 'morning_plan',
      deepLink: '/tasks',
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Email delivery (Respects global daily cap, falls back to Push & In-App on cap hit)
    if (memberCfg.channels?.email) {
      const counterRef = db.collection('system_settings').doc(`email_counter_${todayStr}`);
      const counterDoc = await counterRef.get();
      const currentCount = counterDoc.exists ? (counterDoc.data()?.count || 0) : 0;

      if (currentCount >= 80) {
        console.warn(`[Rule 7] Daily email cap reached (${currentCount}/80). Suppressing email for ${email}; delivered via In-App & Push.`);
      } else {
        const formatItemList = (docs: admin.firestore.QueryDocumentSnapshot[], type: string) => {
          const cap = 5;
          const items = docs.slice(0, cap).map((d) => {
            const data = d.data();
            const link = type === 'lead' 
              ? `https://jaikrishna-industries-bizz-hub.vercel.app/customers?id=${d.id}`
              : `https://jaikrishna-industries-bizz-hub.vercel.app/tasks?id=${d.id}`;
            return `<li><a href="${link}">${data.title || data.companyName || d.id}</a></li>`;
          });
          if (docs.length > cap) {
            items.push(`<li><em>...and ${docs.length - cap} more</em></li>`);
          }
          return items.join('');
        };

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <h2 style="color: #881337;">Vanakkam! Morning Plan — ${todayStr}</h2>
            <p>Here is your daily operational summary:</p>
            ${tasksTodaySnap.size > 0 ? `<h3>Today's Tasks (${tasksTodaySnap.size})</h3><ul>${formatItemList(tasksTodaySnap.docs, 'task')}</ul>` : '<p>No tasks scheduled today.</p>'}
            ${overdueTasksSnap.size > 0 ? `<h3 style="color: #b91c1c;">⚠️ Overdue Tasks (${overdueTasksSnap.size})</h3><ul>${formatItemList(overdueTasksSnap.docs, 'task')}</ul>` : ''}
            ${newLeadsSnap.size > 0 ? `<h3>New Leads (${newLeadsSnap.size})</h3><ul>${formatItemList(newLeadsSnap.docs, 'lead')}</ul>` : ''}
            <p style="margin-top: 20px;">
              <a href="https://jaikrishna-industries-bizz-hub.vercel.app/tasks" style="background: #881337; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Open Tasks</a>
            </p>
          </div>
        `;

        await sendResendEmailFn(email, `Daily Morning Plan — ${todayStr}`, emailHtml);

        await counterRef.set(
          { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    }

    result.sent.push(email);
  }

  return result;
}
