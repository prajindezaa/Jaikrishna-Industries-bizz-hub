/**
 * WhatsApp Hub Guard Logic
 */

import { Customer, WhatsAppHubSettings, WhatsAppQueueItem } from '../types';

export const isCustomerExcludedByFrequency = (
  customer: Customer,
  settings: WhatsAppHubSettings,
  offerId: string,
  pastQueueItems: WhatsAppQueueItem[] = []
): boolean => {
  if (!settings.guards.frequencyEnabled) return false;

  const now = new Date();
  const windowDays = settings.frequencyWindowDays;
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // If customer was never messaged
  if (!customer.lastWhatsAppSentAt) return false;

  const lastSent = new Date(customer.lastWhatsAppSentAt);
  if (lastSent < windowStart || lastSent > now) return false;

  // "Any marketing message" scope
  if (settings.scope === 'anyMarketing') {
    return true;
  }

  // "Same offer only" scope
  return pastQueueItems.some(item => 
    item.customerId === customer.id && 
    item.offerId === offerId &&
    item.status === 'Sent' &&
    item.sentAt && new Date(item.sentAt) >= windowStart
  );
};

export const isOutsideHours = (
  serverTime: Date,
  settings: WhatsAppHubSettings
): boolean => {
  if (!settings.guards.timingEnabled) return false;

  const istDate = new Date(serverTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const [startH, startM] = settings.allowedHours.start.split(':').map(Number);
  const [endH, endM] = settings.allowedHours.end.split(':').map(Number);
  
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  return timeInMinutes < startTime || timeInMinutes >= endTime;
};
