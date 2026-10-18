/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppNotification } from '../types';

/**
 * Requests browser Web Push notification permissions
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Dispatches a local in-browser notification (if permission granted)
 */
export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon.svg',
      badge: '/icon.svg',
      ...options,
    });
  }
}

/**
 * Computes deduplication key for a task reminder
 */
export function getTaskReminderDedupeKey(taskId: string, date: string, nudgeCount: number): string {
  return `${taskId}_${date}_nudge${nudgeCount}`;
}

/**
 * Computes deduplication key for a Meta ad reminder
 */
export function getMetaAdReminderDedupeKey(adId: string, reminderType: string, dateStr: string): string {
  return `meta_ad_${adId}_${reminderType}_${dateStr}`;
}

export interface MetaAdReminderItem {
  id: string;
  adId?: string;
  festivalId?: string;
  title: string;
  body: string;
  type: 'publish_now' | 'ends_soon' | 'move_to_waiting' | 'enter_results' | 'plan_festival_ad';
  dedupeKey: string;
  deepLink: string;
  urgency: 'high' | 'medium' | 'info';
}

/**
 * Evaluates active Meta ads and upcoming festivals for scheduled background nudges
 */
export function evaluateMetaAdsReminders(
  ads: any[],
  festivals: any[],
  options?: {
    leadDays?: number;
    nowMs?: number;
  }
): MetaAdReminderItem[] {
  const now = options?.nowMs ? new Date(options.nowMs) : new Date();
  const nowMs = now.getTime();
  const todayStr = now.toISOString().slice(0, 10);
  const leadDays = options?.leadDays || 14;

  const reminders: MetaAdReminderItem[] = [];

  // 1. Process Meta Ads (Strictly exclude historical and draft ads from lifecycle triggers)
  ads.forEach((ad) => {
    if (ad.isDeleted || ad.isHistorical || ad.isDraft) return;

    const startMs = ad.plannedStart ? new Date(ad.plannedStart).getTime() : 0;
    const endMs = ad.plannedEnd ? new Date(ad.plannedEnd).getTime() : 0;

    // Trigger 1: Ad is Pending and start date/time passed
    if (ad.stage === 'Pending' && startMs > 0 && startMs <= nowMs) {
      reminders.push({
        id: `pending-start-${ad.id}`,
        adId: ad.id,
        title: `Publish ${ad.name} now`,
        body: `Scheduled start time (${new Date(ad.plannedStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) has arrived. Publish on Meta or reschedule.`,
        type: 'publish_now',
        dedupeKey: getMetaAdReminderDedupeKey(ad.id, 'publish_now', todayStr),
        deepLink: '/planning?adId=' + ad.id,
        urgency: 'high',
      });
    }

    // Trigger 2: Ad ends soon (within 24 hours) and is still Published
    if (ad.stage === 'Published' && endMs > nowMs && endMs - nowMs <= 24 * 60 * 60 * 1000) {
      reminders.push({
        id: `ends-soon-${ad.id}`,
        adId: ad.id,
        title: `Heads-up: ${ad.name} ends soon`,
        body: `Campaign scheduled to end on ${new Date(ad.plannedEnd).toLocaleDateString('en-IN')}. Prepare to review incoming WhatsApp conversations.`,
        type: 'ends_soon',
        dedupeKey: getMetaAdReminderDedupeKey(ad.id, 'ends_soon', todayStr),
        deepLink: '/planning?adId=' + ad.id,
        urgency: 'medium',
      });
    }

    // Trigger 3: Ad end time passed and stage is not "Waiting for result"
    if (ad.stage === 'Published' && endMs > 0 && endMs <= nowMs) {
      reminders.push({
        id: `move-waiting-${ad.id}`,
        adId: ad.id,
        title: `Move ${ad.name} to Waiting for result`,
        body: `Campaign finished running on ${new Date(ad.plannedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Tap to advance to Waiting for result.`,
        type: 'move_to_waiting',
        dedupeKey: getMetaAdReminderDedupeKey(ad.id, 'move_to_waiting', todayStr),
        deepLink: '/planning?adId=' + ad.id,
        urgency: 'high',
      });
    }

    // Trigger 4: Ad is Waiting for result (daily repeating until Fulfilled)
    if (ad.stage === 'Waiting for result') {
      const endedDaysAgo = endMs > 0 ? Math.max(1, Math.floor((nowMs - endMs) / (1000 * 60 * 60 * 24))) : 1;
      reminders.push({
        id: `enter-results-${ad.id}`,
        adId: ad.id,
        title: `Enter results for ${ad.name}`,
        body: `Campaign ended ${endedDaysAgo} day(s) ago. Please enter messaging conversations and spend to finalize ROI.`,
        type: 'enter_results',
        dedupeKey: getMetaAdReminderDedupeKey(ad.id, 'enter_results', todayStr),
        deepLink: '/planning?adId=' + ad.id,
        urgency: 'high',
      });
    }
  });

  // 2. Process Upcoming Festivals
  festivals.forEach((fest) => {
    if (fest.isDeleted) return;

    const festDate = new Date(fest.date);
    festDate.setHours(0, 0, 0, 0);
    const diffMs = festDate.getTime() - new Date(todayStr).getTime();
    const daysUntilFest = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Festival within leadDays (default 14) and no active/pending ad planned for it
    if (daysUntilFest >= 0 && daysUntilFest <= leadDays) {
      const hasPlannedAd = ads.some((a) => {
        if (a.isDeleted || a.isHistorical || a.stage === 'Cancelled') return false;
        return (
          a.festivalEventId === fest.id ||
          (a.occasion && a.occasion.toLowerCase().includes(fest.name.toLowerCase()))
        );
      });

      if (!hasPlannedAd) {
        // Look for past ad from previous years for this festival
        const pastAd = ads.find((a) => {
          if (a.isDeleted) return false;
          const isPastMatch = a.isHistorical || a.stage === 'Fulfilled';
          return (
            isPastMatch &&
            (a.festivalEventId === fest.id ||
              (a.occasion && a.occasion.toLowerCase().includes(fest.name.toLowerCase())))
          );
        });

        let bodyText = `${fest.name} is in ${daysUntilFest} day(s) (${fest.date}). No active or pending Meta ad is scheduled yet.`;
        if (pastAd) {
          const convs = pastAd.results?.conversations;
          const cost = pastAd.results?.costPerConversation;
          const perfText = convs ? ` (${convs} conversations${cost ? ` @ ₹${cost}` : ''})` : '';
          bodyText += ` Last ad "${pastAd.name}"${perfText} is available to clone!`;
        }

        reminders.push({
          id: `festival-due-${fest.id}`,
          festivalId: fest.id,
          title: `Plan your ${fest.name} ad`,
          body: bodyText,
          type: 'plan_festival_ad',
          dedupeKey: `festival_${fest.id}_${todayStr}`,
          deepLink: pastAd ? `/planning?cloneId=${pastAd.id}` : `/planning?festId=${fest.id}`,
          urgency: 'medium',
        });
      }
    }
  });

  return reminders;
}

/**
 * Checks if the current time in IST is within quiet hours (default: 21:00 to 08:00)
 */
export function isWithinQuietHours(
  quietHours = { enabled: true, start: '21:00', end: '08:00' }
): boolean {
  if (!quietHours.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = quietHours.start.split(':').map(Number);
  const [endH, endM] = quietHours.end.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes > endMinutes) {
    // Crosses midnight, e.g. 21:00 to 08:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
