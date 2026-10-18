/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  runTransaction,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  Customer,
  Task,
  Order,
  Plan,
  ActivityLog,
  CustomerStatus,
  LeadStage,
  OutreachLog,
  TaskStatus,
  TaskRepeat,
  TaskType,
  Product,
  MetaAd,
  MetaAdStage,
  MetaAdResults,
  FestivalEvent,
  DerivedBusinessOutcome,
  WhatsAppHubSettings,
  GlobalSettings,
  Offer,
} from '../types';
import { normalizePhone } from '../lib/phone';
import {
  validateStageTransition,
  validatePastAd,
  calculateCostPerConversation,
  calculateFrequency,
  calculateCtr,
  calculateRoi,
  calculateCostPerCustomer,
  calculateCostPerOrder,
} from '../lib/meta-ads-utils';

export interface SavedFilterPreset {
  id: string;
  name: string;
  entity: 'customers' | 'tasks' | 'orders';
  filters: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface TrashItem {
  id: string;
  entity: 'customer' | 'task' | 'order' | 'plan' | 'meta_ad';
  title: string;
  details: string;
  deletedBy: string;
  deletedAt: string;
  daysRemaining: number;
  originalData: Record<string, unknown>;
}

interface AppContextType {
  // Customers
  customers: Customer[];
  loadingCustomers: boolean;
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalOrdersCount' | 'totalRevenue' | 'statusHistory' | 'isDeleted'>) => Promise<string>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  softDeleteCustomer: (id: string) => Promise<void>;
  logOutreach: (customerId: string, log: Omit<OutreachLog, 'id' | 'loggedAt' | 'loggedBy'>) => Promise<void>;
  importCustomersBatch: (newCustomers: Customer[]) => Promise<{ imported: number; updated: number; skipped: number }>;

  // Tasks
  tasks: Task[];
  loadingTasks: boolean;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  completeTask: (id: string, note?: string) => Promise<void>;
  softDeleteTask: (id: string) => Promise<void>;
  bulkGenerateTasks: (targetCustomers: Customer[], type: TaskType, date: string, startTime: string, endTime: string) => Promise<number>;

  // Orders (Atomic Transactions)
  orders: Order[];
  loadingOrders: boolean;
  createOrderTransaction: (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'isDeleted'>) => Promise<string>;
  softDeleteOrder: (id: string) => Promise<void>;

  // Plans (Phase 5A)
  plans: Plan[];
  loadingPlans: boolean;
  savePlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<string>;

  // Meta Ads Hub (Phase 5B + Past Ads)
  metaAds: MetaAd[];
  loadingMetaAds: boolean;
  addMetaAd: (adData: Omit<MetaAd, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'stageHistory'>) => Promise<string>;
  addPastAd: (adData: Partial<MetaAd>, linkedCustomerIds?: string[], isDraft?: boolean) => Promise<string>;
  attachCustomersToAd: (adId: string, customerIds: string[]) => Promise<{ attached: number; moved: number }>;
  detachCustomersFromAd: (adId: string, customerIds: string[]) => Promise<number>;
  recalculateAdMetrics: (adId: string) => Promise<DerivedBusinessOutcome>;
  importPastAdsBatch: (adsList: Array<{ adData: Partial<MetaAd>; linkedCustomerIds?: string[] }>, batchId?: string) => Promise<{ count: number; batchId: string }>;
  undoPastAdsBatch: (batchId: string) => Promise<number>;
  updateMetaAd: (id: string, updates: Partial<MetaAd>) => Promise<void>;
  changeMetaAdStage: (id: string, targetStage: MetaAdStage, options?: { resultsPayload?: Partial<MetaAdResults>; cancelReason?: string }) => Promise<{ success: boolean; error?: string }>;
  cloneMetaAd: (sourceAdId: string) => Promise<string>;
  softDeleteMetaAd: (id: string) => Promise<void>;
  getDerivedAdMetrics: (adId: string) => DerivedBusinessOutcome;

  // Festival Calendar
  festivalEvents: FestivalEvent[];
  loadingFestivalEvents: boolean;
  addFestivalEvent: (eventData: Omit<FestivalEvent, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<string>;
  updateFestivalEvent: (id: string, updates: Partial<FestivalEvent>) => Promise<void>;
  deleteFestivalEvent: (id: string) => Promise<void>;

  // Trash & Restore
  trashItems: TrashItem[];
  restoreTrashItem: (item: TrashItem) => Promise<void>;
  permanentlyDeleteTrashItem: (item: TrashItem) => Promise<void>;
  emptyExpiredTrash: () => Promise<number>;

  // Saved Filters
  savedFilters: SavedFilterPreset[];
  saveFilterPreset: (name: string, entity: 'customers' | 'tasks' | 'orders', filters: Record<string, unknown>) => Promise<string>;
  deleteFilterPreset: (id: string) => Promise<void>;

  // Activity Logs
  activityLogs: ActivityLog[];
  logActivity: (entity: ActivityLog['entity'], entityId: string, action: ActivityLog['action'], summary: string, diff?: Record<string, unknown>) => Promise<void>;

  // Settings (WhatsApp Guards)
  settings: GlobalSettings | null;
  updateWhatsAppHubSettings: (settings: WhatsAppHubSettings) => Promise<void>;

  // WhatsApp Hub (Phase 6B)
  offers: Offer[];
  loadingOffers: boolean;
  addOffer: (name: string) => Promise<string>;
  markQueueItemSent: (itemId: string, customerId: string, offerId: string) => Promise<void>;
  undoQueueItemSent: (itemId: string, customerId: string, previousLastSent: string | null) => Promise<void>;

  // Initial Seeding
  seedInitialData: () => Promise<void>;
  isSeeding: boolean;

  // Firestore Security Rules / Permissions Notice
  firestorePermissionError: boolean;
  retryConnection: () => void;
  dismissPermissionBanner: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Initial pooja products catalog
export const POOJA_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Pure Bhimseni Camphor 100g Jar', category: 'Camphor', sku: 'BC-100', wholesalePrice: 180, retailPrice: 240, stockQuantity: 850, isActive: true },
  { id: 'p2', name: 'Special Camphor Tablets 50g Jar', category: 'Camphor', sku: 'CT-50', wholesalePrice: 45, retailPrice: 65, stockQuantity: 2400, isActive: true },
  { id: 'p3', name: 'Premium Flora Agarbatti (50 Sticks)', category: 'Agarbatti', sku: 'AG-FL', wholesalePrice: 85, retailPrice: 120, stockQuantity: 1200, isActive: true },
  { id: 'p4', name: 'Deepam Lamp Oil 1L Can', category: 'Lamp Oil', sku: 'LO-1L', wholesalePrice: 190, retailPrice: 250, stockQuantity: 620, isActive: true },
  { id: 'p5', name: 'Pure Sambrani Dhoop Cups (12 Pack)', category: 'Sambrani', sku: 'SB-12', wholesalePrice: 75, retailPrice: 110, stockQuantity: 950, isActive: true },
  { id: 'p6', name: 'Traditional Rose Water 500ml Bottle', category: 'Rose Water', sku: 'RW-500', wholesalePrice: 60, retailPrice: 90, stockQuantity: 400, isActive: true },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, member } = useAuth();
  const configured = isFirebaseConfigured();

