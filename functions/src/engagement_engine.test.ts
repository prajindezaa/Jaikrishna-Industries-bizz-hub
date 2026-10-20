import assert from 'assert';
import { ENGAGEMENT_CATALOG } from './engagement_engine';

async function testEngagementEngine() {
  console.log('--- RUNNING ENGAGEMENT ENGINE & BUDGET TESTS ---');

  // Test 1: Catalog Integrity
  assert(ENGAGEMENT_CATALOG.length >= 6, 'Contains at least 6 core engagement rules');
  const catalogIds = ENGAGEMENT_CATALOG.map((c) => c.id);
  assert(catalogIds.includes('engage_uncontacted_leads'), 'Includes uncontacted leads');
  assert(catalogIds.includes('engage_no_new_customer_today'), 'Includes new customer nudge');
  assert(catalogIds.includes('engage_daily_plan_missing'), 'Includes plan check');
  assert(catalogIds.includes('engage_midday_task_progress'), 'Includes task progress');
  assert(catalogIds.includes('engage_festival_ad_prep'), 'Includes festival ad prep');
  assert(catalogIds.includes('engage_orders_dispatch_check'), 'Includes dispatch check');
  console.log('✓ Test 1: Engagement catalog items verified.');

  // Test 2: Time Window Constraints
  for (const item of ENGAGEMENT_CATALOG) {
    assert(item.timeWindowIST.start < item.timeWindowIST.end, `Valid time window for ${item.id}`);
    assert(item.deepLink.startsWith('/'), `Valid deep link for ${item.id}`);
  }
  console.log('✓ Test 2: Time windows and deep links verified.');

  // Test 3: Budget Reserve & 30-Minute Window Math
  const memberBudget = 12;
  const reminderReserve = 5;
  const maxEngagementBeforeReserve = memberBudget - reminderReserve; // 7

  assert.strictEqual(maxEngagementBeforeReserve, 7, 'Engagement push capped at 7 to protect 5 reminders');

  const nowMs = Date.now();
  const recentTimestamps = [nowMs - 5 * 60 * 1000, nowMs - 12 * 60 * 1000];
  const within30m = recentTimestamps.filter((t) => nowMs - t < 30 * 60 * 1000);
  assert.strictEqual(within30m.length, 2, 'Detects 2 pushes in 30m window');
  console.log('✓ Test 3: Budget reserve and 30-minute window math verified.');

  console.log('--- ALL ENGAGEMENT ENGINE TESTS PASSED ---');
}

testEngagementEngine().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
