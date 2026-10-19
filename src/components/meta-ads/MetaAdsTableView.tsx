/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Copy,
  Edit2,
  Trash2,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Calendar,
  Sparkles,
  Plus,
  Upload,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MetaAd, MetaAdStage } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatINR, formatIndianNumber, formatMetricOrDash } from '../../lib/meta-ads-utils';

interface MetaAdsTableViewProps {
  ads: MetaAd[];
  onOpenPlanModal: (ad?: MetaAd) => void;
  onOpenResultsModal: (ad: MetaAd) => void;
  onSelectAdForReport?: (ad: MetaAd) => void;
  onOpenPastAdModal?: (draftAd?: MetaAd) => void;
  onOpenBulkImportModal?: () => void;
  onOpenCustomerLinkModal?: (ad: MetaAd) => void;
}

export const MetaAdsTableView: React.FC<MetaAdsTableViewProps> = ({
  ads,
  onOpenPlanModal,
  onOpenResultsModal,
  onSelectAdForReport,
  onOpenPastAdModal,
  onOpenBulkImportModal,
  onOpenCustomerLinkModal,
}) => {
  const { cloneMetaAd, softDeleteMetaAd, getDerivedAdMetrics } = useApp();

  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [selectedGoal, setSelectedGoal] = useState<string>('All');
  const [pastAdsOnly, setPastAdsOnly] = useState(false);
  const [includeDrafts, setIncludeDrafts] = useState(true);

  const filteredAds = useMemo(() => {
    const stagePriority: Record<MetaAdStage, number> = {
      'Waiting for result': 1,
      'Published': 2,
      'Pending': 3,
      'Fulfilled': 4,
      'Cancelled': 5,
    };

    return [...ads]
      .filter((ad) => {
        if (ad.isDeleted) return false;
        if (!includeDrafts && ad.isDraft) return false;
        if (pastAdsOnly && !ad.isHistorical) return false;
        if (selectedStage !== 'All' && ad.stage !== selectedStage) return false;
        if (selectedGoal !== 'All' && ad.goal !== selectedGoal) return false;

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = ad.name.toLowerCase().includes(q);
          const matchOccasion = (ad.occasion || '').toLowerCase().includes(q);
          const matchGoal = ad.goal.toLowerCase().includes(q);
          const matchPlace = (ad.targetCustomers?.places || []).some((p) => p.toLowerCase().includes(q));
          if (!matchName && !matchOccasion && !matchGoal && !matchPlace) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // 1. Stage action priority (Waiting for result, then Published, Pending, Fulfilled)
        const spA = stagePriority[a.stage] || 3;
        const spB = stagePriority[b.stage] || 3;
        if (spA !== spB) return spA - spB;

        // 2. Most recent start or end date
        const dA = a.plannedStart || a.createdAt || '';
        const dB = b.plannedStart || b.createdAt || '';
        return dB.localeCompare(dA);
      });
  }, [ads, search, selectedStage, selectedGoal, pastAdsOnly, includeDrafts]);

  const exportTableToExcel = () => {
    const rows = filteredAds.map((ad) => {
      const derived = getDerivedAdMetrics(ad.id);
      return {
        'Ad Name': ad.name,
        'Type': ad.isHistorical ? 'Historical (Past Ad)' : 'Standard Campaign',
        'Status': ad.isDraft ? 'Draft' : ad.stage,
        'Occasion': ad.occasion || '—',
        'Goal': ad.goal,
        'Daily Budget (INR)': ad.dailyBudget ? formatINR(ad.dailyBudget) : '—',
        'Total Budget / Spent (INR)': formatINR(ad.results?.totalSpent ?? ad.totalBudget),
        'Start Date': ad.plannedStart || '—',
        'End Date': ad.plannedEnd || '—',
        'Duration (Days)': ad.durationDays || '—',
        'Messaging Conversations': ad.results?.conversations !== null && ad.results?.conversations !== undefined ? ad.results.conversations : '—',
        'Cost Per Conversation (INR)': ad.results?.costPerConversation !== null && ad.results?.costPerConversation !== undefined ? ad.results.costPerConversation : '—',
        'Impressions (Views)': ad.results?.views !== null && ad.results?.views !== undefined ? ad.results.views : '—',
        'Reach (Viewers)': ad.results?.viewers !== null && ad.results?.viewers !== undefined ? ad.results.viewers : '—',
        'Link Clicks': ad.results?.linkClicks !== null && ad.results?.linkClicks !== undefined ? ad.results.linkClicks : '—',
        'CTR (%)': ad.results?.ctr !== null && ad.results?.ctr !== undefined ? `${ad.results.ctr}%` : '—',
        'CRM Customers Attributed': derived.customersImported,
        'Attributed Orders': derived.orders,
        'Revenue Attributed (INR)': formatINR(derived.revenue),
        'ROI (%)': `${derived.roi}%`,
        'Created By': ad.createdBy,
        'Assigned To': ad.assignedTo,
        'Batch ID': ad.importBatchId || '—',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Meta Ads Summary');
    XLSX.writeFile(wb, `jaikrishna-meta-ads-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getStageBadge = (stage: MetaAdStage) => {
    switch (stage) {
      case 'Pending':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Published':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Waiting for result':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Fulfilled':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Cancelled':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter Bar and Action Buttons */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by campaign name, occasion, goal, place..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none"
          >
            <option value="All">All Stages ({ads.length})</option>
            <option value="Pending">Pending</option>
            <option value="Published">Published</option>
            <option value="Waiting for result">Waiting for result</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Goal Filter */}
          <select
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none"
          >
            <option value="All">All Goals</option>
            <option value="Messages/Conversations">Messages/Conversations</option>
            <option value="Leads">Leads</option>
            <option value="Traffic">Traffic</option>
            <option value="Awareness">Awareness</option>
          </select>

          {/* Past Ads Only Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-stone-700 font-medium px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 select-none">
            <input
              type="checkbox"
              checked={pastAdsOnly}
              onChange={(e) => setPastAdsOnly(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Past Ads Only</span>
          </label>
        </div>

        {/* Action Buttons: Add Past Ad, Import, Export Excel */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenPastAdModal?.()}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Add Past Ad</span>
          </button>

          <button
            onClick={() => onOpenBulkImportModal?.()}
            className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={exportTableToExcel}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                <th className="py-3 px-4">Campaign Name &amp; Occasion</th>
                <th className="py-3 px-3">Stage</th>
                <th className="py-3 px-3">Goal</th>
                <th className="py-3 px-3">Total Spend</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3 text-right">Conversations</th>
                <th className="py-3 px-3 text-right">Cost/Conv</th>
                <th className="py-3 px-3 text-right">Views</th>
                <th className="py-3 px-3 text-right">Attributed Leads</th>
                <th className="py-3 px-3 text-right">ROI</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
              {filteredAds.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-400">
                    No Meta ads match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAds.map((ad) => {
                  const derived = getDerivedAdMetrics(ad.id);
                  return (
                    <tr key={ad.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-stone-900 truncate" title={ad.name}>
                            {ad.name}
                          </span>
                          {ad.isHistorical && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded">
                              Past ad
                            </span>
                          )}
                          {ad.isDraft && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-stone-200 text-stone-700 rounded">
                              Draft
                            </span>
                          )}
                        </div>
                        {ad.occasion && (
                          <div className="text-[10px] text-amber-800 font-medium truncate mt-0.5">
                            🪔 {ad.occasion}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStageBadge(ad.stage)}`}>
                          {ad.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-stone-600">
                        {ad.goal}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-stone-900">
                        {formatINR(ad.results?.totalSpent ?? ad.totalBudget)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[11px] text-stone-500">
                        {ad.plannedStart ? ad.plannedStart.slice(0, 10) : '—'} to{' '}
                        {ad.plannedEnd ? ad.plannedEnd.slice(0, 10) : '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-medium">
                        {ad.results && ad.results.conversations !== null
                          ? formatIndianNumber(ad.results.conversations)
                          : '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-medium">
                        {ad.results && ad.results.costPerConversation !== null
                          ? formatINR(ad.results.costPerConversation, true)
                          : '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-medium">
                        {ad.results && ad.results.views !== null
                          ? formatIndianNumber(ad.results.views)
                          : '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-medium">
                        {derived.customersImported > 0 ? (
                          <button
                            onClick={() => onOpenCustomerLinkModal?.(ad)}
                            className="text-amber-800 hover:underline font-bold"
                          >
                            {derived.customersImported} lead(s)
                          </button>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-bold">
                        {ad.stage === 'Fulfilled' ? (
                          <span className={derived.roi >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {derived.roi >= 0 ? '+' : ''}{derived.roi.toFixed(1)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Manage Customers */}
                          <button
                            onClick={() => onOpenCustomerLinkModal?.(ad)}
                            className="p-1 text-stone-400 hover:text-amber-800 hover:bg-amber-50 rounded"
                            title="Manage Linked CRM Customers"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>

                          {/* Clone ad */}
                          <button
                            onClick={() => cloneMetaAd(ad.id)}
                            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"
                            title="Clone ad for repeat festival campaign"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit / View Results */}
                          {ad.isDraft ? (
                            <button
                              onClick={() => onOpenPastAdModal?.(ad)}
                              className="p-1 text-amber-700 hover:bg-amber-50 rounded"
                              title="Continue Editing Draft"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          ) : ad.stage === 'Fulfilled' ? (
                            <button
                              onClick={() => onOpenResultsModal(ad)}
                              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Results &amp; Report"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onOpenPlanModal(ad)}
                              className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                              title="Edit Plan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Trash */}
                          <button
                            onClick={() => {
                              if (confirm(`Move "${ad.name}" to 30-day trash?`)) {
                                softDeleteMetaAd(ad.id);
                              }
                            }}
                            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
