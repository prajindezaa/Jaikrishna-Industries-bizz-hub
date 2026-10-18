/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MetaAd,
  MetaAdStage,
  MetaAdResults,
  DerivedBusinessOutcome,
  FestivalEvent,
} from '../types';

/**
 * Validates stage transitions based on strict business invariants
 */
export function validateStageTransition(
  ad: Partial<MetaAd>,
  targetStage: MetaAdStage,
  options?: {
    resultsPayload?: Partial<MetaAdResults>;
    cancelReason?: string;
  }
): { isValid: boolean; error?: string } {
  const currentStage = ad.stage || 'Pending';

  if (targetStage === currentStage) {
    return { isValid: true };
  }

  // Any stage can transition to Cancelled provided a cancellation reason is recorded
  if (targetStage === 'Cancelled') {
    const reason = options?.cancelReason?.trim() || ad.cancelReason?.trim();
    if (!reason) {
      return {
        isValid: false,
        error: 'Please enter a cancellation reason to cancel this ad.',
      };
    }
    return { isValid: true };
  }

  // 1. Pending -> Published
  if (targetStage === 'Published') {
    if (currentStage !== 'Pending') {
      return {
        isValid: false,
        error: `Cannot publish an ad that is currently in '${currentStage}' status. Only Pending ads can be Published.`,
      };
    }
    if (!ad.name?.trim()) {
      return { isValid: false, error: 'Ad Name is required before publishing.' };
    }
    if (!ad.goal?.trim()) {
      return { isValid: false, error: 'Campaign Goal / Objective is required before publishing.' };
    }
    if (!ad.placements || ad.placements.length === 0) {
      return { isValid: false, error: 'Please select at least one ad placement (e.g., Instagram Feed, Facebook Stories).' };
    }
    const hasDaily = (ad.dailyBudget ?? 0) > 0;
    const hasTotal = (ad.totalBudget ?? 0) > 0;
    if (!hasDaily && !hasTotal) {
      return { isValid: false, error: 'Please specify either a Daily Budget (₹) or Total Budget (₹) greater than 0.' };
    }
    if (!ad.plannedStart) {
      return { isValid: false, error: 'Ad Start Date & Time is required.' };
    }
    if (!ad.plannedEnd) {
      return { isValid: false, error: 'Ad End Date & Time is required.' };
    }
    if (new Date(ad.plannedEnd) <= new Date(ad.plannedStart)) {
      return { isValid: false, error: 'End Date & Time must be later than Start Date & Time.' };
    }
    if (!ad.creatives || ad.creatives.length === 0) {
      return { isValid: false, error: 'Please upload at least one creative image before publishing.' };
    }
    return { isValid: true };
  }

  // 2. Published -> Waiting for result
  if (targetStage === 'Waiting for result') {
    if (currentStage !== 'Published') {
      return {
        isValid: false,
        error: `Only Published live ads can move to 'Waiting for result'. Currently: '${currentStage}'.`,
      };
    }
    return { isValid: true };
  }

  // 3. Waiting for result -> Fulfilled
  if (targetStage === 'Fulfilled') {
    if (currentStage !== 'Waiting for result') {
      return {
        isValid: false,
        error: `Only ads in 'Waiting for result' can be fulfilled with verified Meta results. Currently: '${currentStage}'.`,
      };
    }

    const res = options?.resultsPayload || ad.results;
    if (!res) {
      return {
        isValid: false,
        error: 'The complete Results Form must be filled before moving this ad to Fulfilled.',
      };
    }

    // Spend validations
    if (res.totalSpent === undefined || res.totalSpent === null || res.totalSpent < 0) {
      return { isValid: false, error: 'Total Spend (₹) must be 0 or greater.' };
    }

    // Reach validations
    if (res.views !== null && res.views !== undefined && res.views < 0) {
      return { isValid: false, error: 'Views (Impressions) must be 0 or greater.' };
    }
    if (res.viewers !== null && res.viewers !== undefined && res.viewers < 0) {
      return { isValid: false, error: 'Viewers (Reach) must be 0 or greater.' };
    }
    if (
      res.viewers !== null &&
      res.viewers !== undefined &&
      res.views !== null &&
      res.views !== undefined &&
      res.viewers > res.views &&
      res.views > 0
    ) {
      return { isValid: false, error: 'Viewers (Reach) cannot exceed total Views (Impressions).' };
    }

    // Messaging validations
    if (res.conversations !== null && res.conversations !== undefined && res.conversations < 0) {
      return { isValid: false, error: 'Messaging conversations started must be 0 or greater.' };
    }

    // Audience percentage checks (if provided)
    if (res.audienceAge && Object.keys(res.audienceAge).length > 0) {
      const ageValid = validatePercentages(res.audienceAge, 'Age groups');
      if (!ageValid.isValid) return ageValid;
    }

    if (res.audienceGender && Object.keys(res.audienceGender).length > 0) {
      const genderValid = validatePercentages(res.audienceGender, 'Gender split');
      if (!genderValid.isValid) return genderValid;
    }

    if (res.audiencePlaces && Object.keys(res.audiencePlaces).length > 0) {
      const placesValid = validatePercentages(res.audiencePlaces, 'Top places');
      if (!placesValid.isValid) return placesValid;
    }

    return { isValid: true };
  }

  return { isValid: false, error: `Invalid stage transition from '${currentStage}' to '${targetStage}'.` };
}

