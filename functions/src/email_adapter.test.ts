import assert from 'assert';
import { htmlToPlainText, getTodayDateUTC, getYearMonthUTC, ALLOWLISTED_TEAM_EMAILS } from './email_adapter';

async function runTests() {
  console.log('--- RUNNING EMAIL ADAPTER TESTS ---');

  // Test 1: Plain text conversion
  const sampleHtml = `
    <div style="font-family: sans-serif;">
      <h2>Good Morning! Daily Plan</h2>
      <p>Here is your daily summary:</p>
      <ul>
        <li>3 tasks scheduled</li>
        <li>1 lead overdue</li>
      </ul>
      <a href="https://jaikrishnabizzhub.in/tasks">Open Tasks</a>
    </div>
  `;
  const text = htmlToPlainText(sampleHtml);
  assert(text.includes('Good Morning! Daily Plan'), 'Contains title');
  assert(text.includes('• 3 tasks scheduled'), 'Formats list items');
  assert(text.includes('Open Tasks (https://jaikrishnabizzhub.in/tasks)'), 'Formats links');
  console.log('✓ Test 1: htmlToPlainText passed.');

  // Test 2: UTC date calculation
  const fixedDate = new Date('2026-10-20T02:30:00Z'); // 02:30 UTC
  const todayUTC = getTodayDateUTC(fixedDate);
  assert.strictEqual(todayUTC, '2026-10-20', 'UTC day format check');
  const monthUTC = getYearMonthUTC(fixedDate);
  assert.strictEqual(monthUTC, '2026-10', 'UTC month format check');
  console.log('✓ Test 2: UTC day/month boundary passed.');

  // Test 3: Allowlist enforcement
  assert(ALLOWLISTED_TEAM_EMAILS.includes('prajindezaa142@gmail.com'));
  assert(ALLOWLISTED_TEAM_EMAILS.includes('jaikrishnaindustries1@gmail.com'));
  assert(ALLOWLISTED_TEAM_EMAILS.includes('srinisrkp@gmail.com'));
  assert(!ALLOWLISTED_TEAM_EMAILS.includes('customer@random.com'));
  assert(!ALLOWLISTED_TEAM_EMAILS.includes('stranger@gmail.com'));
  console.log('✓ Test 3: Strict 3-member allowlist passed.');

  console.log('--- ALL EMAIL ADAPTER UNIT TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
