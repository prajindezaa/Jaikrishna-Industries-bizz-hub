/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  UserPlus,
  UserMinus,
  Sparkles,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';
import { MetaAd, Customer } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatINR, formatIndianNumber } from '../../lib/meta-ads-utils';

interface AdCustomerLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: MetaAd;
}

export const AdCustomerLinkModal: React.FC<AdCustomerLinkModalProps> = ({
  isOpen,
  onClose,
  ad,
}) => {
  const {
    customers,
    metaAds,
    attachCustomersToAd,
    detachCustomersFromAd,
    recalculateAdMetrics,
    getDerivedAdMetrics,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unassigned_meta' | 'date_range' | 'in_ad'>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [confirmMoveNotice, setConfirmMoveNotice] = useState<string | null>(null);

  const derived = useMemo(() => {
    return getDerivedAdMetrics(ad.id);
  }, [ad.id, getDerivedAdMetrics]);

  // All customers currently linked to this ad
  const currentlyLinked = useMemo(() => {
    return customers.filter((c) => !c.isDeleted && c.campaignId === ad.id);
  }, [customers, ad.id]);

  // Candidates for filtering
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startMs = ad.plannedStart ? new Date(ad.plannedStart).getTime() : 0;
    const endMs = ad.plannedEnd ? new Date(ad.plannedEnd).getTime() : Infinity;

    return customers.filter((c) => {
      if (c.isDeleted) return false;

      // Filter modes
      if (filterType === 'in_ad') {
        if (c.campaignId !== ad.id) return false;
      } else if (filterType === 'unassigned_meta') {
        if (c.source !== 'Meta Ads' || c.campaignId) return false;
      } else if (filterType === 'date_range') {
        const custCreatedMs = new Date(c.createdAt).getTime();
        if (custCreatedMs < startMs || custCreatedMs > endMs) return false;
      }

      // Search match
      if (q) {
        const matchName = c.companyName.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q);
        const matchPhone = c.phone.includes(q);
        const matchCity = c.place?.city.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCity) return false;
      }

      return true;
    });
  }, [customers, ad, search, filterType]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCustomerIds(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedCustomerIds);
    filteredCandidates.forEach((c) => next.add(c.id));
    setSelectedCustomerIds(next);
  };

  const deselectAll = () => {
    setSelectedCustomerIds(new Set());
  };

  const handleAttachSelected = async () => {
    if (selectedCustomerIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await attachCustomersToAd(ad.id, Array.from(selectedCustomerIds));
      setSelectedCustomerIds(new Set());
      setConfirmMoveNotice(null);
    } catch (err) {
      console.error('Failed to attach customers:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetach = async (customerId: string) => {
    setIsSubmitting(true);
    try {
      await detachCustomersFromAd(ad.id, [customerId]);
    } catch (err) {
      console.error('Failed to detach customer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateAdMetrics(ad.id);
    } catch (err) {
      console.error('Recalculation error:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Check how many selected customers belong to another ad
  const movedCustomersCount = Array.from(selectedCustomerIds).filter((id) => {
    const c = customers.find((cust) => cust.id === id);
    return c?.campaignId && c.campaignId !== ad.id;
  }).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 font-display flex items-center gap-2">
                <span>Manage Linked Customers</span>
                {ad.isHistorical && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                    Past Ad
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 truncate max-w-md">
                Ad: <strong>{ad.name}</strong> ({currentlyLinked.length} customer(s) attributed)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Attributed Outcomes Strip */}
        <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[11px] text-stone-500">Attributed Customers</span>
              <div className="font-bold font-mono text-stone-900">{derived.customersImported}</div>
            </div>
            <div>
              <span className="text-[11px] text-stone-500">Orders</span>
              <div className="font-bold font-mono text-stone-900">{derived.orders}</div>
            </div>
            <div>
              <span className="text-[11px] text-stone-500">Revenue</span>
              <div className="font-bold font-mono text-stone-900">{formatINR(derived.revenue)}</div>
            </div>
            <div>
              <span className="text-[11px] text-stone-500">Calculated ROI</span>
              <div className={`font-bold font-mono ${derived.roi >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {derived.roi > 0 ? `+${derived.roi}%` : `${derived.roi}%`}
              </div>
            </div>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>Recalculate Derived Metrics</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-stone-200 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers by shop name, contact, phone, city..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All ({customers.length})
              </button>
              <button
                onClick={() => setFilterType('in_ad')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'in_ad'
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                In this ad ({currentlyLinked.length})
              </button>
              <button
                onClick={() => setFilterType('unassigned_meta')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'unassigned_meta'
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Meta Ads (No Ad)
              </button>
              <button
                onClick={() => setFilterType('date_range')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'date_range'
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                In Ad Dates
              </button>
            </div>
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-mono">
                {selectedCustomerIds.size} selected of {filteredCandidates.length}
              </span>
              <button
                onClick={selectAllFiltered}
                className="text-amber-800 hover:underline font-semibold"
              >
                Select all matching
              </button>
              {selectedCustomerIds.size > 0 && (
                <button
                  onClick={deselectAll}
                  className="text-stone-500 hover:underline"
                >
                  Clear selection
                </button>
              )}
            </div>

            {selectedCustomerIds.size > 0 && (
              <button
                onClick={handleAttachSelected}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Attach {selectedCustomerIds.size} to this ad</span>
              </button>
            )}
          </div>

          {/* Warning banner if moving customers from another ad */}
          {movedCustomersCount > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{movedCustomersCount}</strong> of your selected customers already belong to another Meta ad campaign. Attaching will move them to this ad and update both ads&apos; ROI reports.
              </span>
            </div>
          )}
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-stone-100">
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs">
              No matching customers found for this filter.
            </div>
          ) : (
            filteredCandidates.map((cust) => {
              const isSelected = selectedCustomerIds.has(cust.id);
              const isLinkedToThis = cust.campaignId === ad.id;
              const otherAd = cust.campaignId && cust.campaignId !== ad.id
                ? metaAds.find((a) => a.id === cust.campaignId)
                : null;

              return (
                <div
                  key={cust.id}
                  onClick={() => toggleSelect(cust.id)}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-50/80 border border-amber-300'
                      : isLinkedToThis
                      ? 'bg-emerald-50/40 border border-emerald-200'
                      : 'hover:bg-stone-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(cust.id)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-900 flex items-center gap-2">
                        <span>{cust.companyName}</span>
                        <span className="text-[10px] font-normal text-stone-500">
                          ({cust.contactPerson})
                        </span>
                        {isLinkedToThis && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-medium">
                            Attributed to this ad
                          </span>
                        )}
                        {otherAd && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Belongs to: {otherAd.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                        {cust.place?.city} · {cust.phone} · Source: {cust.source} · Created: {cust.createdAt.slice(0, 10)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-stone-900 font-mono">
                        {formatINR(cust.totalRevenue)}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {cust.totalOrdersCount} orders
                      </div>
                    </div>

                    {isLinkedToThis && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetach(cust.id);
                        }}
                        disabled={isSubmitting}
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                        title="Detach customer from this ad"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs">
          <div className="text-stone-500">
            A customer belongs to at most one ad. Attaching re-attributes orders and calculates exact ROI.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-stone-700 hover:bg-stone-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
