/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  TrendingUp,
  Image as ImageIcon,
  DollarSign,
  Calendar,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Users,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MetaAd, MetaAdStage } from '../../types';
import { formatINR, formatIndianNumber } from '../../lib/meta-ads-utils';

interface MetaAdsPipelineKanbanProps {
  ads: MetaAd[];
  onOpenPlanModal: (ad?: MetaAd) => void;
  onOpenResultsModal: (ad: MetaAd) => void;
  onSelectAdForReport?: (ad: MetaAd) => void;
  onOpenPastAdModal?: (draftAd?: MetaAd) => void;
  onOpenBulkImportModal?: () => void;
  onOpenCustomerLinkModal?: (ad: MetaAd) => void;
}

const STAGES: {
  id: MetaAdStage;
  title: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}[] = [
  {
    id: 'Pending',
    title: 'Pending',
    color: 'border-amber-400 bg-amber-500/10 text-amber-900',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    description: 'Planned, drafting copy & creatives',
  },
  {
    id: 'Published',
    title: 'Published',
    color: 'border-blue-400 bg-blue-500/10 text-blue-900',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    description: 'Live active on Meta Ads Manager',
  },
  {
    id: 'Waiting for result',
    title: 'Waiting for result',
    color: 'border-purple-400 bg-purple-500/10 text-purple-900',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    description: 'Ad ended, results awaiting entry',
  },
  {
    id: 'Fulfilled',
    title: 'Fulfilled',
    color: 'border-emerald-400 bg-emerald-500/10 text-emerald-900',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    description: 'Results recorded, report finalized',
  },
  {
    id: 'Cancelled',
    title: 'Cancelled',
    color: 'border-stone-400 bg-stone-500/10 text-stone-700',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-600',
    description: 'Archived with logged reason',
  },
];

