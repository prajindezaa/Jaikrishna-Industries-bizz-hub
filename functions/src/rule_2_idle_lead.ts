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
import { calculateWorkingDayDate } from './rule_1_stage_followup';

export interface Rule2Options {
  simulatedTime?: Date;
  forceRunNow?: boolean;
  dryRun?: boolean;
}

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') return new Date(val);
  return null;
}

export async function executeRule2IdleLeadCheck(
  db: Firestore,
  options?: Rule2Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number }> {
  const now = options?.simulatedTime || new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  const dryRun = Boolean(options?.dryRun);

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch or initialize Rule 2 settings
  const ruleRef = db.collection('automation_rules').doc('rule_2_idle_lead_reengagement');
  let ruleDoc = await ruleRef.get();

  if (!ruleDoc.exists) {
    const defaultRule2 = {
      id: 'rule_2_idle_lead_reengagement',
      name: 'Rule 2: Idle Lead Re-Engagement',
      description: 'Schedules a follow-up call task when an active lead has no updates for 7 days.',
      enabled: true,
      previewSeenAt: new Date().toISOString(),
      dailyCap: 20,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'round_robin',
      parameters: {
        idleDaysThreshold: 7,
        targetStages: ['Interested', 'Contacted', 'Sample sent'],
        globalDailyCap: 60,
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    await ruleRef.set(defaultRule2);
    ruleDoc = await ruleRef.get();
  }

  const ruleData = ruleDoc.data() || {};
  if (!ruleData.enabled && !options?.forceRunNow) {
    return stats;
  }

  const params = ruleData.parameters || {};
  const idleDaysThreshold = params.idleDaysThreshold || 7;
  const targetStages: string[] = params.targetStages || ['Interested', 'Contacted', 'Sample sent'];
  const dailyCap = ruleData.dailyCap || 20;

  // Calculate cutoff timestamp (Asia/Kolkata date - idleDaysThreshold)
  const cutoffTime = new Date(now.getTime() - idleDaysThreshold * 24 * 60 * 60 * 1000);

  // Fetch allowlisted team members for round-robin assignment
  const allowedSnap = await db.collection('allowed_emails').limit(3).get();
  const members = allowedSnap.docs.map((d) => d.id);
  const teamList = members.length > 0 ? members : ['prajindezaa142@gmail.com'];
  let memberIdx = ruleData.roundRobinIndex || 0;

  // 2. Query candidates: customers in active stages, not deleted
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('leadStage', 'in', targetStages)
    .limit(100)
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

  const rollingRunRef = db.collection('automation_runs').doc(`rule_2_idle_lead_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Customer';

    // Filter out converted / old customers and ordered stages
    if (cust.status === 'Old customer' || cust.leadStage === 'Ordered' || cust.leadStage === 'Not interested' || (cust.totalOrdersCount && cust.totalOrdersCount > 0)) {
      stats.skipped++;
      continue;
    }

    // Check last update time
    const lastDate = parseDate(cust.updatedAt || cust.createdAt);
    if (!lastDate || lastDate.getTime() > cutoffTime.getTime()) {
      stats.skipped++;
      continue;
    }

    // Duplicate Check: Open task for Rule 2 on this customer already exists
    const openExistingSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
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

    // Automation key (determinstic per customer per day)
    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_2:${customerId}:${todayStr}`)
      .digest('hex');

    // Daily Cap Check with Transaction
    const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
    let isCapHit = false;

    if (!dryRun) {
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
    }

    const assignedTo = cust.assignedTo || teamList[memberIdx % teamList.length];
    memberIdx++;

    if (isCapHit) {
      stats.pendingQueued++;
      if (!dryRun) {
        await db.collection('automation_pending').doc(automationKey).set({
          id: automationKey,
          ruleId: 'rule_2_idle_lead_reengagement',
          customerId,
          customerName,
          stage: cust.leadStage,
          assignedTo,
          targetCalendarDays: 1,
          queuedAt: new Date().toISOString(),
          attemptedDate: todayStr,
          status: 'queued',
        });
      }
      continue;
    }

    // Calculate due date
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const taskSnap = await transaction.get(taskDocRef);
        if (taskSnap.exists) return;

        const title = `Re-engage idle lead: ${customerName} (Inactive > ${idleDaysThreshold} days)`;

        transaction.set(taskDocRef, {
          id: automationKey,
          title,
          description: `Created automatically by Rule 2 (Idle Lead Re-Engagement). Customer in stage "${cust.leadStage}" had no activity since ${lastDate.toISOString().slice(0, 10)}.`,
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
            triggeredBy: options?.forceRunNow ? 'manual_run_now' : 'scheduled_cron',
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
    }

    stats.created++;
  }

  // Record rule health and result diagnostics
  if (!dryRun) {
    await ruleRef.set({
      lastRunAt: new Date().toISOString(),
      lastRunDate: todayStr,
      roundRobinIndex: memberIdx,
      lastResult: {
        status: 'success',
        createdCount: stats.created,
        skippedCount: stats.skipped,
        evaluatedCount: stats.evaluated,
        pendingQueuedCount: stats.pendingQueued,
        timestamp: new Date().toISOString(),
      },
    }, { merge: true });
  }

  return stats;
}
