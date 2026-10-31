/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — AI Assistant Settings Card Component
 * Controls Global Kill Switch, per-member toggles, daily action caps (hard max 50),
 * default task time, and risk confirmation policy.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  UserCheck,
  Power,
  History,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { HARD_LIMITS } from '../../shared/schemas';

export const AiAssistantSettingsCard: React.FC = () => {
  const { member, user } = useAuth();
  const currentEmail = (member?.email || user?.email || '').toLowerCase().trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [memberEnabled, setMemberEnabled] = useState(true);
  const [dailyCap, setDailyCap] = useState(HARD_LIMITS.DEFAULT_DAILY_ACTION_CAP);
  const [defaultTaskTime, setDefaultTaskTime] = useState(HARD_LIMITS.DEFAULT_TASK_TIME);
  const [requireSecondConfirmMedium, setRequireSecondConfirmMedium] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!db) return;
      try {
        const snap = await getDoc(doc(db, 'settings', 'ai_assistant'));
        if (snap.exists()) {
          const data = snap.data();
          setGlobalEnabled(data.globalAiActionsEnabled !== false);
          const m = data.memberSettings?.[currentEmail] || {};
          setMemberEnabled(m.aiActionsEnabled !== false);
          setDailyCap(m.dailyActionCap || HARD_LIMITS.DEFAULT_DAILY_ACTION_CAP);
          setDefaultTaskTime(m.defaultTaskTime || HARD_LIMITS.DEFAULT_TASK_TIME);
          setRequireSecondConfirmMedium(Boolean(m.requireSecondConfirmForMedium));
        }
      } catch (err) {
        console.warn('Could not load AI settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [currentEmail]);

  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    try {
      const settingsRef = doc(db, 'settings', 'ai_assistant');
      const snap = await getDoc(settingsRef);
      const existing = snap.exists() ? snap.data() : {};

      const now = new Date().toISOString();
      const updatedMemberSettings = {
        ...(existing.memberSettings || {}),
        [currentEmail]: {
          aiActionsEnabled: memberEnabled,
          dailyActionCap: Math.min(Math.max(1, dailyCap), HARD_LIMITS.MAX_DAILY_ACTION_CAP),
          defaultTaskTime: defaultTaskTime || '10:00',
          requireSecondConfirmForMedium: requireSecondConfirmMedium,
        },
      };

      await setDoc(
        settingsRef,
        {
          globalAiActionsEnabled: globalEnabled,
          memberSettings: updatedMemberSettings,
          updatedAt: now,
          updatedBy: currentEmail,
        },
        { merge: true }
      );

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(`Failed to save AI settings: ${err.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display">
          <Sparkles className="w-4 h-4 text-amber-700" />
          <span>AI Operations & Actions</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          Propose & Confirm
        </span>
      </div>

      <div className="space-y-4 text-xs">
        {/* Global Kill Switch */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
          <div className="space-y-0.5">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Power className="w-3.5 h-3.5 text-stone-600" />
              Global AI Actions Kill Switch
            </span>
            <p className="text-[11px] text-stone-500">
              Emergency toggle for all 3 team members.
            </p>
          </div>
          <button
            onClick={() => setGlobalEnabled(!globalEnabled)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              globalEnabled ? 'bg-emerald-600 justify-end' : 'bg-stone-300 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        {/* Member Action Toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
          <div className="space-y-0.5">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-stone-600" />
              Enable for My Account
            </span>
            <p className="text-[11px] text-stone-500">
              Allow Gemini to propose tasks, leads, and plans for {currentEmail}.
            </p>
          </div>
          <button
            onClick={() => setMemberEnabled(!memberEnabled)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              memberEnabled ? 'bg-[#881337] justify-end' : 'bg-stone-300 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
          </button>
        </div>

        {/* Daily Action Cap */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
          <div className="space-y-0.5">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-stone-600" />
              Daily Action Cap
            </span>
            <p className="text-[11px] text-stone-500">
              Max confirmed actions/day (Hard code limit: {HARD_LIMITS.MAX_DAILY_ACTION_CAP}).
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={HARD_LIMITS.MAX_DAILY_ACTION_CAP}
              value={dailyCap}
              onChange={(e) => setDailyCap(parseInt(e.target.value, 10) || 1)}
              className="w-16 px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-900 font-medium text-center"
            />
            <span className="text-stone-400 text-[11px]">/day</span>
          </div>
        </div>

        {/* Default Task Time */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
          <div className="space-y-0.5">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-600" />
              Default Task Schedule Time
            </span>
            <p className="text-[11px] text-stone-500">
              Used when date is specified without a time (Asia/Kolkata).
            </p>
          </div>
          <input
            type="time"
            value={defaultTaskTime}
            onChange={(e) => setDefaultTaskTime(e.target.value)}
            className="px-2 py-1 text-xs border border-stone-300 rounded bg-white text-stone-900 font-medium"
          />
        </div>

        {/* Confirmation Policy */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
          <div className="space-y-0.5">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-stone-600" />
              Strict 2nd Confirmation for Medium Risk
            </span>
            <p className="text-[11px] text-stone-500">
              Require typed confirmation for record edits and reassignments.
            </p>
          </div>
          <input
            type="checkbox"
            checked={requireSecondConfirmMedium}
            onChange={(e) => setRequireSecondConfirmMedium(e.target.checked)}
            className="w-4 h-4 text-[#881337] rounded border-stone-300"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
        <a
          href="/?module=voice_test"
          className="flex items-center gap-1.5 text-xs text-[#881337] font-semibold hover:underline"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Open Voice Test Bench (Dev Step 0)</span>
        </a>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="flex items-center gap-1 text-emerald-700 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4" /> Preferences Saved!
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#881337] hover:bg-[#9f1239] text-white shadow-xs transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save AI Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
