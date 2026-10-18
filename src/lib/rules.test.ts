/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Firestore Security Rules Unit Tests
 * Uses @firebase/rules-unit-testing to verify client write rejections on:
 * 1. automation_runs (rejected)
 * 2. automation_pending (rejected)
 * 3. tasks with client-forged automation fields (isAutomation, automationKey, automationRuleId, automationStage, automationRunId, createdBy 'automation')
 * 4. activity_logs with byAutomation: true (rejected)
 * 5. customers without lastWriteSource or updatedBy (rejected)
 * 6. customers with valid lastWriteSource and updatedBy (allowed)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

export async function runFirestoreRulesTests() {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  console.log('--- Initializing Firestore Rules Test Environment ---');
  let testEnv: RulesTestEnvironment | null = null;
  const results: { name: string; passed: boolean; error?: string }[] = [];

  try {
    testEnv = await initializeTestEnvironment({
      projectId: 'jaikrishna-rules-test',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });

    const memberAuth = { uid: 'member_1', email: 'prajindezaa142@gmail.com' };
    const context = testEnv.authenticatedContext(memberAuth.uid, { email: memberAuth.email });
    const db = context.firestore();

    // 1. automation_runs client write REJECTED
    try {
      await assertFails(
        db.collection('automation_runs').doc('run_1').set({
          ruleId: 'rule_1',
          createdCount: 5,
        })
      );
      results.push({ name: 'Client write to automation_runs is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Client write to automation_runs is REJECTED', passed: false, error: e.message });
    }

    // 2. automation_pending client write REJECTED
    try {
      await assertFails(
        db.collection('automation_pending').doc('pending_1').set({
          ruleId: 'rule_1',
          status: 'queued',
        })
      );
      results.push({ name: 'Client write to automation_pending is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Client write to automation_pending is REJECTED', passed: false, error: e.message });
    }

    // 3. Client creating task with isAutomation: true is REJECTED
    try {
      await assertFails(
        db.collection('tasks').doc('fake_task_1').set({
          title: 'Forged Task',
          isAutomation: true,
          createdBy: 'member',
        })
      );
      results.push({ name: 'Client create task with isAutomation: true is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Client create task with isAutomation: true is REJECTED', passed: false, error: e.message });
    }

    // 4. Client creating task with createdBy: 'automation' is REJECTED
    try {
      await assertFails(
        db.collection('tasks').doc('fake_task_2').set({
          title: 'Forged Task',
          createdBy: 'automation',
        })
      );
      results.push({ name: 'Client create task with createdBy: "automation" is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Client create task with createdBy: "automation" is REJECTED', passed: false, error: e.message });
    }

    // 5. Client creating task with automationKey is REJECTED
    try {
      await assertFails(
        db.collection('tasks').doc('fake_task_3').set({
          title: 'Forged Task',
          automationKey: 'hash_123',
        })
      );
      results.push({ name: 'Client create task with automationKey is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Client create task with automationKey is REJECTED', passed: false, error: e.message });
    }

    // 6. Client creating activity_logs with byAutomation: true is REJECTED
    try {
      await assertFails(
        db.collection('activity_logs').doc('fake_log').set({
          action: 'test',
          byAutomation: true,
        })
      );
      results.push({ name: 'Client create activity_log with byAutomation: true is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Client create activity_log with byAutomation: true is REJECTED', passed: false, error: e.message });
    }

    // 7. Customer write WITHOUT lastWriteSource is REJECTED
    try {
      await assertFails(
        db.collection('customers').doc('cust_missing_fields').set({
          companyName: 'No Source Mills',
          updatedBy: 'prajindezaa142@gmail.com',
        })
      );
      results.push({ name: 'Customer write without lastWriteSource is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Customer write without lastWriteSource is REJECTED', passed: false, error: e.message });
    }

    // 8. Customer write WITHOUT updatedBy is REJECTED
    try {
      await assertFails(
        db.collection('customers').doc('cust_missing_updated_by').set({
          companyName: 'No UpdatedBy Mills',
          lastWriteSource: 'manual_create',
        })
      );
      results.push({ name: 'Customer write without updatedBy is REJECTED', passed: true });
    } catch (e: any) {
      results.push({ name: 'Customer write without updatedBy is REJECTED', passed: false, error: e.message });
    }

    // 9. Customer write WITH both lastWriteSource and updatedBy SUCCEEDS
    try {
      await assertSucceeds(
        db.collection('customers').doc('cust_valid').set({
          companyName: 'Valid Mills',
          lastWriteSource: 'manual_create',
          updatedBy: 'prajindezaa142@gmail.com',
        })
      );
      results.push({ name: 'Customer write with valid lastWriteSource and updatedBy SUCCEEDS', passed: true });
    } catch (e: any) {
      results.push({ name: 'Customer write with valid lastWriteSource and updatedBy SUCCEEDS', passed: false, error: e.message });
    }
  } finally {
    if (testEnv) {
      await testEnv.cleanup();
    }
  }

  return results;
}

if (process.argv[1]?.includes('rules.test')) {
  runFirestoreRulesTests()
    .then((results) => {
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
      console.log(`Firestore Rules Test Results: ${passed} passed, ${results.length - passed} failed`);
      console.log(`========================================`);
      if (passed !== results.length) process.exit(1);
    })
    .catch((err) => {
      console.error('Test execution error:', err);
      process.exit(1);
    });
}