/**
 * Validates that percentage splits sum to 100% within acceptable 1% rounding tolerance
 */
export function validatePercentages(
  dist: Record<string, number>,
  label: string
): { isValid: boolean; error?: string; sum: number } {
  const values = Object.values(dist);
  if (values.length === 0) {
    return { isValid: true, sum: 0 };
  }

  for (const v of values) {
    if (v < 0) {
      return { isValid: false, error: `${label} percentages cannot be negative.`, sum: 0 };
    }
  }

  const sum = values.reduce((a, b) => a + (Number(b) || 0), 0);
  const roundedSum = Math.round(sum * 10) / 10;

  // Allow 99.0% - 101.0% to gracefully tolerate integer rounding splits (e.g. 33.3 + 33.3 + 33.3 = 99.9)
  if (roundedSum < 99.0 || roundedSum > 101.0) {
    return {
      isValid: false,
      error: `${label} percentages must sum to 100% (current sum: ${roundedSum}%).`,
      sum: roundedSum,
    };
  }

  return { isValid: true, sum: roundedSum };
}

/**
 * Derived metrics calculations with zero-division safety and null-awareness
 */
export function calculateCostPerConversation(
  totalSpent: number | null | undefined,
  conversations: number | null | undefined
): number | null {
  if (conversations === null || conversations === undefined || totalSpent === null || totalSpent === undefined) {
    return null;
  }
  if (conversations <= 0) return 0;
  return Math.round((totalSpent / conversations) * 100) / 100;
}

export function calculateFrequency(
  views: number | null | undefined,
  viewers: number | null | undefined
): number | null {
  if (views === null || views === undefined || viewers === null || viewers === undefined) {
    return null;
  }
  if (viewers <= 0) return 0;
  return Math.round((views / viewers) * 100) / 100;
}

export function calculateCtr(
  linkClicks: number | null | undefined,
  views: number | null | undefined
): number | null {
  if (linkClicks === null || linkClicks === undefined || views === null || views === undefined) {
    return null;
  }
  if (views <= 0) return 0;
  return Math.round(((linkClicks / views) * 100) * 100) / 100;
}

export function calculateRoi(
  revenue: number | null | undefined,
  totalSpent: number | null | undefined
): number | null {
  if (revenue === null || revenue === undefined || totalSpent === null || totalSpent === undefined) {
    return null;
  }
  if (totalSpent <= 0) return 0;
  return Math.round((((revenue - totalSpent) / totalSpent) * 100) * 10) / 10;
}

