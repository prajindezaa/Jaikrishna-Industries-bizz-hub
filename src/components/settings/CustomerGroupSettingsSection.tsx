/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  GitMerge,
  Star,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  HelpCircle,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { CustomerGroup, Customer } from '../../types';
import { useApp } from '../../context/AppContext';

// Curated palette suitable for both Light and Dark backgrounds
export const GROUP_COLOR_PALETTE = [
  { hex: '#881337', name: 'Brand Maroon' },
  { hex: '#b91c1c', name: 'Crimson Red' },
  { hex: '#c2410c', name: 'Terracotta' },
  { hex: '#d97706', name: 'Amber Gold' },
  { hex: '#15803d', name: 'Forest Green' },
  { hex: '#0f766e', name: 'Teal' },
  { hex: '#0369a1', name: 'Ocean Blue' },
  { hex: '#4338ca', name: 'Indigo' },
  { hex: '#6d28d9', name: 'Deep Purple' },
  { hex: '#be185d', name: 'Magenta' },
  { hex: '#475569', name: 'Slate Gray' },
  { hex: '#78350f', name: 'Traditional Ochre' },
];

export const GROUP_ICON_OPTIONS = [
  { id: 'Truck', label: 'Truck (Distributor)', icon: Truck },
  { id: 'Store', label: 'Store (Wholesale)', icon: Store },
  { id: 'Building2', label: 'Building (Retail)', icon: Building2 },
  { id: 'Landmark', label: 'Landmark (Temple / Trust)', icon: Landmark },
  { id: 'Layers', label: 'Layers (General / Other)', icon: Layers },
  { id: 'Tag', label: 'Tag (Special)', icon: Tag },
  { id: 'Shield', label: 'Shield (VIP / Institutional)', icon: Shield },
];

