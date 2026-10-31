/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Shared Assistant & Entity Schemas
 * Used across React Client, API Server Services, and Cloud Functions.
 */

import { z } from 'zod';

export const ALLOWED_TEAM_EMAILS = [
  'prajindezaa142@gmail.com',
  'prajindezaa142@gamil.com',
  'jaikrishnaindustries1@gmail.com',
  'srinisrkp@gmail.com',
] as const;

export type AllowedTeamEmail = typeof ALLOWED_TEAM_EMAILS[number];

// Action Catalog Types
export const ACTION_CATALOG_TYPES = [
  'tasks',
  'customers',
  'plans',
  'festival_events',
  'meta_ads',
] as const;

export type ActionCatalogType = typeof ACTION_CATALOG_TYPES[number];

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

export const PENDING_ACTION_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'expired',
  'undone',
] as const;
export type PendingActionStatus = typeof PENDING_ACTION_STATUSES[number];

// Hard maximums enforced in code
export const HARD_LIMITS = {
  MAX_DAILY_ACTION_CAP: 50,
  DEFAULT_DAILY_ACTION_CAP: 20,
  PENDING_ACTION_TTL_SECONDS: 5 * 60, // 5 minutes
  UNDO_WINDOW_SECONDS: 30 * 60,        // 30 minutes
  MAX_TOOL_CALLS_PER_TURN: 5,
  MAX_BULK_ITEMS: 10,
  DEFAULT_TASK_TIME: '10:00',
  DEFAULT_TASK_DURATION_MINS: 30,
};

// 1. Task Schemas
export const TaskPrioritySchema = z.enum(['Low', 'Medium', 'High', 'Urgent']);
export const TaskTypeSchema = z.enum([
  'Follow-up Call',
  'Payment Collection',
  'Order Dispatch',
  'Sample Delivery',
  'Customer Visit',
  'General',
]);
export const TaskStatusSchema = z.enum(['Pending', 'In Progress', 'Done', 'Cancelled']);

export const ProposeTaskCreateSchema = z.object({
  title: z.string().min(2).max(120),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'StartTime must be HH:MM').default('10:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'EndTime must be HH:MM').default('10:30'),
  priority: TaskPrioritySchema.default('Medium'),
  type: TaskTypeSchema.default('Follow-up Call'),
  assignedTo: z.string().email(),
  notes: z.string().max(1000).optional(),
});

export const ProposeTaskEditSchema = z.object({
  taskId: z.string().min(1),
  updates: z.object({
    title: z.string().min(2).max(120).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    priority: TaskPrioritySchema.optional(),
    type: TaskTypeSchema.optional(),
    assignedTo: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const ProposeTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['In Progress', 'Done']),
  completionNote: z.string().max(500).optional(),
});

// 2. Customer Schemas
export const CustomerLeadStageSchema = z.enum([
  'Discovery',
  'Sample Sent',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
  'Inactive',
]);

export const ProposeCustomerAddSchema = z.object({
  companyName: z.string().min(2).max(120),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().min(8).max(20),
  city: z.string().max(60).optional(),
  state: z.string().max(60).default('Tamil Nadu'),
  groupName: z.string().max(60).optional(),
  leadStage: CustomerLeadStageSchema.default('Discovery'),
  notes: z.string().max(1000).optional(),
  nextFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ProposeCustomerEditSchema = z.object({
  customerId: z.string().min(1),
  updates: z.object({
    companyName: z.string().min(2).max(120).optional(),
    contactPerson: z.string().max(100).optional(),
    phone: z.string().min(8).max(20).optional(),
    city: z.string().max(60).optional(),
    leadStage: CustomerLeadStageSchema.optional(),
    nextFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const ProposeCustomerLogOutcomeSchema = z.object({
  customerId: z.string().min(1),
  channel: z.enum(['call', 'whatsapp', 'visit', 'email']),
  outcome: z.enum(['interested', 'callback_requested', 'busy', 'wrong_number', 'not_interested', 'sample_requested', 'order_placed']),
  notes: z.string().max(500),
  nextFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// 3. Plan Schemas
export const ProposePlanUpsertSchema = z.object({
  planType: z.enum(['daily', 'weekly']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(2).max(120),
  targetOutcomes: z.array(z.string()).min(1).max(20),
  reviewNotes: z.string().max(1000).optional(),
});

// 4. Festival Event Schemas
export const ProposeFestivalEventSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

// 5. Meta Ad Draft Schemas
export const ProposeMetaAdDraftSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(120),
  occasion: z.string().max(80).optional(),
  goal: z.enum(['Messages', 'Sales', 'Awareness', 'Traffic']).default('Messages'),
  dailyBudget: z.number().nonnegative().optional(),
  totalBudget: z.number().nonnegative().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

// Pending Action Representation
export interface PendingActionRecord {
  id: string;
  memberEmail: string;
  catalog: ActionCatalogType;
  tool: string;
  targetEntityId?: string;
  parameters: Record<string, any>;
  parametersHash: string;
  preview: {
    summary: string;
    summaryTa: string;
    details: string;
    before?: Record<string, any>;
    after: Record<string, any>;
    resolvedDates: Array<{
      field: string;
      rawInput: string;
      resolvedIst: string;
      iso: string;
      warning?: string;
    }>;
    untrustedSources?: string[];
  };
  riskLevel: RiskLevel;
  requiresSecondConfirmation: boolean;
  status: PendingActionStatus;
  createdAt: string;
  expiresAt: string;
  executedAt?: string;
  executedBy?: string;
  undoBeforeState?: Record<string, any>;
  undoExpiresAt?: string;
}

// AI Settings Schema
export const MemberAiSettingsSchema = z.object({
  aiActionsEnabled: z.boolean().default(true),
  dailyActionCap: z.number().int().min(1).max(HARD_LIMITS.MAX_DAILY_ACTION_CAP).default(HARD_LIMITS.DEFAULT_DAILY_ACTION_CAP),
  defaultTaskTime: z.string().regex(/^\d{2}:\d{2}$/).default('10:00'),
  requireSecondConfirmForMedium: z.boolean().default(false),
});

export const GlobalAiSettingsSchema = z.object({
  globalAiActionsEnabled: z.boolean().default(true),
  memberSettings: z.record(z.string(), MemberAiSettingsSchema).default({}),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

export type GlobalAiSettings = z.infer<typeof GlobalAiSettingsSchema>;
export type MemberAiSettings = z.infer<typeof MemberAiSettingsSchema>;
