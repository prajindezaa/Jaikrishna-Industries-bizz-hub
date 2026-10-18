/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Users,
  Eye,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Star,
  Upload,
  Info,
  HelpCircle,
  FileText,
  MousePointer,
  Check,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  MetaAd,
  Customer,
  CreativeAsset,
  FestivalEvent,
  MetaAdResults,
} from '../../types';
import { TAMIL_NADU_DISTRICTS } from '../../lib/districts';
import {
  formatINR,
  formatIndianNumber,
  calculateCostPerConversation,
  calculateFrequency,
  calculateCtr,
  validatePercentages,
  validatePastAd,
} from '../../lib/meta-ads-utils';

interface PastAdWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraftAd?: MetaAd | null;
  onSuccess?: (adId: string) => void;
}

const DEFAULT_GOALS = [
  'Messages/Conversations',
  'Leads',
  'Traffic',
  'Awareness',
];

const DEFAULT_PLACEMENTS = [
  'Facebook Feed',
  'Facebook Stories',
  'Facebook Reels',
  'Instagram Feed',
  'Instagram Stories',
  'Instagram Reels',
  'Messenger',
  'Audience Network',
];

const CUSTOMER_TYPES = [
  'Distributor',
  'Wholesaler',
  'Retailer',
  'Temple/Institution',
  'Other',
];

