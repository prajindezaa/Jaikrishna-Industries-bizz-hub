/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Upload,
  Calendar,
  AlertCircle,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  CheckSquare,
  Square,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  MetaAd,
  MetaAdChecklistItem,
  CreativeAsset,
  FestivalEvent,
} from '../../types';
import { TAMIL_NADU_DISTRICTS } from '../../lib/districts';
import { formatINR, getPreparationStartDate } from '../../lib/meta-ads-utils';

interface MetaAdPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  adToEdit?: MetaAd | null;
  initialFestival?: FestivalEvent | null;
  onOpenFestivalCalendar?: () => void;
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

export const MetaAdPlanningModal: React.FC<MetaAdPlanningModalProps> = ({
  isOpen,
  onClose,
  adToEdit,
  initialFestival,
  onOpenFestivalCalendar,
}) => {
  const { member } = useAuth();
  const { addMetaAd, updateMetaAd, addTask, festivalEvents } = useApp();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [occasion, setOccasion] = useState('');
  const [festivalEventId, setFestivalEventId] = useState('');
  const [goal, setGoal] = useState('Messages/Conversations');
  const [customGoals, setCustomGoals] = useState<string[]>(DEFAULT_GOALS);
  const [newGoalInput, setNewGoalInput] = useState('');

  // Target customers
  const [targetCustomerTypes, setTargetCustomerTypes] = useState<string[]>(['Distributor', 'Wholesaler']);
  const [targetPlaces, setTargetPlaces] = useState<string[]>(['Salem', 'Coimbatore']);
  const [targetNotes, setTargetNotes] = useState('');

  // Planned audience
  const [ageRange, setAgeRange] = useState('25-55');
  const [gender, setGender] = useState<'All' | 'Men' | 'Women'>('All');
  const [interests, setInterests] = useState<string[]>([
    'Hindu Temple',
    'Pooja items',
    'Camphor Wholesale',
    'Deepam Lamp Oil',
  ]);
  const [newInterestInput, setNewInterestInput] = useState('');
  const [locations, setLocations] = useState<string[]>(['Tamil Nadu']);
  const [newLocationInput, setNewLocationInput] = useState('');

  // Creatives
  const [creatives, setCreatives] = useState<CreativeAsset[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState('Send WhatsApp Message');
  const [destination, setDestination] = useState('+919865012345');

  // Placements
  const [placements, setPlacements] = useState<string[]>([
    'Facebook Feed',
    'Instagram Feed',
    'Instagram Reels',
  ]);
  const [allPlacements, setAllPlacements] = useState<string[]>(DEFAULT_PLACEMENTS);
  const [newPlacementInput, setNewPlacementInput] = useState('');

  // Budget & Dates
  const [dailyBudget, setDailyBudget] = useState<number>(1000);
  const [totalBudget, setTotalBudget] = useState<number>(7000);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');

  // Ownership & Checklist
  const [assignedTo, setAssignedTo] = useState(member?.email || 'prajindezaa142@gmail.com');
  const [checklist, setChecklist] = useState<MetaAdChecklistItem[]>([
    { id: 'c1', label: 'Creative images formatted & uploaded (1080x1080 / 1080x1920)', completed: false },
    { id: 'c2', label: 'Primary ad copy & headline reviewed in Tamil & English', completed: false },
    { id: 'c3', label: 'WhatsApp destination link active & verified', completed: false },
    { id: 'c4', label: 'Target customer types & districts configured', completed: false },
    { id: 'c5', label: 'Meta Ads Manager prepaid balance verified', completed: false },
  ]);
  const [notes, setNotes] = useState('');

  // Helpers & Warnings
  const [error, setError] = useState<string | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);
  const [createdTaskNotice, setCreatedTaskNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (adToEdit) {
      setName(adToEdit.name || '');
      setDescription(adToEdit.description || '');
      setOccasion(adToEdit.occasion || '');
      setFestivalEventId(adToEdit.festivalEventId || '');
      setGoal(adToEdit.goal || 'Messages/Conversations');
      setTargetCustomerTypes(adToEdit.targetCustomers?.types || ['Distributor']);
      setTargetPlaces(adToEdit.targetCustomers?.places || ['Salem']);
      setTargetNotes(adToEdit.targetCustomers?.notes || '');
      setAgeRange(adToEdit.plannedAudience?.ageRange || '25-55');
      setGender(adToEdit.plannedAudience?.gender || 'All');
      setInterests(adToEdit.plannedAudience?.interests || []);
      setLocations(adToEdit.plannedAudience?.locations || ['Tamil Nadu']);
      setCreatives(adToEdit.creatives || []);
      setPrimaryText(adToEdit.primaryText || '');
      setHeadline(adToEdit.headline || '');
      setCta(adToEdit.cta || 'Send WhatsApp Message');
      setDestination(adToEdit.destination || '+919865012345');
      setPlacements(adToEdit.placements || DEFAULT_PLACEMENTS.slice(0, 3));
      setDailyBudget(adToEdit.dailyBudget || 1000);
      setTotalBudget(adToEdit.totalBudget || 7000);
      setDurationDays(adToEdit.durationDays || 7);
      setPlannedStart(adToEdit.plannedStart ? adToEdit.plannedStart.slice(0, 16) : '');
      setPlannedEnd(adToEdit.plannedEnd ? adToEdit.plannedEnd.slice(0, 16) : '');
      setAssignedTo(adToEdit.assignedTo || member?.email || 'prajindezaa142@gmail.com');
      setChecklist(adToEdit.checklist || []);
      setNotes(adToEdit.notes || '');
    } else {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const startIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const endIso = new Date(in7Days.getTime() - in7Days.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      setName('');
      setDescription('');
      setOccasion(initialFestival?.name || '');
      setFestivalEventId(initialFestival?.id || '');
      setGoal('Messages/Conversations');
      setDailyBudget(1000);
      setTotalBudget(7000);
      setDurationDays(7);
      setPlannedStart(startIso);
      setPlannedEnd(endIso);
      setAssignedTo(member?.email || 'prajindezaa142@gmail.com');
      setCreatives([]);
      setPrimaryText('');
      setHeadline('');
      setDestination('+919865012345');
      setNotes('');
    }
    setError(null);
    setBudgetWarning(null);
  }, [adToEdit, initialFestival, isOpen, member]);

  // Sync dates with duration
  const handleStartDateChange = (val: string) => {
    setPlannedStart(val);
    if (val && plannedEnd) {
      const start = new Date(val).getTime();
      const end = new Date(plannedEnd).getTime();
      if (end > start) {
        const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        setDurationDays(days);
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setPlannedEnd(val);
    if (plannedStart && val) {
      const start = new Date(plannedStart).getTime();
      const end = new Date(val).getTime();
      if (end > start) {
        const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        setDurationDays(days);
      }
    }
  };

  const handleDurationChange = (days: number) => {
    const d = Math.max(1, days);
    setDurationDays(d);
    if (plannedStart) {
      const start = new Date(plannedStart);
      const end = new Date(start.getTime() + d * 24 * 60 * 60 * 1000);
      setPlannedEnd(new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
    if (dailyBudget > 0 && totalBudget <= dailyBudget) {
      setTotalBudget(dailyBudget * d);
    }
  };

  // Warn if daily x duration != total budget
  useEffect(() => {
    if (dailyBudget > 0 && durationDays > 0 && totalBudget > 0) {
      const expectedTotal = dailyBudget * durationDays;
      if (expectedTotal > totalBudget) {
        setBudgetWarning(`Daily Budget (₹${dailyBudget}) × ${durationDays} days = ₹${expectedTotal}, which exceeds Total Budget (₹${totalBudget}).`);
      } else {
        setBudgetWarning(null);
      }
    }
  }, [dailyBudget, durationDays, totalBudget]);

  if (!isOpen) return null;

  // Selected festival preparation helper
  const selectedFestival = festivalEvents.find(f => f.id === festivalEventId || f.name === occasion);
  const prepHelper = selectedFestival ? getPreparationStartDate(selectedFestival.date, 14) : null;

  // Creative handlers
  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setCreatives(prev => [
      ...prev,
      {
        url: imageUrlInput.trim(),
        name: `Creative ${prev.length + 1}`,
      },
    ]);
    setImageUrlInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCreatives(prev => [
            ...prev,
            {
              url: reader.result as string,
              name: file.name,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeCreative = (idx: number) => {
    setCreatives(prev => prev.filter((_, i) => i !== idx));
  };

  const moveCreative = (idx: number, dir: -1 | 1) => {
    setCreatives(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  // Checklist handlers
  const toggleChecklist = (id: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  // Linked task creation
  const handleCreateTaskFromAd = async () => {
    try {
      const todayStr = plannedStart ? plannedStart.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const taskId = await addTask({
        title: `Prepare Creatives & Budget for Meta Ad: ${name || 'New Ad'}`,
        description: `Verify WhatsApp links, target districts (${targetPlaces.join(', ')}), and prepaid budget (₹${totalBudget}) for upcoming ad campaign.`,
        type: 'Meta ads',
        assignedTo,
        priority: 'High',
        date: todayStr,
        startTime: '10:00',
        endTime: '11:00',
        repeat: 'None',
        status: 'Pending',
      });
      setCreatedTaskNotice(`Task created in Task Hub (ID: ${taskId.slice(0, 8)})`);
      setTimeout(() => setCreatedTaskNotice(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create task');
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Ad Name is required');
      return;
    }
    if (dailyBudget < 0 || totalBudget < 0) {
      setError('Budgets cannot be negative numbers');
      return;
    }
    if (plannedStart && plannedEnd && new Date(plannedEnd) <= new Date(plannedStart)) {
      setError('Planned End Date & Time must be later than Start Date & Time');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Omit<MetaAd, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'stageHistory'> = {
        name: name.trim(),
        description: description.trim(),
        occasion: occasion.trim(),
        festivalEventId: festivalEventId || undefined,
        goal,
        stage: adToEdit ? adToEdit.stage : 'Pending',
        targetCustomers: {
          types: targetCustomerTypes,
          places: targetPlaces,
          notes: targetNotes.trim(),
        },
        plannedAudience: {
          ageRange,
          gender,
          interests,
          locations,
        },
        creatives,
        primaryText: primaryText.trim(),
        headline: headline.trim(),
        cta,
        destination: destination.trim(),
        placements,
        dailyBudget: Number(dailyBudget) || 0,
        totalBudget: Number(totalBudget) || 0,
        plannedStart,
        plannedEnd,
        durationDays: Number(durationDays) || 1,
        createdBy: adToEdit?.createdBy || member?.email || 'admin',
        assignedTo,
        checklist,
        notes: notes.trim(),
        results: adToEdit?.results,
      };

      if (adToEdit) {
        await updateMetaAd(adToEdit.id, payload);
      } else {
        await addMetaAd(payload);
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save ad plan');
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
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                {adToEdit ? `Edit Ad: ${adToEdit.stage}` : 'New Meta Ad (Pending)'}
              </span>
              {adToEdit && (
                <span className="text-xs text-stone-500">
                  ID: {adToEdit.id.slice(0, 8)}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-stone-900 font-display mt-0.5">
              {adToEdit ? 'Edit Campaign Plan' : 'Plan New Meta Ad Campaign'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Suggest-Ahead Festival Helper */}
        {prepHelper && (
          <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl flex items-start justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Festival Campaign Helper:</span> For{' '}
                <span className="font-semibold underline">{selectedFestival?.name}</span> ({selectedFestival?.date}),
                we recommend preparing creatives 14 days in advance starting on{' '}
                <span className="font-mono font-bold text-amber-800">{prepHelper.formattedPrepDate}</span>.
                {prepHelper.isDue && (
                  <span className="ml-1 text-rose-700 font-semibold">(Preparation window is active now!)</span>
                )}
              </div>
            </div>
            {onOpenFestivalCalendar && (
              <button
                type="button"
                onClick={onOpenFestivalCalendar}
                className="text-[11px] font-medium text-amber-700 hover:text-amber-900 underline shrink-0"
              >
                View Calendar
              </button>
            )}
          </div>
        )}

        {/* Form Error or Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {budgetWarning && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{budgetWarning}</span>
          </div>
        )}
        {createdTaskNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{createdTaskNotice}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form id="planning-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* 1. Basic Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
              1. Campaign Identity &amp; Objectives
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Ad Campaign Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Bulk Camphor & Deepam Oil Mega Wholesale Blast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Occasion / Pooja Festival (Optional)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={festivalEventId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFestivalEventId(id);
                      const match = festivalEvents.find(f => f.id === id);
                      if (match) setOccasion(match.name);
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">-- Link to Festival Calendar --</option>
                    {festivalEvents.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.date})
                      </option>
                    ))}
                  </select>
                  {onOpenFestivalCalendar && (
                    <button
                      type="button"
                      onClick={onOpenFestivalCalendar}
                      className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600"
                      title="Manage Festivals"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Campaign Goal / Objective *
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {customGoals.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Campaign Description &amp; Offer
                </label>
                <textarea
                  rows={2}
                  placeholder="Direct factory dispatch of Bhimseni camphor jars, 1L deepam lamp oil cans, and agarbatti sample kits at direct wholesale prices..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Target Customers & Geographic Focus */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
              2. Target Customers &amp; Districts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                  Target Customer Types
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOMER_TYPES.map(type => {
                    const isSelected = targetCustomerTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setTargetCustomerTypes(prev =>
                            isSelected ? prev.filter(t => t !== type) : [...prev, type]
                          );
                        }}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-amber-600 border-amber-600 text-white font-semibold'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                  Target Districts (Tamil Nadu 38 Districts)
                </label>
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 border border-stone-200 rounded-lg bg-stone-50/50">
                  {TAMIL_NADU_DISTRICTS.map(dist => {
                    const isSelected = targetPlaces.includes(dist);
                    return (
                      <button
                        key={dist}
                        type="button"
                        onClick={() => {
                          setTargetPlaces(prev =>
                            isSelected ? prev.filter(p => p !== dist) : [...prev, dist]
                          );
                        }}
                        className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                          isSelected
                            ? 'bg-amber-700 text-white font-medium'
                            : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        {dist}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-stone-500 block mt-1">
                  Selected: {targetPlaces.length} districts
                </span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Targeting Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Focus on wholesale pooja shop clusters around major temple zones"
                  value={targetNotes}
                  onChange={(e) => setTargetNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Planned Audience Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
              3. Meta Audience Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Age Range
                </label>
                <input
                  type="text"
                  placeholder="e.g. 25-55"
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="All">All Genders</option>
                  <option value="Men">Men Only</option>
                  <option value="Women">Women Only</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Audience Locations
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Add location"
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newLocationInput.trim()) {
                          setLocations(prev => [...prev, newLocationInput.trim()]);
                          setNewLocationInput('');
                        }
                      }
                    }}
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-stone-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newLocationInput.trim()) {
                        setLocations(prev => [...prev, newLocationInput.trim()]);
                        setNewLocationInput('');
                      }
                    }}
                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded text-xs"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {locations.map((loc, i) => (
                    <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-700 text-[10px] rounded-md flex items-center gap-1">
                      {loc}
                      <button
                        type="button"
                        onClick={() => setLocations(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-stone-400 hover:text-stone-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Interests &amp; Behaviors (Meta Ads Tagging)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Hindu Temple, Retail wholesale, Agarbatti, Pooja store (Press enter)"
                    value={newInterestInput}
                    onChange={(e) => setNewInterestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newInterestInput.trim()) {
                          setInterests(prev => [...prev, newInterestInput.trim()]);
                          setNewInterestInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newInterestInput.trim()) {
                        setInterests(prev => [...prev, newInterestInput.trim()]);
                        setNewInterestInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100"
                  >
                    Add Interest
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {interests.map((interest, i) => (
                    <span key={i} className="px-2.5 py-1 bg-amber-50 border border-amber-200/80 text-amber-900 text-xs rounded-lg flex items-center gap-1.5">
                      {interest}
                      <button
                        type="button"
                        onClick={() => setInterests(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-amber-500 hover:text-amber-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Creatives, Copy & WhatsApp Destination */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
              4. Creatives, Copy &amp; Placements
            </h3>

            {/* Creative images */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Creative Assets (Multiple Images / Cloudinary Uploads) *
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Paste direct Cloudinary / Image URL"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-3 py-1.5 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-xs font-medium"
                >
                  Add URL
                </button>
                <label className="cursor-pointer px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 flex items-center justify-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Creatives preview list */}
              {creatives.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {creatives.map((c, idx) => (
                    <div key={idx} className="relative group border border-stone-200 rounded-xl overflow-hidden bg-stone-100">
                      <img
                        src={c.url}
                        alt={c.name || `Creative ${idx + 1}`}
                        className="w-full h-28 object-cover"
                      />
                      <div className="p-1.5 bg-white text-[11px] truncate text-stone-700 font-medium">
                        {idx + 1}. {c.name || 'Creative'}
                      </div>
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveCreative(idx, -1)}
                            className="p-1 bg-white/90 hover:bg-white rounded text-stone-700 shadow-xs"
                            title="Move left"
                          >
                            <MoveUp className="w-3 h-3 rotate-[-90deg]" />
                          </button>
                        )}
                        {idx < creatives.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveCreative(idx, 1)}
                            className="p-1 bg-white/90 hover:bg-white rounded text-stone-700 shadow-xs"
                            title="Move right"
                          >
                            <MoveDown className="w-3 h-3 rotate-[-90deg]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCreative(idx)}
                          className="p-1 bg-rose-600 hover:bg-rose-700 rounded text-white shadow-xs"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ad text & headline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Primary Ad Text (Copy)
                </label>
                <textarea
                  rows={3}
                  placeholder="Vanakkam! Jaikrishna Industries manufactures pure Bhimseni Camphor jars, Deepam Lamp Oil, and Premium Agarbatti. Direct factory wholesale pricing with sample kits dispatched across Tamil Nadu. Message us today!"
                  value={primaryText}
                  onChange={(e) => setPrimaryText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Headline
                </label>
                <input
                  type="text"
                  placeholder="Direct Factory Pooja Wholesale Catalog"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Call-to-Action (CTA)
                </label>
                <select
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="Send WhatsApp Message">Send WhatsApp Message</option>
                  <option value="Order Wholesale Now">Order Wholesale Now</option>
                  <option value="Get Sample Kit">Get Sample Kit</option>
                  <option value="Learn More">Learn More</option>
                  <option value="Contact Us">Contact Us</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  WhatsApp / Messenger Destination Link or Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+919865012345 or https://wa.me/919865012345?text=Vanakkam"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Placements Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-stone-800">
                  Placements *
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Custom placement"
                    value={newPlacementInput}
                    onChange={(e) => setNewPlacementInput(e.target.value)}
                    className="px-2 py-0.5 text-[11px] rounded border border-stone-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPlacementInput.trim() && !allPlacements.includes(newPlacementInput.trim())) {
                        setAllPlacements(prev => [...prev, newPlacementInput.trim()]);
                        setPlacements(prev => [...prev, newPlacementInput.trim()]);
                        setNewPlacementInput('');
                      }
                    }}
                    className="px-2 py-0.5 text-[10px] bg-stone-100 rounded hover:bg-stone-200"
                  >
                    + Add
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allPlacements.map(plc => {
                  const isChecked = placements.includes(plc);
                  return (
                    <button
                      key={plc}
                      type="button"
                      onClick={() => {
                        setPlacements(prev =>
                          isChecked ? prev.filter(p => p !== plc) : [...prev, plc]
                        );
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                        isChecked
                          ? 'bg-amber-600 border-amber-600 text-white font-medium shadow-2xs'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {plc}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Budget, Duration & Scheduling */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1.5">
              5. Budget &amp; Scheduling
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Daily Budget (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-stone-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={dailyBudget || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDailyBudget(val);
                      if (durationDays > 0) {
                        setTotalBudget(val * durationDays);
                      }
                    }}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Total Budget (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-stone-400 text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={totalBudget || ''}
                    onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={durationDays}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Start Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  value={plannedStart}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  End Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  value={plannedEnd}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Assigned Team Member
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="prajindezaa142@gmail.com">prajindezaa142@gmail.com (Admin)</option>
                  <option value="jaikrishnaindustries1@gmail.com">jaikrishnaindustries1@gmail.com (Sales Manager)</option>
                  <option value="srinisrkp@gmail.com">srinisrkp@gmail.com (Owner)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6. Launch Readiness Checklist & Linked Task */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                6. Launch Readiness Checklist
              </h3>
              <button
                type="button"
                onClick={handleCreateTaskFromAd}
                className="px-2.5 py-1 text-[11px] font-semibold bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Task from this Ad
              </button>
            </div>

            <div className="space-y-1.5">
              {checklist.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleChecklist(item.id)}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-stone-50 cursor-pointer border border-stone-200/60"
                >
                  {item.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-400" />
                  )}
                  <span className={`text-xs ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Strategic Execution Notes
              </label>
              <textarea
                rows={2}
                placeholder="Internal notes for review by the 3 partners..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="text-xs text-stone-500">
            Total Estimated Budget: <span className="font-bold text-stone-900 font-mono">{formatINR(totalBudget)}</span>
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
              form="planning-form"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Saving...' : adToEdit ? 'Save Changes' : 'Create Pending Ad'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
