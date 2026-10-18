/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Automation Rules View (Settings / Automation Hub)
 * Hard-coded, deterministic rules with preview, daily caps, and untouched rollback.
 */

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Sliders,
  Send,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { AutomationRuleDoc, AutomationRunDoc, Customer } from '../types';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

export const AutomationRulesView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { customers, tasks } = useApp();

  const [rules, setRules] = useState<Record<string, AutomationRuleDoc>>({});
  const [runs, setRuns] = useState<AutomationRunDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewRuleId, setPreviewRuleId] = useState<string | null>(null);
  const [sampleCustomerIdx, setSampleCustomerIdx] = useState(0);
  const [sampleStage, setSampleStage] = useState('Sample sent');
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [sendingSamplePlan, setSendingSamplePlan] = useState(false);
  const [undoingRunId, setUndoingRunId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Default Rule Definitions
  const defaultRule1: AutomationRuleDoc = {
    id: 'rule_1_auto_followup',
    name: 'Rule 1: Auto Follow-up Tasks on Stage Change',
    description: 'Generates structured follow-up tasks when a lead moves stage (e.g. Sample sent -> Call in 3 calendar days).',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 30,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      skipOnImport: true,
      stages: {
        'Sample sent': { enabled: true, titleTemplate: 'Call {customer} to ask about sample', taskType: 'Call', daysAfter: 3, startTime: '10:00', endTime: '10:30', priority: 'High' },
        'Interested': { enabled: true, titleTemplate: 'Send price and offer to {customer}', taskType: 'WhatsApp', daysAfter: 1, startTime: '10:00', endTime: '10:30', priority: 'Medium' },
        'Negotiation': { enabled: true, titleTemplate: 'Follow up on negotiation with {customer}', taskType: 'Call', daysAfter: 2, startTime: '10:00', endTime: '10:30', priority: 'High' },
        'Contacted': { enabled: true, titleTemplate: 'Follow-up call to {customer}', taskType: 'Call', daysAfter: 3, startTime: '10:00', endTime: '10:30', priority: 'Medium' },
      },
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  const defaultRule2: AutomationRuleDoc = {
    id: 'rule_2_idle_lead_reengagement',
    name: 'Rule 2: Idle Lead Re-Engagement',
    description: 'Schedules a follow-up call task when an active lead has no updates for 7 days.',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 20,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      idleDaysThreshold: 7,
      targetStages: ['Interested', 'Contacted', 'Sample sent'],
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  const defaultRule3: AutomationRuleDoc = {
    id: 'rule_3_auto_stage_cold',
    name: 'Rule 3: Cold Lead Auto-Stage',
    description: 'Automatically transitions active leads with no contact for 30+ days to Cold stage and tags them "Cold Lead".',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 25,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      coldDaysThreshold: 30,
      targetStages: ['Interested', 'Contacted', 'Sample sent'],
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  const defaultRule4: AutomationRuleDoc = {
    id: 'rule_4_cold_revival',
    name: 'Rule 4: Inactive Customer Revival',
    description: 'Schedules revival check-in calls for past customers who have had no orders or interactions for 60+ days.',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 15,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      inactiveDaysThreshold: 60,
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  const defaultRule5: AutomationRuleDoc = {
    id: 'rule_5_reorder_reminders',
    name: 'Rule 5: Order Reorder Reminders',
    description: 'Proactively creates replenishment call tasks 45 days after a fulfilled wholesale agarbatti order.',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 20,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      reorderCycleDays: 45,
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  const defaultRule6: AutomationRuleDoc = {
    id: 'rule_6_festival_campaign_prep',
    name: 'Rule 6: Festival Campaign Prep',
    description: 'Alerts factory and sales team 14 days before pooja/festival events to prepare stock and promotional campaigns.',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 10,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      lookaheadDays: 14,
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  const defaultRule7: AutomationRuleDoc = {
    id: 'rule_7_morning_plan',
    name: 'Rule 7: Daily Morning Operations Plan',
    description: 'Prepares an automated morning operations digest delivered to each member outside quiet hours.',
    enabled: false,
    previewSeenAt: null,
    dailyCap: 10,
    workingDays: [1, 2, 3, 4, 5, 6],
    fallbackAssignee: 'actor',
    parameters: {
      maxLatenessMinutes: 120,
      lookaheadFestivalDays: 7,
      allowEmptyNotification: false,
      memberSettings: {
        'prajindezaa142@gmail.com': { enabled: true, deliveryTime: '08:30', channels: { push: true, inApp: true, email: true }, sendIfEmpty: false },
      },
    },
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  };

  // Fetch Rules & Run History
  const loadData = async () => {
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Load Rules
      const rulesMap: Record<string, AutomationRuleDoc> = {};
      const r1Doc = await getDoc(doc(db, 'automation_rules', 'rule_1_auto_followup'));
      rulesMap['rule_1_auto_followup'] = r1Doc.exists() ? (r1Doc.data() as AutomationRuleDoc) : defaultRule1;

      const r2Doc = await getDoc(doc(db, 'automation_rules', 'rule_2_idle_lead_reengagement'));
      rulesMap['rule_2_idle_lead_reengagement'] = r2Doc.exists() ? (r2Doc.data() as AutomationRuleDoc) : defaultRule2;

      const r3Doc = await getDoc(doc(db, 'automation_rules', 'rule_3_auto_stage_cold'));
      rulesMap['rule_3_auto_stage_cold'] = r3Doc.exists() ? (r3Doc.data() as AutomationRuleDoc) : defaultRule3;

      const r4Doc = await getDoc(doc(db, 'automation_rules', 'rule_4_cold_revival'));
      rulesMap['rule_4_cold_revival'] = r4Doc.exists() ? (r4Doc.data() as AutomationRuleDoc) : defaultRule4;

      const r5Doc = await getDoc(doc(db, 'automation_rules', 'rule_5_reorder_reminders'));
      rulesMap['rule_5_reorder_reminders'] = r5Doc.exists() ? (r5Doc.data() as AutomationRuleDoc) : defaultRule5;

      const r6Doc = await getDoc(doc(db, 'automation_rules', 'rule_6_festival_campaign_prep'));
      rulesMap['rule_6_festival_campaign_prep'] = r6Doc.exists() ? (r6Doc.data() as AutomationRuleDoc) : defaultRule6;

      const r7Doc = await getDoc(doc(db, 'automation_rules', 'rule_7_morning_plan'));
      rulesMap['rule_7_morning_plan'] = r7Doc.exists() ? (r7Doc.data() as AutomationRuleDoc) : defaultRule7;

      setRules(rulesMap);

      // 2. Load Runs
      const runsQuery = query(collection(db, 'automation_runs'), orderBy('startedAt', 'desc'), limit(15));
      const runsSnap = await getDocs(runsQuery);
      setRuns(runsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AutomationRunDoc)));
    } catch (err) {
      console.error('Error loading automation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle Rule (Enforcing Preview Requirement strictly for Rule 1)
  const handleToggleRule = async (ruleId: string, currentVal: boolean, forceEnable = false) => {
    if (!db) {
      console.warn('Cannot toggle: Firestore db not initialized');
      return;
    }
    const targetRule = rules[ruleId];
    if (!targetRule) return;

    // Hard Rule: Rule 1 cannot turn ON without having viewed the preview first
    if (ruleId === 'rule_1_auto_followup' && !currentVal && !targetRule.previewSeenAt && !forceEnable) {
      setPreviewRuleId(ruleId);
      setActionNotice('Please review the rule preview before enabling Rule 1.');
      return;
    }

    const newVal = !currentVal;
    setSavingRuleId(ruleId);
    try {
      const now = new Date().toISOString();
      const updated = {
        ...targetRule,
        enabled: newVal,
        previewSeenAt: targetRule.previewSeenAt || (newVal ? now : null),
        updatedBy: user?.email || 'admin',
        updatedAt: now,
      };
      await setDoc(doc(db, 'automation_rules', ruleId), updated, { merge: true });
      setRules((prev) => ({ ...prev, [ruleId]: updated }));
      setActionNotice(`Rule ${newVal ? 'ENABLED' : 'DISABLED'} successfully.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      console.error('Error toggling rule:', err);
      setActionNotice(`Error updating rule: ${err.message}`);
    } finally {
      setSavingRuleId(null);
    }
  };

  // Mark Preview Seen
  const handleMarkPreviewSeen = async (ruleId: string) => {
    if (!db) return;
    const targetRule = rules[ruleId];
    if (!targetRule) return;

    const seenTimestamp = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'automation_rules', ruleId), {
        previewSeenAt: seenTimestamp,
        updatedBy: user?.email || 'admin',
      });
      setRules((prev) => ({
        ...prev,
        [ruleId]: { ...targetRule, previewSeenAt: seenTimestamp },
      }));
    } catch (err) {
      console.warn('Could not update previewSeenAt:', err);
    }
  };

  // Trigger Sample Morning Plan
  const handleSendSamplePlan = async () => {
    setSendingSamplePlan(true);
    setActionNotice(null);
    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/automations/sample-morning-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch sample morning plan.');
      setActionNotice(data.message || 'Sample morning plan delivered!');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setSendingSamplePlan(false);
    }
  };

  // Undo a Run
  const handleUndoRun = async (runId: string) => {
    if (!confirm('Are you sure you want to rollback this run? Only untouched/pending tasks will be moved to trash.')) return;
    setUndoingRunId(runId);
    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/automations/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo operation failed.');
      setActionNotice(`Rollback complete: ${data.undoneCount} pending task(s) moved to trash.`);
      loadData();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Undo Error: ${err.message}`);
    } finally {
      setUndoingRunId(null);
    }
  };

  // Preview Calculation Helper
  const calculatePreviewDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    // If Sunday (0), shift to Monday (1)
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  const selectedCustomer = (customers[sampleCustomerIdx] || {
    id: 'sample',
    companyName: 'Shri Murugan Camphor Stores',
    contactPerson: 'Murugan',
    assignedTo: 'prajindezaa142@gmail.com',
  }) as Customer | { companyName: string; contactPerson: string; assignedTo?: string };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#881337] font-semibold text-xs tracking-wider uppercase mb-1">
            <Zap className="w-4 h-4" />
            <span>Automation Hub (Server-Side Rules Engine)</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 font-display">Rule-Based Automations for Jaikrishna Team</h1>
          <p className="text-xs text-stone-500 mt-1">
            Fixed, predictable server-side rules. No AI decision paths. No customer messaging. Tasks are duplicate-safe and reversible.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div className="bg-stone-900 text-white text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-stone-400 hover:text-white font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Active Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Rule 1 */}
        {rules['rule_1_auto_followup'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  Trigger: Customer Stage Change
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_1_auto_followup'].enabled}
                    onChange={() => handleToggleRule('rule_1_auto_followup', rules['rule_1_auto_followup'].enabled)}
                    disabled={savingRuleId === 'rule_1_auto_followup'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 1: Auto Follow-up Tasks on Stage Change</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Automatically creates follow-up tasks when a lead stage changes. Moves prior untouched stage tasks to Trash. Shifts due dates to Monday if landing on Sunday.
              </p>

              {/* Status & Daily Cap Badges */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Daily Cap: {rules['rule_1_auto_followup'].dailyCap} tasks/day
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Working Days: Mon–Sat
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${rules['rule_1_auto_followup'].enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                  {rules['rule_1_auto_followup'].enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              {/* Stage configuration preview pills */}
              <div className="mt-4 space-y-1.5 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                <div className="font-semibold text-stone-800 text-[11px] mb-1">Configured Stage Rules:</div>
                <div className="flex justify-between items-center py-0.5 border-b border-stone-200/60">
                  <span>Sample sent:</span>
                  <span className="font-mono text-stone-800">Call (+3 calendar days)</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-stone-200/60">
                  <span>Interested:</span>
                  <span className="font-mono text-stone-800">WhatsApp (+1 calendar day)</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span>Negotiation:</span>
                  <span className="font-mono text-stone-800">Call (+2 calendar days)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setPreviewRuleId('rule_1_auto_followup');
                  handleMarkPreviewSeen('rule_1_auto_followup');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#881337] hover:underline"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Preview & Simulation</span>
              </button>
              <span className="text-[10px] text-stone-400">
                {rules['rule_1_auto_followup'].previewSeenAt ? 'Preview reviewed ✓' : 'Preview required before enable'}
              </span>
            </div>
          </div>
        )}

        {/* Card: Rule 2 (Idle Lead Re-Engagement) */}
        {rules['rule_2_idle_lead_reengagement'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                  Trigger: Scheduled Daily Check (Idle &gt; 7 Days)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_2_idle_lead_reengagement'].enabled}
                    onChange={() => handleToggleRule('rule_2_idle_lead_reengagement', rules['rule_2_idle_lead_reengagement'].enabled)}
                    disabled={savingRuleId === 'rule_2_idle_lead_reengagement'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 2: Idle Lead Re-Engagement</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Automatically schedules follow-up calls when active leads in Interested, Contacted, or Sample sent have no updates for 7 days.
              </p>

              {/* Status & Daily Cap Badges */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Daily Cap: {rules['rule_2_idle_lead_reengagement'].dailyCap} tasks/day
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Idle Threshold: 7 Days
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${rules['rule_2_idle_lead_reengagement'].enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                  {rules['rule_2_idle_lead_reengagement'].enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px]">Targeted Active Stages:</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-[10px] font-medium text-stone-700">Interested</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-[10px] font-medium text-stone-700">Contacted</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-[10px] font-medium text-stone-700">Sample sent</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Evaluates daily in Asia/Kolkata</span>
              <span className="text-[10px] text-stone-400">Safe duplicate-check</span>
            </div>
          </div>
        )}

        {/* Card: Rule 3 (Cold Lead Auto-Stage) */}
        {rules['rule_3_auto_stage_cold'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  Trigger: Scheduled Daily Check (&gt;= 30 Days Inactive)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_3_auto_stage_cold'].enabled}
                    onChange={() => handleToggleRule('rule_3_auto_stage_cold', rules['rule_3_auto_stage_cold'].enabled)}
                    disabled={savingRuleId === 'rule_3_auto_stage_cold'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 3: Cold Lead Auto-Stage</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Automatically transitions active leads with no updates for 30 days to Cold stage and tags them "Cold Lead" to prevent stale pipeline clutter.
              </p>

              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Daily Cap: {rules['rule_3_auto_stage_cold'].dailyCap} transitions/day
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Threshold: 30 Days
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${rules['rule_3_auto_stage_cold'].enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                  {rules['rule_3_auto_stage_cold'].enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px]">Applied Actions:</div>
                <div className="text-[11px] text-stone-600">Sets leadStage to <span className="font-semibold text-stone-800">Cold</span> & appends tag <span className="font-semibold text-stone-800">Cold Lead</span></div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Pipeline hygiene</span>
              <span className="text-[10px] text-stone-400">Preserves notes</span>
            </div>
          </div>
        )}

        {/* Card: Rule 4 (Inactive Customer Revival) */}
        {rules['rule_4_cold_revival'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                  Trigger: Scheduled Daily Check (Old Customer &gt;= 60d)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_4_cold_revival'].enabled}
                    onChange={() => handleToggleRule('rule_4_cold_revival', rules['rule_4_cold_revival'].enabled)}
                    disabled={savingRuleId === 'rule_4_cold_revival'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 4: Inactive Customer Revival</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Generates high-priority check-in call tasks for past wholesale clients who haven't ordered or called in 60+ days.
              </p>

              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Daily Cap: {rules['rule_4_cold_revival'].dailyCap} tasks/day
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Inactivity: 60 Days
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${rules['rule_4_cold_revival'].enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                  {rules['rule_4_cold_revival'].enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px]">Target Audience:</div>
                <div className="text-[11px] text-stone-600">Existing clients with status <span className="font-semibold text-stone-800">Old customer</span></div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Scheduled revival calls</span>
              <span className="text-[10px] text-stone-400">High priority</span>
            </div>
          </div>
        )}

        {/* Card: Rule 5 (Order Reorder Reminders) */}
        {rules['rule_5_reorder_reminders'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  Trigger: Order Fulfilled + 45 Calendar Days
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_5_reorder_reminders'].enabled}
                    onChange={() => handleToggleRule('rule_5_reorder_reminders', rules['rule_5_reorder_reminders'].enabled)}
                    disabled={savingRuleId === 'rule_5_reorder_reminders'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 5: Order Reorder Reminders</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Proactively schedules reorder call tasks 45 days after a wholesale order is placed so customers never run out of agarbatti inventory.
              </p>

              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Daily Cap: {rules['rule_5_reorder_reminders'].dailyCap} tasks/day
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Cycle: 45 Days
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${rules['rule_5_reorder_reminders'].enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                  {rules['rule_5_reorder_reminders'].enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px]">Refill Automation:</div>
                <div className="text-[11px] text-stone-600">Calculates working-day shift (Mon-Sat) for sales calls</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Repeat order booster</span>
              <span className="text-[10px] text-stone-400">Order-linked</span>
            </div>
          </div>
        )}

        {/* Card: Rule 6 (Festival Campaign Prep) */}
        {rules['rule_6_festival_campaign_prep'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                  Trigger: Upcoming Festival (14 Days Lookahead)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_6_festival_campaign_prep'].enabled}
                    onChange={() => handleToggleRule('rule_6_festival_campaign_prep', rules['rule_6_festival_campaign_prep'].enabled)}
                    disabled={savingRuleId === 'rule_6_festival_campaign_prep'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 6: Festival Campaign Prep</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Monitors pooja and festival calendar dates; schedules preparation and promotional tasks 14 days before peak seasonal demand.
              </p>

              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Daily Cap: {rules['rule_6_festival_campaign_prep'].dailyCap} tasks/day
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Lookahead: 14 Days
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${rules['rule_6_festival_campaign_prep'].enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                  {rules['rule_6_festival_campaign_prep'].enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px]">Seasonality:</div>
                <div className="text-[11px] text-stone-600">Integrates with festival_events to alert factory & ad managers</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Advance stock & ad prep</span>
              <span className="text-[10px] text-stone-400">Zero duplicates</span>
            </div>
          </div>
        )}

        {/* Card: Rule 7 */}
        {rules['rule_7_morning_plan'] && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                  Trigger: Scheduled 08:30 IST Cron
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules['rule_7_morning_plan'].enabled}
                    onChange={() => handleToggleRule('rule_7_morning_plan', rules['rule_7_morning_plan'].enabled)}
                    disabled={savingRuleId === 'rule_7_morning_plan'}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#881337]"></div>
                </label>
              </div>

              <h2 className="text-base font-bold text-stone-900 font-display">Rule 7: Daily Morning Operations Plan</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Sends a structured morning briefing (today's tasks, overdue follow-ups, Meta ads needing action, upcoming festivals) directly to members at their chosen time outside quiet hours.
              </p>

              {/* Status & Timing Badges */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Delivery Time: 08:30 IST
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Max Lateness: 2 Hours
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                  Channels: Push + In-App + Email
                </span>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-600 space-y-1">
                <div className="font-semibold text-stone-800 text-[11px]">Digest Inclusions (Deep-linked):</div>
                <div className="text-[11px] text-stone-600">• Today's tasks with start times</div>
                <div className="text-[11px] text-stone-600">• Overdue tasks & follow-ups</div>
                <div className="text-[11px] text-stone-600">• Meta ads waiting for results</div>
                <div className="text-[11px] text-stone-600">• Upcoming festivals in next 7 days</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={handleSendSamplePlan}
                disabled={sendingSamplePlan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {sendingSamplePlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send me a sample morning plan now</span>
              </button>
              <button
                onClick={() => {
                  setPreviewRuleId('rule_7_morning_plan');
                  handleMarkPreviewSeen('rule_7_morning_plan');
                }}
                className="text-xs font-semibold text-[#881337] hover:underline"
              >
                View Rules
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview & Dry-Run Simulation Modal */}
      {previewRuleId === 'rule_1_auto_followup' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#881337]" />
                <h3 className="text-base font-bold text-stone-900 font-display">Rule 1: Dry-Run Preview & Simulation</h3>
              </div>
              <button
                onClick={() => setPreviewRuleId(null)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            {/* Past 7-Day Real Data Summary */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Past 7 Days Audit Activity</span>
              </div>
              <p>
                Based on your CRM activity logs, <strong>{customers.length} total customers</strong> are registered. If Rule 1 were active, stage transitions would have created follow-up tasks deterministically without customer spam.
              </p>
            </div>

            {/* Live Customer Simulation Widget */}
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-3">
              <div className="font-semibold text-xs text-stone-800">Simulate Rule Behavior on Selected Customer:</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-stone-500 block mb-1">Select Customer:</label>
                  <select
                    value={sampleCustomerIdx}
                    onChange={(e) => setSampleCustomerIdx(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg border border-stone-300 bg-white"
                  >
                    {customers.slice(0, 10).map((c, idx) => (
                      <option key={c.id} value={idx}>
                        {c.companyName || c.contactPerson} ({c.place?.city || 'Salem'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-stone-500 block mb-1">Simulate Stage Transition:</label>
                  <select
                    value={sampleStage}
                    onChange={(e) => setSampleStage(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="Sample sent">Sample sent (+3 calendar days)</option>
                    <option value="Interested">Interested (+1 calendar day)</option>
                    <option value="Negotiation">Negotiation (+2 calendar days)</option>
                    <option value="Contacted">Contacted (+3 calendar days)</option>
                    <option value="Ordered">Ordered (No task / Auto-cancels prior)</option>
                  </select>
                </div>
              </div>

              {/* Simulation Result */}
              <div className="bg-white p-3 rounded-lg border border-stone-200 text-xs space-y-1 mt-2">
                <div className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">Simulated Output:</div>
                <div className="font-semibold text-stone-900">
                  {sampleStage === 'Ordered' ? (
                    <span className="text-emerald-700">✓ No new task. Prior untouched automation tasks moved to Trash.</span>
                  ) : (
                    <>
                      Task Title: &quot;Call {selectedCustomer.companyName || selectedCustomer.contactPerson} regarding {sampleStage}&quot;
                    </>
                  )}
                </div>
                {sampleStage !== 'Ordered' && (
                  <div className="text-stone-600 text-[11px]">
                    Due Date: <strong>{calculatePreviewDate(sampleStage === 'Interested' ? 1 : sampleStage === 'Negotiation' ? 2 : 3)}</strong> (Shifted past Sunday if applicable) · Assigned to: <strong>{selectedCustomer.assignedTo || user?.email}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={async () => {
                  if (previewRuleId) {
                    await handleMarkPreviewSeen(previewRuleId);
                  }
                  setPreviewRuleId(null);
                }}
                className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Close Preview
              </button>
              {previewRuleId && !rules[previewRuleId]?.enabled && (
                <button
                  onClick={async () => {
                    const rId = previewRuleId;
                    await handleMarkPreviewSeen(rId);
                    setPreviewRuleId(null);
                    // Pass forceEnable = true since user explicitly clicked enable from preview
                    await handleToggleRule(rId, false, true);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 shadow-xs cursor-pointer"
                >
                  I have reviewed the preview — Enable Rule 1
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Run History & Undo Table */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900 font-display">Run History & Rollback Log</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Every automated run is logged with its timestamp and tasks. You can rollback untouched tasks at any time.
            </p>
          </div>
        </div>

        {runs.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-400">
            No automation runs recorded yet. Enabled rules will log rolling daily runs here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="p-3">Rule Name</th>
                  <th className="p-3">Started (IST)</th>
                  <th className="p-3">Tasks Created</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/50">
                    <td className="p-3 font-semibold text-stone-800">{r.ruleName || r.ruleId}</td>
                    <td className="p-3 text-stone-500 font-mono text-[11px]">{r.startedAt?.slice(0, 16)}</td>
                    <td className="p-3 text-stone-700 font-medium">{r.createdCount || 0} task(s)</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.undone
                            ? 'bg-rose-100 text-rose-800'
                            : r.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {r.undone ? 'Undone / Rolled Back' : r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {!r.undone && (r.createdCount || 0) > 0 ? (
                        <button
                          onClick={() => handleUndoRun(r.id)}
                          disabled={undoingRunId === r.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 hover:underline"
                        >
                          {undoingRunId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          <span>Undo this run</span>
                        </button>
                      ) : (
                        <span className="text-stone-300 text-[11px]">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