export const PastAdWizardModal: React.FC<PastAdWizardModalProps> = ({
  isOpen,
  onClose,
  initialDraftAd,
  onSuccess,
}) => {
  const { member } = useAuth();
  const teamMembers = [
    { email: 'prajindezaa142@gmail.com', name: 'Prajin (Admin)' },
    { email: 'partner1@jaikrishnaindustries.com', name: 'Partner 1' },
    { email: 'partner2@jaikrishnaindustries.com', name: 'Partner 2' },
  ];
  const {
    metaAds,
    customers,
    festivalEvents,
    addPastAd,
    updateMetaAd,
  } = useApp();

  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // STEP 1: BASICS
  // ---------------------------------------------------------------------------
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [occasion, setOccasion] = useState('');
  const [festivalEventId, setFestivalEventId] = useState('');
  const [goal, setGoal] = useState('Messages/Conversations');
  const [createdBy, setCreatedBy] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [placements, setPlacements] = useState<string[]>(['Facebook Feed', 'Instagram Feed']);

  // ---------------------------------------------------------------------------
  // STEP 2: DATES AND BUDGET
  // ---------------------------------------------------------------------------
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [dailyBudget, setDailyBudget] = useState<string>('');
  const [totalSpent, setTotalSpent] = useState<string>('');

  // ---------------------------------------------------------------------------
  // STEP 3: TARGET & AUDIENCE
  // ---------------------------------------------------------------------------
  const [targetCustomerTypes, setTargetCustomerTypes] = useState<string[]>(['Distributor', 'Wholesaler']);
  const [targetPlaces, setTargetPlaces] = useState<string[]>(['Salem', 'Coimbatore']);
  const [targetNotes, setTargetNotes] = useState('');
  const [ageRange, setAgeRange] = useState('25-55');
  const [gender, setGender] = useState<'All' | 'Men' | 'Women'>('All');
  const [interests, setInterests] = useState<string[]>(['Pooja Items', 'Camphor Wholesale', 'Temples']);
  const [newInterestInput, setNewInterestInput] = useState('');

  // Audience percentage splits (with null / not recorded support)
  const [includeAgeSplit, setIncludeAgeSplit] = useState(false);
  const [audienceAge, setAudienceAge] = useState<Record<string, number>>({
    '18-24': 10,
    '25-34': 45,
    '35-44': 30,
    '45+': 15,
  });

  const [includeGenderSplit, setIncludeGenderSplit] = useState(false);
  const [audienceGender, setAudienceGender] = useState<Record<string, number>>({
    Men: 65,
    Women: 35,
  });

  const [includePlacesSplit, setIncludePlacesSplit] = useState(false);
  const [audiencePlaces, setAudiencePlaces] = useState<Record<string, number>>({
    'Salem & Erode': 50,
    Coimbatore: 30,
    Madurai: 20,
  });
  const [newPlaceKey, setNewPlaceKey] = useState('');
  const [newPlaceVal, setNewPlaceVal] = useState('');

  // ---------------------------------------------------------------------------
  // STEP 4: RESULTS ("Not recorded" vs real 0)
  // ---------------------------------------------------------------------------
  // Messaging
  const [recordedConvs, setRecordedConvs] = useState(true);
  const [conversations, setConversations] = useState<string>('0');
  const [manualCostPerConv, setManualCostPerConv] = useState<string>('');
  const [overrideCostPerConv, setOverrideCostPerConv] = useState(false);

  // Reach
  const [recordedViews, setRecordedViews] = useState(true);
  const [views, setViews] = useState<string>('0');
  const [recordedViewers, setRecordedViewers] = useState(true);
  const [viewers, setViewers] = useState<string>('0');

  // Post Engagement
  const [recordedEngagements, setRecordedEngagements] = useState(false);
  const [engagements, setEngagements] = useState<string>('0');
  const [reactions, setReactions] = useState<string>('0');
  const [comments, setComments] = useState<string>('0');
  const [shares, setShares] = useState<string>('0');
  const [saves, setSaves] = useState<string>('0');

  // Clicks
  const [recordedClicks, setRecordedClicks] = useState(false);
  const [linkClicks, setLinkClicks] = useState<string>('0');
  const [manualCtr, setManualCtr] = useState<string>('');
  const [overrideCtr, setOverrideCtr] = useState(false);

  // Extras
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [creatives, setCreatives] = useState<CreativeAsset[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [lessons, setLessons] = useState('');
  const [rating, setRating] = useState<number>(5);

  // ---------------------------------------------------------------------------
  // STEP 5: LINK EXISTING CUSTOMERS
  // ---------------------------------------------------------------------------
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerQuickFilter, setCustomerQuickFilter] = useState<'all' | 'unassigned_meta' | 'dates'>('unassigned_meta');

  // Populate state if editing draft
  useEffect(() => {
    if (initialDraftAd) {
      setName(initialDraftAd.name || '');
      setDescription(initialDraftAd.description || '');
      setOccasion(initialDraftAd.occasion || '');
      setFestivalEventId(initialDraftAd.festivalEventId || '');
      setGoal(initialDraftAd.goal || 'Messages/Conversations');
      setCreatedBy(initialDraftAd.createdBy || member?.email || '');
      setAssignedTo(initialDraftAd.assignedTo || member?.email || '');
      setPlacements(initialDraftAd.placements || ['Facebook Feed', 'Instagram Feed']);
      setPlannedStart(initialDraftAd.plannedStart || '');
      setPlannedEnd(initialDraftAd.plannedEnd || '');
      setDailyBudget(initialDraftAd.dailyBudget ? String(initialDraftAd.dailyBudget) : '');
      setTotalSpent(
        initialDraftAd.results?.totalSpent !== null && initialDraftAd.results?.totalSpent !== undefined
          ? String(initialDraftAd.results.totalSpent)
          : initialDraftAd.totalBudget
          ? String(initialDraftAd.totalBudget)
          : ''
      );
      if (initialDraftAd.targetCustomers) {
        setTargetCustomerTypes(initialDraftAd.targetCustomers.types || []);
        setTargetPlaces(initialDraftAd.targetCustomers.places || []);
        setTargetNotes(initialDraftAd.targetCustomers.notes || '');
      }
      if (initialDraftAd.results) {
        const r = initialDraftAd.results;
        if (r.conversations !== null && r.conversations !== undefined) {
          setRecordedConvs(true);
          setConversations(String(r.conversations));
        } else {
          setRecordedConvs(false);
        }
        if (r.views !== null && r.views !== undefined) {
          setRecordedViews(true);
          setViews(String(r.views));
        } else {
          setRecordedViews(false);
        }
        if (r.viewers !== null && r.viewers !== undefined) {
          setRecordedViewers(true);
          setViewers(String(r.viewers));
        } else {
          setRecordedViewers(false);
        }
        if (r.linkClicks !== null && r.linkClicks !== undefined) {
          setRecordedClicks(true);
          setLinkClicks(String(r.linkClicks));
        }
        if (r.engagements !== null && r.engagements !== undefined) {
          setRecordedEngagements(true);
          setEngagements(String(r.engagements));
          setReactions(String(r.reactions ?? 0));
          setComments(String(r.comments ?? 0));
          setShares(String(r.shares ?? 0));
          setSaves(String(r.saves ?? 0));
        }
        if (r.lessons) setLessons(r.lessons);
        if (r.rating) setRating(r.rating);
        if (r.screenshotUrl) setScreenshotUrl(r.screenshotUrl);
      }
      if (initialDraftAd.creatives) {
        setCreatives(initialDraftAd.creatives);
      }
    } else {
      setCreatedBy(member?.email || 'admin');
      setAssignedTo(member?.email || 'admin');
    }
  }, [initialDraftAd, member]);

  // Duration in days calculated from start & end
  const durationDays = useMemo(() => {
    if (!plannedStart || !plannedEnd) return 0;
    const startMs = new Date(plannedStart).getTime();
    const endMs = new Date(plannedEnd).getTime();
    if (endMs <= startMs) return 0;
    return Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  }, [plannedStart, plannedEnd]);

  // Derived calculations
  const parsedTotalSpent = totalSpent ? Number(totalSpent) : null;
  const parsedConvs = recordedConvs ? Number(conversations) : null;
  const parsedViews = recordedViews ? Number(views) : null;
  const parsedViewers = recordedViewers ? Number(viewers) : null;
  const parsedClicks = recordedClicks ? Number(linkClicks) : null;

  const autoCostPerConv = calculateCostPerConversation(parsedTotalSpent, parsedConvs);
  const finalCostPerConv = overrideCostPerConv && manualCostPerConv ? Number(manualCostPerConv) : autoCostPerConv;

  const autoFrequency = calculateFrequency(parsedViews, parsedViewers);
  const autoCtr = calculateCtr(parsedClicks, parsedViews);
  const finalCtr = overrideCtr && manualCtr ? Number(manualCtr) : autoCtr;

  // Customers candidate pool
  const candidateCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const startMs = plannedStart ? new Date(plannedStart).getTime() : 0;
    const endMs = plannedEnd ? new Date(plannedEnd).getTime() : Infinity;

    return customers.filter((c) => {
      if (c.isDeleted) return false;

      if (customerQuickFilter === 'unassigned_meta') {
        if (c.source !== 'Meta Ads' || c.campaignId) return false;
      } else if (customerQuickFilter === 'dates') {
        const custMs = new Date(c.createdAt).getTime();
        if (custMs < startMs || custMs > endMs) return false;
      }

      if (q) {
        const matchName = c.companyName.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q);
        const matchPhone = c.phone.includes(q);
        const matchCity = c.place?.city.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCity) return false;
      }

      return true;
    });
  }, [customers, plannedStart, plannedEnd, customerSearch, customerQuickFilter]);

  // Selected customers derived revenue & orders
  const selectedCustomersList = useMemo(() => {
    return customers.filter((c) => selectedCustomerIds.has(c.id));
  }, [customers, selectedCustomerIds]);

  const attributedRevenue = useMemo(() => {
    return selectedCustomersList.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  }, [selectedCustomersList]);

  const attributedOrders = useMemo(() => {
    return selectedCustomersList.reduce((sum, c) => sum + (c.totalOrdersCount || 0), 0);
  }, [selectedCustomersList]);

  const estimatedRoi = useMemo(() => {
    if (!parsedTotalSpent || parsedTotalSpent <= 0) return 0;
    return Math.round((((attributedRevenue - parsedTotalSpent) / parsedTotalSpent) * 100) * 10) / 10;
  }, [attributedRevenue, parsedTotalSpent]);

  // Construct current ad payload for validation
  const buildAdPayload = (isDraft: boolean): Partial<MetaAd> => {
    const res: MetaAdResults = {
      conversations: recordedConvs ? Number(conversations) : null,
      costPerConversation: finalCostPerConv,
      manualCostPerConversationOverride: overrideCostPerConv,
      views: recordedViews ? Number(views) : null,
      viewers: recordedViewers ? Number(viewers) : null,
      frequency: autoFrequency,
      audienceAge: includeAgeSplit ? audienceAge : null,
      audienceGender: includeGenderSplit ? audienceGender : null,
      audiencePlaces: includePlacesSplit ? audiencePlaces : null,
      totalSpent: parsedTotalSpent,
      dailyBudget: dailyBudget ? Number(dailyBudget) : null,
      actualDuration: durationDays,
      actualStart: plannedStart || null,
      actualEnd: plannedEnd || null,
      engagements: recordedEngagements ? Number(engagements) : null,
      reactions: recordedEngagements ? Number(reactions) : null,
      comments: recordedEngagements ? Number(comments) : null,
      shares: recordedEngagements ? Number(shares) : null,
      saves: recordedEngagements ? Number(saves) : null,
      linkClicks: recordedClicks ? Number(linkClicks) : null,
      ctr: finalCtr,
      manualCtrOverride: overrideCtr,
      screenshotUrl: screenshotUrl || null,
      lessons: lessons || null,
      rating: rating || null,
    };

    return {
      name,
      description,
      occasion,
      festivalEventId,
      goal,
      stage: 'Fulfilled',
      targetCustomers: {
        types: targetCustomerTypes,
        places: targetPlaces,
        notes: targetNotes,
      },
      plannedAudience: {
        ageRange,
        gender,
        interests,
        locations: targetPlaces,
      },
      creatives,
      primaryText: '',
      headline: '',
      cta: 'Send WhatsApp Message',
      destination: '',
      placements,
      dailyBudget: dailyBudget ? Number(dailyBudget) : 0,
      totalBudget: parsedTotalSpent ?? 0,
      plannedStart,
      plannedEnd,
      durationDays,
      createdBy,
      assignedTo,
      notes: lessons,
      results: res,
      isHistorical: true,
      isDraft,
    };
  };

  const validationResult = useMemo(() => {
    return validatePastAd(buildAdPayload(false), metaAds, false);
  }, [name, plannedStart, plannedEnd, totalSpent, conversations, views, viewers, engagements, linkClicks, metaAds]);

  if (!isOpen) return null;

  // Step transitions
  const handleNext = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (!name.trim()) {
        setErrorMessage('Ad Name is required.');
        return;
      }
    } else if (step === 2) {
      if (!plannedStart) {
        setErrorMessage('Start Date is required.');
        return;
      }
      if (!plannedEnd) {
        setErrorMessage('End Date is required.');
        return;
      }
      const startMs = new Date(plannedStart).getTime();
      const endMs = new Date(plannedEnd).getTime();
      const nowMs = new Date().getTime();
      if (endMs <= startMs) {
        setErrorMessage('End Date must be strictly after Start Date.');
        return;
      }
      if (endMs > nowMs) {
        setErrorMessage('Past ads must have ended on or before today. Future dates cannot be saved as past completed ads.');
        return;
      }
      if (!totalSpent || Number(totalSpent) < 0) {
        setErrorMessage('Total Spent (₹) is required and cannot be negative.');
        return;
      }
    } else if (step === 3) {
      if (includeAgeSplit) {
        const v = validatePercentages(audienceAge, 'Age split');
        if (!v.isValid) {
          setErrorMessage(v.error || 'Age split must total 100%.');
          return;
        }
      }
      if (includeGenderSplit) {
        const v = validatePercentages(audienceGender, 'Gender split');
        if (!v.isValid) {
          setErrorMessage(v.error || 'Gender split must total 100%.');
          return;
        }
      }
      if (includePlacesSplit) {
        const v = validatePercentages(audiencePlaces, 'Top places split');
        if (!v.isValid) {
          setErrorMessage(v.error || 'Top places split must total 100%.');
          return;
        }
      }
    }
    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = buildAdPayload(true);
      const adId = await addPastAd(payload, Array.from(selectedCustomerIds), true);
      onSuccess?.(adId);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCompleted = async () => {
    if (!validationResult.isValid) {
      setErrorMessage(validationResult.errors.join('; '));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = buildAdPayload(false);
      const adId = await addPastAd(payload, Array.from(selectedCustomerIds), false);
      onSuccess?.(adId);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save completed past ad.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
                <span>Add Past (Completed) Meta Ad</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                  Saved Directly as Fulfilled
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                Log completed festival campaigns, link CRM customers, and record verified Meta Ads results.
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

        {/* Step Progress Bar */}
        <div className="px-6 py-3 bg-white border-b border-stone-200 flex items-center justify-between text-xs font-semibold overflow-x-auto">
          {[
            { num: 1, title: 'Basics' },
            { num: 2, title: 'Dates & Budget' },
            { num: 3, title: 'Target & Audience' },
            { num: 4, title: 'Results' },
            { num: 5, title: 'Link Customers' },
            { num: 6, title: 'Review & Save' },
          ].map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-2 cursor-pointer transition-colors px-2 py-1 rounded-lg ${
                  isActive
                    ? 'text-amber-800 bg-amber-50 font-bold'
                    : isDone
                    ? 'text-emerald-700'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                    isActive
                      ? 'bg-amber-600 text-white'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className="whitespace-nowrap">{s.title}</span>
              </div>
            );
          })}
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* ============================================================== */}
          {/* STEP 1: BASICS */}
          {/* ============================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-stone-800 mb-1">
                    Ad Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Deepavali 2025 Camphor Wholesale Special"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-stone-800 mb-1">Description / Campaign Purpose</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what product was promoted and target audience..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">Occasion / Festival (Optional)</label>
                  <select
                    value={festivalEventId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFestivalEventId(id);
                      const f = festivalEvents.find((ev) => ev.id === id);
                      if (f) setOccasion(f.name);
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  >
                    <option value="">Select from festival calendar or type below</option>
                    {festivalEvents.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.date})
                      </option>
                    ))}
                  </select>
                  {!festivalEventId && (
                    <input
                      type="text"
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      placeholder="Or custom festival name, e.g. Diwali 2025"
                      className="mt-1.5 w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">Campaign Goal / Objective</label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  >
                    {DEFAULT_GOALS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">Created By (Team Member)</label>
                  <select
                    value={createdBy}
                    onChange={(e) => setCreatedBy(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium"
                  >
                    {teamMembers.map((m: { email: string; name: string }) => (
                      <option key={m.email} value={m.email}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">Assigned To</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium"
                  >
                    {teamMembers.map((m: { email: string; name: string }) => (
                      <option key={m.email} value={m.email}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-stone-800 mb-1.5">
                    Meta Placements (Multi-select)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_PLACEMENTS.map((pl) => {
                      const isSel = placements.includes(pl);
                      return (
                        <button
                          key={pl}
                          type="button"
                          onClick={() => {
                            if (isSel) setPlacements(placements.filter((p) => p !== pl));
                            else setPlacements([...placements, pl]);
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            isSel
                              ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {pl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-amber-950">Lifecycle Target Status:</span>{' '}
                    <span className="text-amber-900">Fulfilled (Verified Results)</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded-md text-[10px]">
                    Direct Save Enabled
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: DATES & BUDGET */}
          {/* ============================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Start Date &amp; Time <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">Past dates are fully supported.</p>
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    End Date &amp; Time <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={plannedEnd}
                    onChange={(e) => setPlannedEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Must be in the past (on or before current moment).
                  </p>
                </div>

                <div className="md:col-span-2 p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-stone-600">Calculated Campaign Duration:</span>
                  <span className="text-xs font-bold font-mono text-stone-900">
                    {durationDays > 0 ? `${durationDays} day(s)` : 'Select start and end dates'}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Total Spent (₹) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-500 font-mono">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={totalSpent}
                      onChange={(e) => setTotalSpent(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full pl-7 pr-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">Actual amount invoiced by Meta Ads Manager.</p>
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">Daily Budget (₹) (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-500 font-mono">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full pl-7 pr-3 py-2 border border-stone-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">Configured daily spending limit.</p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: TARGET & AUDIENCE */}
          {/* ============================================================== */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-stone-800 mb-1.5">Target Customer Types</label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOMER_TYPES.map((ct) => {
                    const isSel = targetCustomerTypes.includes(ct);
                    return (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => {
                          if (isSel) setTargetCustomerTypes(targetCustomerTypes.filter((t) => t !== ct));
                          else setTargetCustomerTypes([...targetCustomerTypes, ct]);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                          isSel
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {ct}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1.5">
                  Target Locations (Tamil Nadu Districts)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-stone-50 border border-stone-200 rounded-xl">
                  {TAMIL_NADU_DISTRICTS.slice(0, 16).map((dist) => {
                    const isSel = targetPlaces.includes(dist);
                    return (
                      <button
                        key={dist}
                        type="button"
                        onClick={() => {
                          if (isSel) setTargetPlaces(targetPlaces.filter((p) => p !== dist));
                          else setTargetPlaces([...targetPlaces, dist]);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          isSel
                            ? 'bg-amber-600 text-white border-amber-700 font-semibold'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {dist}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audience Splits Switches */}
              <div className="space-y-3 pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800">Audience Demographic Splits (%)</span>
                  <span className="text-[11px] text-stone-500">Optional: Enable if recorded from Meta report</span>
                </div>

                {/* Age Split */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-800">
                      <input
                        type="checkbox"
                        checked={includeAgeSplit}
                        onChange={(e) => setIncludeAgeSplit(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Age Groups Split</span>
                    </label>
                    {includeAgeSplit && (
                      <span
                        className={`font-mono text-xs font-bold ${
                          validatePercentages(audienceAge, 'Age').isValid ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        Total: {validatePercentages(audienceAge, 'Age').sum}%
                      </span>
                    )}
                  </div>

                  {includeAgeSplit && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {Object.entries(audienceAge).map(([group, val]) => (
                        <div key={group}>
                          <span className="text-[10px] text-stone-500">{group}</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={val}
                            onChange={(e) => {
                              setAudienceAge({ ...audienceAge, [group]: Number(e.target.value) });
                            }}
                            className="w-full px-2 py-1 text-xs border border-stone-300 rounded font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Gender Split */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-800">
                      <input
                        type="checkbox"
                        checked={includeGenderSplit}
                        onChange={(e) => setIncludeGenderSplit(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Gender Split</span>
                    </label>
                    {includeGenderSplit && (
                      <span
                        className={`font-mono text-xs font-bold ${
                          validatePercentages(audienceGender, 'Gender').isValid
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        Total: {validatePercentages(audienceGender, 'Gender').sum}%
                      </span>
                    )}
                  </div>

                  {includeGenderSplit && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {Object.entries(audienceGender).map(([g, val]) => (
                        <div key={g}>
                          <span className="text-[10px] text-stone-500">{g}</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={val}
                            onChange={(e) => {
                              setAudienceGender({ ...audienceGender, [g]: Number(e.target.value) });
                            }}
                            className="w-full px-2 py-1 text-xs border border-stone-300 rounded font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: RESULTS */}
          {/* ============================================================== */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-600 text-xs">
                Every field has a clear <strong>&quot;Not recorded&quot;</strong> state stored as null and displayed as &quot;—&quot;. Real zeros are stored as 0. Reports and ranking will accurately ignore unrecorded fields.
              </div>

              {/* A. Messaging */}
              <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-stone-900">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>A. Messaging</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-stone-600">
                    <input
                      type="checkbox"
                      checked={recordedConvs}
                      onChange={(e) => setRecordedConvs(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Recorded in Meta</span>
                  </label>
                </div>

                {recordedConvs ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Messaging Conversations Started
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={conversations}
                        onChange={(e) => setConversations(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-stone-700">Cost Per Conversation</label>
                        <button
                          type="button"
                          onClick={() => setOverrideCostPerConv(!overrideCostPerConv)}
                          className="text-[10px] text-amber-800 hover:underline"
                        >
                          {overrideCostPerConv ? 'Reset to Auto' : 'Manual Override'}
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!overrideCostPerConv}
                        value={overrideCostPerConv ? manualCostPerConv : autoCostPerConv ?? ''}
                        onChange={(e) => setManualCostPerConv(e.target.value)}
                        placeholder="Auto calculated"
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-mono disabled:bg-stone-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-stone-400 italic text-xs">Marked as &quot;Not recorded&quot; (—)</div>
                )}
              </div>

              {/* B. Reach */}
              <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-stone-900">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>B. Reach (Impressions &amp; Unique Viewers)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-stone-700">Views (Impressions)</span>
                      <label className="text-[10px] text-stone-500 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={recordedViews}
                          onChange={(e) => setRecordedViews(e.target.checked)}
                          className="rounded text-amber-600 w-3 h-3"
                        />
                        <span>Tracked</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      disabled={!recordedViews}
                      value={recordedViews ? views : ''}
                      onChange={(e) => setViews(e.target.value)}
                      placeholder="—"
                      className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-mono disabled:bg-stone-100"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-stone-700">Viewers (Reach)</span>
                      <label className="text-[10px] text-stone-500 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={recordedViewers}
                          onChange={(e) => setRecordedViewers(e.target.checked)}
                          className="rounded text-amber-600 w-3 h-3"
                        />
                        <span>Tracked</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      disabled={!recordedViewers}
                      value={recordedViewers ? viewers : ''}
                      onChange={(e) => setViewers(e.target.value)}
                      placeholder="—"
                      className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-mono disabled:bg-stone-100"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-stone-700 mb-1">Frequency (Auto)</span>
                    <div className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono text-stone-800">
                      {autoFrequency ? autoFrequency : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* E. Post Engagement & F. Clicks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">Post Engagements</span>
                    <label className="text-[10px] text-stone-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recordedEngagements}
                        onChange={(e) => setRecordedEngagements(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Tracked</span>
                    </label>
                  </div>
                  {recordedEngagements ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-stone-500">Total Engagements</span>
                        <input
                          type="number"
                          value={engagements}
                          onChange={(e) => setEngagements(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-stone-300 rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500">Reactions</span>
                        <input
                          type="number"
                          value={reactions}
                          onChange={(e) => setReactions(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-stone-300 rounded font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-stone-400 text-[11px] italic">Not recorded</div>
                  )}
                </div>

                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">Link Clicks &amp; CTR</span>
                    <label className="text-[10px] text-stone-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recordedClicks}
                        onChange={(e) => setRecordedClicks(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>Tracked</span>
                    </label>
                  </div>
                  {recordedClicks ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-stone-500">Clicks</span>
                        <input
                          type="number"
                          value={linkClicks}
                          onChange={(e) => setLinkClicks(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-stone-300 rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500">CTR % (Auto)</span>
                        <div className="px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs font-mono text-stone-800">
                          {finalCtr !== null ? `${finalCtr}%` : '—'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-stone-400 text-[11px] italic">Not recorded</div>
                  )}
                </div>
              </div>

              {/* Lessons & Rating */}
              <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-2.5">
                <span className="font-bold text-stone-900">Lessons Learned &amp; Performance Rating</span>
                <textarea
                  rows={2}
                  value={lessons}
                  onChange={(e) => setLessons(e.target.value)}
                  placeholder="What worked, which customer segment responded best, creative feedback..."
                  className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg"
                />

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-stone-600">Rating:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-1 rounded ${rating >= star ? 'text-amber-500' : 'text-stone-300'}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                  <span className="text-stone-500 text-[11px] font-mono">({rating} of 5 stars)</span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: LINK EXISTING CUSTOMERS */}
          {/* ============================================================== */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-950">Attributed Customers:</span>{' '}
                  <span className="font-mono text-amber-900">{selectedCustomerIds.size} customer(s) selected</span>
                </div>
                <div className="text-right text-[11px] font-mono text-amber-900">
                  Revenue: <strong>{formatINR(attributedRevenue)}</strong> · Orders: <strong>{attributedOrders}</strong>
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Filter customers by shop name, phone, city..."
                  className="px-3 py-1.5 border border-stone-300 rounded-xl text-xs flex-1"
                />

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomerQuickFilter('unassigned_meta')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      customerQuickFilter === 'unassigned_meta'
                        ? 'bg-stone-900 text-white font-semibold'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Source: Meta (No Ad)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerQuickFilter('dates')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      customerQuickFilter === 'dates'
                        ? 'bg-stone-900 text-white font-semibold'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    During Ad Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerQuickFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      customerQuickFilter === 'all'
                        ? 'bg-stone-900 text-white font-semibold'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Multi-Select Helper */}
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span>Showing {candidateCustomers.length} candidate customer(s)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedCustomerIds);
                      candidateCustomers.forEach((c) => next.add(c.id));
                      setSelectedCustomerIds(next);
                    }}
                    className="text-amber-800 font-semibold hover:underline"
                  >
                    Select all matching ({candidateCustomers.length})
                  </button>
                  {selectedCustomerIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerIds(new Set())}
                      className="hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Customer List */}
              <div className="max-h-60 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100">
                {candidateCustomers.length === 0 ? (
                  <div className="p-6 text-center text-stone-400">No matching customers found.</div>
                ) : (
                  candidateCustomers.map((cust) => {
                    const isSelected = selectedCustomerIds.has(cust.id);
                    const otherAd = cust.campaignId ? metaAds.find((a) => a.id === cust.campaignId) : null;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => {
                          const next = new Set(selectedCustomerIds);
                          if (next.has(cust.id)) next.delete(cust.id);
                          else next.add(cust.id);
                          setSelectedCustomerIds(next);
                        }}
                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-amber-600"
                          />
                          <div>
                            <div className="font-bold text-stone-900 flex items-center gap-2">
                              <span>{cust.companyName}</span>
                              <span className="font-normal text-stone-500">({cust.contactPerson})</span>
                              {otherAd && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Currently in: {otherAd.name}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 font-mono">
                              {cust.place?.city} · {cust.phone} · Source: {cust.source}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-xs font-mono font-bold text-stone-900">
                          {formatINR(cust.totalRevenue)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 6: REVIEW & SAVE */}
          {/* ============================================================== */}
          {step === 6 && (
            <div className="space-y-4">
              {/* Duplicate Warning */}
              {validationResult.isDuplicate && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Duplicate Warning:</strong> Another ad with this name and overlapping dates was detected in your history. You can still save if this represents a distinct repeat campaign.
                  </span>
                </div>
              )}

              {/* Validation Errors */}
              {!validationResult.isValid && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-800">
                  <div className="font-bold">Required fields missing:</div>
                  <ul className="list-disc list-inside">
                    {validationResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary Card */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <div>
                    <h3 className="font-bold text-sm text-stone-900 font-display">{name || 'Untitled Past Ad'}</h3>
                    <p className="text-xs text-stone-500">
                      Goal: {goal} · Occasion: {occasion || 'Regular'} · Created by: {createdBy}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-bold rounded-lg text-xs">
                    Stage: Fulfilled
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 block">Total Spent</span>
                    <span className="font-bold font-mono text-stone-900">{formatINR(parsedTotalSpent)}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Duration</span>
                    <span className="font-bold font-mono text-stone-900">{durationDays} days</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Messaging Conversations</span>
                    <span className="font-bold font-mono text-stone-900">
                      {recordedConvs ? formatIndianNumber(parsedConvs) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Cost / Conversation</span>
                    <span className="font-bold font-mono text-stone-900">
                      {finalCostPerConv ? formatINR(finalCostPerConv, true) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Views (Impressions)</span>
                    <span className="font-bold font-mono text-stone-900">
                      {recordedViews ? formatIndianNumber(parsedViews) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Reach (Viewers)</span>
                    <span className="font-bold font-mono text-stone-900">
                      {recordedViewers ? formatIndianNumber(parsedViewers) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Link Clicks</span>
                    <span className="font-bold font-mono text-stone-900">
                      {recordedClicks ? formatIndianNumber(parsedClicks) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Calculated CTR</span>
                    <span className="font-bold font-mono text-stone-900">
                      {finalCtr !== null ? `${finalCtr}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Derived Business Outcome */}
                <div className="pt-3 border-t border-stone-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 block">Linked Customers</span>
                    <span className="font-bold font-mono text-stone-900">{selectedCustomerIds.size}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Attributed Revenue</span>
                    <span className="font-bold font-mono text-stone-900">{formatINR(attributedRevenue)}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Derived ROI</span>
                    <span className={`font-bold font-mono ${estimatedRoi >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {estimatedRoi > 0 ? `+${estimatedRoi}%` : `${estimatedRoi}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-3.5 py-2 font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting || !name.trim()}
              className="px-3.5 py-2 font-semibold text-stone-700 bg-white hover:bg-amber-50 border border-stone-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-stone-500" />
              <span>Save as Draft</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors"
            >
              Cancel
            </button>

            {step < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveCompleted}
                disabled={isSubmitting || !validationResult.isValid}
                className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save as Completed Ad</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
