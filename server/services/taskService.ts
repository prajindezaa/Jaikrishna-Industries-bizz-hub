/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Server-Side Task Execution Service
 * Enforces identical validation, updatedBy, lastWriteSource, and activity_logs as client screens.
 */

import admin from 'firebase-admin';
import { getFirebaseAdmin } from '../../api/middleware.js';
import { ProposeTaskCreateSchema, ProposeTaskEditSchema, ProposeTaskStatusSchema } from '../../src/shared/schemas.js';

export interface ExecuteTaskResult {
  success: boolean;
  taskId: string;
  before?: Record<string, any>;
  after: Record<string, any>;
  summary: string;
}

export async function executeTaskCreate(
  params: any,
  memberEmail: string,
  actionId?: string
): Promise<ExecuteTaskResult> {
  const validated = ProposeTaskCreateSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const now = new Date().toISOString();
  const docRef = db.collection('tasks').doc();

  const taskData: Record<string, any> = {
    id: docRef.id,
    title: validated.title.trim(),
    customerId: validated.customerId || null,
    customerName: validated.customerName || null,
    date: validated.date,
    startTime: validated.startTime,
    endTime: validated.endTime,
    priority: validated.priority,
    type: validated.type,
    assignedTo: validated.assignedTo,
    notes: validated.notes || '',
    status: 'Pending',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_create',
    via: 'ai_assistant',
    actionId: actionId || null,
  };

  await docRef.set(taskData);

  // Activity Log
  await db.collection('activity_logs').add({
    entity: 'task',
    entityId: docRef.id,
    action: 'create',
    performedBy: memberEmail,
    timestamp: now,
    summary: `Created task: ${taskData.title} for ${taskData.date} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { created: taskData },
  });

  return {
    success: true,
    taskId: docRef.id,
    after: taskData,
    summary: `Created task "${taskData.title}" assigned to ${taskData.assignedTo} for ${taskData.date}`,
  };
}

export async function executeTaskUpdate(
  params: any,
  memberEmail: string,
  actionId?: string
): Promise<ExecuteTaskResult> {
  const validated = ProposeTaskEditSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();
  const taskRef = db.collection('tasks').doc(validated.taskId);

  const snapshot = await taskRef.get();
  if (!snapshot.exists) {
    throw new Error(`Task with id ${validated.taskId} not found`);
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

  await taskRef.update(updates);
  const after = { ...before, ...updates };

  await db.collection('activity_logs').add({
    entity: 'task',
    entityId: validated.taskId,
    action: 'update',
    performedBy: memberEmail,
    timestamp: now,
    summary: `Updated task ${validated.taskId} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { before, after },
  });

  return {
    success: true,
    taskId: validated.taskId,
    before,
    after,
    summary: `Updated task "${after.title || validated.taskId}"`,
  };
}

export async function executeTaskStatusChange(
  params: any,
  memberEmail: string,
  actionId?: string
): Promise<ExecuteTaskResult> {
  const validated = ProposeTaskStatusSchema.parse(params);
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();
  const taskRef = db.collection('tasks').doc(validated.taskId);

  const snapshot = await taskRef.get();
  if (!snapshot.exists) {
    throw new Error(`Task with id ${validated.taskId} not found`);
  }

  const before = snapshot.data() || {};
  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    status: validated.status,
    updatedAt: now,
    updatedBy: memberEmail,
    lastWriteSource: 'manual_edit',
    via: 'ai_assistant',
    actionId: actionId || null,
  };

  if (validated.status === 'Done') {
    updates.completedAt = now;
    updates.completedBy = memberEmail;
    updates.completionNote = validated.completionNote || 'Marked done by AI Assistant';
  }

  await taskRef.update(updates);
  const after = { ...before, ...updates };

  await db.collection('activity_logs').add({
    entity: 'task',
    entityId: validated.taskId,
    action: 'status_change',
    performedBy: memberEmail,
    timestamp: now,
    summary: `Changed task status to ${validated.status} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId || null,
    diff: { beforeStatus: before.status, afterStatus: validated.status },
  });

  return {
    success: true,
    taskId: validated.taskId,
    before,
    after,
    summary: `Marked task "${after.title || validated.taskId}" as ${validated.status}`,
  };
}
