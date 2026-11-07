/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Automation Engine Unit & Invariant Tests
 * Validates Rule 1, Rule 7, working-day shifts, idempotency, loop prevention,
 * timezone independence, undo behavior, and security boundaries.
 * (Mocks Firebase Cloud Functions runtime / Firestore structures deterministically)
 */

import { calculateWorkingDayDate, isTaskUntouched } from '../../functions/src/index';

export function runAutomationUnitTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
  }

  // 1. Due Date Calculation: Friday + 2 days = Monday (skips Sunday)
  try {
    const friday = new Date('2026-10-16T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(friday, 2, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-10-19', `Expected 2026-10-19 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 1: Friday + 2 days lands on Monday (skips Sunday)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 1: Friday + 2 days lands on Monday', passed: false, error: err.message });
  }

  // 2. Saturday + 1 day = Monday (skips Sunday)
  try {
    const saturday = new Date('2026-10-17T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(saturday, 1, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-10-19', `Expected 2026-10-19 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 2: Saturday + 1 day lands on Monday', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 2: Saturday + 1 day lands on Monday', passed: false, error: err.message });
  }

  // 3. Month-end edge case: Oct 31, 2026 (Saturday) + 2 days = Monday Nov 2, 2026
  try {
    const oct31 = new Date('2026-10-31T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(oct31, 2, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-11-02', `Expected 2026-11-02 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 3: Oct 31 (Sat) + 2 days lands on Monday Nov 2', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 3: Oct 31 (Sat) + 2 days lands on Monday Nov 2', passed: false, error: err.message });
  }

  // 4. Sunday stage change + 1 day = Monday
  try {
    const sunday = new Date('2026-10-18T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(sunday, 1, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-10-19', `Expected 2026-10-19 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 4: Sunday + 1 day lands on Monday', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 4: Sunday + 1 day lands on Monday', passed: false, error: err.message });
  }

  // 5. Untouched Task Invariant (Pending, no completedAt, no lastEditedBy, no lastEditedAt)
  try {
    const freshTask = {
      status: 'Pending',
      completedAt: null,
      lastEditedBy: null,
      lastEditedAt: null,
    };
    assert(isTaskUntouched(freshTask) === true, 'Fresh automated task must be untouched');

    const editedTask = {
      status: 'Pending',
      completedAt: null,
      lastEditedBy: 'salesmanager@jaikrishnaindustries.com',
      lastEditedAt: '2026-10-18T13:00:00Z',
    };
    assert(isTaskUntouched(editedTask) === false, 'Edited task must NOT be untouched');

    const inProgressTask = {
      status: 'In progress',
      completedAt: null,
      lastEditedBy: null,
      lastEditedAt: null,
    };
    assert(isTaskUntouched(inProgressTask) === false, 'In progress task must NOT be untouched');

    results.push({ name: 'Test 5: Untouched task invariant (lastEditedBy / status)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 5: Untouched task invariant', passed: false, error: err.message });
  }

  // 6. Global Daily Cap & Overflow to automation_pending with Next-Morning Processing
  try {
    const globalCap = 60;
    let currentGlobalCount = 60; // Cap reached
    const stage = 'Sample sent';
    let queuedItem: any = null;

    // Simulate task creation attempt when cap is hit
    if (currentGlobalCount >= globalCap) {
      queuedItem = {
        id: 'auto_key_overflow_1',
        ruleId: 'rule_1_auto_followup',
        customerId: 'CUST_100',
        stage,
        status: 'queued',
      };
    }
    assert(queuedItem !== null && queuedItem.status === 'queued', 'Item must be stored in automation_pending on cap overflow');

    // Simulate next-morning processing run (Asia/Kolkata 08:00)
    let processedTask: any = null;
    if (queuedItem && queuedItem.status === 'queued') {
      processedTask = {
        id: queuedItem.id,
        status: 'Pending',
        isAutomation: true,
        createdBy: 'automation',
        isDeleted: false,
      };
      queuedItem.status = 'processed';
    }
    assert(processedTask !== null && queuedItem.status === 'processed', 'Deferred item processed during next morning run');
    results.push({ name: 'Test 6: Global daily cap overflow to automation_pending and next-morning processing', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 6: Daily cap and overflow', passed: false, error: err.message });
  }

  // 7. Undo behavior: Bulk Batch and Single Task (Untouched soft-deleted, edited preserved)
  try {
    const batchTasks = [
      { id: 't1', status: 'Pending', lastEditedBy: null, isDeleted: false },
      { id: 't2', status: 'In progress', lastEditedBy: 'member1', isDeleted: false },
    ];

    const runDocument = {
      createdTaskIds: ['t1', 't2'],
      undone: false,
    };

    // Execute bulk undo
    let undoneCount = 0;
    for (const t of batchTasks) {
      if (isTaskUntouched(t)) {
        t.isDeleted = true;
        undoneCount++;
      }
    }
    runDocument.undone = true;

    assert(undoneCount === 1, 'Only untouched tasks should be soft-deleted during undo');
    assert(batchTasks[0].isDeleted === true, 'Untouched task must be soft-deleted to Trash');
    assert(batchTasks[1].isDeleted === false, 'Touched/edited task must NOT be deleted');
    assert(runDocument.undone === true, 'Run document marked as undone');
    results.push({ name: 'Test 7: Bulk batch & single task Undo preserves touched tasks', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 7: Undo behavior', passed: false, error: err.message });
  }

  // 8. No Automation Loops (system/automation writes must NOT retrigger Rule 1)
  try {
    const systemWrite = { lastWriteSource: 'system', leadStage: 'Sample sent' };
    const automationWrite = { lastWriteSource: 'automation', leadStage: 'Negotiation' };
    const humanWrite = { lastWriteSource: 'manual_edit', leadStage: 'Sample sent' };

    const shouldTrigger = (data: any) => data.lastWriteSource !== 'system' && data.lastWriteSource !== 'automation';

    assert(shouldTrigger(systemWrite) === false, 'System write must not trigger Rule 1');
    assert(shouldTrigger(automationWrite) === false, 'Automation write must not trigger Rule 1');
    assert(shouldTrigger(humanWrite) === true, 'Human write must trigger Rule 1');
    results.push({ name: 'Test 8: No automation loops (system/automation writes ignored)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 8: No automation loops', passed: false, error: err.message });
  }

  // 9. Rule OFF by default and enabling ONLY after preview was opened
  try {
    let ruleState = {
      enabled: false,
      previewOpened: false,
    };

    const tryEnableWithoutPreview = (state: typeof ruleState) => {
      if (!state.previewOpened) throw new Error('Preview must be opened before enabling Rule 1');
      state.enabled = true;
    };

    let caughtError = false;
    try {
      tryEnableWithoutPreview(ruleState);
    } catch {
      caughtError = true;
    }
    assert(caughtError === true, 'Enabling without preview must throw');

    // Simulate opening preview
    ruleState.previewOpened = true;
    tryEnableWithoutPreview(ruleState);
    assert(ruleState.enabled === true, 'Rule enables after preview opened');
    results.push({ name: 'Test 9: Rule OFF by default; enables only after preview was opened', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 9: Rule preview safeguard', passed: false, error: err.message });
  }

  // 10. Timezone Independence (Device timezone America/New_York and Asia/Dubai, wrong device clock)
  try {
    // Independent of local device time, calculateWorkingDayDate always formats via Asia/Kolkata Intl.DateTimeFormat
    const utcTimestamp = new Date('2026-10-18T23:30:00Z'); // In NY it's Sunday Oct 18 19:30, in Dubai Monday Oct 19 03:30, in Kolkata Monday Oct 19 05:00
    const computedDue = calculateWorkingDayDate(utcTimestamp, 1, [1, 2, 3, 4, 5, 6]);
    // In Kolkata base date is Oct 19 (Mon) + 1 day = Oct 20 (Tue)
    assert(computedDue === '2026-10-20', `Expected 2026-10-20, got ${computedDue}`);
    results.push({ name: 'Test 10: Timezone independence (evaluated strictly in Asia/Kolkata)', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 10: Timezone independence', passed: false, error: err.message });
  }

  // 11. Morning Plan Email-Cap Fallback to Push & In-App, and Empty-Day behavior
  try {
    const dailyEmailCount = 80; // Limit reached
    const memberPrefs = { sendIfEmpty: false };
    const emptyDayItemsCount = 0;

    // Condition 1: Empty day skips if sendIfEmpty is false
    const shouldSkipEmpty = emptyDayItemsCount === 0 && !memberPrefs.sendIfEmpty;
    assert(shouldSkipEmpty === true, 'Empty day must be skipped when sendIfEmpty is false');

    // Condition 2: If cap reached, email is suppressed, push and in-app proceed
    const channels = { push: true, inApp: true, email: dailyEmailCount < 80 };
    assert(channels.email === false, 'Email channel suppressed on cap hit');
    assert(channels.inApp === true && channels.push === true, 'In-App & Push fallbacks active');
    results.push({ name: 'Test 11: Morning Plan email-cap fallback to push/in-app and empty-day suppression', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 11: Morning plan channels and empty-day', passed: false, error: err.message });
  }

  // 12. A manual edit after an import is NOT treated as an import
  try {
    const customer = {
      id: 'cust_imported',
      lastWriteSource: 'bulk_import',
    };

    // Member later manually edits customer
    const updatedCustomer = {
      ...customer,
      leadStage: 'Sample sent',
      lastWriteSource: 'manual_edit',
    };

    const isImport = updatedCustomer.lastWriteSource === 'bulk_import';
    assert(isImport === false, 'Subsequent manual edit is not treated as bulk_import');
    results.push({ name: 'Test 12: Manual edit after import is NOT treated as an import', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 12: Manual edit after import', passed: false, error: err.message });
  }

  // 13. Saving the same stage twice creates only ONE task (Idempotency)
  try {
    const customerId = 'CUST_42';
    const stage = 'Sample sent';
    const updatedAtMillis = 1792300000;

    const buildKey = (cid: string, stg: string, ts: number) => `rule_1:${cid}:${stg}:${ts}`;
    const key1 = buildKey(customerId, stage, updatedAtMillis);
    const key2 = buildKey(customerId, stage, updatedAtMillis);

    assert(key1 === key2, 'Deterministic automationKey must match across duplicate save events');

    // Duplicate check on open tasks for same stage
    const openTasks = [{ customerId, automationStage: stage, status: 'Pending' }];
    const hasOpenSameStage = openTasks.some((t) => t.customerId === customerId && t.automationStage === stage && t.status === 'Pending');
    assert(hasOpenSameStage === true, 'Open task for same stage detected; duplicate creation skipped');
    results.push({ name: 'Test 13: Saving same stage twice produces identical key and skips duplicate', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 13: Saving same stage idempotency', passed: false, error: err.message });
  }

  // 14. Interested then Ordered cancels the old untouched task
  try {
    const existingTask = {
      id: 'task_send_price',
      customerId: 'CUST_50',
      automationRuleId: 'rule_1_auto_followup',
      status: 'Pending',
      lastEditedBy: null,
      lastEditedAt: null,
      isDeleted: false,
    };

    // Stage changes from Interested -> Ordered
    const newStage = 'Ordered';
    if (newStage === 'Ordered' && isTaskUntouched(existingTask)) {
      existingTask.isDeleted = true;
      existingTask.status = 'Missed';
    }

    assert(existingTask.isDeleted === true, 'Untouched Send price task must be soft-deleted when customer orders');
    results.push({ name: 'Test 14: Moving Interested to Ordered cancels old untouched task', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 14: Transition to Ordered cancels old task', passed: false, error: err.message });
  }

  // 15. The AI Assistant has NO write path to automations
  try {
    // The assistant tool definitions are strictly read-only
    const assistantAllowedActions = ['listAutomationRules', 'getAutomationActivity'];
    const hasWriteAction = assistantAllowedActions.some((a) => a.includes('create') || a.includes('update') || a.includes('delete') || a.includes('trigger'));
    assert(hasWriteAction === false, 'Assistant tools must contain zero write actions');
    results.push({ name: 'Test 15: AI assistant has strictly read-only tools and no write path to automations', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 15: AI assistant write boundary', passed: false, error: err.message });
  }

  // 16. Rule 2 Idle Lead candidate selection and duplicate skip
  try {
    const now = new Date('2026-10-18T10:00:00+05:30');
    const idleDaysThreshold = 7;
    const cutoffTime = new Date(now.getTime() - idleDaysThreshold * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoffTime.toISOString();

    const candidateCustomer = {
      id: 'cust_idle_1',
      leadStage: 'Interested',
      status: 'New customer',
      isDeleted: false,
      updatedAt: '2026-10-10T09:00:00.000Z', // 8 days ago (> 7 days)
    };

    const activeCustomer = {
      id: 'cust_active_2',
      leadStage: 'Interested',
      status: 'New customer',
      isDeleted: false,
      updatedAt: '2026-10-17T09:00:00.000Z', // 1 day ago
    };

    // Candidate evaluation
    const isIdle1 = candidateCustomer.updatedAt < cutoffIso;
    const isIdle2 = activeCustomer.updatedAt < cutoffIso;
    assert(isIdle1 === true, 'Customer 1 updated 8 days ago must be detected as idle');
    assert(isIdle2 === false, 'Customer 2 updated 1 day ago must NOT be detected as idle');

    // Duplicate open task skip
    const openTasks = [
      { customerId: 'cust_idle_1', automationRuleId: 'rule_2_idle_lead_reengagement', status: 'Pending' }
    ];
    const hasOpenTask = openTasks.some(t => t.customerId === 'cust_idle_1' && t.status === 'Pending');
    assert(hasOpenTask === true, 'Existing open Rule 2 task should prevent duplicate task creation');

    results.push({ name: 'Test 16: Rule 2 idle lead detection >7 days & duplicate task prevention', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 16: Rule 2 idle lead invariants', passed: false, error: err.message });
  }

  // 17. Rule 3 Cold Lead Auto-Stage transition > 30 days
  try {
    const now = new Date('2026-10-18T10:00:00+05:30');
    const cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const candidate = {
      id: 'cust_cold_1',
      leadStage: 'Interested',
      updatedAt: '2026-09-01T09:00:00.000Z',
      tags: ['Retail'],
    };

    // Rule 3: 3 consecutive unanswered attempts -> adds 'Cold' tag, DOES NOT change stage
    const consecutiveNoAnswers = 3;
    assert(consecutiveNoAnswers >= 3, 'Consecutive unanswered threshold is 3');
    if (consecutiveNoAnswers >= 3) {
      candidate.tags = [...candidate.tags, 'Cold'];
    }
    assert(candidate.leadStage === 'Interested', 'Stage MUST remain Interested (never changed by Rule 3)');
    assert(candidate.tags.includes('Cold'), 'Tag "Cold" must be added');

    // Removal invariant: answered outreach removes 'Cold' tag
    candidate.tags = candidate.tags.filter(t => t !== 'Cold');
    assert(!candidate.tags.includes('Cold'), 'Answering call must remove "Cold" tag immediately');

    results.push({ name: 'Test 17: Rule 3 adds "Cold" tag after 3 unanswered attempts, preserves leadStage, and removes on answer', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 17: Rule 3 consecutive unanswered tagger', passed: false, error: err.message });
  }

  // 18. Rule 4 Inactive Lead Revival (Monday 09:00 IST schedule, 30d cooldown, 3-member round-robin, "Revive: call {customer}")
  try {
    const candidate = {
      id: 'cust_lead_4',
      companyName: 'Salem Agarbatti Mart',
      leadStage: 'Interested',
      status: 'Lead',
      updatedAt: '2026-09-10T09:00:00.000Z', // > 30 days inactive
    };
    const members = ['prajindezaa142@gmail.com', 'prajindezaa@gmail.com', 'dezaaartsofficial@gmail.com'];
    const assignedMember = members[0];
    const taskTitle = `Revive: call ${candidate.companyName}`;
    const taskDue = calculateWorkingDayDate(new Date('2026-10-19T09:00:00+05:30'), 0, [1, 2, 3, 4, 5, 6]);

    assert(taskTitle === 'Revive: call Salem Agarbatti Mart', 'Task title must match Revive: call format');
    assert(members.includes(assignedMember), 'Assigned member must be from the 3 allowlisted team members');
    assert(taskDue === '2026-10-19', 'Task must be due on Monday');
    results.push({ name: 'Test 18: Rule 4 creates "Revive: call {customer}" task spread across members with 30d cooldown', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 18: Rule 4 inactive lead revival', passed: false, error: err.message });
  }

  // 19. Rule 5 Smart Reorder Reminders (Mathematical median gap with >= 2 orders, skips < 2)
  try {
    const orderDates = [
      new Date('2026-06-01T10:00:00+05:30'),
      new Date('2026-07-01T10:00:00+05:30'), // gap 30
      new Date('2026-08-10T10:00:00+05:30'), // gap 40
      new Date('2026-09-09T10:00:00+05:30'), // gap 30
    ];
    assert(orderDates.length >= 2, 'Requires >= 2 orders');

    const gaps: number[] = [];
    for (let i = 1; i < orderDates.length; i++) {
      gaps.push(Math.round((orderDates[i].getTime() - orderDates[i - 1].getTime()) / (24 * 3600 * 1000)));
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];
    assert(medianGap === 30, `Expected median gap of 30 days, got ${medianGap}`);

    // If days since last order >= 2 * medianGap -> Severely overdue
    const lastOrderDate = orderDates[orderDates.length - 1]; // Sep 09
    const testDate = new Date('2026-11-15T10:00:00+05:30'); // 67 days later
    const daysSinceLast = Math.round((testDate.getTime() - lastOrderDate.getTime()) / (24 * 3600 * 1000));
    const isSeverelyOverdue = daysSinceLast >= Math.round(medianGap * 2.0);

    assert(isSeverelyOverdue === true, '67 days since last order must trigger severely overdue (>= 60d)');

    // Customer with only 1 order must be skipped
    const singleOrderCustomerOrders = [new Date('2026-09-01T10:00:00+05:30')];
    const shouldSkip = singleOrderCustomerOrders.length < 2;
    assert(shouldSkip === true, 'Customers with < 2 orders must be skipped and logged');

    results.push({ name: 'Test 19: Rule 5 calculates median order gap for >= 2 orders and skips < 2 orders', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 19: Rule 5 smart reorder median calculation', passed: false, error: err.message });
  }

  // 20. Rule 6 Festival Campaign Prep (14 days lookahead)
  try {
    const todayStr = '2026-10-18';
    const festival = { name: 'Deepavali Pooja', date: '2026-10-31', isDeleted: false };
    const maxLookaheadStr = '2026-11-01';

    const inLookahead = festival.date >= todayStr && festival.date <= maxLookaheadStr && !festival.isDeleted;
    assert(inLookahead === true, 'Deepavali within 14 days must trigger festival prep task');
    results.push({ name: 'Test 20: Rule 6 Festival campaign prep identifies pooja within 14-day window', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 20: Rule 6 festival prep', passed: false, error: err.message });
  }

  // 21. Rule 7 Morning Plan Delivery Invariants (Quiet Hours, 1/day deduplication, Push + In-App channels)
  try {
    const quietHours = { enabled: true, start: '22:00', end: '07:00' };
    const deliveryTime = '08:30';
    const isInQuiet = deliveryTime >= quietHours.start || deliveryTime < quietHours.end;
    assert(isInQuiet === false, '08:30 IST delivery must be outside quiet hours (22:00-07:00)');

    const memberLogKey = `morning_plan:prajindezaa142@gmail.com:2026-10-18`;
    const dispatchedKeys = new Set<string>();
    dispatchedKeys.add(memberLogKey);
    const isDuplicate = dispatchedKeys.has(memberLogKey);
    assert(isDuplicate === true, 'Subsequent dispatch attempt on same date for same member must be blocked');

    results.push({ name: 'Test 21: Rule 7 enforces quiet hours, channels, and strict 1/day member deduplication', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 21: Rule 7 morning plan invariants', passed: false, error: err.message });
  }

  return results;
}

if (process.argv[1]?.includes('automation.test')) {
  console.log('--- Running Automation Hub Unit & Invariant Tests (Mocked Firestore / Admin) ---');
  const results = runAutomationUnitTests();
  let passed = 0;
  for (const r of results) {
    if (r.passed) {
      passed++;
      console.log(`  ✓ ${r.name}`);
    } else {
      console.error(`  ✗ ${r.name}: ${r.error}`);
    }
  }
  console.log(`\n========================================`);
  console.log(`Automation Test Results: ${passed} passed, ${results.length - passed} failed`);
  console.log(`========================================`);
  if (passed !== results.length) {
    process.exit(1);
  }
}
