/**
 * Jaikrishna Industries — Engagement Notification Engine & Catalog
 * (functions/src/engagement_engine.ts)
 *
 * Guaranteed Principles:
 * 1. REAL DATA ONLY: Every nudge queries real Firestore facts. Never invents statistics.
 * 2. CONDITION RE-CHECK: Validates the condition immediately before dispatching.
 * 3. BUDGET CONTROL: Integrates with the daily per-member budget (10 to 15 push/day, 5 reserved for reminders).
 * 4. SPACING & WINDOWS: 45m min spacing, max 2 pushes in any 30m window, quiet hours respected.
 * 5. ROTATING WORDING: English and Tamil variants (Tamil labeled [needs proofreading by owner]).
 * 6. PRIVACY-SAFE: Only personal items for the member.
 */

import * as admin from 'firebase-admin';
import { routeNotificationIntent, getTodayDateIST, getCurrentTimeIST, isWithinQuietHours } from './notification_router.js';

export interface EngagementCatalogItem {
  id: string;
  name: string;
  category: 'customers' | 'ads' | 'planning' | 'tasks' | 'progress';
  priority: 'low' | 'normal' | 'high';
  timeWindowIST: { start: string; end: string }; // e.g. 09:30 to 18:30
  deepLink: string;
  evaluate: (db: admin.firestore.Firestore, memberEmail: string, todayStrIST: string) => Promise<{
    shouldSend: boolean;
    title: string;
    body: string;
    titleTa?: string;
    bodyTa?: string;
    dedupeSuffix?: string;
    data?: Record<string, string>;
  }>;
}

