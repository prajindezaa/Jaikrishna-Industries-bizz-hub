/**
 * E2E Emulator Tests for Automation Rules
 *
 * This script runs against the Firebase Firestore emulator (port 8080).
 * It seeds TEST data, then exercises Rules 1, 3, 4, and 5, verifying real Firestore state.
 *
 * Usage:
 *   1. Start emulators:  firebase emulators:start --only firestore
 *   2. Run:              npx ts-node --esm src/e2e_emulator_test.ts
 */

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Point Admin SDK at emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'demo-jaikrishna-e2e' });
}

const db = getFirestore();

// --- Shared helpers ---
function daysBefore(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// Simple calculateWorkingDayDate stub for tests (the real one is in index.ts)
function calculateWorkingDayDate(_base: Date, _daysToAdd: number, _workingDays: number[] = [1, 2, 3, 4, 5, 6]): string {
  const d = new Date();
  d.setDate(d.getDate() + _daysToAdd);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

let passed = 0;
let failed = 0;
const results: Array<{ test: string; status: string; detail: string }> = [];

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    passed++;
    results.push({ test: testName, status: '✅ PASS', detail: detail || 'OK' });
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    results.push({ test: testName, status: '❌ FAIL', detail: detail || 'Assertion failed' });
    console.error(`  ❌ FAIL: ${testName} — ${detail}`);
  }
}

async function clearCollections() {
  const collections = ['tasks', 'customers', 'orders', 'automation_runs', 'system_settings', 'activity_logs', 'automation_pending', 'notifications'];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      if (col === 'customers') {
        const subSnap = await doc.ref.collection('outreach_logs').get();
        for (const subDoc of subSnap.docs) {
          await subDoc.ref.delete();
        }
      }
      await doc.ref.delete();
    }
  }
}

