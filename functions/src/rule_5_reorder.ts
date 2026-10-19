/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 5: Smart Reorder Reminders Engine
 * Daily run (default 08:00 IST).
 * Old customers with at least 2 orders:
 * Compute the usual reorder interval (median of date gaps between consecutive orders).
 * Creates a reorder task shortly before it is due (e.g. 3 days before).
 * If overdue by a large multiple (default 2x median), creates one "Check in" task and tags 'Reorder overdue'.
 * The 'Reorder overdue' tag is removed on their next order.
 * Skips customers with fewer than 2 orders and reports the count in lastResult.
 * Evaluated strictly in Asia/Kolkata. Never guesses.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { calculateWorkingDayDate } from './rule_1_stage_followup';

export interface Rule5Options {
  simulatedTime?: Date;
  forceRunNow?: boolean; // Bypass 08:00 IST check for manual "Run now" triggers
  dryRun?: boolean;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') return new Date(val);
  return null;
}

/**
 * Calculates the mathematical median of an array of numbers.
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function executeRule5ReorderReminders(
  db: Firestore,
  options?: Rule5Options
): Promise<{
  evaluated: number;
  created: number;
  skipped: number;
  skippedFewerThanTwoOrders: number;
  pendingQueued: number;
  dryRun?: boolean;
}> {
  const now = options?.simulatedTime || new Date();
  const dryRun = Boolean(options?.dryRun);

  // Convert current time to Asia/Kolkata explicitly
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const kolkataHours = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const todayStr = `${year}-${month}-${day}`;

  const stats = {
    evaluated: 0,
    created: 0,
    skipped: 0,
    skippedFewerThanTwoOrders: 0,
    pendingQueued: 0,
    dryRun,
  };

  // 1. Fetch or auto-initialize Rule 5 settings
  const ruleRef = db.collection('automation_rules').doc('rule_5_reorder_reminders');
  let ruleDoc = await ruleRef.get();

  if (!ruleDoc.exists) {
    const defaultRule5 = {
      id: 'rule_5_reorder_reminders',
      name: 'Rule 5: Smart Reorder Reminders',
      description: 'Runs daily at 08:00 IST. For old customers with 2+ orders, calculates median order interval. If overdue by 2x median, tags "Reorder overdue" and schedules a check-in call task.',
      enabled: true,
      dailyCap: 20,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'round_robin',
      parameters: {
        leadDaysBefore: 2,
        overdueMultiplier: 2.0,
        globalDailyCap: 60,
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    await ruleRef.set(defaultRule5);
    ruleDoc = await ruleRef.get();
  }

  const ruleData = ruleDoc.data() || {};
  if (!ruleData.enabled && !options?.forceRunNow) {
    return stats;
  }

  const params = ruleData.parameters || {};

  // Daily Schedule Check (08:00 IST) unless manual "Run now"
  if (!options?.forceRunNow) {
    const scheduledHour = params.scheduledHour ?? 8; // 08:00 IST default
    if (kolkataHours < scheduledHour || kolkataHours > scheduledHour + 2) {
      return stats;
    }
  }

  const leadDaysBefore = params.leadDaysBefore ?? 2; // alert 2 days before expected order by default (editable)
  const overdueMultiplier = params.overdueMultiplier ?? 2.0; // 2x median = overdue
  const dailyCap = ruleData.dailyCap || 20;

  // 2. Query candidates: Old customer, not deleted
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('status', '==', 'Old customer')
    .limit(60)
    .get();

  stats.evaluated = customersSnap.size;
  if (customersSnap.empty) {
    if (!dryRun) {
      await ruleRef.set({
        lastRunAt: new Date().toISOString(),
        lastRunDate: todayStr,
        lastResult: {
          status: 'success',
          createdCount: 0,
          skippedCount: 0,
          evaluatedCount: 0,
          pendingQueuedCount: 0,
          timestamp: new Date().toISOString(),
        },
      }, { merge: true });
    }
    return stats;
  }

  const rollingRunRef = db.collection('automation_runs').doc(`rule_5_reorder_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Customer';

    // Fetch customer orders without requiring a composite index on (customerId, isDeleted, orderDate)
    const ordersSnap = await db
      .collection('orders')
      .where('customerId', '==', customerId)
      .get();

    const orderDates: Date[] = [];
    ordersSnap.forEach((d) => {
      const dData = d.data();
      // Skip deleted and cancelled orders
      if (!dData.isDeleted && dData.deliveryStatus !== 'Cancelled') {
        // Prefer invoiceDate, fallback to orderDate
        const oDate = parseDate(dData.invoiceDate || dData.orderDate);
        if (oDate) {
          orderDates.push(oDate);
        }
      }
    });

    // Sort order dates chronologically in-memory
    orderDates.sort((a, b) => a.getTime() - b.getTime());

    if (orderDates.length < 2) {
      stats.skippedFewerThanTwoOrders++;
      stats.skipped++;
      continue;
    }

    // Compute intervals (in days) between consecutive orders
    const gapsInDays: number[] = [];
    for (let i = 1; i < orderDates.length; i++) {
      const diffMs = orderDates[i].getTime() - orderDates[i - 1].getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      if (diffDays > 0) gapsInDays.push(diffDays);
    }

    if (gapsInDays.length === 0) {
      stats.skipped++;
      continue;
    }

    const medianGapDays = calculateMedian(gapsInDays);
    if (medianGapDays <= 0) {
      stats.skipped++;
      continue;
    }

    const latestOrderDate = orderDates[orderDates.length - 1];
    const daysSinceLastOrder = Math.round((now.getTime() - latestOrderDate.getTime()) / (24 * 60 * 60 * 1000));

    // Expected next order date = latestOrderDate + medianGapDays
    // Condition 1: Due soon (within leadDaysBefore, e.g. [median - 3, median + 2])
    const isDueSoon =
      daysSinceLastOrder >= medianGapDays - leadDaysBefore &&
      daysSinceLastOrder <= medianGapDays + 3;

    // Condition 2: Overdue by large multiple (e.g. >= 2.0x median)
    const isSeverelyOverdue = daysSinceLastOrder >= Math.round(medianGapDays * overdueMultiplier);

    if (!isDueSoon && !isSeverelyOverdue) {
      stats.skipped++;
      continue;
    }

    // Duplicate Check: Open task for Rule 5 on this customer already exists
    // Filtered in memory to match the existing (customerId, automationRuleId, isDeleted) composite index
    const openExistingSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_5_reorder_reminders')
      .where('isDeleted', '==', false)
      .get();

    const hasOpenTask = openExistingSnap.docs.some((d) => {
      const st = d.data()?.status;
      return st === 'Pending' || st === 'In progress';
    });

    if (hasOpenTask) {
      stats.skipped++;
      continue;
    }

    // If severely overdue, apply the tag 'Reorder overdue'
    if (isSeverelyOverdue && !dryRun) {
      const currentTags: string[] = cust.tags || [];
      if (!currentTags.includes('Reorder overdue')) {
        await custDoc.ref.update({
          tags: [...currentTags, 'Reorder overdue'],
          lastWriteSource: 'automation',
          updatedBy: 'automation (rule_5_reorder_reminders)',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Daily Cap Check with Transaction (skip in dryRun)
    const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
    let isCapHit = false;

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const capDoc = await transaction.get(capCounterRef);
        const capData = capDoc.data() || {};
        const globalCount = capData.globalCount || 0;
        const rule5Count = capData.rule5Count || 0;

        if (globalCount >= (params.globalDailyCap || 60) || rule5Count >= dailyCap) {
          isCapHit = true;
          return;
        }

        transaction.set(
          capCounterRef,
          {
            globalCount: globalCount + 1,
            rule5Count: rule5Count + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    }

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_5:${customerId}:${todayStr}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      if (!dryRun) {
        await db.collection('automation_pending').doc(automationKey).set({
          id: automationKey,
          ruleId: 'rule_5_reorder_reminders',
          customerId,
          customerName,
          assignedTo: cust.assignedTo || 'prajindezaa142@gmail.com',
          queuedAt: new Date().toISOString(),
          attemptedDate: todayStr,
          status: 'queued',
        });
      }
      continue;
    }

    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    const title = isSeverelyOverdue
      ? `Reorder Overdue: Call ${customerName}`
      : `Reorder Reminder: Call ${customerName}`;

    const description = isSeverelyOverdue
      ? `Created automatically by Rule 5 (Smart Reorder Reminders). Customer usually reorders every ${medianGapDays} days, but it has been ${daysSinceLastOrder} days (${(daysSinceLastOrder / medianGapDays).toFixed(1)}x usual interval). Reach out to check in and see if stock is needed.`
      : `Created automatically by Rule 5 (Smart Reorder Reminders). Customer usually reorders every ${medianGapDays} days. Last order was ${daysSinceLastOrder} days ago. Expected reorder is due in ~${Math.max(0, medianGapDays - daysSinceLastOrder)} day(s).`;

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const taskSnap = await transaction.get(taskDocRef);
        if (taskSnap.exists) return;

        transaction.set(taskDocRef, {
          id: automationKey,
          title,
          description,
          customerId,
          customerName,
          type: 'Call',
          assignedTo: cust.assignedTo || 'prajindezaa142@gmail.com',
          priority: isSeverelyOverdue ? 'Urgent' : 'High',
          date: dueDateStr,
          startTime: '10:00',
          endTime: '10:30',
          repeat: 'None',
          status: 'Pending',
          isDeleted: false,
          createdBy: 'automation',
          isAutomation: true,
          automationRuleId: 'rule_5_reorder_reminders',
          automationKey,
          automationRunId: rollingRunRef.id,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastEditedBy: null,
          lastEditedAt: null,
        });

        transaction.set(
          rollingRunRef,
          {
            ruleId: 'rule_5_reorder_reminders',
            ruleName: 'Smart Reorder Reminders Engine',
            startedAt: todayStr,
            finishedAt: new Date().toISOString(),
            status: 'completed',
            createdCount: FieldValue.increment(1),
            createdTaskIds: FieldValue.arrayUnion(automationKey),
            undone: false,
            triggeredBy: options?.forceRunNow ? 'manual_run_now' : 'scheduled_cron',
          },
          { merge: true }
        );
      });

      // Write activity log
      await db.collection('activity_logs').add({
        action: 'automation_task_created',
        byAutomation: true,
        automationRuleId: 'rule_5_reorder_reminders',
        details: `Scheduled reorder task "${title}" assigned to ${cust.assignedTo || 'prajindezaa142@gmail.com'} (Due ${dueDateStr})`,
        taskId: automationKey,
        customerId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    stats.created++;
  }

  // Update rule lastResult reporting skipped count for < 2 orders (skip in dryRun)
  if (!dryRun) {
    await ruleRef.set({
      lastRunAt: new Date().toISOString(),
      lastResult: {
        status: 'success',
        createdCount: stats.created,
        skippedCount: stats.skipped,
        skipReasons: {
          fewer_than_two_orders: stats.skippedFewerThanTwoOrders,
          not_due: stats.skipped - stats.skippedFewerThanTwoOrders,
          cap_hit: stats.pendingQueued,
        },
        error: null,
        timestamp: new Date().toISOString(),
      },
    }, { merge: true });
  }

  return stats;
}
