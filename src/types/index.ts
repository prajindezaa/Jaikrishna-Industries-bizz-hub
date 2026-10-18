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
  phone: string; // normalized E.164, e.g. +919876543210
  altPhone?: string;
  whatsapp: string; // normalized
  email?: string;
  place: CustomerPlace;
  customerType: CustomerType;
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

export interface Order {
  id: string;
  orderNumber: string; // e.g. JKI-2026-0001
  customerId: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentStatus: 'Pending' | 'Partial' | 'Paid' | 'Credit';
  deliveryStatus: 'Pending' | 'Packed' | 'Dispatched' | 'Delivered';
  orderDate: string; // YYYY-MM-DD
  notes?: string;
  recordedBy: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
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

export interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  body: string;
  deepLink?: string;
  type: 'task' | 'followup' | 'planning' | 'missed' | 'meta_ad' | 'system';
  isRead: boolean;
  createdAt: string;
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
  | 'orders'
  | 'trash'
  | 'settings'
  | 'assistant';

export type LanguageCode = 'en' | 'ta';