export const CustomerGroupSettingsSection: React.FC = () => {
  const {
    customerGroups,
    customers,
    groupCounters,
    createCustomerGroup,
    updateCustomerGroup,
    archiveCustomerGroup,
    restoreCustomerGroup,
    mergeCustomerGroups,
    deleteCustomerGroup,
    createStarterGroups,
    recalculateGroupCounters,
    migrateOldCustomerTypesToGroups,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [name, setName] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [color, setColor] = useState('#881337');
  const [icon, setIcon] = useState('Truck');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Merge Modal State
  const [mergeSource, setMergeSource] = useState<CustomerGroup | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);

  // Migration Modal State
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [migrationMapping, setMigrationMapping] = useState<Record<string, string>>({});
  const [migrationSubmitting, setMigrationSubmitting] = useState(false);

  // Status / Notice
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleOpenAdd = () => {
    setEditingGroup(null);
    setName('');
    setNameTa('');
    setColor('#881337');
    setIcon('Truck');
    setDescription('');
    setIsDefault(customerGroups.length === 0);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: CustomerGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setNameTa(group.nameTa || '');
    setColor(group.color);
    setIcon(group.icon);
    setDescription(group.description || '');
    setIsDefault(Boolean(group.isDefault));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Group name is required.');
      return;
    }
    if (cleanName.length > 40) {
      setFormError('Group name must be 40 characters or less.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingGroup) {
        await updateCustomerGroup(editingGroup.id, {
          name: cleanName,
          nameTa: nameTa.trim(),
          color,
          icon,
          description: description.trim(),
          isDefault,
        });
        showNotice(`Updated group "${cleanName}"`);
      } else {
        await createCustomerGroup({
          name: cleanName,
          nameTa: nameTa.trim(),
          color,
          icon,
          description: description.trim(),
          sortOrder: customerGroups.length,
          isActive: true,
          isDefault,
        });
        showNotice(`Created customer group "${cleanName}"`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save customer group.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateStarters = async () => {
    if (!window.confirm('Create the 5 standard starter groups (Distributor, Wholesaler, Retailer, Temple/Institution, Other)?')) return;
    try {
      setSubmitting(true);
      const count = await createStarterGroups();
      showNotice(count > 0 ? `Created ${count} starter group(s).` : 'Starter groups already exist.');
    } catch (err: any) {
      alert(err?.message || 'Failed to create starter groups.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const res = await recalculateGroupCounters();
      showNotice(`Counters refreshed! Total active: ${res.totalActive}, Ungrouped: ${res.ungroupedCount}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to recalculate counters.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    const target = customerGroups.find((g) => g.id === mergeTargetId);
    if (!target) return;

    if (!window.confirm(`Are you sure you want to merge "${mergeSource.name}" into "${target.name}"? All customers in "${mergeSource.name}" will be moved, and "${mergeSource.name}" will be archived.`)) {
      return;
    }

    try {
      setMergeSubmitting(true);
      const res = await mergeCustomerGroups(mergeSource.id, mergeTargetId);
      showNotice(`Merged! Moved ${res.movedCount} customer(s) to "${target.name}".`);
      setMergeSource(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to merge groups.');
    } finally {
      setMergeSubmitting(false);
    }
  };

  // Find distinct legacy customer types for migration
  const distinctLegacyTypes = Array.from(
    new Set(
      customers
        .filter((c) => !c.isDeleted && !c.groupId && c.customerType)
        .map((c) => c.customerType!)
    )
  );

  const handleOpenMigration = () => {
    const initMap: Record<string, string> = {};
    distinctLegacyTypes.forEach((t) => {
      // Find matching group by name case-insensitively
      const matched = customerGroups.find((g) => g.name.toLowerCase() === t.toLowerCase());
      if (matched) initMap[t] = matched.id;
    });
    setMigrationMapping(initMap);
    setMigrationModalOpen(true);
  };

  const handleExecuteMigration = async () => {
    try {
      setMigrationSubmitting(true);
      const res = await migrateOldCustomerTypesToGroups(migrationMapping);
      showNotice(`Successfully migrated ${res.updatedCount} customer(s) to customer groups!`);
      setMigrationModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Migration failed.');
    } finally {
      setMigrationSubmitting(false);
    }
  };

  // Render Icon helper
  const renderIcon = (iconName: string, className = 'w-4 h-4') => {
    const match = GROUP_ICON_OPTIONS.find((i) => i.id === iconName);
    const Comp = match ? match.icon : Layers;
    return <Comp className={className} />;
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-700" />
          <h3 className="font-bold text-stone-900 text-sm font-display">Customer Groups &amp; Categories</h3>
          <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded font-semibold">
            Replaces Legacy Customer Type
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {customerGroups.length === 0 && (
            <button
              onClick={handleCreateStarters}
              disabled={submitting}
              className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Starter Groups</span>
            </button>
          )}

          {distinctLegacyTypes.length > 0 && customerGroups.length > 0 && (
            <button
              onClick={handleOpenMigration}
              className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Migrate Legacy Types ({distinctLegacyTypes.length})</span>
            </button>
          )}

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            title="Recalculate exact counters from database"
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 text-xs font-semibold bg-[#881337] hover:bg-[#70102e] text-white rounded-lg flex items-center gap-1 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Counters Summary Banner */}
      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-stone-500">Active Groups: </span>
            <span className="font-bold text-stone-900">
              {customerGroups.filter((g) => g.isActive && !g.isDeleted).length} / 30
            </span>
          </div>
          <div>
            <span className="text-stone-500">Total Classified Customers: </span>
            <span className="font-bold text-stone-900">
              {customers.filter((c) => !c.isDeleted && c.groupId).length}
            </span>
          </div>
          <div>
            <span className="text-stone-500">Ungrouped: </span>
            <span className="font-bold text-amber-700">
              {customers.filter((c) => !c.isDeleted && !c.groupId).length}
            </span>
          </div>
        </div>
        <div className="text-[11px] text-stone-400">
          Single source of truth via atomic counter sync
        </div>
      </div>

      {/* Groups List */}
      <div className="divide-y divide-stone-100">
        {customerGroups.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-500 space-y-2">
            <p>No customer groups configured yet.</p>
            <p className="text-[11px] text-stone-400">
              Click &quot;Create Starter Groups&quot; above to set up standard pooja industry categories (Distributor, Wholesaler, Retailer, Temple/Institution, Other).
            </p>
          </div>
        ) : (
          customerGroups
            .filter((g) => !g.isDeleted)
            .map((group) => {
              const assignedCount = customers.filter(
                (c) => !c.isDeleted && c.groupId === group.id
              ).length;

              return (
                <div
                  key={group.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !group.isActive ? 'opacity-60 bg-stone-50/50 -mx-2 px-2 rounded-lg' : ''
                  }`}
                >
                  {/* Left: Indicator, Icon, Name, and Badges */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
                      style={{ backgroundColor: group.color }}
                    >
                      {renderIcon(group.icon, 'w-4 h-4')}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 text-xs">{group.name}</span>
                        {group.nameTa && (
                          <span
                            className="text-[11px] text-stone-500"
                            title="Tamil text (needs proofreading by owner)"
                          >
                            ({group.nameTa})
                          </span>
                        )}
                        {group.isDefault && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded">
                            Default
                          </span>
                        )}
                        {!group.isActive && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-stone-200 text-stone-600 rounded">
                            Archived
                          </span>
                        )}
                      </div>

                      {group.description && (
                        <p className="text-[11px] text-stone-500 line-clamp-1">{group.description}</p>
                      )}

                      <div className="text-[10px] text-stone-400 flex items-center gap-2">
                        <span className="font-mono">{assignedCount} customer{assignedCount === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span className="font-mono">Hex: {group.color}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => handleOpenEdit(group)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-md border border-stone-200 text-xs flex items-center gap-1"
                      title="Edit group details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    {/* Merge button */}
                    <button
                      onClick={() => {
                        setMergeSource(group);
                        const candidates = customerGroups.filter(
                          (g) => g.id !== group.id && !g.isDeleted && g.isActive
                        );
                        setMergeTargetId(candidates[0]?.id || '');
                      }}
                      className="p-1.5 text-stone-500 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-stone-200 text-xs flex items-center gap-1"
                      title="Merge customers from this group into another"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Merge</span>
                    </button>

                    {/* Archive / Restore button */}
                    {group.isActive ? (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Archive group "${group.name}"? Existing customers stay in this group, but it cannot be selected for new ones.`)) {
                            await archiveCustomerGroup(group.id);
                            showNotice(`Archived group "${group.name}"`);
                          }
                        }}
                        className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-md border border-stone-200 text-xs"
                        title="Archive group (hide from new customer choices)"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await restoreCustomerGroup(group.id);
                          showNotice(`Restored group "${group.name}" to active status`);
                        }}
                        className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md border border-emerald-200 text-xs"
                        title="Restore archived group"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete button (only when customerCount === 0) */}
                    <button
                      onClick={async () => {
                        if (assignedCount > 0) {
                          alert(`Cannot delete group "${group.name}" because it still has ${assignedCount} customer(s). Merge customers into another group first or archive it.`);
                          return;
                        }
                        if (window.confirm(`Move group "${group.name}" to 30-day Trash?`)) {
                          await deleteCustomerGroup(group.id);
                          showNotice(`Moved group "${group.name}" to trash.`);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-stone-200 text-xs"
                      title={assignedCount > 0 ? "Cannot delete while customers exist (merge first)" : "Move to 30-day Trash"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="font-bold text-stone-900 text-sm font-display flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-700" />
                <span>{editingGroup ? 'Edit Customer Group' : 'New Customer Group'}</span>
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Group Name (English) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  placeholder="e.g. Distributor, Wholesaler, Temple"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Group Name (Tamil) <span className="text-stone-400 font-normal">(needs proofreading by owner)</span>
                </label>
                <input
                  type="text"
                  maxLength={40}
                  placeholder="e.g. விநியோகஸ்தர், மொத்த வியாபாரி"
                  value={nameTa}
                  onChange={(e) => setNameTa(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Group Theme Color</label>
                <div className="grid grid-cols-6 gap-2">
                  {GROUP_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={`h-7 rounded-lg border flex items-center justify-center transition-transform ${
                        color === c.hex ? 'scale-110 ring-2 ring-stone-900 border-white' : 'border-stone-200'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {color === c.hex && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Group Icon</label>
                <div className="grid grid-cols-4 gap-2">
                  {GROUP_ICON_OPTIONS.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        className={`p-2 rounded-lg border flex flex-col items-center gap-1 text-[10px] transition-colors ${
                          icon === item.id
                            ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold'
                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                        <span className="truncate w-full text-center">{item.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Who belongs in this group? (e.g. buys in pallet cartons, minimum order ₹25,000)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="grp-default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 text-amber-700 rounded border-stone-300"
                />
                <label htmlFor="grp-default" className="text-stone-700 font-medium">
                  Set as default group for newly created customers
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#881337] hover:bg-[#70102e] text-white rounded-lg font-bold shadow-xs transition-colors"
                >
                  {submitting ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MERGE MODAL */}
      {mergeSource && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="font-bold text-stone-900 text-sm font-display flex items-center gap-2 text-blue-900">
                <GitMerge className="w-4 h-4 text-blue-700" />
                <span>Merge Group: {mergeSource.name}</span>
              </h4>
              <button
                onClick={() => setMergeSource(null)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2">
              <p>
                You are about to merge <strong className="text-stone-900">{mergeSource.name}</strong> into another target group.
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
                <strong>What will happen:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>
                    All {customers.filter((c) => !c.isDeleted && c.groupId === mergeSource.id).length} customers in this group will be moved to the selected target group.
                  </li>
                  <li>
                    Previous group id will be recorded in each customer's audit history.
                  </li>
                  <li>
                    &quot;{mergeSource.name}&quot; will be automatically archived.
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="block font-semibold text-stone-700">Choose Target Customer Group</label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
              >
                {customerGroups
                  .filter((g) => g.id !== mergeSource.id && !g.isDeleted && g.isActive)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({customers.filter((c) => !c.isDeleted && c.groupId === g.id).length} customers)
                    </option>
                  ))}
              </select>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMergeSource(null)}
                className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={mergeSubmitting || !mergeTargetId}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs transition-colors"
              >
                {mergeSubmitting ? 'Merging...' : 'Confirm & Move Customers'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MIGRATION MODAL */}
      {migrationModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
              <h4 className="font-bold text-stone-900 text-sm font-display flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-700" />
                <span>Migrate Legacy Customer Types to Groups</span>
              </h4>
              <button
                onClick={() => setMigrationModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2 overflow-y-auto flex-1 pr-1">
              <p>
                Map legacy <code className="text-[#881337] bg-stone-100 px-1 py-0.5 rounded">customerType</code> values to their destination Customer Group.
                The old field will remain saved for verification until you approve its removal.
              </p>

              <div className="space-y-3 pt-2">
                {distinctLegacyTypes.map((legacyType) => {
                  const affectedCount = customers.filter(
                    (c) => !c.isDeleted && !c.groupId && c.customerType === legacyType
                  ).length;

                  return (
                    <div
                      key={legacyType}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-stone-900 text-xs">{legacyType}</div>
                        <div className="text-[11px] text-stone-500">
                          {affectedCount} customer{affectedCount === 1 ? '' : 's'} to assign
                        </div>
                      </div>

                      <select
                        value={migrationMapping[legacyType] || ''}
                        onChange={(e) =>
                          setMigrationMapping({ ...migrationMapping, [legacyType]: e.target.value })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white font-medium"
                      >
                        <option value="">-- Choose Target Group --</option>
                        {customerGroups
                          .filter((g) => !g.isDeleted)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between gap-2 text-xs shrink-0">
              <span className="text-[11px] text-stone-500">
                Safe &amp; idempotent batched write (400 per commit)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMigrationModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMigration}
                  disabled={migrationSubmitting}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs transition-colors"
                >
                  {migrationSubmitting ? 'Migrating...' : 'Run Migration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
