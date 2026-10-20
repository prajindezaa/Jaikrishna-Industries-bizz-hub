/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Bell,
  Globe,
  Database,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  HardDrive,
  Send,
  Sliders,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { requestNotificationPermission, showBrowserNotification } from '../lib/notifications';
import { z } from 'zod';
import { WhatsAppHubSettings } from '../types';
import { PushOnboarding } from '../components/layout/PushOnboarding';
import { CustomerGroupSettingsSection } from '../components/settings/CustomerGroupSettingsSection';
import { db } from '../lib/firebase';

export const SettingsView: React.FC = () => {
  const { user, member } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { settings, updateWhatsAppHubSettings } = useApp();

  const [diagnostics, setDiagnostics] = useState<{
    firebaseConfigured?: boolean;
    missingClientKeys?: string[];
    hasGeminiKey?: boolean;
    geminiModel?: string;
    hasResendKey?: boolean;
    hasCloudinary?: boolean;
    allowedEmailsCount?: number;
  }>({});

  const [loadingDiag, setLoadingDiag] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Notification Preferences State
  const [prefs, setPrefs] = useState({
    pushEnabled: true,
    inAppEnabled: true,
    emailEnabled: true,
    perTask: true,
    taskUncompleted: true,
    taskNotCreated: true,
    planningNotDone: true,
    missedTaskPeerAlert: true,
    festivalCampaign: true,
    reorderReminder: true,
    quietHoursEnabled: true,
    quietHoursStart: '21:00',
    quietHoursEnd: '08:00',
    dailyEmailCap: 5,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefSaveSuccess, setPrefSaveSuccess] = useState(false);

  // Load preferences from Firestore team_members collection
  useEffect(() => {
    if (!db || !user?.email) return;
    const firestoreDb = db;
    const fetchMemberPrefs = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const snap = await getDoc(doc(firestoreDb, 'team_members', user.email!.toLowerCase()));
        if (snap.exists()) {
          const np = snap.data()?.notificationPreferences;
          if (np) {
            setPrefs({
              pushEnabled: np.channels?.push !== false,
              inAppEnabled: np.channels?.inApp !== false,
              emailEnabled: np.channels?.email !== false,
              perTask: np.types?.perTask !== false,
              taskUncompleted: np.types?.taskUncompleted !== false,
              taskNotCreated: np.types?.taskNotCreated !== false,
              planningNotDone: np.types?.planningNotDone !== false,
              missedTaskPeerAlert: np.types?.missedTaskAlert !== false,
              festivalCampaign: np.types?.festivalCampaign !== false,
              reorderReminder: np.types?.reorderReminder !== false,
              quietHoursEnabled: np.quietHours?.enabled !== false,
              quietHoursStart: np.quietHours?.start || '21:00',
              quietHoursEnd: np.quietHours?.end || '08:00',
              dailyEmailCap: np.dailyEmailCap || 5,
            });
          }
        }
      } catch (err) {
        console.warn('Could not load member preferences:', err);
      }
    };
    fetchMemberPrefs();
  }, [user]);

  const handleSavePreferences = async () => {
    if (!db || !user?.email) return;
    const firestoreDb = db;
    setSavingPrefs(true);
    setPrefSaveSuccess(false);
    try {
      const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
      await setDoc(
        doc(firestoreDb, 'team_members', user.email.toLowerCase()),
        {
          notificationPreferences: {
            channels: {
              push: prefs.pushEnabled,
              inApp: prefs.inAppEnabled,
              email: prefs.emailEnabled,
            },
            types: {
              perTask: prefs.perTask,
              taskUncompleted: prefs.taskUncompleted,
              taskNotCreated: prefs.taskNotCreated,
              planningNotDone: prefs.planningNotDone,
              missedTaskAlert: prefs.missedTaskPeerAlert,
              festivalCampaign: prefs.festivalCampaign,
              reorderReminder: prefs.reorderReminder,
            },
            quietHours: {
              enabled: prefs.quietHoursEnabled,
              start: prefs.quietHoursStart,
              end: prefs.quietHoursEnd,
            },
            dailyEmailCap: prefs.dailyEmailCap,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setPrefSaveSuccess(true);
      setTimeout(() => setPrefSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const fetchDiagnostics = async () => {
    setLoadingDiag(true);
    try {
      const res = await fetch('/api/config-status');
      const data = await res.json();
      setDiagnostics(data);
    } catch (err) {
      console.warn('Diagnostics fetch error:', err);
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleTestNotification = async () => {
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      showBrowserNotification('Jaikrishna Industries Reminder', {
        body: 'Call Salem Murugan Stores regarding 100g Bhimseni camphor tablet order — Due 4:00 PM.',
      });
      setTestResult('Browser push notification displayed successfully!');
    } else {
      setTestResult('Notification permission denied or blocked in browser settings.');
    }
    setTimeout(() => setTestResult(null), 4000);
  };

  const handleTestEmail = async () => {
    setTestResult('Triggering test email dispatch...');
    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ email: member?.email || 'prajindezaa142@gmail.com' }),
      });
      const data = await res.json();
      setTestResult(data.message || 'Test email dispatched successfully via Resend API.');
    } catch (err) {
      setTestResult(`Test email failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-stone-900 font-display">
          System Settings &amp; Configuration
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Shared configurations for all 3 equal Jaikrishna Industries team members.
        </p>
      </div>

      {testResult && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Company & Members & Notifications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Profile */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display pb-3 border-b border-stone-100">
              <Building2 className="w-4 h-4 text-amber-700" />
              <span>Company Profile</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#881337] to-[#4C0519] p-2 flex items-center justify-center shrink-0 border border-amber-300/40">
                <img src="/icon.svg" alt="Company Logo" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-stone-900">Jaikrishna Industries</div>
                <div className="text-xs text-stone-600">
                  Manufacturer of Camphor Tablets, Bhimseni Camphor, Agarbatti, Lamp Oil &amp; Sambrani
                </div>
                <div className="text-[11px] text-stone-500">
                  Primary Location: <span className="font-medium text-stone-700">Salem, Tamil Nadu, India</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Groups & Categories Management (Phase 1) */}
          <CustomerGroupSettingsSection />

          {/* Device Push Registration & Onboarding (Phase 4A) */}
          <PushOnboarding />

          {/* Detailed Notification & Reminder Rules (Phase 4) */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display">
                <Bell className="w-4 h-4 text-amber-700" />
                <span>Notification Channels &amp; Reminder Rules</span>
              </div>
              <span className="text-[10px] font-mono text-stone-500">Asia/Kolkata (IST)</span>
            </div>

            {/* Test Action Buttons */}
            <div className="flex flex-wrap gap-2.5 pb-2 border-b border-stone-100">
              <button
                onClick={handleTestNotification}
                className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-amber-800" />
                <span>Send Test Push Notification</span>
              </button>
              <button
                onClick={handleTestEmail}
                className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-amber-800" />
                <span>Send Test Email (Resend)</span>
              </button>
            </div>

            {/* Toggles */}
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-stone-50 border border-stone-200/60">
                <div>
                  <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#881337]" />
                    <span>Email Delivery Channel (Resend)</span>
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Receive morning plans, overdue alerts, and operations summaries at <span className="font-mono text-stone-700">{user?.email}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.emailEnabled}
                  onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800 focus:ring-amber-800 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-stone-900">Per-Task Nudges</div>
                  <div className="text-[11px] text-stone-500">Alerts 15m before start, at start, and when overdue</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.perTask}
                  onChange={(e) => setPrefs({ ...prefs, perTask: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-stone-900">Task Uncompleted Nudges</div>
                  <div className="text-[11px] text-stone-500">Repeated nudges through the day for pending customer calls</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.taskUncompleted}
                  onChange={(e) => setPrefs({ ...prefs, taskUncompleted: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-stone-900">Task Not Created Alert</div>
                  <div className="text-[11px] text-stone-500">Reminds if 0 tasks scheduled for today by 10:00 AM</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.taskNotCreated}
                  onChange={(e) => setPrefs({ ...prefs, taskNotCreated: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-stone-900">Missed-Task Peer Alerts</div>
                  <div className="text-[11px] text-stone-500">Alerts the other 2 members when a task is missed</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.missedTaskPeerAlert}
                  onChange={(e) => setPrefs({ ...prefs, missedTaskPeerAlert: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-stone-900">Festival Campaign Alerts (Rule 6)</div>
                  <div className="text-[11px] text-stone-500">Alerts 14 days before pooja festivals (Diwali, Pongal, etc.)</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.festivalCampaign}
                  onChange={(e) => setPrefs({ ...prefs, festivalCampaign: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-stone-900">Reorder Cycle Reminders (Rule 5)</div>
                  <div className="text-[11px] text-stone-500">Alerts at 45 days after last camphor / oil bulk dispatch</div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.reorderReminder}
                  onChange={(e) => setPrefs({ ...prefs, reorderReminder: e.target.checked })}
                  className="rounded border-stone-300 text-amber-800"
                />
              </label>

              {/* Email Delivery Options & Cap */}
              {prefs.emailEnabled && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">Verified Sending Domain</div>
                      <div className="text-[11px] text-stone-500 font-mono">jaikrishnabizzhub.in (Resend)</div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Active / Verified
                    </span>
                  </div>

                  <div className="pt-2 border-t border-stone-200/50">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="font-semibold text-stone-900">Daily Digest Email Limit</div>
                        <div className="text-[11px] text-stone-500">Max digest emails sent to your inbox per day (0 to 5)</div>
                      </div>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        {prefs.dailyEmailCap} / day
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={prefs.dailyEmailCap}
                      onChange={(e) => setPrefs({ ...prefs, dailyEmailCap: parseInt(e.target.value, 10) })}
                      className="w-full accent-[#881337] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>0 (Mute digests)</span>
                      <span>3 (Recommended)</span>
                      <span>5 (Max)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quiet Hours Configuration */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-stone-900">Quiet Hours (Asia/Kolkata)</div>
                    <div className="text-[11px] text-stone-500">Suppress non-critical push notifications during rest hours</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.quietHoursEnabled}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursEnabled: e.target.checked })}
                    className="rounded border-stone-300 text-amber-800"
                  />
                </div>

                {prefs.quietHoursEnabled && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-stone-700">
                    <span>From</span>
                    <input
                      type="time"
                      value={prefs.quietHoursStart}
                      onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                      className="px-2 py-1 rounded border border-stone-300 bg-stone-50 font-mono text-xs"
                    />
                    <span>To</span>
                    <input
                      type="time"
                      value={prefs.quietHoursEnd}
                      onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                      className="px-2 py-1 rounded border border-stone-300 bg-stone-50 font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                  className="px-4 py-2 bg-[#881337] hover:bg-[#70102e] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  {savingPrefs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Notification Preferences
                </button>

                {prefSaveSuccess && (
                  <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Preferences Saved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* The 3 Equal Team Members (Allowlist) */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display">
                <Users className="w-4 h-4 text-amber-700" />
                <span>The 3 Authorized Members (Allowlist)</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                Flat Permissions (No RBAC)
              </span>
            </div>

            <div className="divide-y divide-stone-100 text-xs">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-stone-900">Admin</div>
                  <div className="font-mono text-stone-500">prajindezaa142@gmail.com</div>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                  Admin
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-stone-900">Sales Manager</div>
                  <div className="font-mono text-stone-500">jaikrishnaindustries1@gmail.com</div>
                </div>
                <span className="text-[10px] font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold">
                  Sales Manager
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-stone-900">Owner (Srinivasan)</div>
                  <div className="font-mono text-stone-500">srinisrkp@gmail.com</div>
                </div>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                  Owner
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Diagnostics, Quotas & Integrations */}
        <div className="space-y-6">
          {/* Live Service Diagnostics */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display">
                <Database className="w-4 h-4 text-amber-700" />
                <span>Backend Diagnostics</span>
              </div>
              <button
                onClick={fetchDiagnostics}
                disabled={loadingDiag}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
                title="Refresh diagnostics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50">
                <span className="text-stone-600">Firebase Client</span>
                {diagnostics.firebaseConfigured ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Setup Needed
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50">
                <span className="text-stone-600">Gemini AI Key</span>
                {diagnostics.hasGeminiKey ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-stone-400 font-medium text-[11px]">
                    Missing Key
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50">
                <span className="text-stone-600">Gemini Model</span>
                <span className="font-mono text-[11px] font-semibold text-stone-800">
                  {diagnostics.geminiModel || 'gemini-3.8-flash'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50">
                <span className="text-stone-600">Resend Emails</span>
                {diagnostics.hasResendKey ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-stone-400 font-medium text-[11px]">
                    Pending Key
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cost Control & Daily Caps */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display pb-3 border-b border-stone-100">
              <Mail className="w-4 h-4 text-amber-700" />
              <span>Email &amp; Reminder Caps</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-600">Per-Member Daily Cap:</span>
                <span className="font-mono font-semibold text-stone-900">{prefs.dailyEmailCap} digests / day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Global Resend Cap:</span>
                <span className="font-mono font-semibold text-stone-900">80 emails / day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Free Tier Limit:</span>
                <span className="font-mono text-stone-500">100 / day (3,000 / mo)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Quiet Hours:</span>
                <span className="font-mono text-stone-900">
                  {prefs.quietHoursStart} – {prefs.quietHoursEnd} IST
                </span>
              </div>
            </div>
          </div>

          {/* Paid Gemini Tier Requirement Notice (Requirement 13) */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display pb-2 border-b border-stone-100">
              <Sparkles className="w-4 h-4 text-purple-700" />
              <span>Gemini Paid Tier Policy</span>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-900 leading-relaxed">
              <span className="font-bold">Required for Customer Data Confidentiality:</span> Google Gemini paid tier (Pay-As-You-Go with billing enabled) is required for Jaikrishna Industries operations. Under Google's Terms of Service, free-tier inputs may be logged and used to train future models, whereas the paid tier strictly guarantees zero data logging and zero model training on your customer leads, orders, or phone numbers.
            </div>
          </div>

          {/* Resend SPF / DKIM Domain Verification Guide (Requirement 14) */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display pb-2 border-b border-stone-100">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Resend SPF &amp; DKIM Setup Guide (jaikrishnabizzhub.in)</span>
            </div>
            <div className="text-xs text-stone-600 space-y-2">
              <p>To send delivery summaries and reminder emails from <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px] text-stone-800">reminders@jaikrishnabizzhub.in</code>, add these DNS records to your DNS provider (Vercel / GoDaddy):</p>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 font-mono text-[11px] space-y-1.5 text-stone-700 overflow-x-auto">
                <div><strong>1. DKIM (TXT):</strong> Host: <span className="text-[#881337]">resend._domainkey</span> · Value: <span className="text-stone-500">p=MIGf... (from resend.com/domains)</span></div>
                <div><strong>2. SPF (TXT):</strong> Host: <span className="text-[#881337]">send</span> · Value: <span className="text-stone-500">v=spf1 include:amazonses.com ~all</span></div>
                <div><strong>3. Return-Path (MX):</strong> Host: <span className="text-[#881337]">send</span> · Value: <span className="text-stone-500">feedback-smtp.us-east-1.amazonses.com (Priority 10)</span></div>
              </div>
              <p className="text-[11px] text-stone-500">Once verified in your Resend dashboard (status: Verified), emails arrive directly in your team's inbox with zero spam filtering.</p>
            </div>
          </div>

          {/* PWA Installation Card */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm font-display pb-2 border-b border-stone-100">
              <HardDrive className="w-4 h-4 text-amber-700" />
              <span>Installable PWA</span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Install Jaikrishna Industries on your phone or desktop for background push notifications and fast access.
            </p>
            <PWAInstallButton variant="sidebar" />
          </div>
        </div>
      </div>
    </div>
  );
};
