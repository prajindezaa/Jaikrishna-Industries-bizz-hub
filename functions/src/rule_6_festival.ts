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
import { calculateWorkingDayDate } from './rule_1_stage_followup';

export interface Rule6Options {
  simulatedTime?: Date;
  forceRunNow?: boolean;
  dryRun?: boolean;
}

export async function executeRule6FestivalCampaignPrep(
  db: Firestore,
  options?: Rule6Options
): Promise<{ evaluated: number; created: number; skipped: number; pendingQueued: number; dryRun?: boolean }> {
  const now = options?.simulatedTime || new Date();
  const dryRun = Boolean(options?.dryRun);
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const stats = { evaluated: 0, created: 0, skipped: 0, pendingQueued: 0, dryRun };

  // 1. Fetch or auto-initialize Rule 6 settings
  const ruleRef = db.collection('automation_rules').doc('rule_6_festival_campaign_prep');
  let ruleDoc = await ruleRef.get();

  if (!ruleDoc.exists) {
    const defaultRule6 = {
      id: 'rule_6_festival_campaign_prep',
      name: 'Rule 6: Festival Campaign Prep',
      description: 'Alerts factory and sales team 14 days before pooja/festival events to prepare stock and promotional campaigns.',
      enabled: true,
      dailyCap: 10,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'actor',
      parameters: {
        lookaheadDays: 14,
        globalDailyCap: 60,
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };
    await ruleRef.set(defaultRule6);
    ruleDoc = await ruleRef.get();
  }

  const ruleData = ruleDoc.data() || {};
  if (!ruleData.enabled && !options?.forceRunNow) {
    return stats;
  }

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
  if (festivalsSnap.empty) {
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
      .limit(30)
      .get();

    const alreadyHasTask = existingTaskSnap.docs.some((d) => {
      const taskData = d.data();
      const status = taskData?.status;
      const isOpen = status === 'Pending' || status === 'In progress';
      const matchesEvent = taskData?.title?.includes(eventName) || taskData?.automationKey?.includes(eventId);
      return isOpen && matchesEvent;
    });

    if (alreadyHasTask) {
      stats.skipped++;
      continue;
    }

    // Daily Cap Check with Transaction
    const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
    let isCapHit = false;

    if (!dryRun) {
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
    }

    const automationKey = crypto
      .createHash('sha256')
      .update(`rule_6:${eventId}:${eventDate}`)
      .digest('hex');

    if (isCapHit) {
      stats.pendingQueued++;
      if (!dryRun) {
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
      }
      continue;
    }

    // Create Festival Campaign Task (Due tomorrow or next working day)
    const dueDateStr = calculateWorkingDayDate(now, 1, ruleData.workingDays || [1, 2, 3, 4, 5, 6]);
    const taskDocRef = db.collection('tasks').doc(automationKey);

    if (!dryRun) {
      await db.runTransaction(async (transaction) => {
        const taskSnap = await transaction.get(taskDocRef);
        if (taskSnap.exists) return;

        const title = `Festival Prep: Prepare Campaign & Stock for ${eventName} (${eventDate})`;

        transaction.set(taskDocRef, {
          id: automationKey,
          title,
          description: `Created automatically by Rule 6 (Festival Campaign Prep). Festival "${eventName}" is scheduled for ${eventDate}. Review seasonal agarbatti demand, wholesale packaging inventory, and social/Meta ad materials.`,
          type: 'Other',
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
            triggeredBy: options?.forceRunNow ? 'manual_run_now' : 'scheduled_cron',
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
    }

    stats.created++;
  }

  if (!dryRun) {
    await ruleRef.set({
      lastRunAt: new Date().toISOString(),
      lastResult: {
        status: 'success',
        createdCount: stats.created,
        skippedCount: stats.skipped,
        skipReasons: { cap_hit: stats.pendingQueued, already_scheduled: stats.skipped },
        error: null,
        timestamp: new Date().toISOString(),
      },
    }, { merge: true });
  }

  return stats;
}
