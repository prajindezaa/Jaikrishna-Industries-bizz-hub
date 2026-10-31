/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Server-Side Plan, Festival & Meta Ad Services
 */

import { getFirebaseAdmin } from '../../api/middleware.js';
import {
  ProposePlanUpsertSchema,
  ProposeFestivalEventSchema,
  ProposeMetaAdDraftSchema,
} from '../../src/shared/schemas.js';

export async function executePlanUpsert(
  params: any,
  memberEmail: string,
  actionId?: string
) {
  const validated = ProposePlanUpsertSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const now = new Date().toISOString();
  // Find or create plan for this planType & date
  const snapshot = await db.collection('plans')
    .where('planType', '==', validated.planType)
    .where('date', '==', validated.date)
    .limit(1)
    .get();

  let docRef;
  let before: Record<string, any> | undefined;

  if (!snapshot.empty) {
    docRef = snapshot.docs[0].ref;
    before = snapshot.docs[0].data();
  } else {
    docRef = db.collection('plans').doc();
  }

  const planData: Record<string, any> = {
    id: docRef.id,
    planType: validated.planType,
    date: validated.date,
    title: validated.title.trim(),
    targetOutcomes: validated.targetOutcomes,
    reviewNotes: validated.reviewNotes || '',
    isDeleted: false,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_edit',
    via: 'ai_assistant',
    actionId: actionId || null,
    ...(before ? {} : { createdAt: now, createdBy: memberEmail }),
  };

  await docRef.set(planData, { merge: true });

  await db.collection('activity_logs').add({
    entity: 'plan',
    entityId: docRef.id,
    action: before ? 'update' : 'create',
    performedBy: memberEmail,
    timestamp: now,
    summary: `${before ? 'Updated' : 'Created'} ${validated.planType} plan for ${validated.date} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { before, after: planData },
  });

  return {
    success: true,
    planId: docRef.id,
    before,
    after: planData,
    summary: `Saved ${validated.planType} plan for ${validated.date}`,
  };
}

export async function executeFestivalUpsert(
  params: any,
  memberEmail: string,
  actionId?: string
) {
  const validated = ProposeFestivalEventSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const now = new Date().toISOString();
  const docRef = validated.id ? db.collection('festival_events').doc(validated.id) : db.collection('festival_events').doc();

  let before: Record<string, any> | undefined;
  if (validated.id) {
    const snap = await docRef.get();
    if (snap.exists) before = snap.data();
  }

  const festivalData: Record<string, any> = {
    id: docRef.id,
    name: validated.name.trim(),
    date: validated.date,
    notes: validated.notes || '',
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_edit',
    via: 'ai_assistant',
    actionId: actionId || null,
    ...(before ? {} : { createdAt: now, isDeleted: false }),
  };

  await docRef.set(festivalData, { merge: true });

  await db.collection('activity_logs').add({
    entity: 'festival_event',
    entityId: docRef.id,
    action: before ? 'update' : 'create',
    performedBy: memberEmail,
    timestamp: now,
    summary: `${before ? 'Updated' : 'Added'} festival event "${festivalData.name}" (${festivalData.date}) (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { before, after: festivalData },
  });

  return {
    success: true,
    festivalId: docRef.id,
    before,
    after: festivalData,
    summary: `Saved festival event "${festivalData.name}" on ${festivalData.date}`,
  };
}

export async function executeMetaAdDraftUpsert(
  params: any,
  memberEmail: string,
  actionId?: string
) {
  const validated = ProposeMetaAdDraftSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const now = new Date().toISOString();
  const docRef = validated.id ? db.collection('meta_ads').doc(validated.id) : db.collection('meta_ads').doc();

  let before: Record<string, any> | undefined;
  if (validated.id) {
    const snap = await docRef.get();
    if (snap.exists) before = snap.data();
  }

  const adData: Record<string, any> = {
    id: docRef.id,
    name: validated.name.trim(),
    occasion: validated.occasion || 'General Promotion',
    stage: 'Draft',
    isDraft: true,
    goal: validated.goal,
    dailyBudget: validated.dailyBudget || 500,
    totalBudget: validated.totalBudget || 3500,
    plannedStart: validated.plannedStart || null,
    plannedEnd: validated.plannedEnd || null,
    notes: validated.notes || '',
    isDeleted: false,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_edit',
    via: 'ai_assistant',
    actionId: actionId || null,
    ...(before ? {} : { createdAt: now }),
  };

  await docRef.set(adData, { merge: true });

  await db.collection('activity_logs').add({
    entity: 'meta_ad',
    entityId: docRef.id,
    action: before ? 'update' : 'create',
    performedBy: memberEmail,
    timestamp: now,
    summary: `${before ? 'Updated' : 'Created'} Meta ad draft "${adData.name}" (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { before, after: adData },
  });

  return {
    success: true,
    adId: docRef.id,
    before,
    after: adData,
    summary: `Saved Meta ad draft "${adData.name}"`,
  };
}
