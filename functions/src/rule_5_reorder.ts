/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 5: Order Reorder Reminder Engine
 * Inspects past fulfilled orders. When order date + reorderCycleDays (default: 45 days)
 * reaches the current evaluation window, schedules a follow-up task to replenish stock.
 * Evaluated daily strictly in Asia/Kolkata.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { calculateWorkingDayDate } from './index';

export interface Rule5Options {
  simulatedTime?: Date;
}

export async function executeRule5ReorderReminders(
  db: Firestore,
  options?: Rule5Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number }> {
  const now = options?.simulatedTime || new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch Rule 5 settings
  const ruleRef = db.collection('automation_rules').doc('rule_5_reorder_reminders');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const reorderCycleDays = params.reorderCycleDays || 45;
  const dailyCap = ruleData.dailyCap || 20;

  // Calculate target order date that is due for reorder today
  const targetOrderDate = new Date(now.getTime() - reorderCycleDays * 24 * 60 * 60 * 1000);
  const targetDateStr = targetOrderDate.toISOString().slice(0, 10);

  // 2. Query delivered orders around target date
  const ordersSnap = await db
    .collection('orders')
    .where('isDeleted', '==', false)
    .where('orderDate', '<=', targetDateStr)
    .limit(40)
    .get();

  stats.evaluated = ordersSnap.size;
  if (ordersSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_5_reorder_${todayStr}`);

  for (const ordDoc of ordersSnap.docs) {
    const order = ordDoc.data();
    const orderId = ordDoc.id;
    const customerId = order.customerId;
    const customerName = order.customerName || 'Wholesale Client';

    // Duplicate Check: Open task for Rule 5 on this customer or order already exists
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

    // Daily Cap Check with Transaction
    const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
    let isCapHit = false;

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

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_5:${customerId}:${orderId}:${todayStr}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      await db.collection('automation_pending').doc(automationKey).set({
        id: automationKey,
        ruleId: 'rule_5_reorder_reminders',
        customerId,
        customerName,
        orderId,
        assignedTo: order.assignedTo || 'prajindezaa142@gmail.com',
        queuedAt: new Date().toISOString(),
        attemptedDate: todayStr,
        status: 'queued',
      });
      continue;
    }

    // Create Reorder Reminder Task
    const assignedTo = order.assignedTo || 'prajindezaa142@gmail.com';
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    await db.runTransaction(async (transaction) => {
      const taskSnap = await transaction.get(taskDocRef);
      if (taskSnap.exists) return;

      const title = `Reorder Check: ${customerName} (Order #${order.orderNumber || orderId.slice(0, 6)} was ${reorderCycleDays}d ago)`;

      transaction.set(taskDocRef, {
        id: automationKey,
        title,
        description: `Created automatically by Rule 5 (Order Reorder Reminders). Customer last ordered on ${order.orderDate}. Cycle time of ${reorderCycleDays} days elapsed. Proactively call to take refill or new batch requirements.`,
        customerId,
        customerName,
        type: 'Call',
        assignedTo,
        priority: 'Medium',
        date: dueDateStr,
        startTime: '11:30',
        endTime: '12:00',
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
          ruleName: 'Order Reorder Reminders',
          startedAt: todayStr,
          finishedAt: new Date().toISOString(),
          status: 'completed',
          createdCount: FieldValue.increment(1),
          createdTaskIds: FieldValue.arrayUnion(automationKey),
          undone: false,
          triggeredBy: 'scheduled_cron',
        },
        { merge: true }
      );
    });

    // Write activity log
    await db.collection('activity_logs').add({
      action: 'automation_task_created',
      byAutomation: true,
      automationRuleId: 'rule_5_reorder_reminders',
      details: `Scheduled reorder follow-up for ${customerName} based on past order #${order.orderNumber || orderId} (Due ${dueDateStr})`,
      taskId: automationKey,
      customerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    stats.created++;
  }

  return stats;
}
