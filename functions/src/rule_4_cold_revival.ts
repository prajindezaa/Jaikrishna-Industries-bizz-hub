/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 4: Cold Lead Revival Engine
 * Weekly run (default Monday 09:00 IST).
 * Leads in selected stages with no contact for N days (default 30),
 * not ordered, not in Trash: create one "Revive: call {customer}" task each,
 * spread across the 3 members with a per-day cap (default 15) and a 30-day cooldown per customer.
 * Evaluated strictly in Asia/Kolkata.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { calculateWorkingDayDate } from './rule_1_stage_followup';

export interface Rule4Options {
  simulatedTime?: Date;
  forceRunNow?: boolean; // Bypass weekly Monday check for manual "Run now" triggers
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

export async function executeRule4ColdRevival(
  db: Firestore,
  options?: Rule4Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number; dryRun?: boolean }> {
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

  // Check day of week in IST (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayOfWeek = new Date(`${todayStr}T12:00:00+05:30`).getDay();

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0, dryRun };

  // 1. Fetch or auto-initialize Rule 4 settings
  const ruleRef = db.collection('automation_rules').doc('rule_4_cold_revival');
  let ruleDoc = await ruleRef.get();

  if (!ruleDoc.exists) {
    const defaultRule4 = {
      id: 'rule_4_cold_revival',
      name: 'Rule 4: Inactive Lead Revival',
      description: 'Weekly check: creates "Revive: call {customer}" tasks for active leads inactive for 30+ days. Rotates across 3 team members (15/day cap, 30-day cooldown).',
      enabled: true,
      dailyCap: 15,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'round_robin',
      parameters: {
        inactiveDaysThreshold: 30,
        cooldownDays: 30,
        targetStages: ['Interested', 'Contacted', 'Sample sent', 'Negotiation'],
        globalDailyCap: 60,
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    await ruleRef.set(defaultRule4);
    ruleDoc = await ruleRef.get();
  }

  const ruleData = ruleDoc.data() || {};
  if (!ruleData.enabled && !options?.forceRunNow) {
    return stats;
  }

  const params = ruleData.parameters || {};

  // Weekly Schedule Verification (unless manual "Run now" is specified):
  // Default: Monday (dayOfWeek === 1) between 08:00 and 11:00 IST
  if (!options?.forceRunNow) {
    const scheduledDay = params.scheduledDayOfWeek ?? 1; // 1 = Monday
    const scheduledHour = params.scheduledHour ?? 9; // 09:00 default
    if (dayOfWeek !== scheduledDay || kolkataHours < scheduledHour || kolkataHours > scheduledHour + 2) {
      return stats;
    }
  }

  const inactiveDaysThreshold = params.inactiveDaysThreshold || 30; // default 30 days
  const cooldownDays = params.cooldownDays || 30; // 30-day cooldown per customer
  const dailyCap = ruleData.dailyCap || 15; // default 15
  const targetStages: string[] = params.targetStages || ['Interested', 'Contacted', 'Sample sent', 'Negotiation'];

  if (!targetStages || targetStages.length === 0) {
    return stats;
  }

  const cutoffTime = new Date(now.getTime() - inactiveDaysThreshold * 24 * 60 * 60 * 1000);
  const cooldownTime = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);

  // 2. Fetch allowlisted 3 team members to evenly distribute tasks
  const allowedSnap = await db.collection('allowed_emails').limit(3).get();
  const members = allowedSnap.docs.map((d) => d.id);
  const teamList = members.length > 0 ? members : ['prajindezaa142@gmail.com'];
  let memberIdx = ruleData.roundRobinIndex || 0;

  // 3. Query candidates: leads in target stages, not deleted
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('leadStage', 'in', targetStages.slice(0, 10))
    .limit(50)
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

  const rollingRunRef = db.collection('automation_runs').doc(`rule_4_cold_revival_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Lead';

    // Must not be ordered or already an Old customer
    if (cust.status === 'Old customer' || cust.leadStage === 'Ordered' || (cust.totalOrdersCount && cust.totalOrdersCount > 0)) {
      stats.skipped++;
      continue;
    }

    const lastActivity = parseDate(cust.updatedAt || cust.createdAt);
    if (!lastActivity || lastActivity.getTime() > cutoffTime.getTime()) {
      stats.skipped++;
      continue;
    }

    // Cooldown check: Check if customer had a Rule 4 revival task in the last cooldownDays
    // Filtered in memory to avoid requiring a composite index on (customerId, automationRuleId, createdAt)
    const recentRevivalSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_4_cold_revival')
      .get();

    const hasRecentCooldown = recentRevivalSnap.docs.some((d) => {
      const taskCreated = parseDate(d.data()?.createdAt);
      return taskCreated && taskCreated.getTime() >= cooldownTime.getTime();
    });

    if (hasRecentCooldown) {
      stats.skipped++;
      continue;
    }

    // Duplicate Check: Open pending task for Rule 4 on this customer already exists
    // Filtered in memory to match the existing (customerId, automationRuleId, isDeleted) composite index
    const openExistingSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_4_cold_revival')
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

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_4:${customerId}:${todayStr}`)
      .digest('hex');

    // Daily Cap Check with Transaction (skip mutations in dryRun)
    const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
    let isCapHit = false;

    if (!dryRun) {
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
    }

    if (isCapHit) {
      stats.pendingQueued++;
      if (!dryRun) {
        await db.collection('automation_pending').doc(automationKey).set({
          id: automationKey,
          ruleId: 'rule_4_cold_revival',
          customerId,
          customerName,
          assignedTo: cust.assignedTo || teamList[memberIdx % teamList.length],
          queuedAt: new Date().toISOString(),
          attemptedDate: todayStr,
          status: 'queued',
        });
      }
      continue;
    }

    // Spread tasks across the 3 members
    const assignedMember = cust.assignedTo || teamList[memberIdx % teamList.length];
    memberIdx++;

    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const taskSnap = await transaction.get(taskDocRef);
        if (taskSnap.exists) return;

        const title = `Revive: call ${customerName}`;

        transaction.set(taskDocRef, {
          id: automationKey,
          title,
          description: `Created automatically by Rule 4 (Cold Lead Revival). Lead in "${cust.leadStage}" stage with no contact for ${inactiveDaysThreshold}+ days. Reach out to reconnect and understand current agarbatti or camphor requirements.`,
          customerId,
          customerName,
          type: 'Call',
          assignedTo: assignedMember,
          priority: 'High',
          date: dueDateStr,
          startTime: '10:00',
          endTime: '10:30',
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
            ruleName: 'Cold Lead Revival Engine',
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
        automationRuleId: 'rule_4_cold_revival',
        details: `Scheduled revival call task "Revive: call ${customerName}" assigned to ${assignedMember} (Due ${dueDateStr})`,
        taskId: automationKey,
        customerId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    stats.created++;
  }

  // Update member rotation index and rule result (skip in dryRun)
  if (!dryRun) {
    await ruleRef.set({
      roundRobinIndex: memberIdx,
      lastRunAt: new Date().toISOString(),
      lastResult: {
        status: 'success',
        createdCount: stats.created,
        skippedCount: stats.skipped,
        skipReasons: { cap_hit: stats.pendingQueued, cooldown_or_not_eligible: stats.skipped },
        error: null,
        timestamp: new Date().toISOString(),
      },
    }, { merge: true });
  }

  return stats;
}
