/**
 * Jaikrishna Industries — Phase 4B Notification Engine Router & Pipeline Unit Tests
 */

import { isWithinQuietHours, getCurrentTimeIST } from '../../functions/src/notification_router';

export function runNotificationRouterUnitTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
  }

  // Test 1: Overnight quiet hours detection (e.g. 21:00 to 08:00)
  try {
    // 23:30 is within 21:00 to 08:00
    assert(isWithinQuietHours('23:30', '21:00', '08:00') === true, '23:30 should be in quiet hours');
    // 04:15 is within 21:00 to 08:00
    assert(isWithinQuietHours('04:15', '21:00', '08:00') === true, '04:15 should be in quiet hours');
    // 14:00 is OUTSIDE 21:00 to 08:00
    assert(isWithinQuietHours('14:00', '21:00', '08:00') === false, '14:00 should NOT be in quiet hours');
    results.push({ name: 'Test 1: Overnight quiet hours boundary evaluation', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 1: Overnight quiet hours boundary evaluation', passed: false, error: err.message });
  }

  // Test 2: Daytime quiet hours window (e.g. 13:00 to 15:00)
  try {
    assert(isWithinQuietHours('14:00', '13:00', '15:00') === true, '14:00 should be in quiet hours');
    assert(isWithinQuietHours('12:59', '13:00', '15:00') === false, '12:59 should NOT be in quiet hours');
    assert(isWithinQuietHours('15:00', '13:00', '15:00') === false, '15:00 should NOT be in quiet hours (end boundary exclusive)');
    results.push({ name: 'Test 2: Daytime window quiet hours boundary evaluation', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 2: Daytime window quiet hours boundary evaluation', passed: false, error: err.message });
  }

  // Test 3: Same start and end time (disabled quiet hours)
  try {
    assert(isWithinQuietHours('12:00', '00:00', '00:00') === false, 'Equal start and end should not be quiet hours');
    results.push({ name: 'Test 3: Zero-width quiet hours edge case', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 3: Zero-width quiet hours edge case', passed: false, error: err.message });
  }

  // Test 4: Current time format in Asia/Kolkata
  try {
    const formatted = getCurrentTimeIST(new Date());
    assert(/^\d{2}:\d{2}$/.test(formatted), `Time format should match HH:mm, got ${formatted}`);
    results.push({ name: 'Test 4: Strict Asia/Kolkata 24-hour time formatting', passed: true });
  } catch (err: any) {
    results.push({ name: 'Test 4: Strict Asia/Kolkata 24-hour time formatting', passed: false, error: err.message });
  }

  console.log('\n--- Notification Router Unit Test Results ---');
  let passedCount = 0;
  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`[PASS] ${r.name}`);
    } else {
      console.log(`[FAIL] ${r.name}: ${r.error}`);
    }
  }
  console.log(`Summary: ${passedCount}/${results.length} router tests passed.\n`);

  if (passedCount !== results.length) {
    throw new Error('Some Notification Router tests failed');
  }
}

// Auto-run if executed directly via tsx
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.includes('notification-router.test')) {
  runNotificationRouterUnitTests();
}
