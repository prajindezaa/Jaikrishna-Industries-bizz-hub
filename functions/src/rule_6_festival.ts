/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Rule 6: Festival Campaign Prep Engine
 * Queries upcoming pooja / festival events in festival_events collection
 * that occur within N days (default: 14 days).
 * Checks if a campaign planning task or Meta ad campaign is already linked.
 * If not, schedules a festival preparation task for the team.
 * Evaluated daily strictly in Asia/Kolkata.
 */

import { Firestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { calculateWorkingDayDate } from './index';

export interface Rule6Options {
  simulatedTime?: Date;
}

export async function executeRule6FestivalCampaignPrep(
  db: Firestore,
  options?: Rule6Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number }> {
  const now = options?.simulatedTime || new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0 };

  // 1. Fetch Rule 6 settings
  const ruleRef = db.collection('automation_rules').doc('rule_6_festival_campaign_prep');
  const ruleDoc = await ruleRef.get();
  if (!ruleDoc.exists || !ruleDoc.data()?.enabled) {
    return stats;
  }

  const ruleData = ruleDoc.data()!;
  const params = ruleData.parameters || {};
  const lookaheadDays = params.lookaheadDays || 14;
  const dailyCap = ruleData.dailyCap || 10;

  const maxTargetDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const maxTargetDateStr = maxTargetDate.toISOString().slice(0, 10);

  // 2. Query festivals in window [todayStr, maxTargetDateStr]
  const festivalsSnap = await db
    .collection('festival_events')
    .where('isDeleted', '==', false)
    .where('date', '>=', todayStr)
    .where('date', '<=', maxTargetDateStr)
    .limit(20)
    .get();

  stats.evaluated = festivalsSnap.size;
  if (festivalsSnap.empty) return stats;

  const rollingRunRef = db.collection('automation_runs').doc(`rule_6_festival_${todayStr}`);

  for (const festDoc of festivalsSnap.docs) {
    const fest = festDoc.data();
    const eventId = festDoc.id;
    const eventName = fest.name || 'Upcoming Festival';
    const eventDate = fest.date;

    // Check if task already exists for this festival event
    const existingTaskSnap = await db
      .collection('tasks')
      .where('automationRuleId', '==', 'rule_6_festival_campaign_prep')
      .where('isDeleted', '==', false)
      .where('status', 'in', ['Pending', 'In progress'])
      .limit(20)
      .get();

    const alreadyHasTask = existingTaskSnap.docs.some(
      (d) => d.data().title?.includes(eventName) || d.data().automationKey?.includes(eventId)
    );

    if (alreadyHasTask) {
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
      const rule6Count = capData.rule6Count || 0;

      if (globalCount >= (params.globalDailyCap || 60) || rule6Count >= dailyCap) {
        isCapHit = true;
        return;
      }

      transaction.set(
        capCounterRef,
        {
          globalCount: globalCount + 1,
          rule6Count: rule6Count + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_6:${eventId}:${eventDate}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      await db.collection('automation_pending').doc(automationKey).set({
        id: automationKey,
        ruleId: 'rule_6_festival_campaign_prep',
        eventId,
        eventName,
        eventDate,
        assignedTo: 'prajindezaa142@gmail.com',
        queuedAt: new Date().toISOString(),
        attemptedDate: todayStr,
        status: 'queued',
      });
      continue;
    }

    // Create Festival Campaign Task (Due tomorrow or next working day)
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    await db.runTransaction(async (transaction) => {
      const taskSnap = await transaction.get(taskDocRef);
      if (taskSnap.exists) return;

      const title = `Festival Prep: Prepare Campaign & Stock for ${eventName} (${eventDate})`;

      transaction.set(taskDocRef, {
        id: automationKey,
        title,
        description: `Created automatically by Rule 6 (Festival Campaign Prep). Festival "${eventName}" is scheduled for ${eventDate}. Review seasonal agarbatti demand, wholesale packaging inventory, and social/Meta ad materials.`,
        type: 'Factory',
        assignedTo: 'prajindezaa142@gmail.com',
        priority: 'High',
        date: dueDateStr,
        startTime: '10:00',
        endTime: '11:00',
        repeat: 'None',
        status: 'Pending',
        isDeleted: false,
        createdBy: 'automation',
        isAutomation: true,
        automationRuleId: 'rule_6_festival_campaign_prep',
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
          ruleId: 'rule_6_festival_campaign_prep',
          ruleName: 'Festival Campaign Prep',
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
      automationRuleId: 'rule_6_festival_campaign_prep',
      details: `Scheduled festival prep task for ${eventName} on ${eventDate} (Due ${dueDateStr})`,
      taskId: automationKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    stats.created++;
  }

  return stats;
}
