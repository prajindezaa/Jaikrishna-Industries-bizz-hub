/**
 * RULE 1: Auto Follow-Up Tasks on Customer Stage Change
 * 
 * Deterministic, duplicate-safe automation rule:
 * 1. Checks if rule_1_auto_followup is enabled.
 * 2. Cancels untouched pending tasks for this customer from previous stages (or notifies assignee if touched).
 * 3. Inspects configured stage settings (daysAfter, taskTitle/titleTemplate, taskType, priority).
 * 4. Checks duplicate open tasks for same customer & stage.
 * 5. Uses deterministic sha256 automationKey as document ID.
 * 6. Enforces daily and global rate caps.
 * 7. Transactionally creates task with complete metadata.
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { routeNotificationIntent } from './notification_router';

/**
 * Calculates due date in 'Asia/Kolkata' timezone:
 * Base date + N calendar days. If that day lands on a non-working day, shifts to next working day.
 */
export function calculateWorkingDayDate(
  baseDate: Date,
  calendarDaysToAdd: number,
  workingDays: number[] = [1, 2, 3, 4, 5, 6]
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const target = new Date(baseDate.getTime());
  target.setDate(target.getDate() + calendarDaysToAdd);

  // Shift forward if landing on non-working day
  while (true) {
    const parts = formatter.formatToParts(target);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const kolkataDate = new Date(`${y}-${m}-${d}T12:00:00+05:30`);
    const dayOfWeek = kolkataDate.getDay();

    if (workingDays.includes(dayOfWeek)) {
      break;
    }
    target.setDate(target.getDate() + 1);
  }

  const parts = formatter.formatToParts(target);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a task is untouched by human members.
 * Untouched: Pending, not completed, lastEditedBy == null, lastEditedAt == null.
 */
export function isTaskUntouched(task: admin.firestore.DocumentData): boolean {
  return (
    task.status === 'Pending' &&
    !task.completedAt &&
    !task.lastEditedBy &&
    !task.lastEditedAt
  );
}

export interface Rule1ExecutionOptions {
  customerId: string;
  beforeStage?: string | null;
  newStage: string;
  customerData?: admin.firestore.DocumentData | null;
  eventId?: string;
  lastWriteSource?: string;
}

export async function executeRule1CustomerStageChange(
  db: admin.firestore.Firestore,
  options: Rule1ExecutionOptions
): Promise<{ status: string; reason?: string; taskId?: string }> {
  const { customerId, newStage, beforeStage, eventId = `evt_${Date.now()}` } = options;

  if (!newStage) {
    return { status: 'skipped', reason: 'no_stage' };
  }
  if (beforeStage && beforeStage === newStage) {
    return { status: 'skipped', reason: 'stage_unchanged' };
  }

  // Fetch fresh customer data if not passed or incomplete
  let customer = options.customerData;
  if (!customer) {
    const custDoc = await db.collection('customers').doc(customerId).get();
    if (!custDoc.exists) return { status: 'skipped', reason: 'customer_not_found' };
    customer = custDoc.data()!;
  }

  if (customer.isDeleted) {
    return { status: 'skipped', reason: 'customer_deleted' };
  }

  const writeSource = options.lastWriteSource || customer.lastWriteSource;
  if (writeSource === 'system' || writeSource === 'automation') {
    console.log('[Rule 1 Loop Guard] Skipping update authored by automation/system.');
    return { status: 'skipped', reason: 'loop_guard' };
  }

  const customerName = customer.companyName || customer.contactPerson || 'Customer';
  const previousStage = beforeStage || customer.previousStage || null;

  console.log(`[Rule 1] Stage change detected for ${customerId}: "${previousStage || 'None'}" -> "${newStage}" (Source: ${writeSource})`);

  // Fetch Rule 1 configuration
  const ruleRef = db.collection('automation_rules').doc('rule_1_auto_followup');
  const ruleDoc = await ruleRef.get();

  // 1. Check Previous-Stage Task Replacement (In all cases, even if rule is OFF or new stage has no task rule, e.g. Ordered)
  const previousTasksSnap = await db
    .collection('tasks')
    .where('customerId', '==', customerId)
    .where('automationRuleId', '==', 'rule_1_auto_followup')
    .where('isDeleted', '==', false)
    .get();

  for (const pDoc of previousTasksSnap.docs) {
    const pTask = pDoc.data();
    if (isTaskUntouched(pTask)) {
      await pDoc.ref.update({
        isDeleted: true,
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: 'automation (stage changed)',
        status: 'Missed',
        completionNote: `Auto-cancelled: Customer stage changed from ${previousStage || 'previous'} to ${newStage}`,
      });
      console.log(`[Rule 1] Auto-cancelled untouched task ${pDoc.id} due to stage advancement.`);
    } else if (pTask.status !== 'Done' && pTask.status !== 'Missed') {
      // Touched task: notify assignee instead of deleting
      const assignee = pTask.assignedTo || 'prajindezaa142@gmail.com';
      await routeNotificationIntent(db, {
        recipientEmail: assignee,
        title: `Stage Changed for ${customerName}`,
        body: `Stage changed to "${newStage}", but existing task "${pTask.title}" was already edited/started and was preserved.`,
        type: 'task_stage_preserved',
        priority: 'normal',
        deepLink: `/tasks?id=${pDoc.id}`,
        dedupeKey: `stage_preserve_${pDoc.id}_${newStage}`,
      });
    }
  }

  let ruleData: admin.firestore.DocumentData;
  if (!ruleDoc.exists) {
    const defaultRule1 = {
      id: 'rule_1_auto_followup',
      name: 'Rule 1: Auto Follow-up Tasks on Stage Change',
      enabled: true,
      dailyCap: 30,
      workingDays: [1, 2, 3, 4, 5, 6],
      fallbackAssignee: 'actor',
      parameters: {
        skipOnImport: true,
        stages: {
          'Sample sent': { enabled: true, titleTemplate: 'Call {customer} to ask about sample', taskType: 'Call', daysAfter: 3, startTime: '10:00', endTime: '10:30', priority: 'High' },
          'Interested': { enabled: true, titleTemplate: 'Send price and offer to {customer}', taskType: 'WhatsApp', daysAfter: 1, startTime: '10:00', endTime: '10:30', priority: 'Medium' },
          'Negotiation': { enabled: true, titleTemplate: 'Follow up on negotiation with {customer}', taskType: 'Call', daysAfter: 2, startTime: '10:00', endTime: '10:30', priority: 'High' },
          'Contacted': { enabled: true, titleTemplate: 'Follow-up call to {customer}', taskType: 'Call', daysAfter: 3, startTime: '10:00', endTime: '10:30', priority: 'Medium' },
        },
      },
      updatedBy: 'system',
      updatedAt: FieldValue.serverTimestamp(),
    };
    try {
      await ruleRef.set(defaultRule1, { merge: true });
    } catch (e) {
      console.warn('[Rule 1] Notice: could not persist default rule_1 doc:', e);
    }
    ruleData = defaultRule1;
  } else {
    ruleData = ruleDoc.data()!;
    if (ruleData.enabled === false) {
      console.log('[Rule 1] Rule is currently explicitly OFF. Skipping new task creation.');
      return { status: 'skipped', reason: 'rule_disabled' };
    }
  }

  const params = ruleData.parameters || {};

  // Check option "Do not create tasks during imports"
  if (writeSource === 'bulk_import' && params.skipOnImport && !customer.skipOnImportOverride) {
    console.log(`[Rule 1] Skipping task creation for bulk imported customer ${customerId}`);
    return { status: 'skipped', reason: 'skipped_on_import' };
  }

  // Lookup stage rule configuration for the new stage
  const stageConfig = params.stages?.[newStage] || params.stageConfigs?.[newStage];
  if (!stageConfig || stageConfig.enabled === false) {
    console.log(`[Rule 1] No active stage rule for stage "${newStage}". Skipping.`);
    return { status: 'skipped', reason: 'no_stage_config' };
  }

  // Extra Duplicate Protection: check if an open automation task exists for same customer, rule, and stage
  const openSameStageSnap = await db
    .collection('tasks')
    .where('customerId', '==', customerId)
    .where('automationRuleId', '==', 'rule_1_auto_followup')
    .where('automationStage', '==', newStage)
    .where('isDeleted', '==', false)
    .where('status', 'in', ['Pending', 'In progress'])
    .limit(1)
    .get();

  if (!openSameStageSnap.empty) {
    console.log(`[Rule 1] Duplicate protection: Open task for customer ${customerId} and stage "${newStage}" already exists.`);
    return { status: 'skipped', reason: 'duplicate_open_task_exists' };
  }

  // Determine deterministic timestamp from document saved timestamp or event ID
  const stageTimestamp = customer.updatedAt?.toMillis ? String(customer.updatedAt.toMillis()) : eventId;
  const automationKey = crypto
    .createHash('sha256')
    .update(`rule_1:${customerId}:${newStage}:${stageTimestamp}`)
    .digest('hex');

  // Determine target assignee
  let assignedTo = customer.assignedTo;
  if (!assignedTo) {
    if (ruleData.fallbackAssignee === 'round_robin') {
      const teamSnap = await db.collection('allowed_emails').get();
      const emails = teamSnap.docs
        .map((d) => d.id.toLowerCase().trim())
        .filter((e) => Boolean(e) && e !== 'prajindezaa142@gamil.com');
      const teamList = emails.length > 0 ? emails : [
        'prajindezaa142@gmail.com',
        'jaikrishnaindustries1@gmail.com',
        'srinisrkp@gmail.com',
      ];
      const currentIndex = ruleData.roundRobinIndex || 0;
      assignedTo = teamList[currentIndex % teamList.length];
      await ruleRef.update({ roundRobinIndex: currentIndex + 1 });
    } else {
      assignedTo = customer.updatedBy || 'prajindezaa142@gmail.com';
    }
  }

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  const workingDays = ruleData.workingDays || [1, 2, 3, 4, 5, 6];
  const dueDateStr = calculateWorkingDayDate(now, stageConfig.daysAfter || 1, workingDays);

  // Daily Cap & Global Cap Check with Transaction
  const capCounterRef = db.collection('system_settings').doc(`automation_cap_${todayStr}`);
  const globalCap = params.globalDailyCap || 60;
  const perRuleCap = ruleData.dailyCap || 30;

  let isCapHit = false;

  await db.runTransaction(async (transaction) => {
    const capDoc = await transaction.get(capCounterRef);
    const capData = capDoc.data() || {};
    const globalCount = capData.globalCount || 0;
    const rule1Count = capData.rule1Count || 0;

    if (globalCount >= globalCap || rule1Count >= perRuleCap) {
      isCapHit = true;
      return;
    }

    transaction.set(
      capCounterRef,
      {
        globalCount: globalCount + 1,
        rule1Count: rule1Count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  // Overflow Handling: If cap is reached, store in automation_pending
  if (isCapHit) {
    console.warn(`[Rule 1] Daily cap reached. Storing in automation_pending.`);
    await db.collection('automation_pending').doc(automationKey).set({
      id: automationKey,
      customerId,
      customerName,
      stage: newStage,
      assignedTo,
      targetCalendarDays: stageConfig.daysAfter || 1,
      queuedAt: new Date().toISOString(),
      attemptedDate: todayStr,
      status: 'queued',
      ruleId: 'rule_1_auto_followup',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Notify members in-app that items were deferred
    await routeNotificationIntent(db, {
      recipientEmail: assignedTo,
      title: 'Daily Automation Cap Reached',
      body: `Follow-up task for ${customerName} was queued in automation_pending and will be scheduled on the next morning run.`,
      type: 'auto_cap_deferred',
      priority: 'normal',
      deepLink: '/automations',
      dedupeKey: `auto_deferred_rule1_${customerName}_${todayStr}`,
    });
    return { status: 'queued_overflow', taskId: automationKey };
  }

  // Transactional task creation using automationKey as Document ID
  const taskDocRef = db.collection('tasks').doc(automationKey);
  const rollingRunRef = db.collection('automation_runs').doc(`rule_1_auto_followup_${todayStr}`);

  const title = (stageConfig.titleTemplate || stageConfig.taskTitle || 'Follow up with {customer}')
    .replace(/{customer}/g, customerName)
    .replace(/{name}/g, customerName)
    .replace(/{stage}/g, newStage)
    .replace(/{days}/g, String(stageConfig.daysAfter || 1));

  await db.runTransaction(async (transaction) => {
    const existingTaskDoc = await transaction.get(taskDocRef);
    if (existingTaskDoc.exists) {
      console.log(`[Rule 1 Idempotency] Task ${automationKey} already exists. Skipping.`);
      return;
    }

    transaction.set(taskDocRef, {
      id: automationKey,
      title,
      description: `Created automatically by Rule 1 (Auto Follow-up Tasks) upon customer stage transition to "${newStage}".`,
      customerId,
      customerName,
      type: stageConfig.taskType || 'Call',
      assignedTo,
      priority: stageConfig.priority || 'Medium',
      date: dueDateStr,
      startTime: stageConfig.startTime || '10:00',
      endTime: stageConfig.endTime || '10:30',
      repeat: 'None',
      status: 'Pending',
      isDeleted: false,
      createdBy: 'automation',
      isAutomation: true,
      automationRuleId: 'rule_1_auto_followup',
      automationKey,
      automationStage: newStage,
      automationRunId: rollingRunRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastEditedBy: null,
      lastEditedAt: null,
    });

    // Update rolling run document
    transaction.set(
      rollingRunRef,
      {
        ruleId: 'rule_1_auto_followup',
        ruleName: 'Auto Follow-up Tasks on Stage Change',
        startedAt: todayStr,
        finishedAt: new Date().toISOString(),
        status: 'completed',
        createdCount: FieldValue.increment(1),
        createdTaskIds: FieldValue.arrayUnion(automationKey),
        settingsSnapshot: ruleData,
        undone: false,
        triggeredBy: 'customer_stage_change',
      },
      { merge: true }
    );
  });

  // Write to activity_logs
  await db.collection('activity_logs').add({
    action: 'automation_task_created',
    byAutomation: true,
    automationRuleId: 'rule_1_auto_followup',
    details: `Created task "${title}" for ${assignedTo} (Due ${dueDateStr})`,
    taskId: automationKey,
    customerId,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`[Rule 1] Transactionally created task ${automationKey} for ${assignedTo}.`);
  return { status: 'created', taskId: automationKey };
}

/**
 * Convenience wrapper matching the original Cloud Function core signature.
 */
export async function handleCustomerStageChangeRule1Core(
  customerId: string,
  beforeData: admin.firestore.DocumentData | null,
  afterData: admin.firestore.DocumentData | null,
  eventId: string = `evt_${Date.now()}`
): Promise<{ status: string; reason?: string; taskId?: string }> {
  const db = admin.firestore();
  return executeRule1CustomerStageChange(db, {
    customerId,
    beforeStage: beforeData?.leadStage,
    newStage: afterData?.leadStage,
    customerData: afterData,
    eventId,
    lastWriteSource: afterData?.lastWriteSource,
  });
}
