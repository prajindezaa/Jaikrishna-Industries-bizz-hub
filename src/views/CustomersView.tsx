/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageSquare,
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  MapPin,
  Trash2,
  Share2,
  CheckSquare,
  ChevronDown,
  Sparkles,
  Bookmark,
  RotateCcw,
  Loader2,
  Database,
  Edit3,
  Layers,
  GitMerge,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { Customer, CustomerType, CustomerStatus, LeadStage, LeadSource, OutreachLog } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useApp, SavedFilterPreset } from '../context/AppContext';
import { normalizePhone, formatPhoneDisplay, getTelLink, getWhatsAppLink } from '../lib/phone';
import { exportCustomersToExcel, exportCustomersToPDF, exportFullBackupExcel } from '../lib/export';
import { CustomerImportModal } from '../components/CustomerImportModal';
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer';
import { EditCustomerModal } from '../components/EditCustomerModal';
import { LogOutcomeModal } from '../components/LogOutcomeModal';
import { CustomerGroupSelect } from '../components/customers/CustomerGroupSelect';
import { CustomerGroupBadge } from '../components/customers/CustomerGroupBadge';
import { GroupOverviewCards } from '../components/customers/GroupOverviewCards';
import { TAMIL_NADU_DISTRICTS } from '../lib/districts';
import { useAuth } from '../context/AuthContext';

