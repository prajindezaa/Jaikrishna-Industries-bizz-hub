/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRoleLabel = 'Owner' | 'Admin' | 'Sales Manager';

export interface TeamMember {
  id: string; // sanitized email or uid
  email: string;
  name: string;
  label: UserRoleLabel;
  phone: string;
  avatarUrl?: string;
  fcmTokens?: string[];
  notificationPreferences?: {
    channels: {
      push: boolean;
      email: boolean;
    };
    types: {
      perTask: boolean;
      taskUncompleted: boolean;
      taskNotCreated: boolean;
      planningNotDone: boolean;
      followUpDue: boolean;
      missedTaskAlert: boolean;
    };
    quietHours: {
      enabled: boolean;
      start: string; // "21:00"
      end: string; // "08:00"
    };
    dailyEmailCap: number; // default: 5
  };
  updatedAt?: string;
}

export interface CustomerGroup {
  id: string; // Deterministic slug or unique nanoid, e.g. "grp_distributor"
  name: string; // Unique, case-insensitive, trimmed, max 40 chars
  nameTa?: string; // Optional Tamil name, marked (needs proofreading by owner)
  color: string; // Hex color code
  icon: string; // Lucide icon key (e.g. 'Truck', 'Store', 'Building2', 'Landmark', 'Layers')
  description?: string;
  sortOrder: number;
  isActive: boolean; // false = Archived
  isDefault: boolean; // At most one group true
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface CustomerGroupCountersDoc {
  id: string; // 'aggregate'
  totalActive: number;
  ungroupedCount: number;
  groupCounts: Record<string, { total: number; newCustomers: number; oldCustomers: number }>;
  lastRecalculatedAt: string;
  updatedAt: string;
}

export interface CustomerImportBatch {
  id: string; // "batch_YYYYMMDD_HHmmss_xxx"
  fileName: string;
  fileSize: number;
  importedBy: string;
  importedAt: string;
  targetMode: 'fixed_group' | 'file_column';
  defaultGroupId?: string | null;
  counts: {
    totalRows: number;
    created: number;
    updated: number;
    moved: number;
    skipped: number;
    failed: number;
  };
  groupBreakdown: Record<string, number>;
  status: 'completed' | 'undone' | 'failed';
  canUndoUntil: string;
  undoExecutedAt?: string;
  undoExecutedBy?: string;
}

export interface CustomerImportBatchItem {
  id: string; // item id
  batchId: string;
  customerId: string;
  action: 'created' | 'updated' | 'moved' | 'skipped';
  previousGroupId?: string | null;
  newGroupId?: string | null;
  previousValues?: Record<string, unknown> | null;
  importedAt: string;
}

export type CustomerType =
  | 'Distributor'
  | 'Wholesaler'
  | 'Retailer'
  | 'Temple/Institution'
  | 'Other'
  | string;

export type CustomerStatus = 'New customer' | 'Old customer';

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Sample sent'
  | 'Negotiation'
  | 'Ordered'
  | 'Not interested';

export type LeadSource =
  | 'Meta Ads'
  | 'Google Ads'
  | 'Own Calling / Telecalling'
  | 'Direct Reach / Walk-in'
  | 'Reference / Word of Mouth'
  | 'Exhibition / Trade Fair'
  | 'WhatsApp Campaign'
  | 'IndiaMART / B2B Portal'
  | 'Other';

export interface CustomerPlace {
  area: string;
  city: string;
  district: string;
  state: string;
}

export interface StatusHistoryEntry {
  from: CustomerStatus;
  to: CustomerStatus;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface OutreachLog {
  id?: string;
  channel: 'Call' | 'WhatsApp';
  outcome: 'Answered' | 'No answer' | 'Interested' | 'Call later' | 'Not interested';
  note: string;
  nextFollowUp?: string;
  loggedBy: string;
  loggedAt: string;
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string; // normalized E.164, e.g. +919876543210 (or empty/optional when created from invoice)
  altPhone?: string;
  whatsapp: string; // normalized (or empty when created from invoice)
  email?: string;
  gstin?: string; // Optional GSTIN (15 alphanumeric)
  address?: string; // Full street address
  city?: string; // City name
  isPhoneMissing?: boolean; // True when created from invoice without phone
  place: CustomerPlace;
  customerType?: CustomerType; // Deprecated in favor of groupId, retained during migration
  groupId?: string | null; // null/empty string = Ungrouped
  groupName?: string; // denormalized display name
  groupAssignedAt?: string;
  groupAssignedBy?: string;
  previousGroupId?: string | null;
  status: CustomerStatus;
  source: LeadSource;
  campaignId?: string;
  leadStage: LeadStage;
  assignedTo: string; // member email or display name
  tags: string[];
  notes: string;
  nextFollowUpDate?: string; // YYYY-MM-DD
  lastWhatsAppSentAt?: string; // YYYY-MM-DDTHH:mm
  totalOrdersCount: number;
  totalRevenue: number;
  statusHistory: StatusHistoryEntry[];
  stageHistory?: { from: LeadStage; to: LeadStage; changedBy: string; changedAt: string }[];
  lastWriteSource?: 'manual_edit' | 'manual_create' | 'bulk_import' | 'bulk_stage_change' | 'automation' | 'system';
  importBatchId?: string | null;
  updatedBy?: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskType = 'Call' | 'WhatsApp' | 'Visit' | 'Meta ads' | 'Packing' | 'Other';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Pending' | 'In progress' | 'Done' | 'Missed';
export type TaskRepeat = 'None' | 'Daily' | 'Weekly' | 'Custom';

export interface Task {
  id: string;
  title: string;
  description: string;
  customerId?: string | null;
  customerName?: string | null;
  type: TaskType;
  assignedTo: string;
  priority: TaskPriority;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  repeat: TaskRepeat;
  repeatDays?: number[]; // 0 = Sun, 1 = Mon ...
  status: TaskStatus;
  completionNote?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  // Manual Edit Audit Fields (Untouched check: only changed by human member edits)
  lastEditedBy?: string | null;
  lastEditedAt?: string | null;
  // Automation Hub Metadata
  createdBy?: string;
  isAutomation?: boolean;
  automationRuleId?: string;
  automationKey?: string;
  automationRunId?: string;
  automationStage?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlanType = 'meta_ad_campaign' | 'contact_script' | 'daily_plan' | 'weekly_plan';

export interface Plan {
  id: string;
  planType: PlanType;
  title: string;
  period: string; // YYYY-MM-DD or YYYY-Wxx
  assignedTo: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  content: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Meta Ads Hub Data Types (Phase 5B)
// -------------------------------------------------------------
export type MetaAdStage =
  | 'Pending'
  | 'Published'
  | 'Waiting for result'
  | 'Fulfilled'
  | 'Cancelled';

export interface StageHistoryEntry {
  stage: MetaAdStage;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface CreativeAsset {
  url: string;
  publicId?: string;
  name?: string;
}

export interface TargetCustomers {
  types: string[]; // Distributor, Wholesaler, Retailer, Temple/Institution, Other
  places: string[]; // Districts/Cities in Tamil Nadu
  notes: string;
}

export interface PlannedAudience {
  ageRange: string; // e.g. "25-55"
  gender: 'All' | 'Men' | 'Women';
  interests: string[]; // e.g. "Pooja, Temples, Agarbatti, Retail Business"
  locations: string[]; // e.g. "Tamil Nadu, Coimbatore, Salem"
}

export interface MetaAdChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface MetaAdResults {
  // A. Messaging
  conversations: number | null;
  costPerConversation: number | null;
  manualCostPerConversationOverride?: boolean;

  // B. Reach
  views: number | null; // Impressions
  viewers: number | null; // Reach
  frequency: number | null; // views / viewers

  // C. Audience percentage splits (each must sum to 100% if provided)
  audienceAge: Record<string, number> | null;
  audienceGender: Record<string, number> | null;
  audiencePlaces: Record<string, number> | null;

  // D. Spend
  totalSpent: number | null; // ₹
  dailyBudget: number | null; // ₹
  actualDuration: number | null; // in days
  actualStart: string | null; // YYYY-MM-DDTHH:mm
  actualEnd: string | null; // YYYY-MM-DDTHH:mm

  // E. Post engagement
  engagements: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;

  // F. Clicks
  linkClicks: number | null;
  ctr: number | null; // link clicks / views * 100
  manualCtrOverride?: boolean;

  // G. Business outcome (auto-calculated from CRM customers with campaignId)
  derived?: DerivedBusinessOutcome;

  // H. Extras
  screenshotUrl?: string | null;
  screenshotPublicId?: string | null;
  lessons?: string | null;
  rating?: number | null; // 1 to 5 stars
}

export interface DerivedBusinessOutcome {
  customersImported: number;
  orders: number;
  revenue: number;
  roi: number; // ((revenue - spend) / spend) * 100
  costPerCustomer: number; // spend / customersImported
  costPerOrder: number; // spend / orders
}

export interface MetaAd {
  id: string;
  name: string;
  description: string;
  occasion?: string; // Festival name e.g. "Diwali 2026"
  festivalEventId?: string;
  goal: string; // e.g. 'Messages/Conversations', 'Leads', 'Traffic', 'Awareness'
  stage: MetaAdStage;
  cancelReason?: string;
  targetCustomers: TargetCustomers;
  plannedAudience: PlannedAudience;
  creatives: CreativeAsset[];
  primaryText: string;
  headline: string;
  cta: string; // e.g. 'Send WhatsApp Message', 'Order Wholesale', 'Learn More'
  destination: string; // WhatsApp number or direct chat URL
  placements: string[]; // Facebook Feed, Instagram Feed, Reels, etc.
  dailyBudget: number; // ₹
  totalBudget: number; // ₹
  plannedStart: string; // YYYY-MM-DDTHH:mm
  plannedEnd: string; // YYYY-MM-DDTHH:mm
  durationDays: number;
  createdBy: string;
  assignedTo: string;
  checklist: MetaAdChecklistItem[];
  notes: string;
  stageHistory: StageHistoryEntry[];
  results?: MetaAdResults;
  derived?: DerivedBusinessOutcome;
  // Historical / Past Ad Extensions
  isHistorical?: boolean;
  addedAsHistoricalBy?: string;
  addedAsHistoricalAt?: string;
  importBatchId?: string;
  isDraft?: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FestivalEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  notes: string;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderDispatchDetails {
  transporter?: string;
  vehicleNumber?: string;
  lrNumber?: string;
  boxesCount?: number;
  dispatchDate?: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  notes?: string;
}

export interface OrderPaymentRecord {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  reference?: string;
  recordedBy: string;
  createdAt: string;
}

export interface OrderStatusHistoryEntry {
  status: 'Pending' | 'Packed' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'On hold';
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. JKI-2026-0001
  invoiceNumber?: string; // e.g. "62"
  invoiceDate?: string; // YYYY-MM-DD
  financialYear?: string; // e.g. "2026-2027" (April to March)
  customerId: string;
  customerName: string;
  customerGroupId?: string | null; // Group at order time
  customerGroupName?: string | null; // Denormalized name ("unknown group" for pre-existing orders)
  customerGstin?: string;
  customerAddress?: string;
  customerCity?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  totalAmount: number; // Bill Value
  paymentStatus: 'Pending' | 'Partial' | 'Paid' | 'Credit' | 'Unpaid';
  deliveryStatus: 'Pending' | 'Packed' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'On hold';
  orderDate: string; // YYYY-MM-DD
  paymentDueDate?: string; // YYYY-MM-DD
  paidAmount?: number;
  outstandingAmount?: number;
  paymentHistory?: OrderPaymentRecord[];
  dispatch?: OrderDispatchDetails;
  statusHistory?: OrderStatusHistoryEntry[];
  invoiceFileName?: string;
  notes?: string;
  recordedBy: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: 'Camphor' | 'Agarbatti' | 'Lamp Oil' | 'Sambrani' | 'Rose Water' | 'Other';
  sku: string;
  wholesalePrice: number;
  retailPrice: number;
  stockQuantity: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface MemberNotificationPreferences {
  channels: {
    inApp: boolean;
    push: boolean;
    email: boolean; // Note: EMAIL_ENABLED=false keeps this inactive/hidden
  };
  types: {
    perTask: boolean;
    taskUncompleted: boolean;
    taskNotCreated: boolean;
    planningNotDone: boolean;
    followUpDue: boolean;
    missedTaskAlert: boolean;
    festivalCampaign: boolean;
    reorderReminder: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // "21:00"
    end: string;   // "08:00"
  };
  snoozeUntil?: string | null; // ISO timestamp
  dailyEmailCap: number; // default: 5
}

export interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  body: string;
  deepLink?: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  dedupeKey?: string;
}

export interface NotificationIntent {
  recipientEmail: string;
  title: string;
  body: string;
  type: 'task' | 'followup' | 'planning' | 'missed' | 'meta_ad' | 'system';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  deepLink?: string;
  dedupeKey: string;
  category?: string;
  bypassQuietHours?: boolean; // Critical security/system alerts can bypass
  data?: Record<string, string>;
}

export interface NotificationLogRecord {
  id: string;
  recipientEmail: string;
  title: string;
  type: string;
  dedupeKey: string;
  channelsDelivered: string[];
  status: 'delivered' | 'suppressed' | 'failed';
  suppressionReason?: 'quiet_hours' | 'user_disabled_type' | 'user_disabled_channel' | 'snoozed' | 'dedupe_duplicate' | 'cap_exceeded';
  createdAt: string;
}

export interface DeviceRegistration {
  deviceId: string;
  token: string;
  memberEmail: string;
  platform: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown';
  browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'samsung' | 'opera' | 'unknown';
  installedPwa: boolean;
  permissionState: 'granted' | 'default' | 'denied';
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
  lastSuccessAt?: string;
  lastErrorCode?: string;
  active: boolean;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  deepLink?: string;
  tag?: string;
  priority?: 'normal' | 'high' | 'critical';
  collapseKey?: string;
  data?: Record<string, string>;
}

export interface ActivityLog {
  id: string;
  entity: 'customer' | 'task' | 'order' | 'plan' | 'setting' | 'meta_ad' | 'festival_event';
  entityId: string;
  action: 'create' | 'update' | 'soft_delete' | 'restore' | 'status_change';
  performedBy: string;
  timestamp: string;
  summary: string;
  diff?: Record<string, unknown>;
}

export interface WhatsAppHubSettings {
  frequencyWindowDays: number;
  scope: 'anyMarketing' | 'sameOfferOnly';
  allowedHours: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  guards: {
    frequencyEnabled: boolean;
    timingEnabled: boolean;
  };
}

export interface FrequencyOverride {
  reason: 'customerAskedAgain' | 'festivalDeadline' | 'differentOffer' | 'other';
  note?: string;
  overriddenBy: string;
  overriddenAt: string;
}

export interface Offer {
  id: string;
  name: string;
  createdAt: string;
}

export interface WhatsAppQueueItem {
  id: string;
  queueId: string;
  customerId: string;
  offerId: string;
  status: 'Pending' | 'Sent' | 'Failed' | 'Excluded';
  frequencyOverride?: FrequencyOverride;
  timingGuardTag?: 'Sent outside recommended hours';
  sentAt?: string; // ISO string
}

export interface WhatsAppQueue {
  id: string;
  name: string;
  status: 'Draft' | 'Processing' | 'Completed';
  createdBy: string;
  guardSettingsSnapshot: WhatsAppHubSettings;
  createdAt: string;
}

export interface GlobalSettings {
  whatsappHub: WhatsAppHubSettings;
}

export type ActiveModule =
  | 'dashboard'
  | 'customers'
  | 'tasks'
  | 'planning'
  | 'meta_ads'
  | 'orders'
  | 'trash'
  | 'settings'
  | 'assistant'
  | 'automations';

export type LanguageCode = 'en' | 'ta';

// -------------------------------------------------------------
// Automation Hub Data Types (Step A: Rules 1 & 7)
// -------------------------------------------------------------
export type AutomationRuleId =
  | 'rule_1_auto_followup'
  | 'rule_2_idle_lead_reengagement'
  | 'rule_3_auto_stage_cold'
  | 'rule_4_cold_revival'
  | 'rule_5_reorder_reminders'
  | 'rule_6_festival_campaign_prep'
  | 'rule_7_morning_plan';

export interface StageRuleConfig {
  enabled: boolean;
  titleTemplate: string;
  taskType: TaskType;
  daysAfter: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  priority: TaskPriority;
}

export interface Rule1Parameters {
  skipOnImport: boolean;
  stages: {
    'Sample sent'?: StageRuleConfig;
    'Interested'?: StageRuleConfig;
    'Negotiation'?: StageRuleConfig;
    'Contacted'?: StageRuleConfig;
    'New'?: StageRuleConfig;
    'Ordered'?: StageRuleConfig;
    'Not interested'?: StageRuleConfig;
  };
}

export interface Rule7MemberConfig {
  enabled: boolean;
  deliveryTime: string; // HH:mm IST
  channels: {
    push: boolean;
    inApp: boolean;
    email: boolean;
  };
  sendIfEmpty: boolean;
}

export interface Rule7Parameters {
  lookaheadFestivalDays: number;
  allowEmptyNotification: boolean;
  memberSettings: Record<string, Rule7MemberConfig>;
}

export interface AutomationRuleDoc {
  id: AutomationRuleId;
  name: string;
  description: string;
  enabled: boolean;
  previewSeenAt?: string | null;
  dailyCap: number;
  workingDays: number[]; // [1,2,3,4,5,6] (Mon-Sat, 0=Sun)
  fallbackAssignee: 'actor' | 'round_robin';
  parameters: Record<string, any>;
  lastRunAt?: string | null;
  lastResult?: {
    status: 'success' | 'skipped' | 'partial' | 'error';
    createdCount: number;
    skippedCount: number;
    skipReasons: Record<string, number>;
    error?: string | null;
    timestamp: string;
  } | null;
  updatedBy: string;
  updatedAt: string;
}

export interface AutomationRunDoc {
  id: string;
  ruleId: AutomationRuleId;
  ruleName: string;
  startedAt: string;
  finishedAt: string;
  status: 'completed' | 'failed' | 'undone';
  createdCount: number;
  skippedCount: number;
  skipReasons: Record<string, number>;
  createdTaskIds: string[];
  appliedTags?: { customerId: string; tag: string }[];
  settingsSnapshot: Record<string, any>;
  errors?: string[];
  undone: boolean;
  undoneAt?: string | null;
  undoneBy?: string | null;
  triggeredBy: 'firestore_trigger' | 'schedule' | 'manual_test';
}
