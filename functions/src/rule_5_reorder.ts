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
import { calculateWorkingDayDate } from './index';

export interface Rule5Options {
  simulatedTime?: Date;
  forceRunNow?: boolean; // Bypass 08:00 IST check for manual "Run now" triggers
  dryRun?: boolean;
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
  };

  // 1. Fetch Rule 5 settings
  const ruleRef = db.collection('automation_rules').doc('rule_5_reorder_reminders');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};

  // Daily Schedule Check (08:00 IST) unless manual "Run now"
  if (!options?.forceRunNow) {
    const scheduledHour = params.scheduledHour ?? 8; // 08:00 IST default
    if (kolkataHours < scheduledHour || kolkataHours > scheduledHour + 1) {
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
  if (customersSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_5_reorder_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Customer';

    // Must have at least 2 completed orders in the database
    const ordersSnap = await db
      .collection('orders')
      .where('customerId', '==', customerId)
      .where('isDeleted', '==', false)
      .orderBy('orderDate', 'asc')
      .get();

    if (ordersSnap.size < 2) {
      stats.skippedFewerThanTwoOrders++;
      stats.skipped++;
      continue;
    }

    const orderDates: Date[] = [];
    ordersSnap.forEach((d) => {
      const oDate = d.data().orderDate;
      if (oDate) {
        orderDates.push(new Date(oDate));
      }
    });

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
    const openExistingSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_5_reorder_reminders')
      .where('isDeleted', '==', false)
      .where('status', 'in', ['Pending', 'In progress'])
      .limit(1)
      .get();

    if (!openExistingSnap.empty) {
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

    // Create Reorder Reminder or Check-in Task
    const assignedTo = cust.assignedTo || 'prajindezaa142@gmail.com';
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    const taskTitle = isSeverelyOverdue
      ? `Check in: ${customerName} (Reorder overdue by ${daysSinceLastOrder}d, expected every ${medianGapDays}d)`
      : `Reorder Reminder: ${customerName} (Usual cycle ${medianGapDays}d reached)`;

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const taskSnap = await transaction.get(taskDocRef);
        if (taskSnap.exists) return;

        transaction.set(taskDocRef, {
          id: automationKey,
          title: taskTitle,
          description: `Created automatically by Rule 5 (Smart Reorder Reminders). Customer has ${ordersSnap.size} past orders with a calculated median reorder interval of ${medianGapDays} days. Last order was placed on ${latestOrderDate.toISOString().slice(0, 10)} (${daysSinceLastOrder} days ago). Contact customer to confirm stock levels and take new pooja camphor / agarbatti order.`,
          customerId,
          customerName,
          type: 'Call',
          assignedTo,
          priority: isSeverelyOverdue ? 'High' : 'Medium',
          date: dueDateStr,
          startTime: '10:30',
          endTime: '11:00',
          repeat: 'None',
          status: 'Pending',
          isDeleted: false,
          createdBy: 'automation',
          isAutomation: true,
          automationRuleId: 'rule_5_reorder_reminders',
          automationKey,
          automationRunId: rollingRunRef.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastEditedBy: null,
          lastEditedAt: null,
        });

        transaction.set(
          rollingRunRef,
          {
            ruleId: 'rule_5_reorder_reminders',
            ruleName: 'Smart Reorder Reminders',
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
        details: `Scheduled ${isSeverelyOverdue ? 'overdue check-in' : 'reorder reminder'} task for ${customerName} (Median interval: ${medianGapDays}d, Days since last: ${daysSinceLastOrder}d)`,
        taskId: automationKey,
        customerId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    stats.created++;
  }

  // Update rule lastResult reporting skipped count for < 2 orders (skip in dryRun)
  if (!dryRun) {
    await ruleRef.update({
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
    });
  }

  return stats;
}
