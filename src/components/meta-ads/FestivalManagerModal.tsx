/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Calendar, Plus, Trash2, Edit2, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { FestivalEvent } from '../../types';
import { getPreparationStartDate } from '../../lib/meta-ads-utils';

interface FestivalManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanAdForFestival?: (festival: FestivalEvent) => void;
}

export const FestivalManagerModal: React.FC<FestivalManagerModalProps> = ({
  isOpen,
  onClose,
  onPlanAdForFestival,
}) => {
  const { member } = useAuth();
  const { festivalEvents, addFestivalEvent, updateFestivalEvent, deleteFestivalEvent } = useApp();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setDate('');
    setNotes('');
    setEditingId(null);
    setIsAdding(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Festival name is required');
      return;
    }
    if (!date) {
      setError('Festival date is required');
      return;
    }

    try {
      if (editingId) {
        await updateFestivalEvent(editingId, {
          name: name.trim(),
          date,
          notes: notes.trim(),
        });
      } else {
        await addFestivalEvent({
          name: name.trim(),
          date,
          notes: notes.trim(),
          createdBy: member?.email || 'admin',
        });
      }
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save festival');
    }
  };

  const startEdit = (fest: FestivalEvent) => {
    setEditingId(fest.id);
    setName(fest.name);
    setDate(fest.date);
    setNotes(fest.notes || '');
    setIsAdding(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-2xl w-full p-6 space-y-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 font-display">
                Pooja &amp; Festival Calendar
              </h2>
              <p className="text-xs text-stone-500">
                Panchangam reference dates for timing seasonal bulk Meta ads
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panchangam Notice */}
        <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Astronomical Accuracy Notice:</span> In strict accordance with Hindu &amp; Tamil panchangams, festival dates vary each Gregorian year. Team members can freely add and calibrate festival dates verified against official panchangams.
          </div>
        </div>

        {/* Add/Edit Form */}
        {isAdding ? (
          <form onSubmit={handleSave} className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              {editingId ? 'Edit Festival Event' : 'Add New Festival'}
            </h3>
            {error && (
              <div className="text-xs text-rose-600 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Festival / Occasion Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Deepavali 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Festival Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Pooja Products &amp; Campaign Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Peak demand for Bhimseni camphor jars, 1L Deepam oil cans, and agarbatti kits"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs"
              >
                {editingId ? 'Update Event' : 'Save Festival'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2 px-3 border border-dashed border-stone-300 rounded-xl text-xs font-medium text-stone-600 hover:text-stone-900 hover:border-amber-500 hover:bg-amber-50/50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-600" />
            Add Festival or Temple Pooja Event
          </button>
        )}

        {/* Festival Events List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {festivalEvents.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              No festival events recorded yet. Click above to add your first festival date.
            </div>
          ) : (
            festivalEvents.map((fest) => {
              const prep = getPreparationStartDate(fest.date, 14);
              return (
                <div
                  key={fest.id}
                  className="p-3.5 bg-white rounded-xl border border-stone-200/90 shadow-2xs hover:border-amber-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-900">{fest.name}</span>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-stone-100 text-stone-700 rounded">
                        {fest.date}
                      </span>
                      {prep.isDue && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 rounded animate-pulse">
                          Preparation Due Now!
                        </span>
                      )}
                    </div>
                    {fest.notes && <p className="text-xs text-stone-500">{fest.notes}</p>}
                    <div className="text-[11px] text-amber-800 font-medium">
                      💡 Suggested ad preparation start: <span className="font-semibold">{prep.formattedPrepDate}</span> ({prep.daysRemaining > 0 ? `${prep.daysRemaining} days away` : 'Past event'})
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onPlanAdForFestival && (
                      <button
                        onClick={() => {
                          onPlanAdForFestival(fest);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 shadow-2xs transition-colors"
                      >
                        Plan Ad
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(fest)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${fest.name}"?`)) {
                          deleteFestivalEvent(fest.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-stone-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
