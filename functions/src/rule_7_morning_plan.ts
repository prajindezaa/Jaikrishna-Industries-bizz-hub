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
import { routeNotificationIntent } from './notification_router';

export interface Rule7CheckOptions {
  simulatedTime?: Date; // Used for automated testing and simulation
  forceRunNow?: boolean;
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

  // 1. Fetch or auto-initialize Rule 7 settings
  const ruleRef = db.collection('automation_rules').doc('rule_7_morning_plan');
  let ruleDoc = await ruleRef.get();

  if (!ruleDoc.exists) {
    const defaultRule7 = {
      id: 'rule_7_morning_plan',
      name: 'Rule 7: Daily Morning Operations Plan',
      description: 'Prepares an automated morning operations digest delivered to each member outside quiet hours.',
      enabled: true,
      dailyCap: 10,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'actor',
      parameters: {
        maxLatenessMinutes: 120,
        lookaheadFestivalDays: 7,
        allowEmptyNotification: false,
        memberSettings: {
          'prajindezaa142@gmail.com': { enabled: true, deliveryTime: '08:00', channels: { push: true, inApp: true, email: true }, sendIfEmpty: true },
          'jaikrishnaindustries1@gmail.com': { enabled: true, deliveryTime: '08:00', channels: { push: true, inApp: true, email: true }, sendIfEmpty: true },
          'srinisrkp@gmail.com': { enabled: true, deliveryTime: '08:00', channels: { push: true, inApp: true, email: true }, sendIfEmpty: true },
        },
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    await ruleRef.set(defaultRule7);
    ruleDoc = await ruleRef.get();
  }

  const ruleData = ruleDoc.data() || {};
  if (!ruleData.enabled && !options?.forceRunNow) {
    return result;
  }

  const params = ruleData.parameters || {};
  const memberConfigs = params.memberSettings || {};
  const maxLatenessMinutes = params.maxLatenessMinutes ?? 120; // 2 hours default

  // 2. Fetch team members: check team_members first, then allowed_emails, then fallback
  const teamSnap = await db.collection('team_members').get();
  let members = teamSnap.docs.map((d) => (d.data().email || d.id || '').toLowerCase().trim()).filter(Boolean);

  if (members.length === 0) {
    const allowedSnap = await db.collection('allowed_emails').get();
    members = allowedSnap.docs.map((d) => d.id.toLowerCase().trim()).filter(Boolean);
  }

  if (members.length === 0) {
    members = [
      'prajindezaa142@gmail.com',
      'jaikrishnaindustries1@gmail.com',
      'srinisrkp@gmail.com',
    ];
  }

  // Deduplicate and canonicalize
  const uniqueMembers = Array.from(new Set(members)).filter(
    (e) => e !== 'prajindezaa142@gamil.com'
  );
  if (!uniqueMembers.includes('prajindezaa142@gmail.com')) {
    uniqueMembers.unshift('prajindezaa142@gmail.com');
  }

  result.evaluated = uniqueMembers.length;

  for (const email of uniqueMembers) {
    const memberCfg = memberConfigs[email] || {
      enabled: true,
      deliveryTime: '08:00',
      channels: { push: true, inApp: true, email: true },
      sendIfEmpty: true,
    };

    if (!memberCfg.enabled) {
      result.skipped.push({ email, reason: 'member_disabled' });
      continue;
    }

    const chosenTime = memberCfg.deliveryTime || '08:00';
    const [cHours, cMins] = chosenTime.split(':').map(Number);
    const chosenTotalMins = cHours * 60 + cMins;

    // Delivery Condition: serverTime >= chosenTime AND within lateness window (unless forceRunNow)
    if (!options?.forceRunNow) {
      if (currentTotalMins < chosenTotalMins) {
        result.skipped.push({ email, reason: `too_early (current ${kolkataHours}:${kolkataMinutes} < ${chosenTime})` });
        continue;
      }

      if (currentTotalMins > chosenTotalMins + maxLatenessMinutes) {
        result.skipped.push({ email, reason: `expired_lateness_window (${currentTotalMins - chosenTotalMins}m > ${maxLatenessMinutes}m)` });
        continue;
      }
    }

    // Quiet Hours Validation: check member profile or default 21:00 - 08:00
    if (!options?.forceRunNow) {
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
    }

    // Deduplication check: Send once per member per date (unless forceRunNow)
    const dedupeKey = `morning_plan_${email}_${todayStr}`;
    const dedupeRef = db.collection('notification_log').doc(dedupeKey);
    if (!options?.forceRunNow) {
      const dedupeDoc = await dedupeRef.get();
      if (dedupeDoc.exists) {
        result.skipped.push({ email, reason: 'already_sent_today' });
        continue;
      }
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

    // 2. Overdue tasks for member (in-memory filter for status to avoid missing composite index)
    const allMemberTasksSnap = await db
      .collection('tasks')
      .where('assignedTo', '==', email)
      .where('isDeleted', '==', false)
      .limit(50)
      .get();

    const overdueTasks = allMemberTasksSnap.docs.filter((d) => {
      const data = d.data();
      const isOpen = data.status === 'Pending' || data.status === 'In progress';
      return isOpen && data.date && data.date < todayStr;
    });

    // 3. New leads created since yesterday (in-memory filter to avoid composite index)
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentCustomersSnap = await db
      .collection('customers')
      .limit(50)
      .get();

    const newLeads = recentCustomersSnap.docs.filter((d) => {
      const data = d.data();
      if (data.isDeleted) return false;
      const cDate = data.createdAt ? new Date(data.createdAt) : null;
      return cDate && cDate.getTime() >= yesterdayDate.getTime();
    }).slice(0, 5);

    // 4. Pending automation tasks across system
    const pendingAutoTasks = allMemberTasksSnap.docs.filter((d) => {
      const data = d.data();
      return data.isAutomation === true && data.status === 'Pending';
    });

    // 5. Meta ads waiting for result (in-memory filter to avoid composite index)
    const allAdsSnap = await db
      .collection('meta_ads')
      .limit(20)
      .get();

    const adsWaiting = allAdsSnap.docs.filter((d) => {
      const data = d.data();
      return !data.isDeleted && data.stage === 'Waiting for result';
    });

    const totalCount =
      tasksTodaySnap.size +
      overdueTasks.length +
      newLeads.length +
      pendingAutoTasks.length +
      adsWaiting.length;

    // Empty day handling: skip if empty and sendIfEmpty is false
    if (totalCount === 0 && !memberCfg.sendIfEmpty && !options?.forceRunNow) {
      result.skipped.push({ email, reason: 'empty_day_and_sendIfEmpty_false' });
      continue;
    }

    // Dispatch via centralized Notification Router (handles In-App bell, FCM Push, quiet hours, snooze)
    console.log(`[Rule 7] ▶ Dispatching notification for ${email} via routeNotificationIntent (bypassQuietHours=${Boolean(options?.forceRunNow)})...`);
    const routerResult = await routeNotificationIntent(db, {
      recipientEmail: email,
      title: `Good Morning! Daily Plan — ${todayStr}`,
      body: totalCount > 0 
        ? `${tasksTodaySnap.size} task(s) today, ${overdueTasks.length} overdue, ${newLeads.length} new lead(s).` 
        : 'Your schedule is clear for today.',
      type: 'morning_plan',
      priority: 'normal',
      deepLink: '/tasks',
      dedupeKey: `morning_plan_${email}_${todayStr}`,
      bypassQuietHours: Boolean(options?.forceRunNow),
    });
    console.log(`[Rule 7] ✓ routeNotificationIntent returned: accepted=${routerResult.accepted} | channels=[${routerResult.channelsDelivered.join(', ')}] | suppression=${routerResult.suppressionReason || 'none'}`);

    // Record deduplication receipt after dispatch
    await dedupeRef.set({
      deliveredAt: new Date().toISOString(),
      memberEmail: email,
      date: todayStr,
      scheduledTime: chosenTime,
      totalCount,
      routerResult: {
        accepted: routerResult.accepted,
        channelsDelivered: routerResult.channelsDelivered,
        suppressionReason: routerResult.suppressionReason || null,
      },
    });

    // Email delivery (Respects global daily cap, falls back to Push & In-App on cap hit)
    if (memberCfg.channels?.email) {
      const counterRef = db.collection('system_settings').doc(`email_counter_${todayStr}`);
      const counterDoc = await counterRef.get();
      const currentCount = counterDoc.exists ? (counterDoc.data()?.count || 0) : 0;

      if (currentCount >= 80) {
        console.warn(`[Rule 7] Daily email cap reached (${currentCount}/80). Suppressing email for ${email}; delivered via In-App & Push.`);
      } else {
        const formatItemList = (items: { id: string; title: string; link: string }[]) => {
          const cap = 5;
          const displayItems = items.slice(0, cap).map((item) => {
            return `<li><a href="${item.link}">${item.title}</a></li>`;
          });
          if (items.length > cap) {
            displayItems.push(`<li><em>...and ${items.length - cap} more</em></li>`);
          }
          return displayItems.join('');
        };

        const appUrl = (process.env.APP_URL || 'https://jaikrishnabizzhub.in').replace(/\/+$/, '');

        const todayTaskItems = tasksTodaySnap.docs.map((d) => ({
          id: d.id,
          title: d.data().title || d.id,
          link: `${appUrl}/tasks?id=${d.id}`,
        }));

        const overdueTaskItems = overdueTasks.map((d) => ({
          id: d.id,
          title: d.data().title || d.id,
          link: `${appUrl}/tasks?id=${d.id}`,
        }));

        const newLeadItems = newLeads.map((d) => ({
          id: d.id,
          title: d.data().companyName || d.data().contactPerson || d.id,
          link: `${appUrl}/customers?id=${d.id}`,
        }));

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <h2 style="color: #881337;">Vanakkam! Morning Plan — ${todayStr}</h2>
            <p>Here is your daily operational summary:</p>
            ${todayTaskItems.length > 0 ? `<h3>Today's Tasks (${todayTaskItems.length})</h3><ul>${formatItemList(todayTaskItems)}</ul>` : '<p>No tasks scheduled today.</p>'}
            ${overdueTaskItems.length > 0 ? `<h3 style="color: #b91c1c;">⚠️ Overdue Tasks (${overdueTaskItems.length})</h3><ul>${formatItemList(overdueTaskItems)}</ul>` : ''}
            ${newLeadItems.length > 0 ? `<h3>New Leads (${newLeadItems.length})</h3><ul>${formatItemList(newLeadItems)}</ul>` : ''}
            <p style="margin-top: 20px;">
              <a href="${appUrl}/tasks" style="background: #881337; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Open Tasks</a>
            </p>
          </div>
        `;

        await sendResendEmailFn(email, `Daily Morning Plan — ${todayStr}`, emailHtml);

        await counterRef.set(
          { count: (counterDoc.data()?.count || 0) + 1, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }
    }

    result.sent.push(email);
  }

  // Update rule document lastResult for Health Panel visibility
  await ruleRef.set({
    lastRunAt: new Date().toISOString(),
    lastResult: {
      status: 'success',
      createdCount: result.sent.length,
      skippedCount: result.skipped.length,
      skipReasons: result.skipped.reduce((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      error: null,
      timestamp: new Date().toISOString(),
    },
  }, { merge: true });

  return result;
}