export function calculateCostPerCustomer(
  totalSpent: number | null | undefined,
  customersCount: number | null | undefined
): number | null {
  if (totalSpent === null || totalSpent === undefined || customersCount === null || customersCount === undefined) {
    return null;
  }
  if (customersCount <= 0) return 0;
  return Math.round((totalSpent / customersCount) * 100) / 100;
}

export function calculateCostPerOrder(
  totalSpent: number | null | undefined,
  ordersCount: number | null | undefined
): number | null {
  if (totalSpent === null || totalSpent === undefined || ordersCount === null || ordersCount === undefined) {
    return null;
  }
  if (ordersCount <= 0) return 0;
  return Math.round((totalSpent / ordersCount) * 100) / 100;
}

/**
 * Format metric or render em-dash for "Not recorded"
 */
export function formatMetricOrDash(
  val: number | null | undefined,
  formatter: (num: number) => string = (n) => formatIndianNumber(n)
): string {
  if (val === null || val === undefined) {
    return '—';
  }
  return formatter(val);
}

/**
 * Indian Rupee and numbering formatters
 */
export function formatINR(amount: number | null | undefined, showDecimals: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(abs);

  return isNegative ? `-${formatted}` : formatted;
}

export function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Suggest-ahead helper for festival ad preparation
 * Default preparation window: 14 days before festival
 */
export function getPreparationStartDate(
  festivalDateStr: string,
  leadDays: number = 14
): { prepDate: string; daysRemaining: number; isDue: boolean; formattedPrepDate: string } {
  const fest = new Date(festivalDateStr);
  const prep = new Date(fest);
  prep.setDate(fest.getDate() - leadDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = fest.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const prepDateISO = prep.toISOString().split('T')[0];
  const isDue = daysRemaining <= leadDays && daysRemaining >= 0;

  return {
    prepDate: prepDateISO,
    daysRemaining,
    isDue,
    formattedPrepDate: prep.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  };
}

/**
 * Parses Indian number formats like "1,50,000", "₹1,50,000.50", "150000", or returns null if empty
 */
export function parseIndianNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str || str === '—' || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'not recorded') {
    return null;
  }
  const cleaned = str.replace(/[₹,%\s]/g, '');
  const num = Number(cleaned);
  if (isNaN(num)) return null;
  return num;
}

/**
 * Parses dates accepting DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO, etc.
 * Rejects ambiguous or invalid dates.
 */
export function parseFlexibleDate(val: any): { dateISO: string | null; error?: string } {
  if (val === null || val === undefined) return { dateISO: null };
  const str = String(val).trim();
  if (!str) return { dateISO: null };

  // 1. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { dateISO: null, error: `Invalid date format: day ${day}, month ${month} in "${str}". Expected valid DD/MM/YYYY.` };
    }
    const d = new Date(Date.UTC(year, month - 1, day, hours, mins));
    if (isNaN(d.getTime())) {
      return { dateISO: null, error: `Invalid calendar date in "${str}".` };
    }
    return { dateISO: d.toISOString() };
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const mins = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { dateISO: null, error: `Invalid date format: day ${day}, month ${month} in "${str}". Expected valid YYYY-MM-DD.` };
    }
    const d = new Date(Date.UTC(year, month - 1, day, hours, mins));
    if (isNaN(d.getTime())) {
      return { dateISO: null, error: `Invalid calendar date in "${str}".` };
    }
    return { dateISO: d.toISOString() };
  }

  // 3. Fallback standard Date.parse
  const parsedMs = Date.parse(str);
  if (!isNaN(parsedMs)) {
    return { dateISO: new Date(parsedMs).toISOString() };
  }

  return { dateISO: null, error: `Unrecognized date format: "${str}". Please use DD/MM/YYYY or YYYY-MM-DD.` };
}

