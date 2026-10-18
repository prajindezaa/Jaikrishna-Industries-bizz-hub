/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 4: Inactive Customer Revival Engine
 * Identifies existing customers (status === 'Old customer' or previous orders)
 * with no completed orders or inquiries in the last N days (default: 60 days).
 * Generates revival call task, assigns to primary account manager, and tags 'Revival Candidate'.
 * Evaluated daily strictly in Asia/Kolkata.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { calculateWorkingDayDate } from './index';

export interface Rule4Options {
  simulatedTime?: Date;
}

export async function executeRule4ColdRevival(
  db: Firestore,
  options?: Rule4Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number }> {
  const now = options?.simulatedTime || new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch Rule 4 settings
  const ruleRef = db.collection('automation_rules').doc('rule_4_cold_revival');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const inactiveDaysThreshold = params.inactiveDaysThreshold || 60;
  const dailyCap = ruleData.dailyCap || 15;

  const cutoffTime = new Date(now.getTime() - inactiveDaysThreshold * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoffTime.toISOString();

  // 2. Query candidates: Old customer, not deleted
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('status', '==', 'Old customer')
    .limit(50)
    .get();

  stats.evaluated = customersSnap.size;
  if (customersSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_4_cold_revival_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Customer';

    const lastActivity = cust.updatedAt || cust.createdAt;
    if (!lastActivity || lastActivity > cutoffIso) {
      stats.skipped++;
      continue;
    }

    // Duplicate Check: Open task for Rule 4 on this customer already exists
    const openExistingSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_4_cold_revival')
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
      const rule4Count = capData.rule4Count || 0;

      if (globalCount >= (params.globalDailyCap || 60) || rule4Count >= dailyCap) {
        isCapHit = true;
        return;
      }

      transaction.set(
        capCounterRef,
        {
          globalCount: globalCount + 1,
          rule4Count: rule4Count + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_4:${customerId}:${todayStr}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      await db.collection('automation_pending').doc(automationKey).set({
        id: automationKey,
        ruleId: 'rule_4_cold_revival',
        customerId,
        customerName,
        assignedTo: cust.assignedTo || 'prajindezaa142@gmail.com',
        queuedAt: new Date().toISOString(),
        attemptedDate: todayStr,
        status: 'queued',
      });
      continue;
    }

    // Create Revival Task
    const assignedTo = cust.assignedTo || 'prajindezaa142@gmail.com';
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    await db.runTransaction(async (transaction) => {
      const taskSnap = await transaction.get(taskDocRef);
      if (taskSnap.exists) return;

      const title = `Revival Check-in: ${customerName} (Inactive > ${inactiveDaysThreshold} days)`;

      transaction.set(taskDocRef, {
        id: automationKey,
        title,
        description: `Created automatically by Rule 4 (Customer Revival). Existing customer with no recent orders or calls since ${lastActivity?.slice(0, 10)}. Reconnect to discuss current agarbatti & raw material requirements.`,
        customerId,
        customerName,
        type: 'Call',
        assignedTo,
        priority: 'High',
        date: dueDateStr,
        startTime: '11:00',
        endTime: '11:30',
        repeat: 'None',
        status: 'Pending',
        isDeleted: false,
        createdBy: 'automation',
        isAutomation: true,
        automationRuleId: 'rule_4_cold_revival',
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
          ruleId: 'rule_4_cold_revival',
          ruleName: 'Customer Revival Engine',
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
      automationRuleId: 'rule_4_cold_revival',
      details: `Scheduled revival check-in call for ${customerName} (Due ${dueDateStr})`,
      taskId: automationKey,
      customerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    stats.created++;
  }

  return stats;
}
