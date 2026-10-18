/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Upload,
  Info,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Star,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  MessageSquare,
  MousePointer,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { MetaAd, MetaAdResults } from '../../types';
import {
  formatINR,
  formatIndianNumber,
  calculateCostPerConversation,
  calculateFrequency,
  calculateCtr,
  validatePercentages,
  parseMetaAdsExportData,
} from '../../lib/meta-ads-utils';

interface MetaAdResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ad: MetaAd;
  onSuccess?: () => void;
}

export const MetaAdResultsModal: React.FC<MetaAdResultsModalProps> = ({
  isOpen,
  onClose,
  ad,
  onSuccess,
}) => {
  const { changeMetaAdStage, getDerivedAdMetrics } = useApp();

  // A. Messaging
  const [conversations, setConversations] = useState<number>(ad.results?.conversations || 0);
  const [manualCostPerConversation, setManualCostPerConversation] = useState<string>(
    ad.results?.costPerConversation ? String(ad.results.costPerConversation) : ''
  );
  const [overrideCostPerConversation, setOverrideCostPerConversation] = useState(
    Boolean(ad.results?.manualCostPerConversationOverride)
  );

  // B. Reach
  const [views, setViews] = useState<number>(ad.results?.views || 0);
  const [viewers, setViewers] = useState<number>(ad.results?.viewers || 0);

  // C. Audience percentage splits (default values)
  const [audienceAge, setAudienceAge] = useState<Record<string, number>>(
    ad.results?.audienceAge || { '18-24': 10, '25-34': 45, '35-44': 30, '45+': 15 }
  );
  const [audienceGender, setAudienceGender] = useState<Record<string, number>>(
    ad.results?.audienceGender || { Men: 65, Women: 35 }
  );
  const [audiencePlaces, setAudiencePlaces] = useState<Record<string, number>>(
    ad.results?.audiencePlaces || { 'Salem & Erode': 45, Coimbatore: 35, Madurai: 20 }
  );
  const [newPlaceKey, setNewPlaceKey] = useState('');
  const [newPlaceVal, setNewPlaceVal] = useState('');

  // D. Spend
  const [totalSpent, setTotalSpent] = useState<number>(
    ad.results?.totalSpent ?? ad.totalBudget ?? (ad.dailyBudget * (ad.durationDays || 1))
  );
  const [dailyBudget, setDailyBudget] = useState<number>(
    ad.results?.dailyBudget ?? ad.dailyBudget ?? 0
  );
  const [actualDuration, setActualDuration] = useState<number>(
    ad.results?.actualDuration ?? ad.durationDays ?? 7
  );
  const [actualStart, setActualStart] = useState<string>(
    ad.results?.actualStart || ad.plannedStart || ''
  );
  const [actualEnd, setActualEnd] = useState<string>(
    ad.results?.actualEnd || ad.plannedEnd || ''
  );

  // E. Post engagement
  const [engagements, setEngagements] = useState<number>(ad.results?.engagements || 0);
  const [reactions, setReactions] = useState<number>(ad.results?.reactions || 0);
  const [comments, setComments] = useState<number>(ad.results?.comments || 0);
  const [shares, setShares] = useState<number>(ad.results?.shares || 0);
  const [saves, setSaves] = useState<number>(ad.results?.saves || 0);

  // F. Clicks
  const [linkClicks, setLinkClicks] = useState<number>(ad.results?.linkClicks || 0);
  const [manualCtr, setManualCtr] = useState<string>(
    ad.results?.ctr ? String(ad.results.ctr) : ''
  );
  const [overrideCtr, setOverrideCtr] = useState(Boolean(ad.results?.manualCtrOverride));

  // H. Extras
  const [screenshotUrl, setScreenshotUrl] = useState<string>(ad.results?.screenshotUrl || '');
  const [lessons, setLessons] = useState<string>(ad.results?.lessons || '');
  const [rating, setRating] = useState<number>(ad.results?.rating || 5);

  // Status and Validation states
  const [error, setError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-calculated fields
  const calculatedCostPerConv = useMemo(() => {
    return calculateCostPerConversation(totalSpent, conversations);
  }, [totalSpent, conversations]);

  const effectiveCostPerConv = overrideCostPerConversation && manualCostPerConversation !== ''
    ? parseFloat(manualCostPerConversation) || calculatedCostPerConv
    : calculatedCostPerConv;

  const frequency = useMemo(() => {
    return calculateFrequency(views, viewers);
  }, [views, viewers]);

  const calculatedCtr = useMemo(() => {
    return calculateCtr(linkClicks, views);
  }, [linkClicks, views]);

  const effectiveCtr = overrideCtr && manualCtr !== ''
    ? parseFloat(manualCtr) || calculatedCtr
    : calculatedCtr;

  // G. Live derived business outcome from CRM customers linked to this ad campaign
  const derivedOutcome = useMemo(() => {
    return getDerivedAdMetrics(ad.id);
  }, [ad.id, getDerivedAdMetrics]);

  // Live percentage sums
  const ageValidation = useMemo(() => validatePercentages(audienceAge, 'Age groups'), [audienceAge]);
  const genderValidation = useMemo(() => validatePercentages(audienceGender, 'Gender'), [audienceGender]);
  const placesValidation = useMemo(() => validatePercentages(audiencePlaces, 'Places'), [audiencePlaces]);

  // Reset or initialize on ad change
  useEffect(() => {
    if (ad) {
      setConversations(ad.results?.conversations || 0);
      setViews(ad.results?.views || 0);
      setViewers(ad.results?.viewers || 0);
      setTotalSpent(ad.results?.totalSpent ?? ad.totalBudget ?? (ad.dailyBudget * (ad.durationDays || 1)));
      setDailyBudget(ad.results?.dailyBudget ?? ad.dailyBudget ?? 0);
      setActualDuration(ad.results?.actualDuration ?? ad.durationDays ?? 7);
      setActualStart(ad.results?.actualStart || ad.plannedStart || '');
      setActualEnd(ad.results?.actualEnd || ad.plannedEnd || '');
      setEngagements(ad.results?.engagements || 0);
      setReactions(ad.results?.reactions || 0);
      setComments(ad.results?.comments || 0);
      setShares(ad.results?.shares || 0);
      setSaves(ad.results?.saves || 0);
      setLinkClicks(ad.results?.linkClicks || 0);
      setScreenshotUrl(ad.results?.screenshotUrl || '');
      setLessons(ad.results?.lessons || '');
      setRating(ad.results?.rating || 5);
      if (ad.results?.audienceAge) setAudienceAge(ad.results.audienceAge);
      if (ad.results?.audienceGender) setAudienceGender(ad.results.audienceGender);
      if (ad.results?.audiencePlaces) setAudiencePlaces(ad.results.audiencePlaces);
    }
  }, [ad]);

  if (!isOpen) return null;

  // Import from Meta Ads Manager CSV or Excel export
  const handleImportExportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (data.length < 2) {
          setError('File does not contain valid tabular Meta ad data.');
          return;
        }

        const headers = data[0].map((h: any) => String(h || ''));
        // Find row matching current ad name or take first valid row
        let targetRow = data.slice(1).find((row: any[]) => {
          const campaignName = String(row[0] || '').toLowerCase();
          return campaignName && ad.name.toLowerCase().includes(campaignName);
        });

        if (!targetRow) {
          targetRow = data[1];
        }

        const parsed = parseMetaAdsExportData(headers, targetRow);
        if (parsed.views !== undefined && parsed.views !== null) setViews(parsed.views);
        if (parsed.viewers !== undefined && parsed.viewers !== null) setViewers(parsed.viewers);
        if (parsed.totalSpent !== undefined && parsed.totalSpent !== null) setTotalSpent(parsed.totalSpent);
        if (parsed.conversations !== undefined && parsed.conversations !== null) setConversations(parsed.conversations);
        if (parsed.linkClicks !== undefined && parsed.linkClicks !== null) setLinkClicks(parsed.linkClicks);
        if (parsed.engagements !== undefined && parsed.engagements !== null) setEngagements(parsed.engagements);
        if (parsed.reactions !== undefined && parsed.reactions !== null) setReactions(parsed.reactions);
        if (parsed.comments !== undefined && parsed.comments !== null) setComments(parsed.comments);
        if (parsed.shares !== undefined && parsed.shares !== null) setShares(parsed.shares);
        if (parsed.saves !== undefined && parsed.saves !== null) setSaves(parsed.saves);

        setImportNotice(`Successfully mapped & imported Meta Ads Manager data from "${file.name}"!`);
        setTimeout(() => setImportNotice(null), 5000);
      } catch (err: any) {
        setError(`Failed to parse export file: ${err?.message || 'Invalid format'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit and move to Fulfilled
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (totalSpent < 0 || views < 0 || viewers < 0 || conversations < 0) {
      setError('Numerical metrics cannot be negative values.');
      return;
    }

    if (viewers > views && views > 0) {
      setError('Viewers (Reach) cannot exceed total Views (Impressions).');
      return;
    }

    if (!ageValidation.isValid) {
      setError(ageValidation.error || 'Audience age percentages must total 100%.');
      return;
    }
    if (!genderValidation.isValid) {
      setError(genderValidation.error || 'Audience gender percentages must total 100%.');
      return;
    }
    if (!placesValidation.isValid) {
      setError(placesValidation.error || 'Audience place percentages must total 100%.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const resultsPayload: MetaAdResults = {
      conversations: Number(conversations) || 0,
      costPerConversation: effectiveCostPerConv,
      manualCostPerConversationOverride: overrideCostPerConversation,
      views: Number(views) || 0,
      viewers: Number(viewers) || 0,
      frequency,
      audienceAge,
      audienceGender,
      audiencePlaces,
      totalSpent: Number(totalSpent) || 0,
      dailyBudget: Number(dailyBudget) || 0,
      actualDuration: Number(actualDuration) || 0,
      actualStart,
      actualEnd,
      engagements: Number(engagements) || 0,
      reactions: Number(reactions) || 0,
      comments: Number(comments) || 0,
      shares: Number(shares) || 0,
      saves: Number(saves) || 0,
      linkClicks: Number(linkClicks) || 0,
      ctr: effectiveCtr,
      manualCtrOverride: overrideCtr,
      derived: derivedOutcome,
      screenshotUrl: screenshotUrl.trim() || undefined,
      lessons: lessons.trim() || undefined,
      rating: Number(rating) || 5,
    };

    try {
      const res = await changeMetaAdStage(ad.id, 'Fulfilled', {
        resultsPayload,
      });

      if (!res.success) {
        setError(res.error || 'Failed to validate and save results.');
        setSubmitting(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit Meta results.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-4xl w-full p-4 sm:p-6 space-y-6 max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                Move to Fulfilled
              </span>
              <span className="text-xs text-stone-500 font-mono">
                {ad.name}
              </span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 font-display mt-0.5">
              Verified Meta Ads Results Form
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import from Meta Export Banner */}
        <div className="p-3 bg-stone-50 border border-stone-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-900 block">
                Import from Meta Ads Manager Export
              </span>
              <span className="text-[11px] text-stone-500">
                Upload your CSV/Excel export from Meta Ads Manager to auto-fill all metrics
              </span>
            </div>
          </div>
          <label className="cursor-pointer px-3 py-1.5 bg-white border border-stone-300 hover:border-emerald-500 text-stone-800 text-xs font-semibold rounded-lg shadow-2xs hover:bg-emerald-50/50 flex items-center justify-center gap-1.5 shrink-0 transition-colors">
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            Upload CSV / Excel
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleImportExportFile}
              className="hidden"
            />
          </label>
        </div>

        {/* Notices */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {importNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{importNotice}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form id="results-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* A. Messaging */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1.5">
              <MessageSquare className="w-4 h-4 text-amber-700" />
              <span>A. Messaging Performance</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Messaging Conversations Started *
                </label>
                <input
                  type="number"
                  min="0"
                  value={conversations}
                  onChange={(e) => setConversations(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  Direct WhatsApp/Messenger inquiry conversations initiated
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-800">
                    Cost per Messaging Conversation (₹)
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideCostPerConversation}
                      onChange={(e) => setOverrideCostPerConversation(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    Manual Override
                  </label>
                </div>
                {overrideCostPerConversation ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter Meta's reported cost per conversation"
                    value={manualCostPerConversation}
                    onChange={(e) => setManualCostPerConversation(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none font-mono"
                  />
                ) : (
                  <div className="px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-mono text-stone-800 font-bold flex items-center justify-between">
                    <span>{formatINR(calculatedCostPerConv, true)}</span>
                    <span className="text-[10px] text-stone-400 font-sans">
                      (Auto: Spend / Conversations)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* B. Reach */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1.5">
              <Eye className="w-4 h-4 text-blue-700" />
              <span>B. Reach &amp; Frequency</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="block text-xs font-semibold text-stone-800">
                    Views (Impressions) *
                  </label>
                  <div className="group relative cursor-help">
                    <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-stone-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      Total times your ad was on screen (Meta Impressions)
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={views}
                  onChange={(e) => setViews(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="block text-xs font-semibold text-stone-800">
                    Viewers (Reach) *
                  </label>
                  <div className="group relative cursor-help">
                    <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-stone-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      The number of unique people who saw your ad at least once (Meta Reach)
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={viewers}
                  onChange={(e) => setViewers(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Frequency (Avg Views / Viewer)
                </label>
                <div className="px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-mono text-stone-800 font-bold">
                  {frequency !== null ? frequency.toFixed(2) : '—'}x
                </div>
              </div>
            </div>
          </div>

          {/* C. Audience Breakdown (% Wise with Live 100% Validation) */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800">
                <Users className="w-4 h-4 text-purple-700" />
                <span>C. Audience Breakdown (Percentage Wise)</span>
              </div>
              <span className="text-[11px] text-stone-500">
                Each group must sum to 100%
              </span>
            </div>

            {/* Age groups */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-stone-800">Age Groups Split</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  ageValidation.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  Total: {ageValidation.sum}% {ageValidation.isValid ? '✓' : '(Must be 100%)'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(audienceAge).map(([group, pct]) => (
                  <div key={group} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-stone-200">
                    <span className="text-xs text-stone-600 font-medium">{group}:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pct}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAudienceAge(prev => ({ ...prev, [group]: val }));
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs border rounded text-right font-mono"
                    />
                    <span className="text-xs text-stone-400">%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gender split */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-stone-800">Gender Split</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  genderValidation.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  Total: {genderValidation.sum}% {genderValidation.isValid ? '✓' : '(Must be 100%)'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(audienceGender).map(([gen, pct]) => (
                  <div key={gen} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-stone-200">
                    <span className="text-xs text-stone-600 font-medium">{gen}:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pct}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAudienceGender(prev => ({ ...prev, [gen]: val }));
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs border rounded text-right font-mono"
                    />
                    <span className="text-xs text-stone-400">%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top places */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-stone-800">Top Places Split</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  placesValidation.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  Total: {placesValidation.sum}% {placesValidation.isValid ? '✓' : '(Must be 100%)'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Object.entries(audiencePlaces).map(([place, pct]) => (
                  <div key={place} className="flex items-center justify-between gap-1.5 bg-white p-1.5 rounded-lg border border-stone-200">
                    <span className="text-xs text-stone-700 truncate font-medium">{place}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={pct}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setAudiencePlaces(prev => ({ ...prev, [place]: val }));
                        }}
                        className="w-14 px-1.5 py-0.5 text-xs border rounded text-right font-mono"
                      />
                      <span className="text-xs text-stone-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* D. Spend */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-700" />
              <span>D. Spend &amp; Duration</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Total Spent (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-stone-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={totalSpent}
                    onChange={(e) => setTotalSpent(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Daily Budget (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-stone-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Actual Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Actual Start Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Actual End Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* E. Post Engagement */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1.5">
              E. Post Engagement Breakdown
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-xs text-stone-600 mb-1">Engagements</label>
                <input
                  type="number"
                  min="0"
                  value={engagements}
                  onChange={(e) => setEngagements(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Reactions</label>
                <input
                  type="number"
                  min="0"
                  value={reactions}
                  onChange={(e) => setReactions(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Comments</label>
                <input
                  type="number"
                  min="0"
                  value={comments}
                  onChange={(e) => setComments(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Shares</label>
                <input
                  type="number"
                  min="0"
                  value={shares}
                  onChange={(e) => setShares(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">Saves</label>
                <input
                  type="number"
                  min="0"
                  value={saves}
                  onChange={(e) => setSaves(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1 text-xs border rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* F. Clicks & CTR */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1.5">
              <MousePointer className="w-4 h-4 text-amber-700" />
              <span>F. Clicks &amp; Click-Through Rate (CTR)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Link Clicks
                </label>
                <input
                  type="number"
                  min="0"
                  value={linkClicks}
                  onChange={(e) => setLinkClicks(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-800">
                    CTR (Link Click-Through Rate %)
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideCtr}
                      onChange={(e) => setOverrideCtr(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    Manual Override
                  </label>
                </div>
                {overrideCtr ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualCtr}
                    onChange={(e) => setManualCtr(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 font-mono"
                  />
                ) : (
                  <div className="px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-mono text-stone-800 font-bold flex items-center justify-between">
                    <span>{calculatedCtr !== null ? calculatedCtr.toFixed(2) : '—'}%</span>
                    <span className="text-[10px] text-stone-400 font-sans">
                      (Auto: Link Clicks / Views × 100)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* G. Business Outcome (Auto-Linked from CRM) */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-950">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span>G. Business Outcome (Auto-Linked CRM Pipeline)</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
                Live Firestore Rollup
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider block">CRM Customers</span>
                <span className="text-base font-bold text-stone-900 font-mono">
                  {formatIndianNumber(derivedOutcome.customersImported)}
                </span>
                <span className="text-[10px] text-stone-400 block">
                  ({formatINR(derivedOutcome.costPerCustomer)}/lead)
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider block">Orders Sourced</span>
                <span className="text-base font-bold text-stone-900 font-mono">
                  {formatIndianNumber(derivedOutcome.orders)}
                </span>
                <span className="text-[10px] text-stone-400 block">
                  ({formatINR(derivedOutcome.costPerOrder)}/order)
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider block">Attributed Revenue</span>
                <span className="text-base font-bold text-emerald-800 font-mono">
                  {formatINR(derivedOutcome.revenue)}
                </span>
                <span className="text-[10px] text-stone-400 block">From orders</span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider block">Calculated ROI</span>
                <span className={`text-base font-bold font-mono ${
                  derivedOutcome.roi >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}>
                  {derivedOutcome.roi >= 0 ? '+' : ''}{derivedOutcome.roi.toFixed(1)}%
                </span>
                <span className="text-[10px] text-stone-400 block">
                  (Revenue - Spend) / Spend
                </span>
              </div>
            </div>
          </div>

          {/* H. Extras */}
          <div className="p-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1.5">
              H. Qualitative Review &amp; Meta Screenshot
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Meta Ads Manager Screenshot URL
                </label>
                <input
                  type="text"
                  placeholder="https://res.cloudinary.com/jaikrishna/image/upload/v1/meta-results-screenshot.png"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  What Worked, What Didn't &amp; Lessons for Next Campaign
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Bhimseni camphor jar creative converted exceptionally well for Salem retailers. Video Reels yielded 40% lower CPL than static feeds..."
                  value={lessons}
                  onChange={(e) => setLessons(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Overall Campaign Performance Rating
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-amber-500 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= rating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-stone-700 ml-2">
                    {rating} / 5 Stars
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="text-xs text-stone-600">
            Total Spend: <span className="font-bold text-stone-900 font-mono">{formatINR(totalSpent)}</span> · Cost/Conv:{' '}
            <span className="font-bold text-stone-900 font-mono">{formatINR(effectiveCostPerConv, true)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="results-form"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Saving...' : 'Verify & Fulfill Ad'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