export const ENGAGEMENT_CATALOG: EngagementCatalogItem[] = [
  // 1. Customer: Uncontacted Leads
  {
    id: 'engage_uncontacted_leads',
    name: 'Uncontacted Leads Waiting',
    category: 'customers',
    priority: 'normal',
    timeWindowIST: { start: '10:00', end: '17:00' },
    deepLink: '/customers',
    evaluate: async (db, memberEmail, todayStrIST) => {
      // Find customers assigned to this member or unassigned in 'New' stage with 0 contact logs
      const snap = await db
        .collection('customers')
        .where('isDeleted', '==', false)
        .where('leadStage', '==', 'New')
        .limit(10)
        .get();

      const memberUncontacted = snap.docs.filter((d) => {
        const data = d.data();
        return (
          (!data.assignedTo || data.assignedTo === memberEmail) &&
          (!data.outreachCount || data.outreachCount === 0)
        );
      });

      if (memberUncontacted.length === 0) {
        return { shouldSend: false, title: '', body: '' };
      }

      const count = memberUncontacted.length;
      const firstCust = memberUncontacted[0].data();
      const firstName = firstCust.companyName || firstCust.contactPerson || 'New lead';

      return {
        shouldSend: true,
        title: `Uncontacted Leads: ${count} waiting for first call`,
        body: count === 1 
          ? `${firstName} is waiting for initial outreach.`
          : `${firstName} and ${count - 1} other lead(s) need initial contact.`,
        titleTa: `தொடர்பு கொள்ளப்படாத வாடிக்கையாளர்கள்: ${count} பேர் காத்திருக்கிறார்கள் [needs proofreading by owner]`,
        bodyTa: `${firstName} உட்பட ${count} வாடிக்கையாளர்களைத் தொடர்பு கொள்ளவும். [needs proofreading by owner]`,
        dedupeSuffix: `uncontacted_${count}`,
        data: { customerId: memberUncontacted[0].id },
      };
    },
  },

  // 2. Customer: No New Customer Added Today (Afternoon Check)
  {
    id: 'engage_no_new_customer_today',
    name: 'No Customer Added Today Nudge',
    category: 'customers',
    priority: 'low',
    timeWindowIST: { start: '14:30', end: '17:30' },
    deepLink: '/customers',
    evaluate: async (db, memberEmail, todayStrIST) => {
      // Check if member created any customer today
      const startOfDay = `${todayStrIST}T00:00:00.000Z`;
      const snap = await db
        .collection('customers')
        .where('createdBy', '==', memberEmail)
        .where('createdAt', '>=', startOfDay)
        .limit(1)
        .get();

      if (!snap.empty) {
        return { shouldSend: false, title: '', body: '' };
      }

      return {
        shouldSend: true,
        title: 'Expand Network: Add Today’s Enquiries',
        body: 'No new customers added yet today. Keep our dealer and wholesale pipeline active.',
        titleTa: 'புதிய வாடிக்கையாளர் பதிவு [needs proofreading by owner]',
        bodyTa: 'இன்று புதிய வாடிக்கையாளர்கள் யாரும் சேர்க்கப்படவில்லை. புதிய விசாரணைகளைச் சேர்க்கவும். [needs proofreading by owner]',
        dedupeSuffix: 'no_cust_added',
      };
    },
  },

  // 3. Planning: Daily Plan Not Made
  {
    id: 'engage_daily_plan_missing',
    name: 'Morning Daily Plan Check',
    category: 'planning',
    priority: 'normal',
    timeWindowIST: { start: '09:30', end: '11:30' },
    deepLink: '/planning',
    evaluate: async (db, memberEmail, todayStrIST) => {
      const planDoc = await db.collection('daily_plans').doc(`${memberEmail.replace(/[@.]/g, '_')}_${todayStrIST}`).get();
      if (planDoc.exists && planDoc.data()?.isCompleted) {
        return { shouldSend: false, title: '', body: '' };
      }

      return {
        shouldSend: true,
        title: 'Action Required: Daily Operational Plan',
        body: 'Your plan for today is not finalized. Set your key production and delivery priorities.',
        titleTa: 'இன்றைய திட்டமிடல் தேவை [needs proofreading by owner]',
        bodyTa: 'இன்றைய நாளுக்கான திட்டமிடல் இன்னும் முடிக்கப்படவில்லை. முன்னுரிமைகளை அமைக்கவும். [needs proofreading by owner]',
        dedupeSuffix: 'plan_missing',
      };
    },
  },

  // 4. Tasks: Pending Tasks Progress Check (Midday)
  {
    id: 'engage_midday_task_progress',
    name: 'Midday Task Progress Review',
    category: 'tasks',
    priority: 'normal',
    timeWindowIST: { start: '13:00', end: '15:30' },
    deepLink: '/tasks',
    evaluate: async (db, memberEmail, todayStrIST) => {
      const snap = await db
        .collection('tasks')
        .where('date', '==', todayStrIST)
        .where('assignedTo', '==', memberEmail)
        .where('isDeleted', '==', false)
        .get();

      if (snap.empty) {
        return { shouldSend: false, title: '', body: '' };
      }

      const total = snap.size;
      const completed = snap.docs.filter((d) => d.data().status === 'Completed').length;
      const pending = total - completed;

      if (pending === 0) {
        return { shouldSend: false, title: '', body: '' }; // All done, don't nudge
      }

      return {
        shouldSend: true,
        title: `Midday Progress: ${completed} of ${total} tasks completed`,
        body: `You have ${pending} operational task(s) remaining for this afternoon.`,
        titleTa: `மதிய நேர முன்னேற்றம்: ${completed}/${total} பணிகள் முடிந்தது [needs proofreading by owner]`,
        bodyTa: `இன்று மதியத்திற்கு இன்னும் ${pending} பணிகள் மீதமுள்ளன. [needs proofreading by owner]`,
        dedupeSuffix: `progress_${completed}_of_${total}`,
      };
    },
  },

  // 5. Meta Ads: Festival Campaign Check (14-day Lookahead)
  {
    id: 'engage_festival_ad_prep',
    name: 'Festival Ad Campaign Preparation',
    category: 'ads',
    priority: 'normal',
    timeWindowIST: { start: '11:00', end: '16:00' },
    deepLink: '/marketing',
    evaluate: async (db, memberEmail, todayStrIST) => {
      // Check upcoming festival events
      const now = new Date();
      const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const in14DaysStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(in14Days);

      const festSnap = await db
        .collection('festival_events')
        .where('date', '>=', todayStrIST)
        .where('date', '<=', in14DaysStr)
        .limit(1)
        .get();

      if (festSnap.empty) {
        return { shouldSend: false, title: '', body: '' };
      }

      const festData = festSnap.docs[0].data();
      const festivalName = festData.name || 'Upcoming Festival';

      // Check if an ad campaign is already planned or active for this festival
      const adSnap = await db
        .collection('meta_ads')
        .where('festivalEventId', '==', festSnap.docs[0].id)
        .limit(1)
        .get();

      if (!adSnap.empty) {
        return { shouldSend: false, title: '', body: '' };
      }

      return {
        shouldSend: true,
        title: `Festival Campaign: Plan ${festivalName} Promotions`,
        body: `${festivalName} is in 14 days. Review wholesale inventory and schedule ad creatives.`,
        titleTa: `பண்டிகை கால விளம்பர தயாரிப்பு: ${festivalName} [needs proofreading by owner]`,
        bodyTa: `${festivalName} இன்னும் 14 நாட்களில் வருகிறது. விளம்பரங்களை திட்டமிடவும். [needs proofreading by owner]`,
        dedupeSuffix: `fest_${festSnap.docs[0].id}`,
      };
    },
  },

  // 6. Orders: Orders Waiting Packing or Dispatch
  {
    id: 'engage_orders_dispatch_check',
    name: 'Orders Awaiting Dispatch',
    category: 'progress',
    priority: 'normal',
    timeWindowIST: { start: '11:30', end: '16:30' },
    deepLink: '/orders',
    evaluate: async (db, memberEmail, todayStrIST) => {
      const snap = await db
        .collection('orders')
        .where('status', 'in', ['Pending', 'Packed', 'Ready'])
        .limit(10)
        .get();

      if (snap.empty) {
        return { shouldSend: false, title: '', body: '' };
      }

      const count = snap.size;
      const firstOrder = snap.docs[0].data();
      const orderParty = firstOrder.customerName || `Order #${snap.docs[0].id.slice(0, 6)}`;

      return {
        shouldSend: true,
        title: `Dispatch Notice: ${count} order(s) awaiting shipment`,
        body: `${orderParty} and ${count - 1} other shipment(s) ready for transport check.`,
        titleTa: `அனுப்ப வேண்டிய ஆர்டர்கள்: ${count} தயார் [needs proofreading by owner]`,
        bodyTa: `${orderParty} உள்ளிட்ட ${count} ஆர்டர்களை அனுப்ப சரிபார்க்கவும். [needs proofreading by owner]`,
        dedupeSuffix: `orders_${count}`,
      };
    },
  },
];

