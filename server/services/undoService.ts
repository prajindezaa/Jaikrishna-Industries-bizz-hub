/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Server-Side Action Undo Service
 * Restores previous state if within 30-minute window and record hasn't changed since.
 */

import { getFirebaseAdmin } from '../../api/middleware.js';
import { HARD_LIMITS } from '../../src/shared/schemas.js';

export interface ExecuteUndoResult {
  success: boolean;
  message: string;
  entity: string;
  entityId: string;
}

export async function executeActionUndo(
  actionId: string,
  memberEmail: string
): Promise<ExecuteUndoResult> {
  const adminSdk = getFirebaseAdmin();
  const db = adminSdk.firestore();

  const actionRef = db.collection('pending_actions').doc(actionId);
  const actionSnap = await actionRef.get();

  if (!actionSnap.exists) {
    throw new Error('Action record not found.');
  }

  const action = actionSnap.data() as any;

  // 1. Verify ownership
  if (action.memberEmail !== memberEmail) {
    throw new Error('You cannot undo an action initiated by another team member.');
  }

  // 2. Verify status
  if (action.status !== 'confirmed') {
    throw new Error(`Cannot undo action with status "${action.status}".`);
  }

  // 3. Verify 30-minute TTL
  const now = new Date();
  if (action.undoExpiresAt && new Date(action.undoExpiresAt).getTime() < now.getTime()) {
    throw new Error('Undo window (30 minutes) has expired for this action.');
  }

  // 4. Map collection name
  const collectionMap: Record<string, string> = {
    tasks: 'tasks',
    customers: 'customers',
    plans: 'plans',
    festival_events: 'festival_events',
    meta_ads: 'meta_ads',
  };

  const collectionName = collectionMap[action.catalog];
  if (!collectionName || !action.targetEntityId) {
    throw new Error(`Unsupported entity undo for catalog "${action.catalog}".`);
  }

  const entityRef = db.collection(collectionName).doc(action.targetEntityId);
  const currentSnap = await entityRef.get();

  if (!currentSnap.exists) {
    throw new Error('The target document no longer exists in the database.');
  }

  const currentData = currentSnap.data() || {};

  // 5. Concurrency check: Ensure record was not updated after this action's execution
  if (action.executedAt && currentData.updatedAt && currentData.updatedAt > action.executedAt) {
    // If another action or manual edit modified it, reject undo
    if (currentData.actionId !== actionId) {
      throw new Error(
        `Cannot undo: this record was updated by ${currentData.updatedBy || 'another change'} at ${currentData.updatedAt} after the AI action.`
      );
    }
  }

  // 6. Restore before-state or soft-delete if it was newly created
  const nowIso = now.toISOString();

  if (!action.undoBeforeState || Object.keys(action.undoBeforeState).length === 0) {
    // It was a newly created document: soft-delete it
    await entityRef.update({
      isDeleted: true,
      deletedAt: nowIso,
      deletedBy: memberEmail,
      updatedAt: nowIso,
      updatedBy: memberEmail,
      lastWriteSource: 'manual_edit',
      via: 'ai_assistant_undo',
      undoActionId: actionId,
    });
  } else {
    // Revert to before-state
    await entityRef.set(
      {
        ...action.undoBeforeState,
        updatedAt: nowIso,
        updatedBy: memberEmail,
        lastWriteSource: 'manual_edit',
        via: 'ai_assistant_undo',
        undoActionId: actionId,
      },
      { merge: false }
    );
  }

  // Mark action status as 'undone'
  await actionRef.update({
    status: 'undone',
    undoneAt: nowIso,
    undoneBy: memberEmail,
  });

  // Log in activity_logs
  await db.collection('activity_logs').add({
    entity: action.catalog === 'festival_events' ? 'festival_event' : action.catalog.replace(/s$/, ''),
    entityId: action.targetEntityId,
    action: 'restore',
    performedBy: memberEmail,
    timestamp: nowIso,
    summary: `Undid AI action ${actionId} (by AI assistant for ${memberEmail})`,
    byAssistant: true,
    assistantActionId: actionId,
    diff: { revertedTo: action.undoBeforeState || 'soft_deleted' },
  });

  return {
    success: true,
    message: `Successfully undid action "${action.preview?.summary || actionId}".`,
    entity: action.catalog,
    entityId: action.targetEntityId,
  };
}
