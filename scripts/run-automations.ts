/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Automation Engine Runner
 * Executable via Node / tsx in GitHub Actions or locally.
 * Connects via Firebase Admin SDK to execute scheduled rules.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getFirebaseAdmin } from '../api/middleware';
import { executeRule2IdleLeadCheck } from '../functions/src/rule_2_idle_lead';
import { executeRule3AutoStageCold } from '../functions/src/rule_3_auto_cold';
import { executeRule4ColdRevival } from '../functions/src/rule_4_cold_revival';
import { executeRule5ReorderReminders } from '../functions/src/rule_5_reorder';
import { executeRule6FestivalCampaignPrep } from '../functions/src/rule_6_festival';
import { executeRule7MorningPlan } from '../functions/src/rule_7_morning_plan';

async function sendEmailStub(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email Skipped - No RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'reminders@jaikrishnabizzhub.in',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Resend Error] ${res.status}: ${errText}`);
    } else {
      console.log(`[Resend Success] Sent email to ${to}`);
    }
  } catch (err) {
    console.warn(`[Resend Failed] ${err}`);
  }
}

async function main() {
  console.log('========================================================');
  console.log('🚀 JAIKRISHNA AUTOMATIONS ENGINE — CRON RUNNER');
  console.log('Time (UTC):', new Date().toISOString());
  console.log('Time (IST):', new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'long' }).format(new Date()));
  console.log('========================================================\n');

  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  // 1. Rule 2: Idle Lead Re-Engagement
  console.log('▶ Running Rule 2: Idle Lead Re-Engagement...');
  try {
    const r2Result = await executeRule2IdleLeadCheck(db);
    console.log('  ✓ Rule 2 finished:', r2Result);
  } catch (e) {
    console.error('  ✗ Rule 2 failed:', e);
  }

  // 2. Rule 3: Auto "Cold" Tagging
  console.log('\n▶ Running Rule 3: Auto Stage Cold Tagging...');
  try {
    const r3Result = await executeRule3AutoStageCold(db);
    console.log('  ✓ Rule 3 finished:', r3Result);
  } catch (e) {
    console.error('  ✗ Rule 3 failed:', e);
  }

  // 3. Rule 4: Cold Lead Revival
  console.log('\n▶ Running Rule 4: Cold Lead Revival...');
  try {
    const r4Result = await executeRule4ColdRevival(db);
    console.log('  ✓ Rule 4 finished:', r4Result);
  } catch (e) {
    console.error('  ✗ Rule 4 failed:', e);
  }

  // 4. Rule 5: Reorder Reminders
  console.log('\n▶ Running Rule 5: Smart Reorder Reminders...');
  try {
    const r5Result = await executeRule5ReorderReminders(db, { forceRunNow: true });
    console.log('  ✓ Rule 5 finished:', r5Result);
  } catch (e) {
    console.error('  ✗ Rule 5 failed:', e);
  }

  // 5. Rule 6: Festival Campaign Prep
  console.log('\n▶ Running Rule 6: Festival Campaign Prep...');
  try {
    const r6Result = await executeRule6FestivalCampaignPrep(db, { forceRunNow: true });
    console.log('  ✓ Rule 6 finished:', r6Result);
  } catch (e) {
    console.error('  ✗ Rule 6 failed:', e);
  }

  // 6. Rule 7: Daily Morning Plan Briefing (For all 3 team members)
  console.log('\n▶ Running Rule 7: Morning Plan Briefing...');
  try {
    const r7Result = await executeRule7MorningPlan(db as any, sendEmailStub, { forceRunNow: true });
    console.log('  ✓ Rule 7 finished:', r7Result);
  } catch (e) {
    console.error('  ✗ Rule 7 failed:', e);
  }

  // 7. Phase 2 Engagement & Attention Engine (Condition-based nudges within daily push budget)
  console.log('\n▶ Running Phase 2 Engagement Engine for 3 Team Members...');
  try {
    const { runEngagementEngineForMember } = await import('../functions/src/engagement_engine.js');
    const members = ['prajindezaa142@gmail.com', 'jaikrishnaindustries1@gmail.com', 'srinisrkp@gmail.com'];
    for (const member of members) {
      console.log(`  Evaluating engagement nudges for ${member}...`);
      const engResult = await runEngagementEngineForMember(db as any, member);
      console.log(`  ✓ ${member}: evaluated=${engResult.evaluated}, sent=${engResult.sent}, suppressed=${engResult.suppressed}`);
      if (engResult.details.length > 0) {
        engResult.details.forEach((d) => console.log(`    - ${d}`));
      }
    }
  } catch (e) {
    console.error('  ✗ Engagement engine failed:', e);
  }

  console.log('\n========================================================');
  console.log('✅ ALL AUTOMATIONS FINISHED SUCCESSFULLY');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('FATAL RUNNER ERROR:', err);
  process.exit(1);
});