/**
 * Validates a Past Ad directly to be saved as Fulfilled (or draft)
 */
export function validatePastAd(
  ad: Partial<MetaAd>,
  existingAds: MetaAd[] = [],
  isDraft: boolean = false
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate?: boolean;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // If saving as draft, skip all hard validation checks except name
  if (isDraft) {
    if (!ad.name?.trim()) {
      errors.push('Ad Name is required even for drafts.');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  // Required fields for Fulfilled Past Ad:
  // only ad name, start date, end date, and total spent
  if (!ad.name?.trim()) {
    errors.push('Ad Name is required.');
  }

  if (!ad.plannedStart) {
    errors.push('Start Date & Time is required.');
  }

  if (!ad.plannedEnd) {
    errors.push('End Date & Time is required.');
  }

  const nowMs = new Date().getTime();

  if (ad.plannedStart && ad.plannedEnd) {
    const startMs = new Date(ad.plannedStart).getTime();
    const endMs = new Date(ad.plannedEnd).getTime();

    if (endMs <= startMs) {
      errors.push('End Date & Time must be strictly later than Start Date & Time.');
    }

    // The end must NOT be in the future (Past ad requirement)
    if (endMs > nowMs) {
      errors.push('Past ads cannot end in the future. End date must be on or before today.');
    }
  }

  const totalSpent = ad.results?.totalSpent ?? ad.totalBudget;
  if (totalSpent === null || totalSpent === undefined) {
    errors.push('Total Spent (₹) is required for completed past ads.');
  } else if (totalSpent < 0) {
    errors.push('Total Spent cannot be negative.');
  }

  // Non-negative checks on optional numbers
  const res = ad.results;
  if (res) {
    if (res.conversations !== null && res.conversations !== undefined && res.conversations < 0) {
      errors.push('Messaging conversations cannot be negative.');
    }
    if (res.views !== null && res.views !== undefined && res.views < 0) {
      errors.push('Views cannot be negative.');
    }
    if (res.viewers !== null && res.viewers !== undefined && res.viewers < 0) {
      errors.push('Viewers cannot be negative.');
    }
    if (res.linkClicks !== null && res.linkClicks !== undefined && res.linkClicks < 0) {
      errors.push('Link clicks cannot be negative.');
    }

    // Warnings
    const engagements = res.engagements ?? 0;
    const subEngagements = (res.reactions ?? 0) + (res.comments ?? 0) + (res.shares ?? 0) + (res.saves ?? 0);
    if (subEngagements > engagements && engagements > 0) {
      warnings.push(`Sum of reactions, comments, shares, and saves (${subEngagements}) exceeds total post engagements (${engagements}).`);
    }

    if (res.linkClicks !== null && res.linkClicks !== undefined && res.views !== null && res.views !== undefined) {
      if (res.linkClicks > res.views && res.views > 0) {
        warnings.push(`Link clicks (${res.linkClicks}) exceeds total views (${res.views}).`);
      }
    }

    // Percentages: if group is provided, must total 100%
    if (res.audienceAge && Object.keys(res.audienceAge).length > 0) {
      const p = validatePercentages(res.audienceAge, 'Age groups split');
      if (!p.isValid) errors.push(p.error || 'Age split must total 100%.');
    }
    if (res.audienceGender && Object.keys(res.audienceGender).length > 0) {
      const p = validatePercentages(res.audienceGender, 'Gender split');
      if (!p.isValid) errors.push(p.error || 'Gender split must total 100%.');
    }
    if (res.audiencePlaces && Object.keys(res.audiencePlaces).length > 0) {
      const p = validatePercentages(res.audiencePlaces, 'Top places split');
      if (!p.isValid) errors.push(p.error || 'Top places split must total 100%.');
    }
  }

  // Duplicate detection: warn if another ad has the same name and overlapping dates
  let isDuplicate = false;
  if (ad.name && ad.plannedStart && ad.plannedEnd) {
    const cleanName = ad.name.trim().toLowerCase();
    const startMs = new Date(ad.plannedStart).getTime();
    const endMs = new Date(ad.plannedEnd).getTime();

    const existingMatch = existingAds.find((other) => {
      if (other.id === ad.id || other.isDeleted) return false;
      if (other.name.trim().toLowerCase() !== cleanName) return false;
      const otherStart = new Date(other.plannedStart).getTime();
      const otherEnd = new Date(other.plannedEnd).getTime();
      // Overlap condition
      return startMs <= otherEnd && endMs >= otherStart;
    });

    if (existingMatch) {
      isDuplicate = true;
      warnings.push(`Another ad named "${existingMatch.name}" already ran between ${existingMatch.plannedStart.slice(0, 10)} and ${existingMatch.plannedEnd.slice(0, 10)}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    isDuplicate,
  };
}

/**
 * Calculates average of a metric across ads, strictly ignoring nulls.
 * Returns both the average and the count of ads included ("based on 4 of 6 ads").
 */
export function calculateAverageMetric(
  ads: MetaAd[],
  getter: (ad: MetaAd) => number | null | undefined
): { average: number | null; count: number; totalAds: number; note: string } {
  let sum = 0;
  let count = 0;

  for (const ad of ads) {
    if (ad.isDeleted || ad.isDraft) continue;
    const val = getter(ad);
    if (val !== null && val !== undefined && !isNaN(val)) {
      sum += val;
      count++;
    }
  }

  const validAdsTotal = ads.filter((a) => !a.isDeleted && !a.isDraft).length;
  const average = count > 0 ? Math.round((sum / count) * 100) / 100 : null;

  return {
    average,
    count,
    totalAds: validAdsTotal,
    note: count > 0 ? `Based on ${count} of ${validAdsTotal} ads` : 'No recorded data',
  };
}

/**
 * Meta Ads Manager CSV/Excel row mapper
 */
export function parseMetaAdsExportData(headers: string[], row: any[]): Partial<MetaAdResults> {
  const map: Record<string, any> = {};
  headers.forEach((h, idx) => {
    const cleanKey = h.trim().toLowerCase();
    map[cleanKey] = row[idx];
  });

  const getNum = (possibleKeys: string[]): number | null => {
    for (const key of possibleKeys) {
      if (map[key] !== undefined && map[key] !== '') {
        const val = String(map[key]).replace(/[₹,]/g, '').trim();
        const num = parseFloat(val);
        if (!isNaN(num)) return num;
      }
    }
    return null;
  };

  const views = getNum(['impressions', 'views']);
  const viewers = getNum(['reach', 'viewers']);
  const totalSpent = getNum(['amount spent (inr)', 'amount spent', 'spend', 'total spent', 'cost']);
  const conversations = getNum([
    'messaging conversations started',
    'messaging conversations',
    'conversations',
    'results',
  ]);
  const linkClicks = getNum(['link clicks', 'clicks (all)', 'clicks']);
  const postEngagements = getNum(['post engagements', 'engagements']);
  const postReactions = getNum(['post reactions', 'reactions']);
  const postComments = getNum(['post comments', 'comments']);
  const postShares = getNum(['post shares', 'shares']);
  const postSaves = getNum(['post saves', 'saves']);

  const costPerConv = calculateCostPerConversation(totalSpent, conversations);
  const frequency = calculateFrequency(views, viewers);
  const ctr = calculateCtr(linkClicks, views);

  return {
    views,
    viewers,
    frequency,
    totalSpent,
    conversations,
    costPerConversation: costPerConv,
    linkClicks,
    ctr,
    engagements: postEngagements,
    reactions: postReactions,
    comments: postComments,
    shares: postShares,
    saves: postSaves,
    audienceAge: null,
    audienceGender: null,
    audiencePlaces: null,
  };
}
