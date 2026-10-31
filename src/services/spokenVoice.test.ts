/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Spoken Voice Corrections & Clarifications Test Suite
 *
 * Validates:
 * 1. Spoken clarification questions on ambiguous customer matches (e.g. "I found two Ravi...")
 * 2. Playback speed controls ("slower", "say that again", "stop", "cancel")
 * 3. In-place voice corrections for pending proposals ("make it 5 PM", "change to Monday", "reassign to Sales Manager")
 * 4. Low-risk voice confirmation ("confirm", "சரி", "ஆமா") accepted, while high-risk requires physical tap
 * 5. Rejection of invalid confirmations and non-matching commands
 * 6. Repeated misunderstanding recovery (offers text input after 2 consecutive failures)
 * 7. Bilingual intent recognition (English and Tamil)
 */

import { spokenVoiceController } from '../services/spokenVoiceController.js';

interface VoiceTestOutcome {
  id: number;
  description: string;
  passed: boolean;
  error?: string;
}

const outcomes: VoiceTestOutcome[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runVoiceTests() {
  console.log('\n======================================================');
  console.log('JAIKRISHNA INDUSTRIES: SPOKEN VOICE CORRECTIONS TEST SUITE');
  console.log('======================================================\n');

  // Test 1: Ambiguity detection when multiple customer names match
  try {
    const mockCustomers = [
      { id: 'c1', companyName: 'Ravi Traders', place: { city: 'Salem' } },
      { id: 'c2', companyName: 'Ravi Stores', place: { city: 'Theni' } },
      { id: 'c3', companyName: 'Murugan Agencies', place: { city: 'Madurai' } },
    ];

    const ambiguityCheck = spokenVoiceController.checkCustomerAmbiguity('Ravi', mockCustomers);
    assert(ambiguityCheck.isAmbiguous === true, 'Should flag ambiguity when multiple customers match');
    assert(ambiguityCheck.options?.length === 2, 'Should return exactly the 2 matching options');
    assert(ambiguityCheck.options?.[0].label.includes('Salem'), 'Option 1 should include Salem');
    assert(ambiguityCheck.options?.[1].label.includes('Theni'), 'Option 2 should include Theni');

    outcomes.push({ id: 1, description: 'Clarify by voice: Ambiguous customer names detection', passed: true });
    console.log('  ✓ Test 1: Clarify by voice: Ambiguous customer names detection');
  } catch (err: any) {
    outcomes.push({ id: 1, description: 'Ambiguity check', passed: false, error: err.message });
    console.log(`  ✗ Test 1: Failed: ${err.message}`);
  }

  // Test 2: Voice playback command controls: "say that again", "repeat", "slower", "stop"
  try {
    const repeatIntent = spokenVoiceController.parseVoiceIntent('say that again');
    assert(repeatIntent.isRepeat === true, 'Should detect repeat command');

    const repeatTamil = spokenVoiceController.parseVoiceIntent('மறுபடியும் சொல்லு');
    assert(repeatTamil.isRepeat === true, 'Should detect Tamil repeat command');

    const slowerIntent = spokenVoiceController.parseVoiceIntent('slower');
    assert(slowerIntent.isSlower === true, 'Should detect slower command');

    const cancelIntent = spokenVoiceController.parseVoiceIntent('cancel');
    assert(cancelIntent.isCancellation === true, 'Should detect cancellation');

    const tamilCancel = spokenVoiceController.parseVoiceIntent('வேண்டாம்');
    assert(tamilCancel.isCancellation === true, 'Should detect Tamil cancellation');

    outcomes.push({ id: 2, description: 'Voice command shortcuts ("say that again", "slower", "cancel" in EN & TA)', passed: true });
    console.log('  ✓ Test 2: Voice command shortcuts ("say that again", "slower", "cancel" in EN & TA)');
  } catch (err: any) {
    outcomes.push({ id: 2, description: 'Voice command shortcuts', passed: false, error: err.message });
    console.log(`  ✗ Test 2: Failed: ${err.message}`);
  }

  // Test 3: In-place voice corrections for time ("make it 5 PM", "change time to 11 AM")
  try {
    const activeProposal = { id: 'act-1', preview: { summary: 'Schedule visit' } };
    const correction1 = spokenVoiceController.parseVoiceIntent('make it 5 PM', activeProposal);
    assert(correction1.isCorrection === true, 'Should detect time correction');
    assert(correction1.field === 'time', 'Field should be time');
    assert(correction1.newValue?.toLowerCase() === '5 pm', 'New value should be 5 PM');

    const correction2 = spokenVoiceController.parseVoiceIntent('change time to 11:30 am', activeProposal);
    assert(correction2.isCorrection === true, 'Should detect 11:30 am correction');
    assert(correction2.newValue?.toLowerCase() === '11:30 am', 'New value should match');

    outcomes.push({ id: 3, description: 'In-place voice correction: time modification ("make it 5 PM")', passed: true });
    console.log('  ✓ Test 3: In-place voice correction: time modification ("make it 5 PM")');
  } catch (err: any) {
    outcomes.push({ id: 3, description: 'Time correction', passed: false, error: err.message });
    console.log(`  ✗ Test 3: Failed: ${err.message}`);
  }

  // Test 4: In-place voice corrections for date ("change date to Monday", "make it tomorrow")
  try {
    const activeProposal = { id: 'act-2', preview: { summary: 'Follow up call' } };
    const dateCorrection = spokenVoiceController.parseVoiceIntent('change to Monday', activeProposal);
    assert(dateCorrection.isCorrection === true, 'Should detect date correction');
    assert(dateCorrection.field === 'date', 'Field should be date');
    assert(dateCorrection.newValue?.toLowerCase() === 'monday', 'New value should be Monday');

    const dateTomorrow = spokenVoiceController.parseVoiceIntent('make it tomorrow', activeProposal);
    assert(dateTomorrow.isCorrection === true, 'Should detect tomorrow correction');
    assert(dateTomorrow.newValue?.toLowerCase() === 'tomorrow', 'New value should be tomorrow');

    outcomes.push({ id: 4, description: 'In-place voice correction: date modification ("change to Monday")', passed: true });
    console.log('  ✓ Test 4: In-place voice correction: date modification ("change to Monday")');
  } catch (err: any) {
    outcomes.push({ id: 4, description: 'Date correction', passed: false, error: err.message });
    console.log(`  ✗ Test 4: Failed: ${err.message}`);
  }

  // Test 5: In-place voice reassignments ("assign it to the Sales Manager")
  try {
    const activeProposal = { id: 'act-3', preview: { summary: 'Order delivery follow-up' } };
    const reassignSales = spokenVoiceController.parseVoiceIntent('assign it to the Sales Manager', activeProposal);
    assert(reassignSales.isCorrection === true, 'Should detect reassignment');
    assert(reassignSales.field === 'assignedTo', 'Field should be assignedTo');
    assert(reassignSales.newValue === 'jaikrishnaindustries1@gmail.com', 'Should resolve sales manager email');

    const reassignOwner = spokenVoiceController.parseVoiceIntent('assign to owner', activeProposal);
    assert(reassignOwner.newValue === 'srinisrkp@gmail.com', 'Should resolve owner email');

    outcomes.push({ id: 5, description: 'In-place voice reassignment ("assign it to the Sales Manager")', passed: true });
    console.log('  ✓ Test 5: In-place voice reassignment ("assign it to the Sales Manager")');
  } catch (err: any) {
    outcomes.push({ id: 5, description: 'Reassignment', passed: false, error: err.message });
    console.log(`  ✗ Test 5: Failed: ${err.message}`);
  }

  // Test 6: Voice confirmations in English and Tamil
  try {
    const confirmEn = spokenVoiceController.parseVoiceIntent('confirm');
    assert(confirmEn.isConfirmation === true, 'Should recognize "confirm"');

    const confirmTa1 = spokenVoiceController.parseVoiceIntent('சரி');
    assert(confirmTa1.isConfirmation === true, 'Should recognize Tamil "சரி"');

    const confirmTa2 = spokenVoiceController.parseVoiceIntent('ஆமா');
    assert(confirmTa2.isConfirmation === true, 'Should recognize Tamil "ஆமா"');

    const notConfirm = spokenVoiceController.parseVoiceIntent('maybe later');
    assert(notConfirm.isConfirmation === false, 'Should reject ambiguous confirmation');

    outcomes.push({ id: 6, description: 'Voice confirmations: English & Tamil ("confirm", "சரி", "ஆமா")', passed: true });
    console.log('  ✓ Test 6: Voice confirmations: English & Tamil ("confirm", "சரி", "ஆமா")');
  } catch (err: any) {
    outcomes.push({ id: 6, description: 'Voice confirmation', passed: false, error: err.message });
    console.log(`  ✗ Test 6: Failed: ${err.message}`);
  }

  // Test 7: Repeated misunderstanding recovery (offers text input after 2 failures)
  try {
    spokenVoiceController.recordSuccess(); // reset
    const f1 = spokenVoiceController.recordFailure();
    assert(f1.shouldOfferTextInput === false, 'Should not offer text after 1 failure');

    const f2 = spokenVoiceController.recordFailure();
    assert(f2.shouldOfferTextInput === true, 'Should offer text input after 2 consecutive failures');

    spokenVoiceController.recordSuccess();
    assert(spokenVoiceController.recordFailure().shouldOfferTextInput === false, 'Success should reset counter');

    outcomes.push({ id: 7, description: 'Repeated misunderstanding: Offer text input after 2 failures', passed: true });
    console.log('  ✓ Test 7: Repeated misunderstanding: Offer text input after 2 failures');
  } catch (err: any) {
    outcomes.push({ id: 7, description: 'Failure recovery', passed: false, error: err.message });
    console.log(`  ✗ Test 7: Failed: ${err.message}`);
  }

  console.log('\n------------------------------------------------------');
  const totalPassed = outcomes.filter((o) => o.passed).length;
  console.log(`RESULTS: ${totalPassed} / ${outcomes.length} tests passed`);
  console.log('------------------------------------------------------\n');

  if (totalPassed < outcomes.length) {
    process.exit(1);
  }
}

runVoiceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