export const MetaAdsPipelineKanban: React.FC<MetaAdsPipelineKanbanProps> = ({
  ads,
  onOpenPlanModal,
  onOpenResultsModal,
  onSelectAdForReport,
  onOpenPastAdModal,
  onOpenBulkImportModal,
  onOpenCustomerLinkModal,
}) => {
  const { changeMetaAdStage, cloneMetaAd, softDeleteMetaAd, getDerivedAdMetrics } = useApp();

  const [draggedAdId, setDraggedAdId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancellingAd, setCancellingAd] = useState<MetaAd | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  const nowTime = new Date().getTime();

  // Find ended published ads requiring prompt to move to "Waiting for result"
  const endedPublishedAds = ads.filter((ad) => {
    if (ad.stage !== 'Published' || !ad.plannedEnd) return false;
    return new Date(ad.plannedEnd).getTime() <= nowTime;
  });

  const handleDragStart = (e: React.DragEvent, adId: string) => {
    e.dataTransfer.setData('text/plain', adId);
    setDraggedAdId(adId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: MetaAdStage) => {
    e.preventDefault();
    const adId = e.dataTransfer.getData('text/plain') || draggedAdId;
    if (!adId) return;

    const ad = ads.find((a) => a.id === adId);
    if (!ad || ad.stage === targetStage) return;

    await executeStageChange(ad, targetStage);
    setDraggedAdId(null);
  };

  const executeStageChange = async (ad: MetaAd, targetStage: MetaAdStage) => {
    setErrorMessage(null);

    if (targetStage === 'Cancelled') {
      setCancellingAd(ad);
      setCancelReasonInput('');
      return;
    }

    if (targetStage === 'Fulfilled') {
      // Must open the verified Results Form
      onOpenResultsModal(ad);
      return;
    }

    const res = await changeMetaAdStage(ad.id, targetStage);
    if (!res.success) {
      setErrorMessage(res.error || `Cannot move ad to '${targetStage}'`);
      if (targetStage === 'Published') {
        // Open edit form so member can easily provide missing requirements
        onOpenPlanModal(ad);
      }
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingAd) return;
    if (!cancelReasonInput.trim()) {
      setErrorMessage('Please enter a cancellation reason.');
      return;
    }

    const res = await changeMetaAdStage(cancellingAd.id, 'Cancelled', {
      cancelReason: cancelReasonInput.trim(),
    });

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to cancel ad');
    } else {
      setCancellingAd(null);
      setCancelReasonInput('');
    }
  };

  const handleClone = async (ad: MetaAd) => {
    try {
      const clonedId = await cloneMetaAd(ad.id);
      const clonedAd = ads.find(a => a.id === clonedId);
      if (clonedAd) {
        onOpenPlanModal(clonedAd);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to clone ad');
    }
  };

  return (
    <div className="space-y-4">
      {/* Overdue Ended Ads Notice Banner */}
      {endedPublishedAds.length > 0 && (
        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-purple-700 shrink-0" />
            <div>
              <span className="font-bold">Ad Schedule Ended:</span> {endedPublishedAds.length} Published ad(s) have passed their scheduled end time. Click below to move them to &quot;Waiting for result&quot;.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {endedPublishedAds.map((ad) => (
              <button
                key={ad.id}
                onClick={() => executeStageChange(ad, 'Waiting for result')}
                className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-xs shadow-2xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                <span>Move &quot;{ad.name.slice(0, 18)}...&quot;</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-stone-400 hover:text-stone-700 p-1"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kanban Board Horizontal Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
        {STAGES.map((col) => {
          const colAds = ads.filter((a) => a.stage === col.id);
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="bg-stone-100/70 border border-stone-200/90 rounded-2xl p-3 flex flex-col min-h-[480px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.id === 'Pending' ? 'bg-amber-500' : col.id === 'Published' ? 'bg-blue-500' : col.id === 'Waiting for result' ? 'bg-purple-500' : col.id === 'Fulfilled' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                  <span className="text-xs font-bold text-stone-900">{col.title}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${col.badgeBg} ${col.badgeText}`}>
                  {colAds.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[720px] pr-0.5">
                {colAds.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center p-3 text-center text-[11px] text-stone-400">
                    Drop ads here
                  </div>
                ) : (
                  colAds.map((ad) => {
                    const derived = getDerivedAdMetrics(ad.id);
                    const isOverdue =
                      ad.stage === 'Published' &&
                      ad.plannedEnd &&
                      new Date(ad.plannedEnd).getTime() <= nowTime;

                    return (
                      <div
                        key={ad.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, ad.id)}
                        className={`p-3 bg-white rounded-xl border transition-all shadow-2xs hover:shadow-xs cursor-grab active:cursor-grabbing space-y-2.5 ${
                          isOverdue ? 'border-purple-300 ring-2 ring-purple-100' : 'border-stone-200 hover:border-amber-400'
                        }`}
                      >
                        {/* Occasion / Festival Tag */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
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
                            {ad.occasion ? (
                              <span className="text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded truncate max-w-[120px]">
                                🪔 {ad.occasion}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-stone-500">
                                {ad.goal}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-stone-400">
                            {ad.placements?.length || 0} placements
                          </span>
                        </div>

                        {/* Title & Preview Image */}
                        <div>
                          <h4 className="text-xs font-bold text-stone-900 line-clamp-2">
                            {ad.name}
                          </h4>
                          {ad.creatives && ad.creatives.length > 0 && (
                            <div className="mt-2 relative rounded-lg overflow-hidden h-24 bg-stone-100 border border-stone-200">
                              <img
                                src={ad.creatives[0].url}
                                alt={ad.name}
                                className="w-full h-full object-cover"
                              />
                              {ad.creatives.length > 1 && (
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">
                                  +{ad.creatives.length - 1} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Budget & Target Info */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-100">
                          <span className="text-stone-500 font-medium">Budget:</span>
                          <span className="font-mono font-bold text-stone-900">
                            {formatINR(ad.totalBudget || (ad.dailyBudget * (ad.durationDays || 1)))}
                          </span>
                        </div>

                        {/* Stage Specific Highlights */}
                        {ad.stage === 'Fulfilled' && ad.results && (
                          <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200/80 space-y-1 text-[11px]">
                            <div className="flex justify-between text-emerald-950 font-medium">
                              <span>WhatsApp Convs:</span>
                              <span className="font-bold font-mono">
                                {formatIndianNumber(ad.results.conversations)}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-950 font-medium">
                              <span>Cost/Conv:</span>
                              <span className="font-bold font-mono">
                                {formatINR(ad.results.costPerConversation, true)}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-950 font-medium">
                              <span>Attributed Leads:</span>
                              <span className="font-bold font-mono text-stone-800">
                                {derived.customersImported}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-950 font-medium">
                              <span>ROI:</span>
                              <span className="font-bold font-mono text-emerald-800">
                                {derived.roi >= 0 ? '+' : ''}{derived.roi.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}

                        {isOverdue && (
                          <div className="p-1.5 bg-purple-100 text-purple-900 text-[10px] font-bold rounded text-center animate-pulse">
                            Ended · Results due now!
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                          {/* Mobile quick Move-To dropdown */}
                          <div className="flex items-center gap-1">
                            <select
                              value={ad.stage}
                              onChange={(e) => executeStageChange(ad, e.target.value as MetaAdStage)}
                              className="text-[10px] font-semibold bg-stone-50 border border-stone-200 text-stone-700 py-1 px-1.5 rounded-lg focus:outline-none"
                            >
                              <option value="" disabled>Move to...</option>
                              {STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  → {s.title}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Link Customers */}
                            <button
                              onClick={() => onOpenCustomerLinkModal?.(ad)}
                              className="p-1.5 text-stone-400 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                              title="Link / Manage CRM Customers"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>

                            {/* Clone Ad */}
                            <button
                              onClick={() => handleClone(ad)}
                              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                              title="Clone ad for repeat festival campaign"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit / View Results */}
                            {ad.isDraft ? (
                              <button
                                onClick={() => onOpenPastAdModal?.(ad)}
                                className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                                title="Continue Editing Draft"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            ) : ad.stage === 'Fulfilled' ? (
                              <button
                                onClick={() => onOpenResultsModal(ad)}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                title="View/Edit Results"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onOpenPlanModal(ad)}
                                className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
                                title="Edit Planning Form"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Soft Delete */}
                            <button
                              onClick={() => {
                                if (confirm(`Move "${ad.name}" to 30-day trash?`)) {
                                  softDeleteMetaAd(ad.id);
                                }
                              }}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Add in Columns */}
              {col.id === 'Pending' && (
                <button
                  onClick={() => onOpenPlanModal()}
                  className="mt-2.5 w-full py-2 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-300 rounded-xl text-xs font-semibold text-stone-700 hover:text-amber-900 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>Plan New Ad</span>
                </button>
              )}

              {col.id === 'Fulfilled' && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <button
                    onClick={() => onOpenPastAdModal?.()}
                    className="w-full py-1.5 bg-white hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 rounded-xl text-xs font-semibold text-stone-700 hover:text-emerald-900 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Add Past Ad</span>
                  </button>
                  <button
                    onClick={() => onOpenBulkImportModal?.()}
                    className="w-full py-1.5 bg-white hover:bg-blue-50 border border-stone-200 hover:border-blue-300 rounded-xl text-xs font-semibold text-stone-700 hover:text-blue-900 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-700" />
                    <span>Import Past Ads</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cancellation Reason Modal */}
      {cancellingAd && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">
              Cancel Ad: &quot;{cancellingAd.name}&quot;
            </h3>
            <p className="text-xs text-stone-500">
              Please record a reason for canceling this campaign for audit and historical analysis:
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Budget reallocated to Pongal festival; creatives delayed by designer; payment failure..."
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingAd(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
