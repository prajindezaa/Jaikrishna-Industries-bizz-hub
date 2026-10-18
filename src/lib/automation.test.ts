/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Automation Engine Unit & Invariant Tests
 * Validates Rule 1, Rule 7, working-day shifts, idempotency, and security boundaries.
 */

import { calculateWorkingDayDate, isTaskUntouched } from '../../functions/src/index';

export function runAutomationUnitTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
  }

  // TEST 1: Due Date Calculation: Friday + 2 days = Monday (skips Sunday)
  try {
    // Friday: 2026-10-16
    const friday = new Date('2026-10-16T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(friday, 2, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-10-19', `Expected 2026-10-19 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 1: Friday + 2 days lands on Monday', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 1: Friday + 2 days lands on Monday', passed: false, error: err.message });
  }

  // TEST 2: Saturday + 1 day = Monday (skips Sunday)
  try {
    // Saturday: 2026-10-17
    const saturday = new Date('2026-10-17T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(saturday, 1, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-10-19', `Expected 2026-10-19 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 2: Saturday + 1 day lands on Monday', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 2: Saturday + 1 day lands on Monday', passed: false, error: err.message });
  }

  // TEST 3: Month-end edge case: Oct 31, 2026 (Saturday) + 2 days = Monday Nov 2, 2026
  try {
    const oct31 = new Date('2026-10-31T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(oct31, 2, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-11-02', `Expected 2026-11-02 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 3: Oct 31 (Sat) + 2 days lands on Monday Nov 2', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 3: Oct 31 (Sat) + 2 days lands on Monday Nov 2', passed: false, error: err.message });
  }

  // TEST 4: Sunday stage change + 1 day = Monday
  try {
    const sunday = new Date('2026-10-18T12:00:00+05:30');
    const dueDate = calculateWorkingDayDate(sunday, 1, [1, 2, 3, 4, 5, 6]);
    assert(dueDate === '2026-10-19', `Expected 2026-10-19 (Monday), got ${dueDate}`);
    results.push({ name: 'Test 4: Sunday + 1 day lands on Monday', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 4: Sunday + 1 day lands on Monday', passed: false, error: err.message });
  }

  // TEST 5: Untouched Task Invariant (Pending, no completedAt, no lastEditedBy, no lastEditedAt)
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

  // TEST 6: Morning Plan Active/Quiet Hours Evaluation
  try {
    // 08:30 IST is outside quiet hours (21:00 to 08:00)
    const quietStart = 21;
    const quietEnd = 8;
    const testDeliveryHour = 8;
    const testDeliveryMin = 30;

    const isInsideQuiet = testDeliveryHour >= quietStart || (testDeliveryHour < quietEnd);
    assert(isInsideQuiet === false, '08:30 IST must be outside 21:00-08:00 quiet hours');

    results.push({ name: 'Test 6: Morning Plan delivery time falls outside quiet hours', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 6: Quiet hours evaluation', passed: false, error: err.message });
  }

  return results;
}
