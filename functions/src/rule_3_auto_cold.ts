/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 3: Consecutive Unanswered Cold Tagging Engine
 * Evaluates active leads. When N consecutive outreach logs are 'No answer' (default 3),
 * adds the tag "Cold". Never changes leadStage.
 * Does NOT run for customers with status 'Old customer', or stages 'Ordered' or 'Not interested'.
 * When an outreach log is 'Answered', 'Interested', or an order is placed, the "Cold" tag is removed.
 * Evaluated strictly in Asia/Kolkata.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

export interface Rule3Options {
  simulatedTime?: Date;
  dryRun?: boolean;
  triggeredBy?: 'scheduled_cron' | 'manual_test';
}

export async function executeRule3AutoStageCold(
  db: Firestore,
  options?: Rule3Options
): Promise<{ evaluated: number; updated: number; skipped: number; pendingQueued: number; dryRun?: boolean }> {
  const now = options?.simulatedTime || new Date();
  const dryRun = Boolean(options?.dryRun);
  const triggeredBy = options?.triggeredBy || 'scheduled_cron';
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, updated: 0, skipped: 0, pendingQueued: 0, dryRun };

  // 1. Fetch Rule 3 settings (auto-initialize if missing)
  const ruleRef = db.collection('automation_rules').doc('rule_3_auto_stage_cold');
  let ruleDoc = await ruleRef.get();

  if (!ruleDoc.exists) {
    // Auto-initialize the rule document so toggling ON from UI works
    const defaultRule = {
      id: 'rule_3_auto_stage_cold',
      name: 'Rule 3: Auto "Cold" Tag (Consecutive Unanswered)',
      description: 'After 3 consecutive unanswered calls/outreach attempts, automatically adds "Cold" tag. Removed instantly when lead answers, replies, or orders. Customer stage is never changed.',
      enabled: false,
      previewSeenAt: null,
      dailyCap: 25,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'actor',
      parameters: {
        consecutiveUnansweredThreshold: 3,
        targetStages: ['Interested', 'Contacted', 'Sample sent', 'New', 'Negotiation'],
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    await ruleRef.set(defaultRule);
    ruleDoc = await ruleRef.get();
  }

  if (!ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const consecutiveThreshold = params.consecutiveUnansweredThreshold || 3;
  const targetStages: string[] = params.targetStages || ['Interested', 'Contacted', 'Sample sent', 'New', 'Negotiation'];
  const dailyCap = ruleData.dailyCap || 25;

  // 2. Query candidates: active leads, not deleted, not Old customer, not Ordered, not Not interested
  const customersSnap = await db
    .collection('customers')
    .where('isDeleted', '==', false)
    .where('leadStage', 'in', targetStages)
    .limit(50)
    .get();

  stats.evaluated = customersSnap.size;
  if (customersSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_3_auto_cold_${todayStr}`);

  for (const custDoc of customersSnap.docs) {
    const cust = custDoc.data();
    const customerId = custDoc.id;
    const customerName = cust.companyName || cust.contactPerson || 'Customer';

    // Invariant: Never applies to Old customer, Ordered, or Not interested
    if (cust.status === 'Old customer' || cust.leadStage === 'Ordered' || cust.leadStage === 'Not interested') {
      stats.skipped++;
      continue;
    }

    const currentTags: string[] = cust.tags || [];

    // Query recent outreach logs for this customer
    const logsSnap = await db
      .collection('customers')
      .doc(customerId)
      .collection('outreach_logs')
      .orderBy('loggedAt', 'desc')
      .limit(consecutiveThreshold + 2)
      .get();

    if (logsSnap.empty) {
      stats.skipped++;
      continue;
    }

    const logs = logsSnap.docs.map((d) => d.data());

    // Check recent attempts:
    // If most recent is Answered, Interested -> ensure Cold tag is removed
    const latest = logs[0];
    if (latest.outcome === 'Answered' || latest.outcome === 'Interested') {
      if (currentTags.includes('Cold') || currentTags.includes('Cold Lead')) {
        if (!dryRun) {
          const cleanedTags = currentTags.filter((t) => t !== 'Cold' && t !== 'Cold Lead');
          await custDoc.ref.update({
            tags: cleanedTags,
            lastWriteSource: 'automation',
            updatedBy: 'automation (rule_3_auto_stage_cold)',
            updatedAt: new Date().toISOString(),
          });
          await db.collection('activity_logs').add({
            action: 'customer_tag_remove',
            byAutomation: true,
            automationRuleId: 'rule_3_auto_stage_cold',
            details: `Removed Cold tag from ${customerName} after outreach interaction (${latest.outcome}).`,
            customerId,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        stats.updated++;
      }
      continue;
    }

    // Check if last N consecutive attempts are 'No answer'
    let consecutiveCount = 0;
    for (const log of logs) {
      if (log.outcome === 'No answer') {
        consecutiveCount++;
      } else {
        break;
      }
    }

    if (consecutiveCount < consecutiveThreshold) {
      stats.skipped++;
      continue;
    }

    // If already tagged 'Cold', nothing to do
    if (currentTags.includes('Cold')) {
      stats.skipped++;
      continue;
    }

    // Daily Cap Check with Transaction (skip cap mutation during dryRun)
    const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
    let isCapHit = false;

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const capDoc = await transaction.get(capCounterRef);
        const capData = capDoc.data() || {};
        const globalCount = capData.globalCount || 0;
        const rule3Count = capData.rule3Count || 0;

        if (globalCount >= (params.globalDailyCap || 60) || rule3Count >= dailyCap) {
          isCapHit = true;
          return;
        }

        transaction.set(
          capCounterRef,
          {
            globalCount: globalCount + 1,
            rule3Count: rule3Count + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } else {
      // During dryRun, read-only cap check (no mutation)
      const capDoc = await capCounterRef.get();
      const capData = capDoc.data() || {};
      const globalCount = capData.globalCount || 0;
      const rule3Count = capData.rule3Count || 0;
      if (globalCount >= (params.globalDailyCap || 60) || rule3Count >= dailyCap) {
        isCapHit = true;
      }
    }

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_3:${customerId}:${todayStr}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      if (!dryRun) {
        await db.collection('automation_pending').doc(automationKey).set({
          id: automationKey,
          ruleId: 'rule_3_auto_stage_cold',
          customerId,
          customerName,
          action: 'add_tag_cold',
          queuedAt: new Date().toISOString(),
          attemptedDate: todayStr,
          status: 'queued',
        });
      }
      continue;
    }

    if (!dryRun) {
      // Apply tag 'Cold' strictly without changing leadStage
      const newTags = [...currentTags, 'Cold'];
      await db.runTransaction(async (transaction) => {
        transaction.update(custDoc.ref, {
          tags: newTags,
          lastWriteSource: 'automation',
          updatedBy: 'automation (rule_3_auto_stage_cold)',
          updatedAt: new Date().toISOString(),
        });

        transaction.set(
          rollingRunRef,
          {
            ruleId: 'rule_3_auto_stage_cold',
            ruleName: 'Cold Lead Tagging (Consecutive Unanswered)',
            startedAt: todayStr,
            finishedAt: new Date().toISOString(),
            status: 'completed',
            createdCount: FieldValue.increment(1),
            appliedTags: FieldValue.arrayUnion({ customerId, tag: 'Cold' }),
            undone: false,
            triggeredBy,
          },
          { merge: true }
        );
      });

      // Write activity log
      await db.collection('activity_logs').add({
        action: 'customer_tag_add',
        byAutomation: true,
        automationRuleId: 'rule_3_auto_stage_cold',
        details: `Customer ${customerName} tagged as "Cold" after ${consecutiveCount} consecutive unanswered outreach attempts. Stage was not changed.`,
        customerId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    stats.updated++;
  }

  // Update rule lastResult if not dryRun
  if (!dryRun) {
    await ruleRef.update({
      lastRunAt: new Date().toISOString(),
      lastResult: {
        status: 'success',
        createdCount: stats.updated,
        skippedCount: stats.skipped,
        skipReasons: { cap_hit: stats.pendingQueued, threshold_not_met: stats.skipped },
        error: null,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return stats;
}
