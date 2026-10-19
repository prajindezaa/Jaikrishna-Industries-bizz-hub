/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  Plus,
  Check,
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  Tag,
} from 'lucide-react';
import { CustomerGroup } from '../../types';
import { useApp } from '../../context/AppContext';

interface CustomerGroupSelectProps {
  value: string | null; // groupId or null for Ungrouped
  onChange: (groupId: string | null) => void;
  required?: boolean;
  allowUngrouped?: boolean;
  className?: string;
  preselectedGroupHint?: string | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  Tag,
  Layers,
};

export const CustomerGroupSelect: React.FC<CustomerGroupSelectProps> = ({
  value,
  onChange,
  required = true,
  allowUngrouped = true,
  className = '',
  preselectedGroupHint,
}) => {
  const { customerGroups, createCustomerGroup } = useApp();
  const [showCreateInline, setShowCreateInline] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#881337');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const activeGroups = customerGroups.filter((g) => g.isActive && !g.isDeleted);
  const selectedGroup = customerGroups.find((g) => g.id === value);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCreateError(null);
    const cleanName = newGroupName.trim();
    if (!cleanName) return;

    try {
      setCreating(true);
      const newId = await createCustomerGroup({
        name: cleanName,
        color: newGroupColor,
        icon: 'Truck',
        sortOrder: customerGroups.length,
        isActive: true,
        isDefault: false,
      });
      onChange(newId);
      setNewGroupName('');
      setShowCreateInline(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="relative">
        <select
          value={value === null ? '__ungrouped__' : (value || '')}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__create_new__') {
              setShowCreateInline(true);
            } else if (v === '__ungrouped__') {
              onChange(null);
            } else {
              onChange(v || null);
            }
          }}
          className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337] bg-white font-medium text-stone-800 pr-8"
        >
          {allowUngrouped && (
            <option value="__ungrouped__">-- Ungrouped (No Category) --</option>
          )}

          {activeGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} {g.nameTa ? `(${g.nameTa})` : ''} {g.isDefault ? '★ (Default)' : ''}
            </option>
          ))}

          {/* If the current value is an archived group, still show it with (archived) */}
          {selectedGroup && !selectedGroup.isActive && (
            <option value={selectedGroup.id} disabled>
              {selectedGroup.name} (Archived)
            </option>
          )}

          <option value="__create_new__">＋ Create new customer group...</option>
        </select>
      </div>

      {preselectedGroupHint && selectedGroup && (
        <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: selectedGroup.color }}
          />
          <span>Preselected from active tab: <strong>{selectedGroup.name}</strong></span>
        </div>
      )}

      {/* Inline Create Shortcut */}
      {showCreateInline && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Quick Create Group
            </span>
            <button
              type="button"
              onClick={() => setShowCreateInline(false)}
              className="text-stone-400 hover:text-stone-600 text-xs"
            >
              Cancel
            </button>
          </div>

          {createError && (
            <div className="text-[11px] text-rose-700 font-semibold">{createError}</div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. VIP Wholesalers"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-hidden"
            />
            <button
              type="button"
              disabled={creating || !newGroupName.trim()}
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs font-bold bg-[#881337] hover:bg-[#70102e] text-white rounded-lg disabled:opacity-50"
            >
              {creating ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