// ============================================================================
// SEED TEST DATA
// ============================================================================
async function seedData() {
  console.log('\n📦 Seeding test data...');
  await clearCollections();

  // Allowed emails (team members)
  await db.collection('allowed_emails').doc('member1@test.com').set({ allowed: true, role: 'Admin' });
  await db.collection('allowed_emails').doc('member2@test.com').set({ allowed: true, role: 'Member' });
  await db.collection('allowed_emails').doc('member3@test.com').set({ allowed: true, role: 'Member' });

  // Automation rules
  await db.collection('automation_rules').doc('rule_1_auto_followup').set({
    enabled: true,
    name: 'Auto Follow-up Tasks',
    parameters: {
      stages: {
        'Sample sent': { enabled: true, titleTemplate: 'Call {customer} to ask about sample', taskType: 'Call', daysAfter: 3, priority: 'High' },
        'Interested': { enabled: true, titleTemplate: 'Send price and offer to {customer}', taskType: 'WhatsApp', daysAfter: 1, priority: 'Medium' },
        'Negotiation': { enabled: true, titleTemplate: 'Follow up on negotiation with {customer}', taskType: 'Call', daysAfter: 2, priority: 'High' },
        'Contacted': { enabled: true, titleTemplate: 'Follow-up call to {customer}', taskType: 'Call', daysAfter: 3, priority: 'Medium' },
      },
    },
    workingDays: [1, 2, 3, 4, 5, 6],
  });

  await db.collection('automation_rules').doc('rule_2_idle_lead_reengagement').set({
    enabled: true,
    name: 'Rule 2: Idle Lead Re-Engagement',
    dailyCap: 20,
    workingDays: [1, 2, 3, 4, 5, 6],
    parameters: {
      idleDaysThreshold: 7,
      targetStages: ['Interested', 'Contacted', 'Sample sent'],
      globalDailyCap: 60,
    },
  });

  await db.collection('automation_rules').doc('rule_3_auto_stage_cold').set({
    enabled: true,
    name: 'Consecutive Unanswered Cold Tagging',
    parameters: { consecutiveUnansweredThreshold: 3, targetStages: ['Interested', 'Contacted', 'Sample sent', 'New', 'Negotiation'] },
  });

  await db.collection('automation_rules').doc('rule_4_cold_revival').set({
    enabled: true,
    name: 'Cold Lead Revival Engine',
    parameters: {
      inactiveDaysThreshold: 30,
      cooldownDays: 30,
      targetStages: ['Interested', 'Contacted', 'Sample sent', 'Negotiation'],
      scheduledDayOfWeek: new Date().getDay(), // set to today so it runs
      scheduledHour: new Date().getHours(),
    },
    dailyCap: 15,
    workingDays: [1, 2, 3, 4, 5, 6],
  });

  await db.collection('automation_rules').doc('rule_5_reorder_reminders').set({
    enabled: true,
    name: 'Smart Reorder Reminders',
    parameters: { leadDaysBefore: 2, overdueMultiplier: 2.0, scheduledHour: 8 },
    dailyCap: 20,
    workingDays: [1, 2, 3, 4, 5, 6],
  });

  // ---- Customers for Rule 2 ----
  // Idle lead: Inactive for 10 days in 'Interested' stage -> should receive a re-engagement call task
  await db.collection('customers').doc('cust_rule2_idle').set({
    companyName: 'Sri Murugan Traders',
    contactPerson: 'Murugan',
    leadStage: 'Interested',
    status: 'New lead',
    isDeleted: false,
    tags: [],
    assignedTo: 'member1@test.com',
    createdAt: daysBefore(20),
    updatedAt: daysBefore(10),
  });

  // Active lead: Updated 2 days ago (< 7 days idle) -> should be skipped
  await db.collection('customers').doc('cust_rule2_active').set({
    companyName: 'Kaveri Camphor Mart',
    contactPerson: 'Kaveri',
    leadStage: 'Interested',
    status: 'New lead',
    isDeleted: false,
    tags: [],
    assignedTo: 'member2@test.com',
    createdAt: daysBefore(15),
    updatedAt: daysBefore(2),
  });

  // Converted / Ordered customer: in 'Contacted' stage but status 'Old customer' -> should be skipped by in-memory check
  await db.collection('customers').doc('cust_rule2_ordered').set({
    companyName: 'Madurai Deepam Stores',
    contactPerson: 'Sundaram',
    leadStage: 'Contacted',
    status: 'Old customer',
    isDeleted: false,
    tags: [],
    assignedTo: 'member3@test.com',
    totalOrdersCount: 2,
    createdAt: daysBefore(30),
    updatedAt: daysBefore(15),
  });

  // ---- Customers for Rule 3 ----
  // Customer with 3 consecutive 'No answer' outcomes → should get Cold tag
  await db.collection('customers').doc('cust_rule3_cold').set({
    companyName: 'Rule3 Cold Test Co',
    contactPerson: 'Test Person',
    leadStage: 'New',
    status: 'New lead',
    isDeleted: false,
    tags: [],
    assignedTo: 'member1@test.com',
    createdAt: daysBefore(60),
    updatedAt: daysBefore(10),
  });
  // Add 3 'No answer' outreach logs
  for (let i = 0; i < 3; i++) {
    await db.collection('customers').doc('cust_rule3_cold').collection('outreach_logs').add({
      outcome: 'No answer',
      loggedAt: daysBefore(5 - i),
      method: 'Call',
    });
  }

  // Customer with 2 'No answer' + 1 'Answered' → should NOT get Cold tag
  await db.collection('customers').doc('cust_rule3_safe').set({
    companyName: 'Rule3 Safe Test Co',
    contactPerson: 'Safe Person',
    leadStage: 'New',
    status: 'New lead',
    isDeleted: false,
    tags: [],
    assignedTo: 'member2@test.com',
    createdAt: daysBefore(60),
    updatedAt: daysBefore(10),
  });
  // First log is 'Answered' (most recent), then 2 'No answer'
  await db.collection('customers').doc('cust_rule3_safe').collection('outreach_logs').add({
    outcome: 'Answered',
    loggedAt: daysBefore(1),
    method: 'Call',
  });
  for (let i = 0; i < 2; i++) {
    await db.collection('customers').doc('cust_rule3_safe').collection('outreach_logs').add({
      outcome: 'No answer',
      loggedAt: daysBefore(5 - i),
      method: 'Call',
    });
  }

  // ---- Customer for Rule 4 ----
  // Inactive lead (no activity for 40 days) → should get revival task
  await db.collection('customers').doc('cust_rule4_inactive').set({
    companyName: 'Rule4 Inactive Lead Co',
    contactPerson: 'Inactive Person',
    leadStage: 'Negotiation',
    status: 'New lead',
    isDeleted: false,
    tags: [],
    totalOrdersCount: 0,
    assignedTo: 'member1@test.com',
    createdAt: daysBefore(90),
    updatedAt: daysBefore(40),
  });

  // ---- Customers for Rule 5 ----
  // Old customer with 3 orders, median gap ~30 days, last order 60 days ago (severely overdue at 2x)
  await db.collection('customers').doc('cust_rule5_overdue').set({
    companyName: 'Rule5 Overdue Customer',
    contactPerson: 'Overdue Person',
    leadStage: 'Ordered',
    status: 'Old customer',
    isDeleted: false,
    tags: [],
    assignedTo: 'member2@test.com',
    createdAt: daysBefore(200),
    updatedAt: daysBefore(60),
  });
  // 3 orders with ~30-day gaps
  await db.collection('orders').doc('order_r5_1').set({
    customerId: 'cust_rule5_overdue',
    orderDate: daysBefore(150),
    isDeleted: false,
    totalAmount: 5000,
  });
  await db.collection('orders').doc('order_r5_2').set({
    customerId: 'cust_rule5_overdue',
    orderDate: daysBefore(120),
    isDeleted: false,
    totalAmount: 6000,
  });
  await db.collection('orders').doc('order_r5_3').set({
    customerId: 'cust_rule5_overdue',
    orderDate: daysBefore(90),
    isDeleted: false,
    totalAmount: 7000,
  });

  // Old customer with only 1 order → should be SKIPPED
  await db.collection('customers').doc('cust_rule5_skip').set({
    companyName: 'Rule5 Skip Customer',
    contactPerson: 'Skip Person',
    leadStage: 'Ordered',
    status: 'Old customer',
    isDeleted: false,
    tags: [],
    assignedTo: 'member3@test.com',
    createdAt: daysBefore(200),
    updatedAt: daysBefore(60),
  });
  await db.collection('orders').doc('order_r5_skip_1').set({
    customerId: 'cust_rule5_skip',
    orderDate: daysBefore(100),
    isDeleted: false,
    totalAmount: 3000,
  });

  console.log('  ✅ Test data seeded.');
}

