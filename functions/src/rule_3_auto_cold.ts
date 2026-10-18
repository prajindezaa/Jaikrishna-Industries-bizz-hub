/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 3: Cold Lead Auto-Stage Engine
 * Evaluates leads in active stages (Interested, Contacted, Sample sent)
 * with no activity logs or customer updates for >= N days (default: 30 days).
 * Moves leadStage to 'Cold', applies tag 'Cold Lead', and records rolling run logs.
 * Evaluated daily strictly in Asia/Kolkata.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

export interface Rule3Options {
  simulatedTime?: Date;
}

export async function executeRule3AutoStageCold(
  db: Firestore,
  options?: Rule3Options
): Promise<{ evaluated: number; updated: number; skipped: number; pendingQueued: number }> {
  const now = options?.simulatedTime || new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, updated: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch Rule 3 settings
  const ruleRef = db.collection('automation_rules').doc('rule_3_auto_stage_cold');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const coldDaysThreshold = params.coldDaysThreshold || 30;
  const targetStages: string[] = params.targetStages || ['Interested', 'Contacted', 'Sample sent'];
  const dailyCap = ruleData.dailyCap || 25;

  const cutoffTime = new Date(now.getTime() - coldDaysThreshold * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoffTime.toISOString();

  // 2. Query candidates: customers in active stages, not deleted
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

    const lastActivity = cust.updatedAt || cust.createdAt;
    if (!lastActivity || lastActivity > cutoffIso) {
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

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_3:${customerId}:${todayStr}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      await db.collection('automation_pending').doc(automationKey).set({
        id: automationKey,
        ruleId: 'rule_3_auto_stage_cold',
        customerId,
        customerName,
        stage: 'Cold',
        queuedAt: new Date().toISOString(),
        attemptedDate: todayStr,
        status: 'queued',
      });
      continue;
    }

    // Update customer stage to 'Cold' and append 'Cold Lead' tag
    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(custDoc.ref);
      if (!docSnap.exists) return;
      const current = docSnap.data() || {};

      const currentTags: string[] = current.tags || [];
      const updatedTags = currentTags.includes('Cold Lead') ? currentTags : [...currentTags, 'Cold Lead'];

      transaction.update(custDoc.ref, {
        leadStage: 'Cold',
        tags: updatedTags,
        lastWriteSource: 'automation',
        updatedBy: 'automation (rule_3_auto_stage_cold)',
        updatedAt: new Date().toISOString(),
      });

      transaction.set(
        rollingRunRef,
        {
          ruleId: 'rule_3_auto_stage_cold',
          ruleName: 'Cold Lead Auto-Stage',
          startedAt: todayStr,
          finishedAt: new Date().toISOString(),
          status: 'completed',
          createdCount: FieldValue.increment(1),
          appliedTags: FieldValue.arrayUnion({ customerId, tag: 'Cold Lead' }),
          undone: false,
          triggeredBy: 'scheduled_cron',
        },
        { merge: true }
      );
    });

    // Write activity log
    await db.collection('activity_logs').add({
      action: 'customer_stage_auto_transition',
      byAutomation: true,
      automationRuleId: 'rule_3_auto_stage_cold',
      details: `Customer ${customerName} automatically moved to Cold stage after ${coldDaysThreshold} days of inactivity.`,
      customerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    stats.updated++;
  }

  return stats;
}