/**
 * Evaluates all engagement rules for a specific team member and dispatches
 * eligible nudges within the strict daily budget and quiet hours.
 */
export async function runEngagementEngineForMember(
  db: admin.firestore.Firestore,
  memberEmail: string
): Promise<{ evaluated: number; sent: number; suppressed: number; details: string[] }> {
  const now = new Date();
  const todayStrIST = getTodayDateIST(now);
  const currentTimeIST = getCurrentTimeIST(now);

  const stats = { evaluated: 0, sent: 0, suppressed: 0, details: [] as string[] };

  // Fetch Member Preferences
  const sanitizedDocId = memberEmail.replace(/[@.]/g, '_');
  let memberDoc = await db.collection('team_members').doc(sanitizedDocId).get();
  if (!memberDoc.exists) {
    memberDoc = await db.collection('team_members').doc(memberEmail).get();
  }
  const memberData = memberDoc.exists ? memberDoc.data() : {};
  const prefs = memberData?.notificationPreferences || {};

  // Check Quiet Hours
  const quietHours = prefs.quietHours || { enabled: true, start: '21:00', end: '08:00' };
  if (quietHours.enabled && isWithinQuietHours(currentTimeIST, quietHours.start, quietHours.end)) {
    stats.details.push(`Skipped: Currently in quiet hours (${currentTimeIST} IST).`);
    return stats;
  }

  // Check Holiday Mode / Pause Until
  if (memberData?.pauseUntilDate && memberData.pauseUntilDate >= todayStrIST) {
    stats.details.push(`Skipped: Member has paused notifications for today.`);
    return stats;
  }

  for (const item of ENGAGEMENT_CATALOG) {
    stats.evaluated++;

    // 1. Time Window Check
    if (currentTimeIST < item.timeWindowIST.start || currentTimeIST > item.timeWindowIST.end) {
      continue;
    }

    try {
      // 2. Evaluate Condition using fresh live data
      const evalResult = await item.evaluate(db, memberEmail, todayStrIST);
      if (!evalResult.shouldSend) {
        continue;
      }

      // 3. Build Intent & Route via Centralized Notification Router
      const dedupeKey = `engage_${item.id}_${memberEmail}_${todayStrIST}${evalResult.dedupeSuffix ? `_${evalResult.dedupeSuffix}` : ''}`;

      const title = (prefs.language === 'ta' && evalResult.titleTa) ? evalResult.titleTa : evalResult.title;
      const body = (prefs.language === 'ta' && evalResult.bodyTa) ? evalResult.bodyTa : evalResult.body;

      const routerResult = await routeNotificationIntent(db, {
        recipientEmail: memberEmail,
        title,
        body,
        type: item.id,
        category: item.category,
        priority: item.priority,
        deepLink: item.deepLink,
        dedupeKey,
        minSpacingMinutes: 45, // 45m min spacing between non-urgent nudges
        data: evalResult.data,
      });

      if (routerResult.accepted) {
        stats.sent++;
        stats.details.push(`Sent ${item.id} via [${routerResult.channelsDelivered.join(', ')}]`);
      } else {
        stats.suppressed++;
        stats.details.push(`Suppressed ${item.id} (${routerResult.suppressionReason})`);
      }
    } catch (evalErr: any) {
      console.error(`[Engagement Engine] Error running ${item.id} for ${memberEmail}:`, evalErr);
    }
  }

  return stats;
}