  const updateWhatsAppHubSettings = async (settings: WhatsAppHubSettings) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'settings', 'main'), { whatsappHub: settings }, { merge: true });
      await logActivity('setting', 'main', 'update', `Updated WhatsApp Hub preferences: ${JSON.stringify(settings)}`);
    } catch (err) {
      console.error('Error updating WhatsApp Hub settings:', err);
      throw err;
    }
  };

  const markQueueItemSent = async (itemId: string, customerId: string, offerId: string) => {
    if (!db) return;
    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db!, 'whatsapp_queue_items', itemId);
        const customerRef = doc(db!, 'customers', customerId);
        const now = new Date().toISOString();

        transaction.update(itemRef, { status: 'Sent', sentAt: now });
        transaction.update(customerRef, { lastWhatsAppSentAt: now });
      });
    } catch (err) {
      console.error('Error marking item sent:', err);
      throw err;
    }
  };

  const addOffer = async (name: string): Promise<string> => {
    if (!db) return '';
    const normalizedName = name.trim().toLowerCase();
    const existing = offers.find(o => o.name.trim().toLowerCase() === normalizedName);
    if (existing) return existing.id;

    const docRef = doc(collection(db, 'offers'));
    const now = new Date().toISOString();
    await setDoc(docRef, { id: docRef.id, name: name.trim(), createdAt: now });
    await logActivity('meta_ad', docRef.id, 'create', `Created offer: ${name.trim()}`);
    return docRef.id;
  };

  const undoQueueItemSent = async (itemId: string, customerId: string, previousLastSent: string | null) => {
    if (!db) return;
    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db!, 'whatsapp_queue_items', itemId);
        const customerRef = doc(db!, 'customers', customerId);

        transaction.update(itemRef, { status: 'Pending', sentAt: null });
        transaction.update(customerRef, { lastWhatsAppSentAt: previousLastSent });
      });
      await logActivity('meta_ad', itemId, 'update', 'Undid mark sent for queue item');
    } catch (err) {
      console.error('Error undoing mark sent:', err);
      throw err;
    }
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Meta Ads Hub (Phase 5B) State
  const [metaAds, setMetaAds] = useState<MetaAd[]>([]);
  const [loadingMetaAds, setLoadingMetaAds] = useState(true);
  const [deletedMetaAds, setDeletedMetaAds] = useState<MetaAd[]>([]);

  // Festival Events State
  const [festivalEvents, setFestivalEvents] = useState<FestivalEvent[]>([]);
  const [loadingFestivalEvents, setLoadingFestivalEvents] = useState(true);

  const [savedFilters, setSavedFilters] = useState<SavedFilterPreset[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // Raw soft-deleted items
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<Order[]>([]);

  // Firestore Security Rules / Permissions Notice
  const [firestorePermissionError, setFirestorePermissionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retryConnection = () => {
    setFirestorePermissionError(false);
    setRetryCount((prev) => prev + 1);
  };

  const dismissPermissionBanner = () => {
    setFirestorePermissionError(false);
  };

  // Helper for handling listener errors
  const handleSnapshotError = (err: any, contextName: string) => {
    if (err?.code === 'permission-denied') {
      console.warn(`Firestore permission denied on ${contextName}. Please update security rules.`);
      setFirestorePermissionError(true);
    } else {
      console.warn(`Error listening to ${contextName}:`, err);
    }
  };

  // 1. Live Firestore Listeners
  useEffect(() => {
    if (!configured || !db || !user) {
      setLoadingCustomers(false);
      setLoadingTasks(false);
      setLoadingOrders(false);
      setLoadingPlans(false);
      return;
    }

    // A. Listen to Customers
    const custUnsub = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const active: Customer[] = [];
        const deleted: Customer[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as Customer;
          if (data.isDeleted) {
            deleted.push(data);
          } else {
            active.push(data);
          }
        });
        active.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCustomers(active);
        setDeletedCustomers(deleted);
        setLoadingCustomers(false);
      },
      (err) => {
        handleSnapshotError(err, 'customers');
        setLoadingCustomers(false);
      }
    );

    // B. Listen to Tasks
    const taskUnsub = onSnapshot(
      collection(db, 'tasks'),
      (snapshot) => {
        const active: Task[] = [];
        const deleted: Task[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as Task;
          if (data.isDeleted) {
            deleted.push(data);
          } else {
            active.push(data);
          }
        });
        active.sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.startTime.localeCompare(b.startTime);
        });
        setTasks(active);
        setDeletedTasks(deleted);
        setLoadingTasks(false);
      },
      (err) => {
        handleSnapshotError(err, 'tasks');
        setLoadingTasks(false);
      }
    );

    // C. Listen to Orders
    const orderUnsub = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const active: Order[] = [];
        const deleted: Order[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as Order;
          if (data.isDeleted) {
            deleted.push(data);
          } else {
            active.push(data);
          }
        });
        active.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        setOrders(active);
        setDeletedOrders(deleted);
        setLoadingOrders(false);
      },
      (err) => {
        handleSnapshotError(err, 'orders');
        setLoadingOrders(false);
      }
    );

    // D. Listen to Plans
    const planUnsub = onSnapshot(
      collection(db, 'plans'),
      (snapshot) => {
        const active: Plan[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as Plan;
          if (!data.isDeleted) {
            active.push(data);
          }
        });
        setPlans(active);
        setLoadingPlans(false);
      },
      (err) => {
        handleSnapshotError(err, 'plans');
        setLoadingPlans(false);
      }
    );

    // D2. Listen to Meta Ads (Phase 5B)
    const metaAdsUnsub = onSnapshot(
      collection(db, 'meta_ads'),
      (snapshot) => {
        const active: MetaAd[] = [];
        const deleted: MetaAd[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as MetaAd;
          if (data.isDeleted) {
            deleted.push(data);
          } else {
            active.push(data);
          }
        });
        active.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setMetaAds(active);
        setDeletedMetaAds(deleted);
        setLoadingMetaAds(false);
      },
      (err) => {
        handleSnapshotError(err, 'meta_ads');
        setLoadingMetaAds(false);
      }
    );

    // D3. Listen to Festival Events Calendar
    const festivalUnsub = onSnapshot(
      collection(db, 'festival_events'),
      (snapshot) => {
        const list: FestivalEvent[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as FestivalEvent;
          if (!data.isDeleted) {
            list.push(data);
          }
        });
        list.sort((a, b) => a.date.localeCompare(b.date));
        setFestivalEvents(list);
        setLoadingFestivalEvents(false);
      },
      (err) => {
        handleSnapshotError(err, 'festival_events');
        setLoadingFestivalEvents(false);
      }
    );

    // E. Listen to Saved Filters
    const filterUnsub = onSnapshot(
      collection(db, 'saved_filters'),
      (snapshot) => {
        const list: SavedFilterPreset[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as SavedFilterPreset);
        });
        setSavedFilters(list);
      },
      (err) => {
        handleSnapshotError(err, 'saved_filters');
      }
    );

    // F. Listen to Activity Logs (Recent 50)
    const logUnsub = onSnapshot(
      collection(db, 'activity_logs'),
      (snapshot) => {
        const list: ActivityLog[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ActivityLog);
        });
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivityLogs(list.slice(0, 50));
      },
      (err) => {
        handleSnapshotError(err, 'activity_logs');
      }
    );

    // G. Listen to Settings
    const settingsUnsub = onSnapshot(
      doc(db, 'settings', 'main'),
      (doc) => {
        if (doc.exists()) {
          setSettings(doc.data() as GlobalSettings);
        } else {
          setSettings({
            whatsappHub: {
              frequencyWindowDays: 7,
              scope: 'anyMarketing',
              allowedHours: { start: '09:00', end: '21:00' },
              guards: { frequencyEnabled: true, timingEnabled: true },
            },
          });
        }
      },
      (err) => console.error('Error listening to settings:', err)
    );

    // H. Listen to Offers
    const offersUnsub = onSnapshot(
      collection(db, 'offers'),
      (snapshot) => {
        const list: Offer[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Offer);
        });
        setOffers(list);
        setLoadingOffers(false);
      },
      (err) => {
        console.error('Error listening to offers:', err);
        setLoadingOffers(false);
      }
    );

    return () => {
      custUnsub();
      taskUnsub();
      orderUnsub();
      planUnsub();
      metaAdsUnsub();
      festivalUnsub();
      filterUnsub();
      logUnsub();
      settingsUnsub();
      offersUnsub();
    };
  }, [configured, user, retryCount]);

  // Activity Log Helper
  const logActivity = async (
    entity: ActivityLog['entity'],
    entityId: string,
    action: ActivityLog['action'],
    summary: string,
    diff?: Record<string, unknown>
  ) => {
    if (!db) return;
    try {
      const logEntry: Omit<ActivityLog, 'id'> = {
        entity,
        entityId,
        action,
        performedBy: member?.email || user?.email || 'prajindezaa142@gmail.com',
        timestamp: new Date().toISOString(),
        summary,
        diff,
      };
      await addDoc(collection(db, 'activity_logs'), logEntry);
    } catch (e) {
      console.warn('Failed to record activity log:', e);
    }
  };

  // 2. Customers Operations
  const addCustomer = async (
    data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalOrdersCount' | 'totalRevenue' | 'statusHistory' | 'isDeleted'>
  ): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');

    const normalized = normalizePhone(data.phone);
    if (!normalized) {
      throw new Error('Invalid phone number format. Please check the digits.');
    }

    // Duplicate check on normalized phone
    const existing = customers.find((c) => c.phone === normalized);
    if (existing) {
      throw new Error(`Customer with phone ${normalized} already exists: "${existing.companyName}" (${existing.place.city})`);
    }

    const now = new Date().toISOString();
    const newDocRef = doc(collection(db, 'customers'));
    const customerObj: Customer = {
      ...data,
      id: newDocRef.id,
      phone: normalized,
      whatsapp: data.whatsapp ? normalizePhone(data.whatsapp) || normalized : normalized,
      totalOrdersCount: 0,
      totalRevenue: 0,
      statusHistory: [
        {
          from: data.status,
          to: data.status,
          changedBy: member?.email || 'admin',
          changedAt: now,
          reason: 'Initial creation',
        },
      ],
      stageHistory: [{
        from: data.leadStage,
        to: data.leadStage,
        changedBy: member?.email || 'admin',
        changedAt: now,
      }],
      lastWriteSource: 'manual_create',
      updatedBy: member?.email || user?.email || 'admin',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newDocRef, customerObj);
    await logActivity('customer', newDocRef.id, 'create', `Created customer: ${customerObj.companyName} (${customerObj.place.city})`);
    return newDocRef.id;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const existing = customers.find((c) => c.id === id);

    const now = new Date().toISOString();
    let nextUpdates: Partial<Customer> = {
      ...updates,
      updatedAt: now,
      lastWriteSource: 'manual_edit' as const,
      updatedBy: member?.email || user?.email || 'admin',
    };

    if (updates.phone) {
      const normalized = normalizePhone(updates.phone);
      if (normalized) nextUpdates.phone = normalized;
    }
    if (updates.whatsapp) {
      const normalizedWp = normalizePhone(updates.whatsapp);
      if (normalizedWp) nextUpdates.whatsapp = normalizedWp;
    }

    // Status transition tracking
    if (existing && updates.status && updates.status !== existing.status) {
      const historyEntry = {
        from: existing.status,
        to: updates.status,
        changedBy: member?.email || 'admin',
        changedAt: now,
        reason: 'Status updated from customer view',
      };
      nextUpdates.statusHistory = [historyEntry, ...(existing.statusHistory || [])];
    }

    // Lead stage transition tracking (for Rule 1 preview & audit)
    if (existing && updates.leadStage && updates.leadStage !== existing.leadStage) {
      const stageEntry = {
        from: existing.leadStage,
        to: updates.leadStage,
        changedBy: member?.email || 'admin',
        changedAt: now,
      };
      nextUpdates.stageHistory = [stageEntry, ...(existing.stageHistory || [])];
    }

    await updateDoc(doc(db, 'customers', id), nextUpdates);
    await logActivity('customer', id, 'update', `Updated customer ${existing?.companyName || id}`);
  };

  const softDeleteCustomer = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const existing = customers.find((c) => c.id === id);
    const now = new Date().toISOString();

    await updateDoc(doc(db, 'customers', id), {
      isDeleted: true,
      deletedAt: now,
      deletedBy: member?.email || user?.email || 'admin',
      updatedAt: now,
    });

    await logActivity('customer', id, 'soft_delete', `Moved customer to 30-day trash: ${existing?.companyName || id}`);
  };

  const logOutreach = async (
    customerId: string,
    log: Omit<OutreachLog, 'id' | 'loggedAt' | 'loggedBy'>
  ): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) throw new Error('Customer not found');

    const now = new Date().toISOString();
    const outreachEntry: OutreachLog = {
      ...log,
      id: `outreach-${Date.now()}`,
      loggedBy: member?.email || user?.email || 'admin',
      loggedAt: now,
    };

    const updates: Partial<Customer> = {
      updatedAt: now,
      lastWriteSource: 'manual_edit' as const,
      updatedBy: member?.email || user?.email || 'admin',
    };

    if (log.nextFollowUp) {
      updates.nextFollowUpDate = log.nextFollowUp;
    }

    let newStage: typeof customer.leadStage | undefined;
    if (log.outcome === 'Interested') {
      newStage = 'Interested';
    } else if (log.outcome === 'Not interested') {
      newStage = 'Not interested';
    } else if (customer.leadStage === 'New') {
      newStage = 'Contacted';
    }

    if (newStage && newStage !== customer.leadStage) {
      updates.leadStage = newStage;
      updates.stageHistory = [{
        from: customer.leadStage,
        to: newStage,
        changedBy: member?.email || 'admin',
        changedAt: now,
      }, ...(customer.stageHistory || [])];
    }

    let currentTags = [...(customer.tags || [])];

    // Rule 3: Never changes stage. If answered, replied, or interested -> remove 'Cold' tag
    if (log.outcome === 'Answered' || log.outcome === 'Interested') {
      currentTags = currentTags.filter((t) => t !== 'Cold' && t !== 'Cold Lead');
      updates.tags = currentTags;
    } else if (log.outcome === 'No answer') {
      // Check past outreach logs for consecutive 'No answer' outcomes
      try {
        const pastLogsSnap = await getDocs(
          query(
            collection(db, 'customers', customerId, 'outreach_logs'),
            orderBy('loggedAt', 'desc'),
            limit(5)
          )
        );
        const pastLogs = pastLogsSnap.docs.map((d) => d.data());
        // Counting consecutive 'No answer' outcomes including this one
        let consecutiveNoAnswer = 1;
        for (const pl of pastLogs) {
          if (pl.outcome === 'No answer') {
            consecutiveNoAnswer++;
          } else {
            break;
          }
        }

        // Rule 3 default: 3 consecutive unanswered attempts -> add 'Cold' tag
        // Do not add for 'Ordered', 'Old customer', or 'Not interested'
        const isExcluded =
          customer.status === 'Old customer' ||
          customer.leadStage === 'Ordered' ||
          customer.leadStage === 'Not interested';

        if (consecutiveNoAnswer >= 3 && !isExcluded) {
          if (!currentTags.includes('Cold')) {
            currentTags.push('Cold');
            updates.tags = currentTags;
          }
        }
      } catch (err) {
        console.warn('[Rule 3 Tag Check] Could not query past outreach logs:', err);
      }
    }

    await updateDoc(doc(db, 'customers', customerId), updates);
    await addDoc(collection(db, 'customers', customerId, 'outreach_logs'), outreachEntry);
    await logActivity('customer', customerId, 'update', `Logged ${log.channel} outcome (${log.outcome}) for ${customer.companyName}`);
  };

  const importCustomersBatch = async (
    newCustomers: Customer[]
  ): Promise<{ imported: number; updated: number; skipped: number }> => {
    if (!db) throw new Error('Firestore not initialized');

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const cust of newCustomers) {
      const normalized = normalizePhone(cust.phone);
      if (!normalized) {
        skipped++;
        continue;
      }

      const existing = customers.find((c) => c.phone === normalized);
      if (existing) {
        // Update existing customer with new info
        await updateDoc(doc(db, 'customers', existing.id), {
          ...cust,
          phone: normalized,
          id: existing.id,
          totalOrdersCount: existing.totalOrdersCount,
          totalRevenue: existing.totalRevenue,
          statusHistory: existing.statusHistory,
          lastWriteSource: 'bulk_import' as const,
          updatedBy: member?.email || user?.email || 'import',
          updatedAt: new Date().toISOString(),
        });
        updated++;
      } else {
        const docRef = doc(collection(db, 'customers'));
        const fullCust: Customer = {
          ...cust,
          id: docRef.id,
          phone: normalized,
          whatsapp: cust.whatsapp ? normalizePhone(cust.whatsapp) || normalized : normalized,
          totalOrdersCount: 0,
          totalRevenue: 0,
          statusHistory: [
            {
              from: cust.status,
              to: cust.status,
              changedBy: member?.email || 'import',
              changedAt: new Date().toISOString(),
              reason: 'Bulk CSV/Excel import',
            },
          ],
          lastWriteSource: 'bulk_import' as const,
          updatedBy: member?.email || user?.email || 'import',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(docRef, fullCust);
        imported++;
      }
    }

    await logActivity(
      'customer',
      'batch-import',
      'create',
      `Imported ${imported} new customers, updated ${updated}, skipped ${skipped}`
    );

    return { imported, updated, skipped };
  };

  // 3. Tasks Operations
  const addTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    const docRef = doc(collection(db, 'tasks'));

    const taskObj: Task = {
      ...data,
      id: docRef.id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, taskObj);
    await logActivity('task', docRef.id, 'create', `Created task: ${data.title} for ${data.date}`);
    return docRef.id;
  };

  const updateTask = async (id: string, updates: Partial<Task>): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    await updateDoc(doc(db, 'tasks', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await logActivity('task', id, 'update', `Updated task ${id}`);
  };

  const completeTask = async (id: string, note?: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', id), {
      status: 'Done',
      completionNote: note || 'Task marked as completed',
      completedAt: now,
      completedBy: member?.email || user?.email || 'admin',
      updatedAt: now,
    });
    await logActivity('task', id, 'status_change', `Completed task ${id}`);
  };

  const softDeleteTask = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', id), {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    });
    await logActivity('task', id, 'soft_delete', `Moved task ${id} to 30-day trash`);
  };

  const bulkGenerateTasks = async (
    targetCustomers: Customer[],
    type: TaskType,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<number> => {
    if (!db) throw new Error('Firestore not initialized');
    let count = 0;
    const now = new Date().toISOString();

    for (const cust of targetCustomers) {
      const docRef = doc(collection(db, 'tasks'));
      const taskObj: Task = {
        id: docRef.id,
        title: `${type === 'Call' ? 'Call' : type === 'WhatsApp' ? 'WhatsApp' : 'Visit'} ${cust.companyName} (${cust.place.city})`,
        description: `Follow up regarding pooja products catalog & wholesale quotation. Contact: ${cust.contactPerson} (${cust.phone}).`,
        customerId: cust.id,
        customerName: cust.companyName,
        type,
        assignedTo: cust.assignedTo || member?.email || 'prajindezaa142@gmail.com',
        priority: cust.customerType === 'Wholesaler' || cust.customerType === 'Distributor' ? 'High' : 'Medium',
        date,
        startTime,
        endTime,
        repeat: 'None',
        status: 'Pending',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, taskObj);
      count++;
    }

    await logActivity('task', 'bulk-generate', 'create', `Bulk generated ${count} follow-up tasks for ${date}`);
    return count;
  };

  // 4. Atomic Order Creation Transaction (Requirement 9)
  const createOrderTransaction = async (
    orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'isDeleted'>
  ): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');

    const customerRef = doc(db, 'customers', orderData.customerId);
    const orderRef = doc(collection(db, 'orders'));
    const orderNumber = `JKI-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      const custDoc = await transaction.get(customerRef);
      if (!custDoc.exists()) {
        throw new Error('Customer document does not exist.');
      }

      const custData = custDoc.data() as Customer;
      const prevOrdersCount = custData.totalOrdersCount || 0;
      const prevRevenue = custData.totalRevenue || 0;
      const newOrdersCount = prevOrdersCount + 1;
      const newRevenue = prevRevenue + orderData.totalAmount;

      // 1. Prepare Order Document
      const newOrder: Order = {
        ...orderData,
        id: orderRef.id,
        orderNumber,
        recordedBy: member?.email || user?.email || 'admin',
        isDeleted: false,
        createdAt: now,
      };

      // 2. Customer updates: totalOrdersCount, totalRevenue, promote status to "Old customer", leadStage to "Ordered"
      const statusHistory = custData.statusHistory || [];
      const isPromoted = custData.status !== 'Old customer';

      const nextStatusHistory = isPromoted
        ? [
            {
              from: custData.status,
              to: 'Old customer' as CustomerStatus,
              changedBy: member?.email || user?.email || 'admin',
              changedAt: now,
              reason: `Automated status upgrade upon Order ${orderNumber} confirmation`,
            },
            ...statusHistory,
          ]
        : statusHistory;

      // Remove 'Cold' tag or 'Reorder overdue' tag if present upon ordering
      const existingTags: string[] = custData.tags || [];
      const updatedTags = existingTags.filter(t => t !== 'Cold' && t !== 'Cold Lead' && t !== 'Reorder overdue');

      // Execute transaction writes
      transaction.set(orderRef, newOrder);
      transaction.update(customerRef, {
        totalOrdersCount: newOrdersCount,
        totalRevenue: newRevenue,
        status: 'Old customer',
        leadStage: 'Ordered',
        tags: updatedTags,
        statusHistory: nextStatusHistory,
        lastWriteSource: 'manual_edit',
        updatedBy: member?.email || user?.email || 'admin',
        updatedAt: now,
      });
    });

    await logActivity(
      'order',
      orderRef.id,
      'create',
      `Created Order ${orderNumber} for ₹${orderData.totalAmount.toLocaleString('en-IN')} (Customer: ${orderData.customerName})`
    );

    const targetCust = customers.find((c) => c.id === orderData.customerId);
    if (targetCust?.campaignId) {
      recalculateAdMetrics(targetCust.campaignId).catch(console.error);
    }

    return orderRef.id;
  };

  const softDeleteOrder = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'orders', id), {
      isDeleted: true,
      deletedAt: now,
    });
    await logActivity('order', id, 'soft_delete', `Moved Order ${id} to trash`);
  };

  // 5. Planning Operations
  const savePlan = async (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = doc(collection(db, 'plans'));
    const now = new Date().toISOString();

    const planObj: Plan = {
      ...plan,
      id: docRef.id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, planObj);
    await logActivity('plan', docRef.id, 'create', `Created ${plan.planType}: ${plan.title}`);
    return docRef.id;
  };

  // 5B. Meta Ads Operations (Phase 5B)
  const addMetaAd = async (
    adData: Omit<MetaAd, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'stageHistory'>
  ): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = doc(collection(db, 'meta_ads'));
    const now = new Date().toISOString();

    const defaultChecklist = adData.checklist && adData.checklist.length > 0 ? adData.checklist : [
      { id: 'c1', label: 'Creative images formatted & uploaded (1080x1080 / 1080x1920)', completed: (adData.creatives?.length || 0) > 0 },
      { id: 'c2', label: 'Primary ad copy & headline reviewed in Tamil & English', completed: false },
      { id: 'c3', label: 'WhatsApp destination link active & verified', completed: false },
      { id: 'c4', label: 'Target customer types & districts configured', completed: false },
      { id: 'c5', label: 'Meta Ads Manager prepaid balance verified', completed: false },
    ];

    const newAd: MetaAd = {
      ...adData,
      id: docRef.id,
      stage: 'Pending',
      checklist: defaultChecklist,
      stageHistory: [
        {
          stage: 'Pending',
          changedBy: member?.email || user?.email || 'admin',
          changedAt: now,
          reason: 'Initial creation in Planning Hub',
        },
      ],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, newAd);
    await logActivity(
      'meta_ad',
      docRef.id,
      'create',
      `Created Pending Meta Ad: "${newAd.name}" (Total Budget: ₹${newAd.totalBudget || (newAd.dailyBudget * (newAd.durationDays || 1))})`
    );
    return docRef.id;
  };

  const updateMetaAd = async (id: string, updates: Partial<MetaAd>): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const existing = metaAds.find((a) => a.id === id);
    const now = new Date().toISOString();
    const nextUpdates = {
      ...updates,
      updatedAt: now,
    };
    await updateDoc(doc(db, 'meta_ads', id), nextUpdates);
    await logActivity('meta_ad', id, 'update', `Updated Meta Ad: "${existing?.name || id}"`);
  };

  const changeMetaAdStage = async (
    id: string,
    targetStage: MetaAdStage,
    options?: { resultsPayload?: Partial<MetaAdResults>; cancelReason?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!db) throw new Error('Firestore not initialized');
    const ad = metaAds.find((a) => a.id === id);
    if (!ad) return { success: false, error: 'Ad campaign not found' };

    const validation = validateStageTransition(ad, targetStage, options);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();
    const updatedHistory = [
      {
        stage: targetStage,
        changedBy: member?.email || user?.email || 'admin',
        changedAt: now,
        reason: options?.cancelReason || (targetStage === 'Fulfilled' ? 'Results entered and verified' : `Moved from ${ad.stage} to ${targetStage}`),
      },
      ...(ad.stageHistory || []),
    ];

    const updates: Partial<MetaAd> = {
      stage: targetStage,
      stageHistory: updatedHistory,
      updatedAt: now,
    };

    if (targetStage === 'Cancelled' && options?.cancelReason) {
      updates.cancelReason = options.cancelReason;
    }

    if (targetStage === 'Fulfilled' && options?.resultsPayload) {
      updates.results = {
        ...(ad.results || {}),
        ...options.resultsPayload,
      } as MetaAdResults;
    }

    await updateDoc(doc(db, 'meta_ads', id), updates);
    await logActivity('meta_ad', id, 'status_change', `Ad "${ad.name}" moved from ${ad.stage} -> ${targetStage}`);
    return { success: true };
  };

  const cloneMetaAd = async (sourceAdId: string): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const source = metaAds.find((a) => a.id === sourceAdId);
    if (!source) throw new Error('Source ad not found');

    const docRef = doc(collection(db, 'meta_ads'));
    const now = new Date().toISOString();

    const clonedAd: MetaAd = {
      id: docRef.id,
      name: `${source.name} (Copy)`,
      description: source.description || '',
      occasion: source.occasion || '',
      festivalEventId: source.festivalEventId || '',
      goal: source.goal || 'Messages/Conversations',
      stage: 'Pending',
      targetCustomers: source.targetCustomers ? { ...source.targetCustomers } : { types: [], places: [], notes: '' },
      plannedAudience: source.plannedAudience ? { ...source.plannedAudience } : { ageRange: '25-55', gender: 'All', interests: [], locations: [] },
      creatives: source.creatives ? [...source.creatives] : [],
      primaryText: source.primaryText || '',
      headline: source.headline || '',
      cta: source.cta || 'Send WhatsApp Message',
      destination: source.destination || '',
      placements: source.placements ? [...source.placements] : [],
      dailyBudget: source.dailyBudget || 0,
      totalBudget: source.totalBudget || 0,
      durationDays: source.durationDays || 7,
      plannedStart: '',
      plannedEnd: '',
      createdBy: member?.email || user?.email || 'admin',
      assignedTo: source.assignedTo || member?.email || 'admin',
      checklist: source.checklist?.map((c) => ({ ...c, completed: false })) || [],
      notes: source.notes || '',
      stageHistory: [
        {
          stage: 'Pending',
          changedBy: member?.email || user?.email || 'admin',
          changedAt: now,
          reason: `Cloned from ad: "${source.name}"`,
        },
      ],
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, clonedAd);
    await logActivity('meta_ad', docRef.id, 'create', `Cloned ad "${source.name}" into new Pending ad`);
    return docRef.id;
  };

  const softDeleteMetaAd = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const existing = metaAds.find((a) => a.id === id);
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'meta_ads', id), {
      isDeleted: true,
      deletedAt: now,
      deletedBy: member?.email || user?.email || 'admin',
      updatedAt: now,
    });
    await logActivity('meta_ad', id, 'soft_delete', `Moved Meta Ad to trash: "${existing?.name || id}"`);
  };

  const getDerivedAdMetrics = (adId: string): DerivedBusinessOutcome => {
    const matchingCustomers = customers.filter((c) => !c.isDeleted && c.campaignId === adId);
    const customerIds = new Set(matchingCustomers.map((c) => c.id));
    const matchingOrders = orders.filter((o) => !o.isDeleted && customerIds.has(o.customerId));
    const revenue = matchingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const ad = metaAds.find((a) => a.id === adId);
    const spend =
      ad?.results?.totalSpent ??
      ad?.totalBudget ??
      (ad ? (ad.dailyBudget || 0) * (ad.durationDays || 1) : 0);

    const roi = spend > 0 ? calculateRoi(revenue, spend) : 0;
    const costPerCust = matchingCustomers.length > 0 ? calculateCostPerCustomer(spend, matchingCustomers.length) : 0;
    const costPerOrd = matchingOrders.length > 0 ? calculateCostPerOrder(spend, matchingOrders.length) : 0;

    return {
      customersImported: matchingCustomers.length,
      orders: matchingOrders.length,
      revenue,
      roi: roi ?? 0,
      costPerCustomer: costPerCust ?? 0,
      costPerOrder: costPerOrd ?? 0,
    };
  };

  const recalculateAdMetrics = async (adId: string): Promise<DerivedBusinessOutcome> => {
    if (!db) throw new Error('Firestore not initialized');
    const outcome = getDerivedAdMetrics(adId);
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'meta_ads', adId), {
      derived: outcome,
      updatedAt: now,
    });
    return outcome;
  };

  const addPastAd = async (
    adData: Partial<MetaAd>,
    linkedCustomerIds: string[] = [],
    isDraft: boolean = false
  ): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const firestore = db;

    const validation = validatePastAd(adData, metaAds, isDraft);
    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    const docRef = doc(collection(firestore, 'meta_ads'));
    const adId = docRef.id;
    const now = new Date().toISOString();
    const userEmail = member?.email || user?.email || 'admin';

    const defaultChecklist = adData.checklist && adData.checklist.length > 0 ? adData.checklist : [
      { id: 'c1', label: 'Historical ad creatives & primary copy archived', completed: true },
      { id: 'c2', label: 'Meta Ads Manager results verified', completed: true },
      { id: 'c3', label: 'Customer leads attributed to campaign', completed: linkedCustomerIds.length > 0 },
    ];

    const pastAd: MetaAd = {
      id: adId,
      name: adData.name || 'Completed Historical Ad',
      description: adData.description || '',
      occasion: adData.occasion || '',
      festivalEventId: adData.festivalEventId || '',
      goal: adData.goal || 'Messages/Conversations',
      stage: 'Fulfilled',
      cancelReason: '',
      targetCustomers: adData.targetCustomers || { types: [], places: [], notes: '' },
      plannedAudience: adData.plannedAudience || { ageRange: '25-55', gender: 'All', interests: [], locations: [] },
      creatives: adData.creatives || [],
      primaryText: adData.primaryText || '',
      headline: adData.headline || '',
      cta: adData.cta || 'Send WhatsApp Message',
      destination: adData.destination || '',
      placements: adData.placements || ['Facebook Feed', 'Instagram Feed'],
      dailyBudget: adData.dailyBudget ?? 0,
      totalBudget: adData.totalBudget ?? adData.results?.totalSpent ?? 0,
      plannedStart: adData.plannedStart || '',
      plannedEnd: adData.plannedEnd || '',
      durationDays: adData.durationDays || 7,
      createdBy: adData.createdBy || userEmail,
      assignedTo: adData.assignedTo || userEmail,
      checklist: defaultChecklist,
      notes: adData.notes || '',
      stageHistory: [
        {
          stage: 'Fulfilled',
          changedBy: userEmail,
          changedAt: now,
          reason: isDraft ? 'Saved as draft past ad' : 'Added as completed (historical)',
        },
      ],
      results: adData.results || {
        conversations: null,
        costPerConversation: null,
        views: null,
        viewers: null,
        frequency: null,
        audienceAge: null,
        audienceGender: null,
        audiencePlaces: null,
        totalSpent: null,
        dailyBudget: null,
        actualDuration: null,
        actualStart: null,
        actualEnd: null,
        engagements: null,
        reactions: null,
        comments: null,
        shares: null,
        saves: null,
        linkClicks: null,
        ctr: null,
      },
      isHistorical: true,
      addedAsHistoricalBy: userEmail,
      addedAsHistoricalAt: now,
      importBatchId: adData.importBatchId || '',
      isDraft: Boolean(isDraft),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const batch = writeBatch(firestore);
    batch.set(docRef, pastAd);

    if (linkedCustomerIds.length > 0) {
      linkedCustomerIds.forEach((cId) => {
        const custRef = doc(firestore, 'customers', cId);
        const existingCust = customers.find((c) => c.id === cId);
        if (existingCust?.campaignId && existingCust.campaignId !== adId) {
          logActivity(
            'customer',
            cId,
            'update',
            `Reattributed customer "${existingCust.companyName}" from ad "${existingCust.campaignId}" to past ad "${pastAd.name}"`
          ).catch(console.error);
        }
        batch.update(custRef, {
          campaignId: adId,
          source: 'Meta Ads',
          updatedAt: now,
        });
      });
    }

    await batch.commit();

    // Compute derived outcome
    if (linkedCustomerIds.length > 0) {
      await recalculateAdMetrics(adId);
    }

    await logActivity(
      'meta_ad',
      adId,
      'create',
      isDraft
        ? `Saved draft past ad: "${pastAd.name}"`
        : `Added completed past ad: "${pastAd.name}" (Total Spent: ₹${pastAd.results?.totalSpent ?? pastAd.totalBudget})`
    );

    return adId;
  };

  const attachCustomersToAd = async (
    adId: string,
    customerIds: string[]
  ): Promise<{ attached: number; moved: number }> => {
    if (!db) throw new Error('Firestore not initialized');
    const firestore = db;
    if (customerIds.length === 0) return { attached: 0, moved: 0 };

    const batch = writeBatch(firestore);
    const now = new Date().toISOString();
    let moved = 0;
    let attached = 0;

    const ad = metaAds.find((a) => a.id === adId);
    const targetAdName = ad?.name || adId;

    customerIds.forEach((cId) => {
      const cust = customers.find((c) => c.id === cId);
      if (cust) {
        if (cust.campaignId && cust.campaignId !== adId) {
          moved++;
          logActivity(
            'customer',
            cId,
            'update',
            `Moved customer "${cust.companyName}" from previous ad to "${targetAdName}"`
          ).catch(console.error);
        } else {
          attached++;
        }
        batch.update(doc(firestore, 'customers', cId), {
          campaignId: adId,
          source: 'Meta Ads',
          updatedAt: now,
        });
      }
    });

    await batch.commit();
    await recalculateAdMetrics(adId);
    return { attached, moved };
  };

  const detachCustomersFromAd = async (
    adId: string,
    customerIds: string[]
  ): Promise<number> => {
    if (!db) throw new Error('Firestore not initialized');
    const firestore = db;
    if (customerIds.length === 0) return 0;

    const batch = writeBatch(firestore);
    const now = new Date().toISOString();

    customerIds.forEach((cId) => {
      batch.update(doc(firestore, 'customers', cId), {
        campaignId: null,
        updatedAt: now,
      });
      logActivity(
        'customer',
        cId,
        'update',
        `Detached customer from ad "${adId}"`
      ).catch(console.error);
    });

    await batch.commit();
    await recalculateAdMetrics(adId);
    return customerIds.length;
  };

  const importPastAdsBatch = async (
    adsList: Array<{ adData: Partial<MetaAd>; linkedCustomerIds?: string[] }>,
    batchId?: string
  ): Promise<{ count: number; batchId: string }> => {
    if (!db) throw new Error('Firestore not initialized');
    const firestore = db;
    const importId = batchId || `batch_${Date.now()}`;
    const now = new Date().toISOString();
    const userEmail = member?.email || user?.email || 'admin';

    // Firestore batch limit is 500 operations
    const chunkSize = 200;
    for (let i = 0; i < adsList.length; i += chunkSize) {
      const chunk = adsList.slice(i, i + chunkSize);
      const batch = writeBatch(firestore);

      chunk.forEach((item) => {
        const docRef = doc(collection(firestore, 'meta_ads'));
        const adId = docRef.id;

        const pastAd: MetaAd = {
          id: adId,
          name: item.adData.name || 'Imported Meta Ad',
          description: item.adData.description || '',
          occasion: item.adData.occasion || '',
          festivalEventId: item.adData.festivalEventId || '',
          goal: item.adData.goal || 'Messages/Conversations',
          stage: 'Fulfilled',
          cancelReason: '',
          targetCustomers: item.adData.targetCustomers || { types: [], places: [], notes: '' },
          plannedAudience: item.adData.plannedAudience || { ageRange: '25-55', gender: 'All', interests: [], locations: [] },
          creatives: item.adData.creatives || [],
          primaryText: item.adData.primaryText || '',
          headline: item.adData.headline || '',
          cta: item.adData.cta || 'Send WhatsApp Message',
          destination: item.adData.destination || '',
          placements: item.adData.placements || ['Facebook Feed', 'Instagram Feed'],
          dailyBudget: item.adData.dailyBudget ?? 0,
          totalBudget: item.adData.totalBudget ?? item.adData.results?.totalSpent ?? 0,
          plannedStart: item.adData.plannedStart || '',
          plannedEnd: item.adData.plannedEnd || '',
          durationDays: item.adData.durationDays || 7,
          createdBy: item.adData.createdBy || userEmail,
          assignedTo: item.adData.assignedTo || userEmail,
          checklist: [],
          notes: item.adData.notes || '',
          stageHistory: [
            {
              stage: 'Fulfilled',
              changedBy: userEmail,
              changedAt: now,
              reason: `Bulk imported from spreadsheet (Batch: ${importId})`,
            },
          ],
          results: item.adData.results || {
            conversations: null,
            costPerConversation: null,
            views: null,
            viewers: null,
            frequency: null,
            audienceAge: null,
            audienceGender: null,
            audiencePlaces: null,
            totalSpent: null,
            dailyBudget: null,
            actualDuration: null,
            actualStart: null,
            actualEnd: null,
            engagements: null,
            reactions: null,
            comments: null,
            shares: null,
            saves: null,
            linkClicks: null,
            ctr: null,
          },
          isHistorical: true,
          addedAsHistoricalBy: userEmail,
          addedAsHistoricalAt: now,
          importBatchId: importId,
          isDraft: false,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };

        batch.set(docRef, pastAd);

        if (item.linkedCustomerIds && item.linkedCustomerIds.length > 0) {
          item.linkedCustomerIds.forEach((cId) => {
            batch.update(doc(firestore, 'customers', cId), {
              campaignId: adId,
              source: 'Meta Ads',
              updatedAt: now,
            });
          });
        }
      });

      await batch.commit();
    }

    await logActivity(
      'meta_ad',
      importId,
      'create',
      `Imported batch of ${adsList.length} past Meta ads (Batch ID: ${importId})`
    );

    return { count: adsList.length, batchId: importId };
  };

  const undoPastAdsBatch = async (batchId: string): Promise<number> => {
    if (!db) throw new Error('Firestore not initialized');
    const firestore = db;
    const matchingAds = metaAds.filter((a) => a.importBatchId === batchId && !a.isDeleted);
    if (matchingAds.length === 0) return 0;

    const adIds = new Set(matchingAds.map((a) => a.id));
    const now = new Date().toISOString();
    const userEmail = member?.email || user?.email || 'admin';

    const batch = writeBatch(firestore);

    matchingAds.forEach((a) => {
      batch.update(doc(firestore, 'meta_ads', a.id), {
        isDeleted: true,
        deletedAt: now,
        deletedBy: userEmail,
        updatedAt: now,
      });
    });

    // Unlink any customer associated with these ads
    customers.forEach((c) => {
      if (c.campaignId && adIds.has(c.campaignId)) {
        batch.update(doc(firestore, 'customers', c.id), {
          campaignId: null,
          updatedAt: now,
        });
      }
    });

    await batch.commit();

    await logActivity(
      'meta_ad',
      batchId,
      'soft_delete',
      `Undid past ads import batch ${batchId} (Moved ${matchingAds.length} ads to trash)`
    );

    return matchingAds.length;
  };

  // Festival Events Operations
  const addFestivalEvent = async (
    eventData: Omit<FestivalEvent, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = doc(collection(db, 'festival_events'));
    const now = new Date().toISOString();
    const newEvent: FestivalEvent = {
      ...eventData,
      id: docRef.id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(docRef, newEvent);
    await logActivity('festival_event', docRef.id, 'create', `Added festival: "${newEvent.name}" (${newEvent.date})`);
    return docRef.id;
  };

  const updateFestivalEvent = async (id: string, updates: Partial<FestivalEvent>): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'festival_events', id), {
      ...updates,
      updatedAt: now,
    });
    await logActivity('festival_event', id, 'update', `Updated festival event ${id}`);
  };

  const deleteFestivalEvent = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    await updateDoc(doc(db, 'festival_events', id), {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
    });
    await logActivity('festival_event', id, 'soft_delete', `Deleted festival event ${id}`);
  };

  // 6. Trash Items Aggregation & 30-Day Expiration
  const trashItems = useMemo<TrashItem[]>(() => {
    const list: TrashItem[] = [];
    const now = new Date().getTime();

    // Customers in trash
    deletedCustomers.forEach((c) => {
      const delTime = c.deletedAt ? new Date(c.deletedAt).getTime() : now;
      const ageDays = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(0, 30 - ageDays);
      list.push({
        id: c.id,
        entity: 'customer',
        title: c.companyName,
        details: `${c.place.city} · ${c.phone} · ${c.customerType}`,
        deletedBy: c.deletedBy || 'admin',
        deletedAt: c.deletedAt || new Date().toISOString(),
        daysRemaining: remaining,
        originalData: c as unknown as Record<string, unknown>,
      });
    });

    // Tasks in trash
    deletedTasks.forEach((t) => {
      const delTime = t.deletedAt ? new Date(t.deletedAt).getTime() : now;
      const ageDays = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(0, 30 - ageDays);
      list.push({
        id: t.id,
        entity: 'task',
        title: t.title,
        details: `Scheduled for ${t.date} (${t.startTime}) · ${t.priority} Priority`,
        deletedBy: 'admin',
        deletedAt: t.deletedAt || new Date().toISOString(),
        daysRemaining: remaining,
        originalData: t as unknown as Record<string, unknown>,
      });
    });

    // Orders in trash
    deletedOrders.forEach((o) => {
      const delTime = o.deletedAt ? new Date(o.deletedAt).getTime() : now;
      const ageDays = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(0, 30 - ageDays);
      list.push({
        id: o.id,
        entity: 'order',
        title: `Order ${o.orderNumber}`,
        details: `Total: ₹${o.totalAmount.toLocaleString('en-IN')} · ${o.customerName}`,
        deletedBy: 'admin',
        deletedAt: o.deletedAt || new Date().toISOString(),
        daysRemaining: remaining,
        originalData: o as unknown as Record<string, unknown>,
      });
    });

    // Meta Ads in trash
    deletedMetaAds.forEach((a) => {
      const delTime = a.deletedAt ? new Date(a.deletedAt).getTime() : now;
      const ageDays = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(0, 30 - ageDays);
      list.push({
        id: a.id,
        entity: 'meta_ad',
        title: `Meta Ad: ${a.name}`,
        details: `${a.stage} · Goal: ${a.goal} · Budget: ₹${a.totalBudget || a.dailyBudget}`,
        deletedBy: a.deletedBy || 'admin',
        deletedAt: a.deletedAt || new Date().toISOString(),
        daysRemaining: remaining,
        originalData: a as unknown as Record<string, unknown>,
      });
    });

    return list.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }, [deletedCustomers, deletedTasks, deletedOrders, deletedMetaAds]);

  const restoreTrashItem = async (item: TrashItem): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const colName =
      item.entity === 'customer'
        ? 'customers'
        : item.entity === 'task'
        ? 'tasks'
        : item.entity === 'order'
        ? 'orders'
        : 'meta_ads';
    await updateDoc(doc(db, colName, item.id), {
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    });
    await logActivity(item.entity, item.id, 'restore', `Restored ${item.title} from trash`);
  };

  const permanentlyDeleteTrashItem = async (item: TrashItem): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const colName =
      item.entity === 'customer'
        ? 'customers'
        : item.entity === 'task'
        ? 'tasks'
        : item.entity === 'order'
        ? 'orders'
        : 'meta_ads';
    await deleteDoc(doc(db, colName, item.id));
    await logActivity(item.entity, item.id, 'update', `Permanently deleted ${item.title}`);
  };

  const emptyExpiredTrash = async (): Promise<number> => {
    if (!db) throw new Error('Firestore not initialized');
    let purged = 0;
    for (const item of trashItems) {
      if (item.daysRemaining <= 0) {
        await permanentlyDeleteTrashItem(item);
        purged++;
      }
    }
    return purged;
  };

  // 7. Saved Filters
  const saveFilterPreset = async (
    name: string,
    entity: 'customers' | 'tasks' | 'orders',
    filters: Record<string, unknown>
  ): Promise<string> => {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = doc(collection(db, 'saved_filters'));
    const preset: SavedFilterPreset = {
      id: docRef.id,
      name,
      entity,
      filters,
      createdBy: member?.email || user?.email || 'admin',
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, preset);
    return docRef.id;
  };

  const deleteFilterPreset = async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    await deleteDoc(doc(db, 'saved_filters', id));
  };

  // 8. Seeding Initial Demo Data (Pooja Products Manufacturer in Tamil Nadu)
  const seedInitialData = async () => {
    if (!db) throw new Error('Firestore not initialized');
    setIsSeeding(true);

    try {
      const sampleCustomers = [
        {
          companyName: 'Murugan Stores & Pooja Center',
          contactPerson: 'Murugan Swamy',
          phone: '+919842154321',
          whatsapp: '+919842154321',
          place: { area: 'Town Hall', city: 'Salem', district: 'Salem', state: 'Tamil Nadu' },
          customerType: 'Wholesaler',
          status: 'New customer' as CustomerStatus,
          source: 'Meta Ads' as const,
          campaignId: 'META-CAMPHOR-OCT26',
          leadStage: 'Interested' as LeadStage,
          assignedTo: 'prajindezaa142@gmail.com',
          tags: ['Camphor Tablets', 'Bulk Order', 'Wholesale'],
          notes: 'Interested in 500 jars of 100g Bhimseni Camphor and 200 bottles of Lamp Oil. Follow up with wholesale price list.',
          nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        },
        {
          companyName: 'Sri Krishna Vilas Agarbatti Mart',
          contactPerson: 'K. Venkatesan',
          phone: '+919443212345',
          whatsapp: '+919443212345',
          place: { area: 'R.S. Puram', city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu' },
          customerType: 'Distributor',
          status: 'Old customer' as CustomerStatus,
          source: 'Reference / Word of Mouth' as const,
          leadStage: 'Ordered' as LeadStage,
          assignedTo: 'prajindezaa142@gmail.com',
          tags: ['Regular', 'Agarbatti', 'Distributor'],
          notes: 'Monthly recurring wholesale order of Flora Agarbatti and Deepam Lamp Oil.',
          nextFollowUpDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        },
        {
          companyName: 'Meenakshi Amman Temple Trust Store',
          contactPerson: 'S. Ramanathan',
          phone: '+919865012345',
          whatsapp: '+919865012345',
          place: { area: 'South Masi St', city: 'Madurai', district: 'Madurai', state: 'Tamil Nadu' },
          customerType: 'Temple/Institution',
          status: 'New customer' as CustomerStatus,
          source: 'Meta Ads' as const,
          campaignId: 'META-TEMPLE-DIWALI26',
          leadStage: 'Negotiation' as LeadStage,
          assignedTo: 'prajindezaa142@gmail.com',
          tags: ['Temple Trust', 'Lamp Oil', 'Festival Order'],
          notes: 'Needs 500 Litres of pure Deepam Lamp Oil and pure Sambrani cups for festival pooja.',
          nextFollowUpDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        },
        {
          companyName: 'Erode Kaveri Pooja Nilayam',
          contactPerson: 'M. Palaniswamy',
          phone: '+919488112233',
          whatsapp: '+919488112233',
          place: { area: 'Brough Road', city: 'Erode', district: 'Erode', state: 'Tamil Nadu' },
          customerType: 'Retailer',
          status: 'New customer' as CustomerStatus,
          source: 'Meta Ads' as const,
          campaignId: 'META-CAMPHOR-OCT26',
          leadStage: 'Contacted' as LeadStage,
          assignedTo: 'prajindezaa142@gmail.com',
          tags: ['Rose Water', 'Camphor', 'Retail'],
          notes: 'Inquired through Facebook Lead ad for Camphor tablets and Rose Water 500ml.',
          nextFollowUpDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        },
        {
          companyName: 'Tiruppur Kumaran Pooja Bhandar',
          contactPerson: 'T. R. Senthil',
          phone: '+919789012345',
          whatsapp: '+919789012345',
          place: { area: 'Kumaran Road', city: 'Tiruppur', district: 'Tiruppur', state: 'Tamil Nadu' },
          customerType: 'Wholesaler',
          status: 'New customer' as CustomerStatus,
          source: 'Meta Ads' as const,
          campaignId: 'META-CAMPHOR-OCT26',
          leadStage: 'Sample sent' as LeadStage,
          assignedTo: 'prajindezaa142@gmail.com',
          tags: ['Sample Sent', 'Bhimseni Camphor'],
          notes: 'Sample box of Bhimseni Camphor jars sent via ST Courier on Monday.',
          nextFollowUpDate: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10),
        },
      ];

      for (const sample of sampleCustomers) {
        const docRef = doc(collection(db, 'customers'));
        const now = new Date().toISOString();
        const fullCust: Customer = {
          ...sample,
          id: docRef.id,
          totalOrdersCount: sample.status === 'Old customer' ? 3 : 0,
          totalRevenue: sample.status === 'Old customer' ? 42500 : 0,
          statusHistory: [
            {
              from: sample.status,
              to: sample.status,
              changedBy: 'seed',
              changedAt: now,
              reason: 'Initial seed',
            },
          ],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(docRef, fullCust);
      }

      // Sample Initial Tasks
      const todayStr = new Date().toISOString().slice(0, 10);
      const sampleTasks = [
        {
          title: 'Call Salem Murugan Stores for Camphor Order Quotation',
          description: 'Follow up on wholesale inquiry of 500 jars of 100g Bhimseni Camphor.',
          customerName: 'Murugan Stores & Pooja Center',
          type: 'Call' as TaskType,
          assignedTo: 'prajindezaa142@gmail.com',
          priority: 'High' as const,
          date: todayStr,
          startTime: '10:00',
          endTime: '10:30',
          repeat: 'None' as TaskRepeat,
          status: 'Pending' as TaskStatus,
        },
        {
          title: 'Send WhatsApp Festival Wholesale Price List to Madurai Temple Trust',
          description: 'Share Deepam Lamp Oil 1L bulk rates and sample catalog over WhatsApp.',
          customerName: 'Meenakshi Amman Temple Trust Store',
          type: 'WhatsApp' as TaskType,
          assignedTo: 'prajindezaa142@gmail.com',
          priority: 'High' as const,
          date: todayStr,
          startTime: '11:30',
          endTime: '12:00',
          repeat: 'None' as TaskRepeat,
          status: 'Pending' as TaskStatus,
        },
        {
          title: 'Review Meta Ad Campaign (Camphor & Lamp Oil Pooja Bundle)',
          description: 'Analyze Salem & Coimbatore lead submissions, CTR, CPL, and update contact scripts.',
          type: 'Meta ads' as TaskType,
          assignedTo: 'prajindezaa142@gmail.com',
          priority: 'Medium' as const,
          date: todayStr,
          startTime: '15:00',
          endTime: '16:00',
          repeat: 'Weekly' as TaskRepeat,
          status: 'Pending' as TaskStatus,
        },
      ];

      for (const t of sampleTasks) {
        const docRef = doc(collection(db, 'tasks'));
        const now = new Date().toISOString();
        await setDoc(docRef, {
          ...t,
          id: docRef.id,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Sample Order
      const orderRef = doc(collection(db, 'orders'));
      const sampleOrder: Order = {
        id: orderRef.id,
        orderNumber: `JKI-2026-0001`,
        customerId: 'seed-cust-2',
        customerName: 'Sri Krishna Vilas Agarbatti Mart',
        items: [
          { productId: 'p1', productName: 'Pure Bhimseni Camphor 100g Jar', quantity: 100, unitPrice: 180, total: 18000 },
          { productId: 'p4', productName: 'Deepam Lamp Oil 1L Can', quantity: 50, unitPrice: 190, total: 9500 },
        ],
        subtotal: 27500,
        discount: 1000,
        totalAmount: 26500,
        paymentStatus: 'Paid',
        deliveryStatus: 'Delivered',
        orderDate: todayStr,
        recordedBy: 'prajindezaa142@gmail.com',
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };
      // Seed initial Meta Ads if empty
      const metaAdsSnap = await collection(db, 'meta_ads');
      const sampleAdRef = doc(metaAdsSnap);
      const sampleMetaAd: MetaAd = {
        id: sampleAdRef.id,
        name: 'Diwali Festival Bulk Camphor & Deepam Oil Outreach',
        description: 'Wholesale inquiry drive for Pooja stores and distributors across Tamil Nadu',
        occasion: 'Diwali Pooja Season',
        goal: 'Messages/Conversations',
        stage: 'Fulfilled',
        targetCustomers: {
          types: ['Distributor', 'Wholesaler', 'Retailer'],
          places: ['Salem', 'Coimbatore', 'Erode', 'Madurai'],
          notes: 'Focus on pure Bhimseni Camphor jars and Deepam Lamp Oil 1L bulk cartons',
        },
        plannedAudience: {
          ageRange: '25-55',
          gender: 'All',
          interests: ['Hindu Temple', 'Pooja', 'Agarbatti Wholesalers', 'Retail Business'],
          locations: ['Tamil Nadu', 'Salem', 'Coimbatore'],
        },
        creatives: [
          {
            url: 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?auto=format&fit=crop&w=800&q=80',
            name: 'bhimseni-camphor-diwali.jpg',
          },
        ],
        primaryText: 'Factory Direct Pure Bhimseni Camphor & Deepam Lamp Oil for Pooja stores. Contact Jaikrishna Industries Salem.',
        headline: 'Direct Factory Pooja Wholesale Catalog',
        cta: 'Send WhatsApp Message',
        destination: '+919865012345',
        placements: ['Facebook Feed', 'Instagram Feed', 'Instagram Reels'],
        dailyBudget: 1500,
        totalBudget: 15000,
        plannedStart: '2026-10-01T09:00',
        plannedEnd: '2026-10-10T23:59',
        durationDays: 10,
        createdBy: 'prajindezaa142@gmail.com',
        assignedTo: 'prajindezaa142@gmail.com',
        checklist: [
          { id: 'c1', label: 'Creatives ready', completed: true },
          { id: 'c2', label: 'Copy approved', completed: true },
          { id: 'c3', label: 'Audience set', completed: true },
          { id: 'c4', label: 'Payment method OK', completed: true },
          { id: 'c5', label: 'WhatsApp number linked', completed: true },
        ],
        notes: 'Very high response from Salem and Erode pooja shops.',
        stageHistory: [
          { stage: 'Pending', changedBy: 'prajindezaa142@gmail.com', changedAt: '2026-09-28T10:00:00Z' },
          { stage: 'Published', changedBy: 'prajindezaa142@gmail.com', changedAt: '2026-10-01T09:00:00Z' },
          { stage: 'Waiting for result', changedBy: 'prajindezaa142@gmail.com', changedAt: '2026-10-10T23:59:00Z' },
          { stage: 'Fulfilled', changedBy: 'prajindezaa142@gmail.com', changedAt: '2026-10-12T11:00:00Z', reason: 'Meta results verified' },
        ],
        results: {
          conversations: 215,
          costPerConversation: 67.44,
          views: 38400,
          viewers: 24200,
          frequency: 1.59,
          audienceAge: { '18-24': 8, '25-34': 44, '35-44': 32, '45+': 16 },
          audienceGender: { Men: 68, Women: 32 },
          audiencePlaces: { 'Salem & Erode': 45, 'Coimbatore': 35, 'Madurai & Trichy': 20 },
          totalSpent: 14500,
          dailyBudget: 1500,
          actualDuration: 10,
          actualStart: '2026-10-01T09:00',
          actualEnd: '2026-10-10T23:59',
          engagements: 1820,
          reactions: 1140,
          comments: 260,
          shares: 240,
          saves: 180,
          linkClicks: 640,
          ctr: 1.67,
          lessons: 'High conversion for Bhimseni camphor jars creative; video reel got 40% more WhatsApp clicks.',
          rating: 5,
        },
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(sampleAdRef, sampleMetaAd);

      // Seed verified Panchangam festival dates
      const festSnap = await collection(db, 'festival_events');
      const sampleFestivals = [
        { name: 'Diwali / Deepavali (Verified Panchangam)', date: '2026-11-08', notes: 'Major camphor, deepam oil, and agarbatti bulk order festival.' },
        { name: 'Karthigai Deepam (Verified Panchangam)', date: '2026-11-23', notes: 'High lamp oil consumption across Tamil Nadu temples and households.' },
        { name: 'Pongal / Makar Sankranti (Verified Panchangam)', date: '2027-01-14', notes: 'Temple pooja kits and sambrani dhoop cups demand peak.' },
      ];
      for (const fest of sampleFestivals) {
        const festRef = doc(festSnap);
        await setDoc(festRef, {
          ...fest,
          id: festRef.id,
          createdBy: 'prajindezaa142@gmail.com',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await logActivity('customer', 'seed', 'create', 'Seeded initial Jaikrishna Industries workspace');
    } catch (err) {
      console.error('Failed to seed data:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        customers,
        loadingCustomers,
        addCustomer,
        updateCustomer,
        softDeleteCustomer,
        logOutreach,
        importCustomersBatch,
        tasks,
        loadingTasks,
        addTask,
        updateTask,
        completeTask,
        softDeleteTask,
        bulkGenerateTasks,
        orders,
        loadingOrders,
        createOrderTransaction,
        softDeleteOrder,
        plans,
        loadingPlans,
        savePlan,
        metaAds,
        loadingMetaAds,
        addMetaAd,
        addPastAd,
        attachCustomersToAd,
        detachCustomersFromAd,
        recalculateAdMetrics,
        importPastAdsBatch,
        undoPastAdsBatch,
        updateMetaAd,
        changeMetaAdStage,
        cloneMetaAd,
        softDeleteMetaAd,
        getDerivedAdMetrics,
        festivalEvents,
        loadingFestivalEvents,
        addFestivalEvent,
        updateFestivalEvent,
        deleteFestivalEvent,
        trashItems,
        restoreTrashItem,
        permanentlyDeleteTrashItem,
        emptyExpiredTrash,
        savedFilters,
        saveFilterPreset,
        deleteFilterPreset,
        activityLogs,
        logActivity,
        offers,
        loadingOffers,
        addOffer,
        markQueueItemSent,
        undoQueueItemSent,
        settings,
        updateWhatsAppHubSettings,
        seedInitialData,
        isSeeding,
        firestorePermissionError,
        retryConnection,
        dismissPermissionBanner,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
