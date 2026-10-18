/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 2: Idle Lead Re-Engagement Engine
 * Identifies leads in active stages (Interested, Contacted, Sample sent)
 * with no activity logs or customer updates for N days (default: 7 days).
 * Evaluated once daily (or during scheduled runs) strictly in Asia/Kolkata.
 * Enforces idempotency, untouched task cancellation, and rolling run logs.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { calculateWorkingDayDate } from './index';

export interface Rule2Options {
  simulatedTime?: Date;
}

export async function executeRule2IdleLeadCheck(
  db: Firestore,
  options?: Rule2Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number }> {
  const now = options?.simulatedTime || new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch Rule 2 settings
  const ruleRef = db.collection('automation_rules').doc('rule_2_idle_lead_reengagement');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const idleDaysThreshold = params.idleDaysThreshold || 7;
  const targetStages: string[] = params.targetStages || ['Interested', 'Contacted', 'Sample sent'];
  const dailyCap = ruleData.dailyCap || 20;

  // Calculate cutoff timestamp (Asia/Kolkata date - idleDaysThreshold)
  const cutoffTime = new Date(now.getTime() - idleDaysThreshold * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoffTime.toISOString();

  // 2. Query candidates: customers in active stages, not deleted, not old customer
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('leadStage', 'in', targetStages)
    .where('status', '==', 'New customer')
    .limit(50)
    .get();

  stats.evaluated = customersSnap.size;
  if (customersSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_2_idle_lead_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Customer';

    // Check last update time
    const lastActivity = cust.updatedAt || cust.createdAt;
    if (!lastActivity || lastActivity > cutoffIso) {
      stats.skipped++;
      continue;
    }

    // Duplicate Check: Open task for Rule 2 on this customer already exists
    const openExistingSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
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
      const rule2Count = capData.rule2Count || 0;

      if (globalCount >= (params.globalDailyCap || 60) || rule2Count >= dailyCap) {
        isCapHit = true;
        return;
      }

      transaction.set(
        capCounterRef,
        {
          globalCount: globalCount + 1,
          rule2Count: rule2Count + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_2:${customerId}:${todayStr}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      await db.collection('automation_pending').doc(automationKey).set({
        id: automationKey,
        ruleId: 'rule_2_idle_lead_reengagement',
        customerId,
        customerName,
        stage: cust.leadStage,
        assignedTo: cust.assignedTo || 'prajindezaa142@gmail.com',
        targetCalendarDays: 1,
        queuedAt: new Date().toISOString(),
        attemptedDate: todayStr,
        status: 'queued',
      });
      continue;
    }

    // Create task
    const assignedTo = cust.assignedTo || 'prajindezaa142@gmail.com';
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    await db.runTransaction(async (transaction) => {
      const taskSnap = await transaction.get(taskDocRef);
      if (taskSnap.exists) return;

      const title = `Re-engage idle lead: ${customerName} (Inactive > ${idleDaysThreshold} days)`;

      transaction.set(taskDocRef, {
        id: automationKey,
        title,
        description: `Created automatically by Rule 2 (Idle Lead Re-Engagement). Customer in stage "${cust.leadStage}" had no activity since ${lastActivity?.slice(0, 10)}.`,
        customerId,
        customerName,
        type: 'Call',
        assignedTo,
        priority: 'Medium',
        date: dueDateStr,
        startTime: '10:30',
        endTime: '11:00',
        repeat: 'None',
        status: 'Pending',
        isDeleted: false,
        createdBy: 'automation',
        isAutomation: true,
        automationRuleId: 'rule_2_idle_lead_reengagement',
        automationKey,
        automationStage: cust.leadStage,
        automationRunId: rollingRunRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastEditedBy: null,
        lastEditedAt: null,
      });

      transaction.set(
        rollingRunRef,
        {
          ruleId: 'rule_2_idle_lead_reengagement',
          ruleName: 'Idle Lead Re-Engagement',
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
      automationRuleId: 'rule_2_idle_lead_reengagement',
      details: `Scheduled idle re-engagement follow-up for ${customerName} (Due ${dueDateStr})`,
      taskId: automationKey,
      customerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    stats.created++;
  }

  return stats;
}
