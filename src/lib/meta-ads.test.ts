/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  validateStageTransition,
  validatePercentages,
  calculateCostPerConversation,
  calculateFrequency,
  calculateCtr,
  calculateRoi,
  calculateCostPerCustomer,
  calculateCostPerOrder,
  getPreparationStartDate,
  formatINR,
  formatIndianNumber,
  parseMetaAdsExportData,
} from './meta-ads-utils';
import { MetaAd, MetaAdResults } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

console.log('--- Testing Stage Transitions ---');

// Test 1: Pending -> Published without required fields fails
const incompletePendingAd: Partial<MetaAd> = {
  name: '',
  stage: 'Pending',
  creatives: [],
  placements: [],
  dailyBudget: 0,
  plannedStart: '',
  plannedEnd: '',
};

const v1 = validateStageTransition(incompletePendingAd, 'Published');
assert(!v1.isValid, 'Pending -> Published without required fields is invalid');
assert(Boolean(v1.error), `Has descriptive error: "${v1.error}"`);

// Test 2: Pending -> Published with all required fields succeeds
const completePendingAd: Partial<MetaAd> = {
  name: 'Deepavali Camphor 2026',
  stage: 'Pending',
  goal: 'Messages/Conversations',
  placements: ['Facebook Feed', 'Instagram Feed'],
  dailyBudget: 500,
  plannedStart: '2026-10-20T09:00',
  plannedEnd: '2026-10-25T21:00',
  creatives: [{
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    name: 'sample.jpg',
  }],
};

const v2 = validateStageTransition(completePendingAd, 'Published');
assert(v2.isValid, 'Pending -> Published with all required fields is valid');

// Test 3: Published -> Waiting for result is always allowed
const publishedAd: Partial<MetaAd> = {
  ...completePendingAd,
  stage: 'Published',
};
const v3 = validateStageTransition(publishedAd, 'Waiting for result');
assert(v3.isValid, 'Published -> Waiting for result is allowed');

// Test 4: Waiting for result -> Fulfilled requires valid results
const waitingAd: Partial<MetaAd> = {
  ...completePendingAd,
  stage: 'Waiting for result',
};
const v4NoResults = validateStageTransition(waitingAd, 'Fulfilled');
assert(!v4NoResults.isValid, 'Waiting for result -> Fulfilled without results is invalid');

const mockResults: MetaAdResults = {
  conversations: 42,
  costPerConversation: 35.7,
  views: 12500,
  viewers: 9400,
  frequency: 1.33,
  audienceAge: { '18-24': 10, '25-34': 40, '35-54': 35, '55+': 15 },
  audienceGender: { Men: 65, Women: 35 },
  audiencePlaces: { Madurai: 50, Chennai: 30, Coimbatore: 20 },
  totalSpent: 1500,
  dailyBudget: 500,
  actualDuration: 3,
  actualStart: '2026-10-20T09:00',
  actualEnd: '2026-10-23T09:00',
  engagements: 380,
  reactions: 240,
  comments: 45,
  shares: 60,
  saves: 35,
  linkClicks: 280,
  ctr: 2.24,
  rating: 5,
  lessons: 'Carousel ad with WhatsApp click-to-chat yielded high conversion.',
};

const v4WithResults = validateStageTransition(waitingAd, 'Fulfilled', { resultsPayload: mockResults });
assert(v4WithResults.isValid, 'Waiting for result -> Fulfilled with valid results is valid');

// Test 5: Cancellation from any stage requires reason
const v5NoReason = validateStageTransition(publishedAd, 'Cancelled');
assert(!v5NoReason.isValid, 'Cancellation without reason is invalid');

const v5WithReason = validateStageTransition(publishedAd, 'Cancelled', { cancelReason: 'Meta account billing lock' });
assert(v5WithReason.isValid, 'Cancellation with reason is valid');

// Test 6: Invalid stage skip
const v6InvalidSkip = validateStageTransition(completePendingAd, 'Fulfilled');
assert(!v6InvalidSkip.isValid, 'Direct jump from Pending to Fulfilled is prohibited');

console.log('\n--- Testing Percentage Split Validation ---');
const validSplit = { Men: 60, Women: 40 };
assert(validatePercentages(validSplit, 'Gender').isValid, 'Split totaling 100% is valid');

const invalidSplit = { Men: 50, Women: 40 };
assert(!validatePercentages(invalidSplit, 'Gender').isValid, 'Split totaling 90% is invalid');

console.log('\n--- Testing Derived Metrics ---');
assert(calculateCostPerConversation(1500, 30) === 50, 'Cost per conversation = 1500 / 30 = 50');
assert(calculateCostPerConversation(1500, 0) === 0, 'Cost per conversation handles division by 0');
assert(calculateFrequency(12000, 8000) === 1.5, 'Frequency = 12000 / 8000 = 1.5');
assert(calculateCtr(250, 10000) === 2.5, 'CTR = (250 / 10000) * 100 = 2.5%');
assert(calculateRoi(50000, 10000) === 400, 'ROI = ((50000 - 10000) / 10000) * 100 = 400%');
assert(calculateCostPerCustomer(10000, 20) === 500, 'Cost per customer = 10000 / 20 = 500');
assert(calculateCostPerOrder(10000, 50) === 200, 'Cost per order = 10000 / 50 = 200');

console.log('\n--- Testing Festival Suggest-Ahead Helper ---');
const prep = getPreparationStartDate('2026-11-01', 14);
assert(prep.prepDate === '2026-10-18', 'Suggests start preparing on 2026-10-18 for festival on 2026-11-01 (14 days ahead)');

console.log('\n--- Testing Indian Currency & Number Formatters ---');
assert(formatINR(125000).replace(/\s/g, ' ').includes('1,25,000'), 'formatINR(125000) formats with Lakhs separator');
assert(formatINR(67.44, true).includes('67.44'), 'formatINR with decimals retains decimals');
assert(formatIndianNumber(54321) === '54,321', 'formatIndianNumber(54321) formats correctly');

console.log('\n--- Testing Meta Ads Manager CSV Import Parser ---');
const headers = [
  'Campaign Name',
  'Amount Spent (INR)',
  'Messaging Conversations Started',
  'Impressions',
  'Reach',
  'Link Clicks',
];
const row = ['Deepavali Camphor 2026', '2500.00', '75', '24500', '18200', '540'];

const parsed = parseMetaAdsExportData(headers, row);
assert(parsed.totalSpent === 2500, 'Parsed total spent = 2500');
assert(parsed.conversations === 75, 'Parsed conversations = 75');
assert(parsed.views === 24500, 'Parsed impressions = 24500');
assert(parsed.viewers === 18200, 'Parsed reach = 18200');
assert(parsed.linkClicks === 540, 'Parsed link clicks = 540');
assert(parsed.costPerConversation === 33.33, 'Calculated cost per conversation = 33.33');
assert(parsed.frequency === 1.35, 'Calculated frequency = 1.35');
assert(parsed.ctr === 2.2, 'Calculated CTR = 2.2%');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Meta Ads tests passed successfully!');
}
