/**
 * WhatsApp Hub Queue Processing Logic
 */
import { WhatsAppHubSettings, Customer, WhatsAppQueueItem } from '../types';
import { isCustomerExcludedByFrequency } from './whatsapp-guards';

export const processWhatsAppQueue = (
  customers: Customer[],
  settings: WhatsAppHubSettings,
  offerId: string,
  pastQueueItems: WhatsAppQueueItem[] = []
): {
  included: Customer[];
  excluded: { customer: Customer; reason: string }[];
} => {
  const included: Customer[] = [];
  const excluded: { customer: Customer; reason: string }[] = [];

  customers.forEach(customer => {
    // 1. "Do not message" rule
    if (customer.tags.includes('Do not message')) {
      excluded.push({ customer, reason: 'Do not message' });
      return;
    }

    // 2. Frequency Guard
    if (isCustomerExcludedByFrequency(customer, settings, offerId, pastQueueItems)) {
      excluded.push({ customer, reason: 'Excluded by frequency guard' });
      return;
    }

    included.push(customer);
  });

  return { included, excluded };
};