interface CustomersViewProps {
  onOpenNewCustomer?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = () => {
  const { t } = useLanguage();
  const { member } = useAuth();
  const {
    customers,
    loadingCustomers,
    customerGroups,
    loadingCustomerGroups,
    groupCounters,
    addCustomer,
    updateCustomer,
    softDeleteCustomer,
    logOutreach,
    importCustomersBatch,
    seedInitialData,
    isSeeding,
    savedFilters,
    saveFilterPreset,
    deleteFilterPreset,
    tasks,
    orders,
    plans,
  } = useApp();

  // Remember last selected group per member via localStorage
  const memberStorageKey = `jki_last_selected_group_${member?.email || 'default'}`;
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    try {
      return localStorage.getItem(memberStorageKey) || 'all';
    } catch {
      return 'all';
    }
  });

  const handleGroupTabChange = (newGroupId: string) => {
    setSelectedGroupId(newGroupId);
    try {
      localStorage.setItem(memberStorageKey, newGroupId);
    } catch {
      // ignore
    }
  };

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | CustomerStatus>('All');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'grouped' | 'overview'>('table');

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Bulk Move Modal State
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveTargetGroupId, setBulkMoveTargetGroupId] = useState<string>('');
  const [bulkMoving, setBulkMoving] = useState(false);

  // Filter Presets Modal
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [customerSort, setCustomerSort] = useState<
    'action_priority' | 'name_asc' | 'revenue_desc' | 'orders_desc' | 'created_desc' | 'followup_soon'
  >('action_priority');

  // Outreach Outcome Modal State
  const [outcomeTarget, setOutcomeTarget] = useState<{
    customer: Customer;
    channel: 'Call' | 'WhatsApp';
  } | null>(null);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form State for Adding Single Customer (Group-wise Add)
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [rawPhone, setRawPhone] = useState('');
  const [placeCity, setPlaceCity] = useState('Salem');
  const [formGroupId, setFormGroupId] = useState<string | null>(null);
  const [status, setStatus] = useState<CustomerStatus>('New customer');
  const [leadSource, setLeadSource] = useState<LeadSource>('Meta Ads');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Duplicate Phone Detection State (4 Choices Modal)
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existingCustomer: Customer;
    normalizedPhone: string;
    pendingData: any;
  } | null>(null);
  const [duplicateReason, setDuplicateReason] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const cities = Array.from(new Set(customers.map((c) => c.place?.city).filter(Boolean)));

  // Global Keyboard Shortcut: 'N' to open Add Customer modal in currently selected group
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input, textarea or select, or has a modifier pressed
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !showAddModal && !editingCustomer && !showImportModal) {
          e.preventDefault();
          handleOpenAddModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal, editingCustomer, showImportModal, selectedGroupId, customerGroups]);

  const executeAddCustomer = async (custData: any, addAnother: boolean = false) => {
    try {
      setIsSubmitting(true);
      await addCustomer(custData);
      showToast(`Customer "${custData.companyName}" successfully saved!`);

      if (addAnother) {
        setCompanyName('');
        setContactPerson('');
        setRawPhone('');
        setNotes('');
        setDuplicateConflict(null);
        setFormError(null);
      } else {
        setShowAddModal(false);
        setCompanyName('');
        setContactPerson('');
        setRawPhone('');
        setNotes('');
        setDuplicateConflict(null);
        setFormError(null);
      }
    } catch (err: any) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent, addAnother: boolean = false) => {
    e.preventDefault();
    setFormError(null);
    if (!companyName.trim() || !rawPhone.trim()) {
      setFormError('Company name and phone number are required.');
      return;
    }

    const normalized = normalizePhone(rawPhone.trim());
    if (!normalized) {
      setFormError('Invalid phone number format. Please check the digits.');
      return;
    }

    // Check if target group is archived
    if (formGroupId) {
      const grp = customerGroups.find((g) => g.id === formGroupId);
      if (grp && !grp.isActive) {
        setFormError(`Group "${grp.name}" is archived. New customers cannot be assigned to archived groups.`);
        return;
      }
    }

    const resolvedGroup = formGroupId ? customerGroups.find((g) => g.id === formGroupId) : null;
    const now = new Date().toISOString();

    const pendingData = {
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim() || companyName.trim(),
      phone: normalized,
      whatsapp: normalized,
      place: { area: '', city: placeCity || 'Salem', district: placeCity || 'Salem', state: 'Tamil Nadu' },
      groupId: formGroupId || null,
      groupName: resolvedGroup ? resolvedGroup.name : (formGroupId ? 'Unknown Group' : 'Ungrouped'),
      groupAssignedAt: formGroupId ? now : null,
      groupAssignedBy: formGroupId ? (member?.email || 'admin') : null,
      previousGroupId: null,
      customerType: (resolvedGroup?.name || 'Retailer') as CustomerType,
      status,
      source: leadSource,
      leadStage: 'New' as LeadStage,
      assignedTo: member?.email || 'prajindezaa142@gmail.com',
      tags: ['New Inbound'],
      notes: notes.trim(),
    };

    // Duplicate check on phone across ALL groups
    const existing = customers.find((c) => c.phone === normalized && !c.isDeleted);
    if (existing) {
      setDuplicateConflict({
        existingCustomer: existing,
        normalizedPhone: normalized,
        pendingData,
      });
      return;
    }

    await executeAddCustomer(pendingData, addAnother);
  };

  // Duplicate resolution actions (4 Choices: Skip, Move, Update, Save Anyway / Open)
  const handleDuplicateSkip = () => {
    setDuplicateConflict(null);
    showToast('Add skipped. Existing customer preserved.');
  };

  const handleDuplicateMove = async () => {
    if (!duplicateConflict) return;
    try {
      setIsSubmitting(true);
      const { existingCustomer, pendingData } = duplicateConflict;
      const targetGrp = formGroupId ? customerGroups.find((g) => g.id === formGroupId) : null;
      await updateCustomer(existingCustomer.id, {
        groupId: formGroupId || null,
        groupName: targetGrp ? targetGrp.name : 'Ungrouped',
        groupAssignedAt: new Date().toISOString(),
        groupAssignedBy: member?.email || 'admin',
        previousGroupId: existingCustomer.groupId || null,
        lastWriteSource: 'manual_edit',
      });
      showToast(`Moved "${existingCustomer.companyName}" to "${targetGrp?.name || 'Ungrouped'}".`);
      setDuplicateConflict(null);
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Error moving customer: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateUpdate = async (overwrite: boolean = false) => {
    if (!duplicateConflict) return;
    try {
      setIsSubmitting(true);
      const { existingCustomer, pendingData } = duplicateConflict;
      const updates: Partial<Customer> = {};

      if (overwrite) {
        updates.companyName = pendingData.companyName;
        updates.contactPerson = pendingData.contactPerson;
        updates.place = pendingData.place;
        if (pendingData.notes) {
          updates.notes = existingCustomer.notes
            ? `${existingCustomer.notes}\n[Update]: ${pendingData.notes}`
            : pendingData.notes;
        }
      } else {
        // Fill empty fields only
        if (!existingCustomer.contactPerson && pendingData.contactPerson) {
          updates.contactPerson = pendingData.contactPerson;
        }
        if (!existingCustomer.place?.city && pendingData.place?.city) {
          updates.place = pendingData.place;
        }
        if (pendingData.notes) {
          updates.notes = existingCustomer.notes
            ? `${existingCustomer.notes}\n[Appended Note]: ${pendingData.notes}`
            : pendingData.notes;
        }
      }

      await updateCustomer(existingCustomer.id, updates);
      showToast(`Updated existing customer "${existingCustomer.companyName}".`);
      setDuplicateConflict(null);
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Error updating customer: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateSaveAnyway = async () => {
    if (!duplicateConflict) return;
    if (!duplicateReason.trim()) {
      alert('Please provide a reason to create duplicate phone record.');
      return;
    }
    try {
      setIsSubmitting(true);
      const { pendingData } = duplicateConflict;
      const finalData = {
        ...pendingData,
        tags: [...(pendingData.tags || []), 'Duplicate-Phone-Allowed'],
        notes: pendingData.notes
          ? `${pendingData.notes}\n[Duplicate Allowed Reason]: ${duplicateReason.trim()}`
          : `[Duplicate Allowed Reason]: ${duplicateReason.trim()}`,
      };
      await addCustomer(finalData);
      showToast(`Saved duplicate customer with verified override.`);
      setDuplicateConflict(null);
      setDuplicateReason('');
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Failed to save duplicate: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateOpenCustomer = () => {
    if (!duplicateConflict) return;
    const cust = duplicateConflict.existingCustomer;
    setDuplicateConflict(null);
    setShowAddModal(false);
    setActiveCustomer(cust);
  };

  // Bulk Move to Group
  const handleExecuteBulkMove = async () => {
    if (selectedIds.size === 0) return;
    const targetGrp = customerGroups.find((g) => g.id === bulkMoveTargetGroupId);
    const targetName = targetGrp ? targetGrp.name : (bulkMoveTargetGroupId === '__ungrouped__' ? 'Ungrouped' : null);
    if (!targetName && bulkMoveTargetGroupId !== '__ungrouped__') {
      alert('Please select a target group.');
      return;
    }

    try {
      setBulkMoving(true);
      const resolvedTargetId = bulkMoveTargetGroupId === '__ungrouped__' ? null : bulkMoveTargetGroupId;
      const now = new Date().toISOString();

      for (const id of Array.from(selectedIds)) {
        const cust = customers.find((c) => c.id === id);
        if (!cust) continue;
        await updateCustomer(id, {
          groupId: resolvedTargetId,
          groupName: targetName || 'Ungrouped',
          groupAssignedAt: now,
          groupAssignedBy: member?.email || 'admin',
          previousGroupId: cust.groupId || null,
          lastWriteSource: 'manual_edit',
        });
      }

      showToast(`Moved ${selectedIds.size} customer(s) to ${targetName}.`);
      setSelectedIds(new Set());
      setShowBulkMoveModal(false);
      setBulkMoveTargetGroupId('');
    } catch (err: any) {
      alert(`Failed to bulk move: ${err?.message || err}`);
    } finally {
      setBulkMoving(false);
    }
  };

  const handleImportSuccess = (res: {
    imported: number;
    updated: number;
    moved: number;
    skipped: number;
    batchId?: string;
  }) => {
    showToast(
      `Batch import completed: ${res.imported} new, ${res.updated} updated, ${res.moved} moved, ${res.skipped} skipped.`
    );
  };

  const handleSaveOutreachOutcome = async (log: OutreachLog, updatedNextFollowUp?: string) => {
    if (!outcomeTarget) return;
    try {
      await logOutreach(outcomeTarget.customer.id, {
        ...log,
        nextFollowUp: updatedNextFollowUp,
      });
      showToast(`Outreach outcome logged for ${outcomeTarget.customer.companyName}`);
    } catch (err) {
      console.error('Failed to log outreach:', err);
    }
  };

  const handleBulkTrash = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Move ${selectedIds.size} selected customer(s) to 30-day Trash?`)) {
      try {
        for (const id of Array.from(selectedIds)) {
          await softDeleteCustomer(id);
        }
        setSelectedIds(new Set());
        showToast(`Moved ${selectedIds.size} customer(s) to 30-day Trash.`);
      } catch (err: any) {
        console.error('Error moving customers to trash:', err);
        alert(err?.message || 'Failed to move customers to trash.');
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSavePreset = async () => {
    if (!newFilterName.trim()) return;
    await saveFilterPreset(newFilterName.trim(), 'customers', {
      search,
      selectedStatus,
      selectedCity,
      selectedStage,
    });
    setNewFilterName('');
    setShowSaveFilterModal(false);
    showToast('Filter preset saved!');
  };

  const applyPreset = (preset: SavedFilterPreset) => {
    const f = preset.filters as { search?: string; selectedStatus?: string; selectedCity?: string; selectedStage?: string };
    if (f.search !== undefined) setSearch(f.search);
    if (f.selectedStatus) setSelectedStatus(f.selectedStatus as 'All' | CustomerStatus);
    if (f.selectedCity) setSelectedCity(f.selectedCity);
    if (f.selectedStage) setSelectedStage(f.selectedStage);
    showToast(`Applied preset: ${preset.name}`);
  };

  // Helper to open Add modal with active group preselected
  const handleOpenAddModal = (overrideGroupId?: string | null) => {
    let targetGrp: string | null = null;
    if (overrideGroupId !== undefined) {
      targetGrp = overrideGroupId;
    } else if (selectedGroupId !== 'all' && selectedGroupId !== 'ungrouped') {
      targetGrp = selectedGroupId;
    } else {
      const defaultGroup = customerGroups.find((g) => g.isDefault && !g.isDeleted && g.isActive);
      targetGrp = defaultGroup ? defaultGroup.id : (customerGroups[0]?.id || null);
    }
    setFormGroupId(targetGrp);
    setFormError(null);
    setDuplicateConflict(null);
    setShowAddModal(true);
  };

  const filteredCustomers = [...customers]
    .filter((c) => {
      const matchesSearch =
        !search ||
        c.companyName.toLowerCase().includes(search.toLowerCase()) ||
        c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.place?.city && c.place.city.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;
      const matchesCity = selectedCity === 'All' || c.place?.city === selectedCity;
      const matchesStage = selectedStage === 'All' || c.leadStage === selectedStage;

      // Group Filtering: 'all' shows all, 'ungrouped' shows customers with no groupId, otherwise matches c.groupId
      const matchesGroup =
        selectedGroupId === 'all' ||
        (selectedGroupId === 'ungrouped' ? !c.groupId : c.groupId === selectedGroupId);

      return matchesSearch && matchesStatus && matchesCity && matchesStage && matchesGroup;
    })
    .sort((a, b) => {
      if (customerSort === 'name_asc') {
        return a.companyName.localeCompare(b.companyName);
      }
      if (customerSort === 'revenue_desc') {
        return (b.totalRevenue || 0) - (a.totalRevenue || 0);
      }
      if (customerSort === 'orders_desc') {
        return (b.totalOrdersCount || 0) - (a.totalOrdersCount || 0);
      }
      if (customerSort === 'created_desc') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (customerSort === 'followup_soon') {
        const fA = a.nextFollowUpDate || '9999-99-99';
        const fB = b.nextFollowUpDate || '9999-99-99';
        return fA.localeCompare(fB);
      }

      // Default: 'action_priority'
      // 1. Leads actively needing outreach (New leads, Negotiation, Interested) appear first
      const stageWeight: Record<string, number> = {
        'New': 1,
        'Negotiation': 2,
        'Interested': 3,
        'Sample sent': 4,
        'Contacted': 5,
        'Ordered': 6,
        'Not interested': 7,
      };
      const swA = stageWeight[a.leadStage || 'New'] || 5;
      const swB = stageWeight[b.leadStage || 'New'] || 5;
      if (swA !== swB) return swA - swB;

      // 2. Customers with upcoming/overdue follow-up dates first
      const todayStr = new Date().toISOString().slice(0, 10);
      const isDueA = a.nextFollowUpDate && a.nextFollowUpDate <= todayStr;
      const isDueB = b.nextFollowUpDate && b.nextFollowUpDate <= todayStr;
      if (isDueA !== isDueB) return isDueA ? -1 : 1;

      // 3. Most recently updated / created
      const dateA = a.updatedAt || a.createdAt || '';
      const dateB = b.updatedAt || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#881337] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-stone-900 tracking-tight">
              Customer CRM & Meta Ads Leads
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#881337]/10 text-[#881337]">
              {customers.length} total
            </span>
          </div>
          <p className="text-xs text-stone-700 mt-1">
            Track wholesale inquiries, phone/WhatsApp outreach logs, and 30-day soft-delete archives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Full Backup Export */}
          <button
            onClick={() => exportFullBackupExcel({ customers, tasks, orders, plans })}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 shadow-xs transition-colors"
            title="Download full multi-sheet Excel backup"
          >
            <Database className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden md:inline">Full</span> Backup
          </button>

          {/* Export Excel */}
          <button
            onClick={() => exportCustomersToExcel(filteredCustomers)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel
          </button>

          {/* Export PDF */}
          <button
            onClick={() => exportCustomersToPDF(filteredCustomers)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-rose-600" />
            PDF
          </button>

          {/* Import Meta Ads / Bulk Sheet */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-[#881337]/30 bg-[#881337]/5 text-[#881337] hover:bg-[#881337]/10 flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Import CSV/Excel
          </button>

          {/* Add Customer Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] flex items-center gap-1.5 shadow-sm transition-colors"
            title="Add Customer in current group (Shortcut: press N)"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 rounded font-mono text-white/90">
              N
            </kbd>
          </button>
        </div>
      </div>

      {/* Customer Groups Tabs Bar (Desktop + Mobile) with Live Counters */}
      <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* All Customers Tab */}
            <button
              onClick={() => handleGroupTabChange('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                selectedGroupId === 'all'
                  ? 'bg-[#881337] text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>All Customers</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedGroupId === 'all' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {customers.length}
              </span>
            </button>

            {/* Ungrouped Tab */}
            <button
              onClick={() => handleGroupTabChange('ungrouped')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                selectedGroupId === 'ungrouped'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              <span>Ungrouped</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedGroupId === 'ungrouped' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {customers.filter((c) => !c.groupId).length}
              </span>
            </button>

            {/* Individual Group Tabs */}
            {customerGroups
              .filter((g) => g.isActive && !g.isDeleted)
              .map((grp) => {
                const count = customers.filter((c) => c.groupId === grp.id).length;
                const isSelected = selectedGroupId === grp.id;
                return (
                  <button
                    key={grp.id}
                    onClick={() => handleGroupTabChange(grp.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 shrink-0 transition-colors ${
                      isSelected
                        ? 'text-white shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                    style={isSelected ? { backgroundColor: grp.color } : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: isSelected ? '#ffffff' : grp.color }}
                    />
                    <span>{grp.name}</span>
                    {grp.nameTa && (
                      <span
                        className={`text-[10px] hidden md:inline font-normal ${
                          isSelected ? 'text-white/80' : 'text-stone-700'
                        }`}
                      >
                        ({grp.nameTa})
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Quick inline shortcut to add customer directly into active group */}
          {selectedGroupId !== 'all' && selectedGroupId !== 'ungrouped' && (
            <button
              onClick={() => handleOpenAddModal(selectedGroupId)}
              className="px-2.5 py-1 text-xs font-bold text-[#881337] bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 shrink-0 border border-[#881337]/20 transition-colors"
              title="Add a new customer straight into this group"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add to</span>{' '}
              {customerGroups.find((g) => g.id === selectedGroupId)?.name}
            </button>
          )}
        </div>
      </div>

      {/* Filter Presets Bar */}
      {savedFilters.filter((f) => f.entity === 'customers').length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-stone-700 flex items-center gap-1 font-medium">
            <Bookmark className="w-3.5 h-3.5 text-amber-600" /> Saved Filters:
          </span>
          {savedFilters
            .filter((f) => f.entity === 'customers')
            .map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 cursor-pointer transition-colors"
              >
                <button onClick={() => applyPreset(preset)} className="font-medium">
                  {preset.name}
                </button>
                <button
                  onClick={() => deleteFilterPreset(preset.id)}
                  className="text-stone-700 hover:text-red-600 text-xs ml-1"
                  title="Remove preset"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Search, Filter & View Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-[240px] items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-sm">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by company, contact person, city or phone (+91)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-800 focus:outline-hidden placeholder:text-stone-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-stone-700 hover:text-stone-600">
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-200">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'All' | CustomerStatus)}
              className="bg-transparent font-medium text-stone-700 focus:outline-hidden text-xs"
            >
              <option value="All">All Statuses</option>
              <option value="New customer">New customer</option>
              <option value="Old customer">Old customer</option>
            </select>
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-1 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-200">
            <MapPin className="w-3.5 h-3.5 text-stone-500" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-transparent font-medium text-stone-700 focus:outline-hidden text-xs"
            >
              <option value="All">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Lead Stage Filter */}
          <div className="flex items-center gap-1 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-200">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-transparent font-medium text-stone-700 focus:outline-hidden text-xs"
            >
              <option value="All">All Stages</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested</option>
              <option value="Sample sent">Sample sent</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Ordered">Ordered</option>
              <option value="Not interested">Not interested</option>
            </select>
          </div>

          {/* Customer Sort Dropdown */}
          <div className="flex items-center gap-1 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-200">
            <span className="text-[11px] font-medium text-stone-500">Sort:</span>
            <select
              value={customerSort}
              onChange={(e) => setCustomerSort(e.target.value as any)}
              className="bg-transparent font-medium text-stone-700 focus:outline-hidden text-xs"
            >
              <option value="action_priority">⚡ Action Priority (New &amp; Hot Leads First)</option>
              <option value="followup_soon">⏰ Follow-Up Due Soonest</option>
              <option value="revenue_desc">💰 Highest Revenue First</option>
              <option value="orders_desc">📦 Most Orders First</option>
              <option value="created_desc">🆕 Newest Added First</option>
              <option value="name_asc">🔤 Name (A to Z)</option>
            </select>
          </div>

          {/* Save Filter Preset Button */}
          <button
            onClick={() => setShowSaveFilterModal(true)}
            className="px-2.5 py-1.5 text-stone-700 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium flex items-center gap-1 transition-colors"
            title="Save current filters as preset"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Save Preset
          </button>

          {/* Table / Grouped / Overview Toggle */}
          <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-100">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-xs text-stone-800' : 'text-stone-700 hover:text-stone-800'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'grouped' ? 'bg-white shadow-xs text-stone-800' : 'text-stone-700 hover:text-stone-800'
              }`}
            >
              By City
            </button>
            <button
              onClick={() => setViewMode('overview')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${
                viewMode === 'overview' ? 'bg-[#881337] shadow-xs text-white' : 'text-stone-700 hover:text-stone-800'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Overview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#881337]/10 border border-[#881337]/30 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#881337]" />
            <span className="font-bold text-[#881337]">
              {selectedIds.size} customer(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkMoveModal(true)}
              className="px-3 py-1.5 bg-[#881337] text-white font-semibold rounded-md hover:bg-[#70102e] flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <GitMerge className="w-3.5 h-3.5" />
              Move to Group...
            </button>
            <button
              onClick={handleBulkTrash}
              className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-md hover:bg-rose-700 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Move to 30-Day Trash
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingCustomers ? (
        <div className="p-12 text-center bg-white rounded-xl border border-stone-200">
          <Loader2 className="w-8 h-8 animate-spin text-[#881337] mx-auto mb-3" />
          <p className="text-xs font-semibold text-stone-700">Loading customers from Firestore...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-[#881337] mb-3 shadow-xs">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-800 mb-1">
            {customers.length === 0 ? 'No customers in Firestore yet' : 'No customers match your filter'}
          </h3>
          <p className="text-xs text-stone-700 max-w-md mx-auto mb-5">
            {customers.length === 0
              ? 'Seed initial Tamil Nadu pooja products distributor leads (Salem, Coimbatore, Madurai, Erode) or import your Meta Ads CSV.'
              : 'Try clearing your search query or switching status/city filters.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {customers.length === 0 && (
              <button
                onClick={seedInitialData}
                disabled={isSeeding}
                className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Seed 5 Pooja Leads & Catalog
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#881337] text-white text-xs font-bold hover:bg-[#70102e] flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Customer
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-bold hover:bg-stone-50 flex items-center gap-2 shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Import Meta Ads Leads
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded-xs text-[#881337] focus:ring-[#881337]"
                    />
                  </th>
                  <th className="py-3 px-3">Company / Shop</th>
                  <th className="py-3 px-3">Contact & Phone</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Group</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3">Follow-up</th>
                  <th className="py-3 px-3 text-right">Outreach Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {filteredCustomers.map((cust) => {
                  const isSelected = selectedIds.has(cust.id);
                  const isNew = cust.status === 'New customer';
                  const telLink = getTelLink(cust.phone);
                  const wpLink = getWhatsAppLink(
                    cust.whatsapp || cust.phone,
                    `Vanakkam ${cust.contactPerson || cust.companyName}, greetings from Jaikrishna Industries (Salem).`
                  );
                  const custGroup = cust.groupId ? customerGroups.find((g) => g.id === cust.groupId) : null;

                  return (
                    <tr
                      key={cust.id}
                      className={`hover:bg-amber-50/40 transition-colors ${isSelected ? 'bg-amber-50/70' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(cust.id)}
                          className="rounded-xs text-[#881337] focus:ring-[#881337]"
                        />
                      </td>

                      {/* Company Name (clickable for drawer) */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setActiveCustomer(cust)}
                          className="text-left font-bold text-stone-900 hover:text-[#881337] group block"
                        >
                          <span className="flex items-center gap-1.5">
                            {cust.companyName}
                            <ArrowRight className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          {cust.tags && cust.tags.length > 0 && (
                            <span className="text-[10px] text-stone-700 font-normal block mt-0.5">
                              {cust.tags.join(' · ')}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Contact & Phone */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-stone-800">{cust.contactPerson || '—'}</div>
                        {cust.isPhoneMissing || !cust.phone ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Phone missing
                          </span>
                        ) : (
                          <div className="text-[11px] text-stone-700 font-mono">
                            {formatPhoneDisplay(cust.phone)}
                          </div>
                        )}
                        {cust.gstin && (
                          <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                            GST: {cust.gstin}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-stone-700">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="font-medium text-stone-800">{cust.place?.city || 'Salem'}</span>
                        </div>
                        {cust.place?.area && (
                          <div className="text-[10px] text-stone-700 ml-4">{cust.place.area}</div>
                        )}
                      </td>

                      {/* Customer Group (replaces legacy customerType) */}
                      <td className="py-3 px-3">
                        <CustomerGroupBadge
                          group={custGroup}
                          groupId={cust.groupId}
                          groupName={cust.groupName}
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isNew
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {cust.status}
                        </span>
                      </td>

                      {/* Lead Stage */}
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-semibold text-stone-700 px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">
                          {cust.leadStage}
                        </span>
                      </td>

                      {/* Follow-up Date */}
                      <td className="py-3 px-3">
                        {cust.nextFollowUpDate ? (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>{cust.nextFollowUpDate}</span>
                          </div>
                        ) : (
                          <span className="text-stone-700">—</span>
                        )}
                      </td>

                      {/* Quick Outreach Call / WhatsApp */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct Phone Call */}
                          {cust.phone ? (
                            <a
                              href={telLink}
                              onClick={() => setOutcomeTarget({ customer: cust, channel: 'Call' })}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                              title="Call customer directly"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span
                              className="p-1.5 rounded-lg bg-stone-100 text-stone-300 border border-stone-200 cursor-not-allowed"
                              title="No phone number available"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </span>
                          )}

                          {/* Direct WhatsApp Click-to-Chat */}
                          {cust.phone || cust.whatsapp ? (
                            <a
                              href={wpLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOutcomeTarget({ customer: cust, channel: 'WhatsApp' })}
                              className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors"
                              title="Send WhatsApp message"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span
                              className="p-1.5 rounded-lg bg-stone-100 text-stone-300 border border-stone-200 cursor-not-allowed"
                              title="No WhatsApp number available"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </span>
                          )}

                          {/* Edit Customer Profile */}
                          <button
                            onClick={() => setEditingCustomer(cust)}
                            className="p-1.5 rounded-lg bg-stone-50 text-stone-600 hover:text-[#881337] hover:bg-rose-50 border border-stone-200 transition-colors"
                            title="Edit customer details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Soft Delete */}
                          <button
                            onClick={async () => {
                              if (window.confirm(`Move "${cust.companyName}" to 30-day trash?`)) {
                                try {
                                  await softDeleteCustomer(cust.id);
                                  showToast(`Moved ${cust.companyName} to 30-day trash.`);
                                } catch (err: any) {
                                  console.error('Failed to move customer to trash:', err);
                                  alert(err?.message || 'Failed to move customer to trash.');
                                }
                              }
                            }}
                            className="p-1.5 rounded-lg bg-stone-50 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 transition-colors"
                            title="Move to 30-day Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'overview' ? (
        /* Overview Mode: Group Cards */
        <GroupOverviewCards
          groups={customerGroups.filter((g) => !g.isDeleted)}
          customers={customers}
          orders={orders}
          tasks={tasks}
          onSelectGroup={(gid) => {
            handleGroupTabChange(gid);
            setViewMode('table');
          }}
        />
      ) : (
        /* Grouped By City View */
        <div className="space-y-6">
          {cities.map((city) => {
            const cityCustomers = filteredCustomers.filter((c) => c.place?.city === city);
            if (cityCustomers.length === 0) return null;

            return (
              <div key={city} className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#881337]" />
                    <h3 className="font-bold text-sm text-stone-900">{city}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#881337]/10 text-[#881337] font-semibold">
                      {cityCustomers.length} leads
                    </span>
                  </div>
                </div>

                <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cityCustomers.map((cust) => {
                    const custGroup = cust.groupId ? customerGroups.find((g) => g.id === cust.groupId) : null;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => setActiveCustomer(cust)}
                        className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-amber-50/40 hover:border-amber-200 transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-stone-900 text-xs">{cust.companyName}</h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                cust.status === 'New customer'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {cust.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-700 mt-1">
                            {cust.contactPerson} · {formatPhoneDisplay(cust.phone)}
                          </p>
                          <div className="mt-2">
                            <CustomerGroupBadge
                              group={custGroup}
                              groupId={cust.groupId}
                              groupName={cust.groupName}
                            />
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                          <span className="text-stone-700 font-medium">{cust.leadStage}</span>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={getTelLink(cust.phone)}
                              onClick={() => setOutcomeTarget({ customer: cust, channel: 'Call' })}
                              className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                            <a
                              href={getWhatsAppLink(cust.whatsapp || cust.phone, 'Vanakkam')}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOutcomeTarget({ customer: cust, channel: 'WhatsApp' })}
                              className="p-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => setEditingCustomer(cust)}
                              className="p-1 rounded-md bg-stone-50 text-stone-600 hover:text-[#881337] hover:bg-rose-50 border border-stone-200"
                              title="Edit customer details"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Move "${cust.companyName}" to 30-day trash?`)) {
                                  try {
                                    await softDeleteCustomer(cust.id);
                                    showToast(`Moved ${cust.companyName} to 30-day trash.`);
                                  } catch (err: any) {
                                    console.error('Failed to move customer to trash:', err);
                                    alert(err?.message || 'Failed to move customer to trash.');
                                  }
                                }
                              }}
                              className="p-1 rounded-md bg-stone-50 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200"
                              title="Move to 30-day Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <h3 className="font-bold text-base text-stone-900 font-display">Add Pooja Products Customer</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Company / Shop Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Murugan Stores & Pooja Center"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Murugan Swamy"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone (+91 default) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9842154321"
                    value={rawPhone}
                    onChange={(e) => setRawPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">District / Hub (38 TN Districts)</label>
                  <select
                    value={placeCity}
                    onChange={(e) => setPlaceCity(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    {TAMIL_NADU_DISTRICTS.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Customer Group <span className="text-rose-500">*</span>
                  </label>
                  <CustomerGroupSelect
                    value={formGroupId}
                    onChange={(gid) => setFormGroupId(gid)}
                    allowUngrouped={true}
                    preselectedGroupHint={
                      selectedGroupId !== 'all' && selectedGroupId !== 'ungrouped'
                        ? customerGroups.find((g) => g.id === selectedGroupId)?.name
                        : null
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Initial Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    <option value="New customer">New customer</option>
                    <option value="Old customer">Old customer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Lead Source</label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Own Calling / Telecalling">Own Calling / Telecalling</option>
                  <option value="Direct Reach / Walk-in">Direct Reach / Walk-in</option>
                  <option value="Reference / Word of Mouth">Reference / Word of Mouth</option>
                  <option value="Exhibition / Trade Fair">Exhibition / Trade Fair</option>
                  <option value="WhatsApp Campaign">WhatsApp Campaign</option>
                  <option value="IndiaMART / B2B Portal">IndiaMART / B2B Portal</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Notes / Pooja Requirements</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Inquired about 500 jars of Bhimseni Camphor wholesale rates..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={(e) => handleAddCustomer(e, true)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#881337]/30 text-[#881337] bg-rose-50 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Save & Add Another
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save Customer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Filter Preset Modal */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in">
            <h3 className="font-bold text-sm text-stone-900 mb-1">Save Filter Preset</h3>
            <p className="text-xs text-stone-700 mb-3">
              Save your current search, city, and status selections for 1-click access.
            </p>
            <input
              type="text"
              placeholder="e.g. Salem Wholesalers"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 mb-4 focus:outline-hidden focus:border-[#881337]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveFilterModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!newFilterName.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer */}
      <CustomerDetailDrawer
        customer={activeCustomer}
        onClose={() => setActiveCustomer(null)}
        onUpdateCustomer={async (updated) => {
          await updateCustomer(updated.id, updated);
          setActiveCustomer(updated);
          showToast(`Updated ${updated.companyName}`);
        }}
        onDeleteCustomer={async (id) => {
          try {
            await softDeleteCustomer(id);
            setActiveCustomer(null);
            showToast('Moved to 30-day trash.');
          } catch (err: any) {
            console.error('Failed to move customer to trash:', err);
            alert(err?.message || 'Failed to move customer to trash.');
          }
        }}
        onLogOutcome={(channel) => {
          if (activeCustomer) {
            setOutcomeTarget({ customer: activeCustomer, channel });
          }
        }}
        onEdit={(cust) => {
          setEditingCustomer(cust);
        }}
      />

      {/* Edit Customer Profile Modal */}
      <EditCustomerModal
        customer={editingCustomer}
        isOpen={Boolean(editingCustomer)}
        onClose={() => setEditingCustomer(null)}
        onSave={async (customerId, updates) => {
          await updateCustomer(customerId, updates);
          if (activeCustomer && activeCustomer.id === customerId) {
            setActiveCustomer({ ...activeCustomer, ...updates });
          }
          showToast(`Customer details updated successfully.`);
        }}
        onDelete={async (customerId) => {
          await softDeleteCustomer(customerId);
          if (activeCustomer && activeCustomer.id === customerId) {
            setActiveCustomer(null);
          }
          showToast('Moved to 30-day trash.');
        }}
      />

      {/* Import Modal */}
      <CustomerImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        existingCustomers={customers}
        onImportComplete={handleImportSuccess}
      />

      {/* Duplicate Phone Detection Conflict Modal (4 Choices: Skip, Move, Update, Save Anyway / Open) */}
      {duplicateConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 pb-3 border-b border-stone-200">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-stone-900">Phone Number Already Exists</h3>
                <p className="text-xs text-stone-600">
                  Phone number <span className="font-mono font-bold text-stone-900">{formatPhoneDisplay(duplicateConflict.normalizedPhone)}</span> is already assigned.
                </p>
              </div>
            </div>

            {/* Existing Customer Details */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Existing Customer:</div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 text-sm">{duplicateConflict.existingCustomer.companyName}</span>
                <CustomerGroupBadge
                  groupId={duplicateConflict.existingCustomer.groupId}
                  groupName={duplicateConflict.existingCustomer.groupName}
                />
              </div>
              <div className="text-stone-700">
                Contact: <strong>{duplicateConflict.existingCustomer.contactPerson || '—'}</strong> · City: <strong>{duplicateConflict.existingCustomer.place?.city || 'Salem'}</strong>
              </div>
            </div>

            {/* Target Group details */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900">
              You are attempting to add a lead for: <strong>"{duplicateConflict.pendingData.companyName}"</strong> in group <strong>"{duplicateConflict.pendingData.groupName}"</strong>.
            </div>

            {/* 4 Choices */}
            <div className="space-y-2 pt-1">
              {/* Choice 1: Skip */}
              <button
                type="button"
                onClick={handleDuplicateSkip}
                className="w-full p-2.5 text-left text-xs rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-stone-900">1. Skip (Do not add)</div>
                  <div className="text-stone-600 text-[11px]">Keep existing customer unchanged and discard duplicate form.</div>
                </div>
                <span className="text-stone-400 font-bold">→</span>
              </button>

              {/* Choice 2: Update existing customer */}
              <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-stone-900 text-xs">2. Update existing customer</div>
                    <div className="text-stone-600 text-[11px]">Enrich existing customer info and append inquiry note.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDuplicateUpdate(false)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition-colors"
                  >
                    Fill Empty Fields Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateUpdate(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                  >
                    Overwrite Fields
                  </button>
                </div>
              </div>

              {/* Choice 3: Move existing customer to this group */}
              <button
                type="button"
                onClick={handleDuplicateMove}
                className="w-full p-2.5 text-left text-xs rounded-xl border border-stone-200 hover:bg-blue-50/70 hover:border-blue-300 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-blue-900">3. Move to "{duplicateConflict.pendingData.groupName}"</div>
                  <div className="text-blue-700 text-[11px]">
                    Transfer "{duplicateConflict.existingCustomer.companyName}" from its current group to this group.
                  </div>
                </div>
                <span className="text-blue-600 font-bold">→</span>
              </button>

              {/* Choice 4: Save anyway with reason */}
              <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                <div>
                  <div className="font-bold text-stone-900 text-xs">4. Save anyway (create duplicate record)</div>
                  <div className="text-stone-600 text-[11px]">Require a business justification to allow shared phone number.</div>
                </div>
                <input
                  type="text"
                  placeholder="Reason for duplicate (e.g. Branch of same enterprise, family member)..."
                  value={duplicateReason}
                  onChange={(e) => setDuplicateReason(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleDuplicateSaveAnyway}
                  disabled={!duplicateReason.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#881337] text-white text-xs font-semibold hover:bg-[#70102e] disabled:opacity-50 transition-colors"
                >
                  Save Anyway with Reason
                </button>
              </div>

              {/* Choice 5: Open existing customer profile */}
              <button
                type="button"
                onClick={handleDuplicateOpenCustomer}
                className="w-full py-2 text-center text-xs font-bold text-stone-700 hover:text-stone-900 hover:underline transition-colors"
              >
                Or Open "{duplicateConflict.existingCustomer.companyName}" Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in space-y-3">
            <h3 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
              <GitMerge className="w-4 h-4 text-[#881337]" /> Move {selectedIds.size} Customer(s) to Group
            </h3>
            <p className="text-xs text-stone-600">
              Select the target customer group. All selected records will have their group re-assigned with an audit log entry.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Target Customer Group</label>
              <select
                value={bulkMoveTargetGroupId}
                onChange={(e) => setBulkMoveTargetGroupId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="">-- Select Target Group --</option>
                <option value="__ungrouped__">Ungrouped (Remove from group)</option>
                {customerGroups
                  .filter((g) => g.isActive && !g.isDeleted)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.nameTa ? `(${g.nameTa})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowBulkMoveModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkMove}
                disabled={!bulkMoveTargetGroupId || bulkMoving}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] disabled:opacity-50 flex items-center gap-1.5"
              >
                {bulkMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Outreach Modal */}
      {outcomeTarget && (
        <LogOutcomeModal
          isOpen={true}
          customer={outcomeTarget.customer}
          channel={outcomeTarget.channel}
          onClose={() => setOutcomeTarget(null)}
          onSaveOutcome={handleSaveOutreachOutcome}
        />
      )}
    </div>
  );
};