// ============================================================================
// TEST: Rule 1 — Auto Follow-up Tasks on Stage Change
// ============================================================================
async function testRule1() {
  console.log('\n🧪 TEST: Rule 1 — Auto Follow-up Tasks on Stage Change');

  const { executeRule1CustomerStageChange } = await import('./rule_1_stage_followup');

  const custId = 'cust_rule1_test';
  await db.collection('customers').doc(custId).set({
    companyName: 'Rule 1 Test Corp',
    contactPerson: 'Ravi Kumar',
    leadStage: 'Sample sent',
    status: 'New lead',
    isDeleted: false,
    tags: [],
    assignedTo: 'member1@test.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Stage changed to 'Sample sent' -> Rule 1 creates task
  const res1 = await executeRule1CustomerStageChange(db as any, {
    customerId: custId,
    beforeStage: 'New',
    newStage: 'Sample sent',
  });
  console.log(`  Rule 1 (first trigger) status: ${res1.status}, taskId: ${res1.taskId}`);

  const tasksSnap1 = await db.collection('tasks')
    .where('customerId', '==', custId)
    .where('automationRuleId', '==', 'rule_1_auto_followup')
    .where('isDeleted', '==', false)
    .get();
  assert(tasksSnap1.size === 1, 'Rule 1: Exactly one task created on stage change', `tasks found=${tasksSnap1.size}`);

  const firstTaskId = tasksSnap1.docs[0].id;
  const firstTaskData = tasksSnap1.docs[0].data();
  assert(firstTaskData.status === 'Pending', 'Rule 1: Created task is Pending', `status=${firstTaskData.status}`);

  // 2. Save same stage again -> still exactly one task (no duplicates)
  const res2 = await executeRule1CustomerStageChange(db as any, {
    customerId: custId,
    beforeStage: 'Sample sent',
    newStage: 'Sample sent',
  });
  console.log(`  Rule 1 (same stage re-save) status: ${res2.status}`);

  const tasksSnap2 = await db.collection('tasks')
    .where('customerId', '==', custId)
    .where('automationRuleId', '==', 'rule_1_auto_followup')
    .where('isDeleted', '==', false)
    .get();
  assert(tasksSnap2.size === 1, 'Rule 1: Still exactly one task after re-saving same stage', `tasks found=${tasksSnap2.size}`);

  // 3. Advance stage to 'Negotiation' -> old untouched task goes to Trash (isDeleted: true), new task created
  await db.collection('customers').doc(custId).update({
    leadStage: 'Negotiation',
    updatedAt: new Date().toISOString(),
  });

  const res3 = await executeRule1CustomerStageChange(db as any, {
    customerId: custId,
    beforeStage: 'Sample sent',
    newStage: 'Negotiation',
  });
  console.log(`  Rule 1 (advanced to Negotiation) status: ${res3.status}`);

  const oldTaskDoc = await db.collection('tasks').doc(firstTaskId).get();
  const oldTaskData = oldTaskDoc.data();
  assert(oldTaskData?.isDeleted === true, 'Rule 1: Old untouched task marked deleted (Trash)', `isDeleted=${oldTaskData?.isDeleted}`);

  const tasksSnap3 = await db.collection('tasks')
    .where('customerId', '==', custId)
    .where('automationRuleId', '==', 'rule_1_auto_followup')
    .where('isDeleted', '==', false)
    .get();
  assert(tasksSnap3.size === 1, 'Rule 1: Exactly one active task for new stage', `tasks found=${tasksSnap3.size}`);
  assert(tasksSnap3.docs[0].data().automationStage === 'Negotiation', 'Rule 1: Active task is for Negotiation stage', `stage=${tasksSnap3.docs[0].data().automationStage}`);
}

// ============================================================================
// TEST: Rule 2 — Idle Lead Re-Engagement
// ============================================================================
async function testRule2() {
  console.log('\n🧪 TEST: Rule 2 — Idle Lead Re-Engagement Engine');

  const { executeRule2IdleLeadCheck } = await import('./rule_2_idle_lead');

  // 1. Dry run should calculate candidates but NOT write tasks to Firestore
  const statsDry = await executeRule2IdleLeadCheck(db as any, { forceRunNow: true, dryRun: true });
  console.log(`  Rule 2 (dryRun) stats: evaluated=${statsDry.evaluated}, created=${statsDry.created}, skipped=${statsDry.skipped}`);
  assert(statsDry.created >= 1, 'Rule 2: dryRun calculates created tasks count', `created=${statsDry.created}`);

  const dryTasksSnap = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule2_idle')
    .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
    .where('isDeleted', '==', false)
    .get();
  assert(dryTasksSnap.size === 0, 'Rule 2: dryRun does NOT write tasks to Firestore', `tasks found=${dryTasksSnap.size}`);

  // 2. Real execution
  const stats = await executeRule2IdleLeadCheck(db as any, { forceRunNow: true });
  console.log(`  Rule 2 stats: evaluated=${stats.evaluated}, created=${stats.created}, skipped=${stats.skipped}`);

  assert(stats.created >= 1, 'Rule 2: Created at least 1 idle re-engagement task', `created=${stats.created}`);
  assert(stats.skipped >= 2, 'Rule 2: Skipped active lead and ordered customer', `skipped=${stats.skipped}`);

  // 3. Verify task created for idle lead
  const idleTasksSnap = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule2_idle')
    .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
    .where('isDeleted', '==', false)
    .get();
  assert(idleTasksSnap.size === 1, 'Rule 2: Exactly 1 task created for idle lead', `tasks found=${idleTasksSnap.size}`);

  const idleTaskData = idleTasksSnap.docs[0].data();
  assert(idleTaskData.type === 'Call', 'Rule 2: Task type is Call', `type=${idleTaskData.type}`);
  assert(idleTaskData.priority === 'Medium', 'Rule 2: Task priority is Medium', `priority=${idleTaskData.priority}`);
  assert(idleTaskData.status === 'Pending', 'Rule 2: Task status is Pending', `status=${idleTaskData.status}`);
  assert(idleTaskData.title.includes('Re-engage idle lead: Sri Murugan Traders'), 'Rule 2: Task title contains customer name and idle prompt', `title=${idleTaskData.title}`);

  // 4. Verify active lead was NOT assigned a task
  const activeTasksSnap = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule2_active')
    .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
    .where('isDeleted', '==', false)
    .get();
  assert(activeTasksSnap.size === 0, 'Rule 2: Active lead (< 7 days) gets no task', `tasks found=${activeTasksSnap.size}`);

  // 5. Verify ordered customer was NOT assigned a task
  const orderedTasksSnap = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule2_ordered')
    .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
    .where('isDeleted', '==', false)
    .get();
  assert(orderedTasksSnap.size === 0, 'Rule 2: Ordered / Old customer gets no task', `tasks found=${orderedTasksSnap.size}`);

  // 6. Idempotency: re-run should NOT create duplicates
  const stats2 = await executeRule2IdleLeadCheck(db as any, { forceRunNow: true });
  console.log(`  Rule 2 (re-run) stats: evaluated=${stats2.evaluated}, created=${stats2.created}, skipped=${stats2.skipped}`);
  const idleTasksSnap2 = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule2_idle')
    .where('automationRuleId', '==', 'rule_2_idle_lead_reengagement')
    .where('isDeleted', '==', false)
    .get();
  assert(idleTasksSnap2.size === 1, 'Rule 2: Still exactly 1 task after re-run (idempotency preserved)', `tasks found=${idleTasksSnap2.size}`);
}

// ============================================================================
// TEST: Rule 3 — Cold Tagging
// ============================================================================
async function testRule3() {
  console.log('\n🧪 TEST: Rule 3 — Cold Tagging Engine');

  const { executeRule3AutoStageCold } = await import('./rule_3_auto_cold');
  const stats = await executeRule3AutoStageCold(db as any, { triggeredBy: 'manual_test' });

  console.log(`  Rule 3 stats: evaluated=${stats.evaluated}, updated=${stats.updated}, skipped=${stats.skipped}`);

  // Check: cust_rule3_cold should have 'Cold' tag
  const coldDoc = await db.collection('customers').doc('cust_rule3_cold').get();
  const coldTags: string[] = coldDoc.data()?.tags || [];
  assert(coldTags.includes('Cold'), 'Rule 3: Customer with 3 No-answers gets Cold tag', `tags=${JSON.stringify(coldTags)}`);

  // Check: cust_rule3_safe should NOT have 'Cold' tag
  const safeDoc = await db.collection('customers').doc('cust_rule3_safe').get();
  const safeTags: string[] = safeDoc.data()?.tags || [];
  assert(!safeTags.includes('Cold'), 'Rule 3: Customer with Answered does NOT get Cold tag', `tags=${JSON.stringify(safeTags)}`);

  // Now simulate an answered outreach for cold customer — Cold tag should be removed
  // First add an 'Answered' outreach log to the cold customer
  await db.collection('customers').doc('cust_rule3_cold').collection('outreach_logs').add({
    outcome: 'Answered',
    loggedAt: new Date().toISOString(),
    method: 'Call',
  });

  // Run Rule 3 again — the Cold tag should be REMOVED since the latest outreach was answered
  // Rule 3 counts Cold-tag removals as "updated" — so updated=1 means the removal happened
  const stats2 = await executeRule3AutoStageCold(db as any, { triggeredBy: 'manual_test' });
  console.log(`  Rule 3 (re-run after answer) stats: evaluated=${stats2.evaluated}, updated=${stats2.updated}`);

  const coldDoc2 = await db.collection('customers').doc('cust_rule3_cold').get();
  const coldTags2: string[] = coldDoc2.data()?.tags || [];
  assert(!coldTags2.includes('Cold'), 'Rule 3: Cold tag REMOVED after answer', `tags=${JSON.stringify(coldTags2)}`);
  assert(stats2.updated === 1, 'Rule 3: Re-run after answer counts 1 removal update', `updated=${stats2.updated}`);
}

// ============================================================================
// TEST: Rule 4 — Cold Lead Revival
// ============================================================================
async function testRule4() {
  console.log('\n🧪 TEST: Rule 4 — Cold Lead Revival');

  const { executeRule4ColdRevival } = await import('./rule_4_cold_revival');

  // Run with forceRunNow to bypass day-of-week check
  const stats = await executeRule4ColdRevival(db as any, { forceRunNow: true });

  console.log(`  Rule 4 stats: evaluated=${stats.evaluated}, created=${stats.created}, skipped=${stats.skipped}`);

  assert(stats.created >= 1, 'Rule 4: Created at least 1 revival task', `created=${stats.created}`);

  // Check that a task was created for cust_rule4_inactive
  const tasksSnap = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule4_inactive')
    .where('automationRuleId', '==', 'rule_4_cold_revival')
    .where('isDeleted', '==', false)
    .get();

  assert(tasksSnap.size === 1, 'Rule 4: Exactly 1 task for inactive customer', `tasks found=${tasksSnap.size}`);

  // Run again — should NOT create a duplicate (idempotency)
  const stats2 = await executeRule4ColdRevival(db as any, { forceRunNow: true });
  console.log(`  Rule 4 (re-run) stats: evaluated=${stats2.evaluated}, created=${stats2.created}, skipped=${stats2.skipped}`);

  const tasksSnap2 = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule4_inactive')
    .where('automationRuleId', '==', 'rule_4_cold_revival')
    .where('isDeleted', '==', false)
    .get();

  assert(tasksSnap2.size === 1, 'Rule 4: Still exactly 1 task after re-run (no dupe)', `tasks found=${tasksSnap2.size}`);

  // Dry run should not create anything
  const statsDry = await executeRule4ColdRevival(db as any, { forceRunNow: true, dryRun: true });
  console.log(`  Rule 4 (dryRun) stats: evaluated=${statsDry.evaluated}, created=${statsDry.created}`);
  // dryRun reports "would create" count but doesn't write — task count should stay the same
  const tasksSnap3 = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule4_inactive')
    .where('automationRuleId', '==', 'rule_4_cold_revival')
    .where('isDeleted', '==', false)
    .get();
  assert(tasksSnap3.size === 1, 'Rule 4: dryRun does not create extra tasks', `tasks after dryRun=${tasksSnap3.size}`);
}

// ============================================================================
// TEST: Rule 5 — Reorder Reminders
// ============================================================================
async function testRule5() {
  console.log('\n🧪 TEST: Rule 5 — Reorder Reminders');

  const { executeRule5ReorderReminders } = await import('./rule_5_reorder');

  const stats = await executeRule5ReorderReminders(db as any, { forceRunNow: true });

  console.log(`  Rule 5 stats: evaluated=${stats.evaluated}, created=${stats.created}, skipped=${stats.skipped}, skippedFewOrders=${stats.skippedFewerThanTwoOrders}`);

  // cust_rule5_overdue has 3 orders with ~30d gaps, last 90 days ago → severely overdue
  assert(stats.created >= 1, 'Rule 5: Created at least 1 reorder/check-in task', `created=${stats.created}`);

  // cust_rule5_skip has only 1 order → should be skipped
  assert(stats.skippedFewerThanTwoOrders >= 1, 'Rule 5: Skipped customer with <2 orders', `skippedFewOrders=${stats.skippedFewerThanTwoOrders}`);

  // Check cust_rule5_overdue has the 'Reorder overdue' tag
  const overdueDoc = await db.collection('customers').doc('cust_rule5_overdue').get();
  const overdueTags: string[] = overdueDoc.data()?.tags || [];
  assert(overdueTags.includes('Reorder overdue'), 'Rule 5: Overdue customer gets "Reorder overdue" tag', `tags=${JSON.stringify(overdueTags)}`);

  // Simulate a new order → tag should be removable
  // (Note: tag removal on new order is typically handled by a separate Firestore trigger, not Rule 5 itself)

  // Idempotency: run again, should not create duplicate task
  const stats2 = await executeRule5ReorderReminders(db as any, { forceRunNow: true });
  const taskSnap2 = await db.collection('tasks')
    .where('customerId', '==', 'cust_rule5_overdue')
    .where('automationRuleId', '==', 'rule_5_reorder_reminders')
    .where('isDeleted', '==', false)
    .get();
  assert(taskSnap2.size === 1, 'Rule 5: No duplicate task after re-run', `tasks found=${taskSnap2.size}`);

  // dryRun
  const statsDry = await executeRule5ReorderReminders(db as any, { forceRunNow: true, dryRun: true });
  console.log(`  Rule 5 (dryRun) stats: evaluated=${statsDry.evaluated}, created=${statsDry.created}`);
}

// ============================================================================
// MAIN — Run all tests
// ============================================================================
async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Jaikrishna Industries — E2E Emulator Tests');
    console.log('  Firestore emulator at localhost:8080');
    console.log('═══════════════════════════════════════════════════════');

    await seedData();
    await testRule1();
    await testRule2();
    await testRule3();
    await testRule4();
    await testRule5();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n  Test                                                    | Status   | Detail');
    console.log('  --------------------------------------------------------|----------|-------');
    for (const r of results) {
      console.log(`  ${r.test.padEnd(56)}| ${r.status.padEnd(9)}| ${r.detail}`);
    }
    console.log('');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n💥 Fatal error in E2E tests:', err);
    process.exit(2);
  }
}

main();
