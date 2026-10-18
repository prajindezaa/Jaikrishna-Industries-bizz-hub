/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Database,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useApp, TrashItem } from '../context/AppContext';

export const TrashView: React.FC = () => {
  const { t } = useLanguage();
  const { trashItems, restoreTrashItem, permanentlyDeleteTrashItem, emptyExpiredTrash } = useApp();

  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [restoredToast, setRestoredToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setRestoredToast(msg);
    setTimeout(() => setRestoredToast(null), 3000);
  };

  const handleRestore = async (item: TrashItem) => {
    await restoreTrashItem(item);
    showToast(`Restored "${item.title}" successfully!`);
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    if (
      window.confirm(
        `PERMANENT DELETION WARNING: Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`
      )
    ) {
      await permanentlyDeleteTrashItem(item);
      showToast(`Permanently deleted "${item.title}".`);
    }
  };

  const handleEmptyExpired = async () => {
    const expiredCount = trashItems.filter((i) => i.daysRemaining <= 0).length;
    if (expiredCount === 0) {
      alert('No expired items (>30 days old) found.');
      return;
    }
    if (window.confirm(`Permanently purge ${expiredCount} items older than 30 days?`)) {
      const purged = await emptyExpiredTrash();
      showToast(`Purged ${purged} expired items.`);
    }
  };

  const filteredItems = trashItems.filter((item) => {
    const matchesEntity = filterEntity === 'all' || item.entity === filterEntity;
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.details.toLowerCase().includes(search.toLowerCase());
    return matchesEntity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {restoredToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#881337] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-300" />
          <span>{restoredToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-stone-900 tracking-tight">
              30-Day Trash & Recovery Archive
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
              {trashItems.length} items
            </span>
          </div>
          <p className="text-xs text-stone-700 mt-1">
            Soft-deleted records are retained securely for 30 days. You can restore them anytime or let the scheduled Cloud Function purge them permanently.
          </p>
        </div>

        <button
          onClick={handleEmptyExpired}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Purge Expired (&gt;30 Days)
        </button>
      </div>

      {/* Policy Notice Box */}
      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Automated Trash Purge Policy:</span> Any customer, task, or order in trash is automatically purged after 30 days by the daily Cloud Function (`purgeExpiredTrashScheduled` at 02:00 AM IST). Restoring returns the record to active status with all historical notes and orders intact.
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-sm">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            placeholder="Search deleted records by name or detail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-800 focus:outline-hidden placeholder:text-stone-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-100 text-xs">
            {['all', 'customer', 'task', 'order'].map((tType) => (
              <button
                key={tType}
                onClick={() => setFilterEntity(tType)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-colors ${
                  filterEntity === tType
                    ? 'bg-white shadow-xs text-stone-900'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                {tType === 'all' ? 'All Types' : `${tType}s`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 mb-3 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800 mb-1">Trash is Empty</h3>
          <p className="text-xs text-stone-700 max-w-sm mx-auto">
            There are no soft-deleted customers, tasks, or orders in your workspace.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs divide-y divide-stone-100">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 hover:bg-stone-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                    {item.entity}
                  </span>
                  <h4 className="font-bold text-stone-900 text-sm">{item.title}</h4>
                </div>
                <p className="text-stone-700">{item.details}</p>
                <div className="flex items-center gap-3 text-[11px] text-stone-700 pt-0.5">
                  <span>Deleted by: {item.deletedBy}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-amber-700 font-medium">
                    <Clock className="w-3 h-3" />
                    {item.daysRemaining} days remaining before permanent purge
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRestore(item)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
                <button
                  onClick={() => handlePermanentDelete(item)}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
