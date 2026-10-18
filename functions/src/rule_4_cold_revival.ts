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
import { calculateWorkingDayDate } from './index';

export interface Rule4Options {
  simulatedTime?: Date;
  forceRunNow?: boolean; // Bypass weekly Monday check for manual "Run now" triggers
  dryRun?: boolean;
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
  const kolkataMinutes = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const todayStr = `${year}-${month}-${day}`;

  // Check day of week in IST (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayOfWeek = new Date(`${todayStr}T12:00:00+05:30`).getDay();

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch Rule 4 settings
  const ruleRef = db.collection('automation_rules').doc('rule_4_cold_revival');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};

  // Weekly Schedule Verification (unless manual "Run now" is specified):
  // Default: Monday (dayOfWeek === 1) between 09:00 and 10:00 IST
  if (!options?.forceRunNow) {
    const scheduledDay = params.scheduledDayOfWeek ?? 1; // 1 = Monday
    const scheduledHour = params.scheduledHour ?? 9; // 09:00
    if (dayOfWeek !== scheduledDay || kolkataHours < scheduledHour || kolkataHours > scheduledHour + 1) {
      return stats;
    }
  }

  const inactiveDaysThreshold = params.inactiveDaysThreshold || 30; // default 30 days
  const cooldownDays = params.cooldownDays || 30; // 30-day cooldown per customer
  const dailyCap = ruleData.dailyCap || 15; // default 15
  const targetStages: string[] = params.targetStages || ['Interested', 'Contacted', 'Sample sent', 'Negotiation'];

  const cutoffTime = new Date(now.getTime() - inactiveDaysThreshold * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoffTime.toISOString();

  const cooldownTime = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);
  const cooldownIso = cooldownTime.toISOString();

  // 2. Fetch allowlisted 3 team members to evenly distribute tasks
  const allowedSnap = await db.collection('allowed_emails').limit(3).get();
  const members = allowedSnap.docs.map((d) => d.id);
  const teamList = members.length > 0 ? members : ['prajindezaa142@gmail.com'];
  let memberIdx = ruleData.roundRobinIndex || 0;

  // 3. Query candidates: leads in target stages, not deleted, not ordered
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('leadStage', 'in', targetStages)
    .limit(50)
    .get();

  stats.evaluated = customersSnap.size;
  if (customersSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_4_cold_revival_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Lead';

    // Must not be ordered or already an Old customer
    if (cust.status === 'Old customer' || cust.leadStage === 'Ordered' || cust.totalOrdersCount > 0) {
      stats.skipped++;
      continue;
    }

    const lastActivity = cust.updatedAt || cust.createdAt;
    if (!lastActivity || lastActivity > cutoffIso) {
      stats.skipped++;
      continue;
    }

    // Cooldown check: Check if customer had a Rule 4 revival task in the last cooldownDays
    const recentRevivalSnap = await db
      .collection('tasks')
      .where('customerId', '==', customerId)
      .where('automationRuleId', '==', 'rule_4_cold_revival')
      .where('createdAt', '>=', cooldownIso)
      .limit(1)
      .get();

    if (!recentRevivalSnap.empty) {
      stats.skipped++;
      continue;
    }

    // Duplicate Check: Open pending task for Rule 4 on this customer already exists
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

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_4:${customerId}:${todayStr}`)
      .digest('hex');

    // Daily Cap Check with Transaction (skip in dryRun)
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
    await ruleRef.update({
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
    });
  }

  return { ...stats, dryRun: dryRun || undefined };
}
