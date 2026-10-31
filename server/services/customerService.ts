/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Server-Side Customer Execution Service
 * Handles customer creation, edits, stage changes with history, and outreach logging.
 */

import admin from 'firebase-admin';
import { getFirebaseAdmin } from '../../api/middleware.js';
import {
  ProposeCustomerAddSchema,
  ProposeCustomerEditSchema,
  ProposeCustomerLogOutcomeSchema,
} from '../../src/shared/schemas.js';

export interface ExecuteCustomerResult {
  success: boolean;
  customerId: string;
  before?: Record<string, any>;
  after: Record<string, any>;
  summary: string;
}

export async function executeCustomerAdd(
  params: any,
  memberEmail: string,
  actionId?: string
): Promise<ExecuteCustomerResult> {
  const validated = ProposeCustomerAddSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const now = new Date().toISOString();
  const docRef = db.collection('customers').doc();

  const customerData: Record<string, any> = {
    id: docRef.id,
    companyName: validated.companyName.trim(),
    contactPerson: validated.contactPerson?.trim() || '',
    phone: validated.phone.trim(),
    place: {
      city: validated.city || '',
      state: validated.state || 'Tamil Nadu',
      pincode: '',
    },
    groupName: validated.groupName || 'Ungrouped',
    status: 'Lead',
    leadStage: validated.leadStage,
    notes: validated.notes || '',
    nextFollowUpDate: validated.nextFollowUpDate || null,
    totalOrdersCount: 0,
    totalRevenue: 0,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_create',
    via: 'ai_assistant',
    actionId: actionId || null,
    stageHistory: [
      {
        from: 'None',
        to: validated.leadStage,
        changedBy: memberEmail,
        changedAt: now,
        reason: 'Created by AI Assistant',
      },
    ],
  };

  await docRef.set(customerData);

  // Activity Log
  await db.collection('activity_logs').add({
    entity: 'customer',
    entityId: docRef.id,
    action: 'create',
    performedBy: memberEmail,
    timestamp: now,
    summary: `Created customer: ${customerData.companyName} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { created: customerData },
  });

  return {
    success: true,
    customerId: docRef.id,
    after: customerData,
    summary: `Added customer "${customerData.companyName}" with stage ${customerData.leadStage}`,
  };
}

export async function executeCustomerUpdate(
  params: any,
  memberEmail: string,
  actionId?: string
): Promise<ExecuteCustomerResult> {
  const validated = ProposeCustomerEditSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();
  const custRef = db.collection('customers').doc(validated.customerId);

  const snapshot = await custRef.get();
  if (!snapshot.exists) {
    throw new Error(`Customer with id ${validated.customerId} not found`);
  }

  const before = snapshot.data() || {};
  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    ...validated.updates,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_edit',
    via: 'ai_assistant',
    actionId: actionId || null,
  };

  // If stage changed, append to stageHistory
  if (validated.updates.leadStage && validated.updates.leadStage !== before.leadStage) {
    const stageHistory = before.stageHistory || [];
    updates.stageHistory = [
      {
        from: before.leadStage,
        to: validated.updates.leadStage,
        changedBy: memberEmail,
        changedAt: now,
        reason: 'Updated by AI Assistant',
      },
      ...stageHistory,
    ];
  }

  await custRef.update(updates);
  const after = { ...before, ...updates };

  await db.collection('activity_logs').add({
    entity: 'customer',
    entityId: validated.customerId,
    action: 'update',
    performedBy: memberEmail,
    timestamp: now,
    summary: `Updated customer ${before.companyName || validated.customerId} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { before, after },
  });

  return {
    success: true,
    customerId: validated.customerId,
    before,
    after,
    summary: `Updated details for customer "${after.companyName || validated.customerId}"`,
  };
}

export async function executeCustomerLogOutcome(
  params: any,
  memberEmail: string,
  actionId?: string
): Promise<ExecuteCustomerResult> {
  const validated = ProposeCustomerLogOutcomeSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();
  const custRef = db.collection('customers').doc(validated.customerId);

  const snapshot = await custRef.get();
  if (!snapshot.exists) {
    throw new Error(`Customer with id ${validated.customerId} not found`);
  }

  const before = snapshot.data() || {};
  const now = new Date().toISOString();

  const outreachLog = {
    id: `log-${Date.now()}`,
    channel: validated.channel,
    outcome: validated.outcome,
    notes: validated.notes,
    timestamp: now,
    performedBy: memberEmail,
  };

  const outreachLogs = [outreachLog, ...(before.outreachLogs || [])];
  const updates: Record<string, any> = {
    outreachLogs,
    lastOutreachDate: now,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_edit',
    via: 'ai_assistant',
    actionId: actionId || null,
  };

  if (validated.nextFollowUpDate) {
    updates.nextFollowUpDate = validated.nextFollowUpDate;
  }

  await custRef.update(updates);
  const after = { ...before, ...updates };

  await db.collection('activity_logs').add({
    entity: 'customer',
    entityId: validated.customerId,
    action: 'update',
    performedBy: memberEmail,
    timestamp: now,
    summary: `Logged ${validated.channel} outcome (${validated.outcome}) for ${before.companyName || validated.customerId} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { outreachLog },
  });

  return {
    success: true,
    customerId: validated.customerId,
    before,
    after,
    summary: `Logged ${validated.channel} call outcome for "${before.companyName}"`,
  };
}
