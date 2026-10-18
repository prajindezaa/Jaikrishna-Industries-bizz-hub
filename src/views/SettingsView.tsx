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
    emailEnabled: true,
    perTask: true,
    taskUncompleted: true,
    taskNotCreated: true,
    planningNotDone: true,
    missedTaskPeerAlert: true,
    dailyEmailCap: 5,
    quietHoursStart: '21:00',
    quietHoursEnd: '08:00',
  });

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
                <Mail className="w-3.5 h-3.5 text-rose-800" />
                <span>Send Test Email Digest</span>
              </button>
            </div>

            {/* Toggles */}
            <div className="space-y-3 text-xs">
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
                  <div className="font-semibold text-stone-900">Primary Admin</div>
                  <div className="font-mono text-stone-500">prajindezaa142@gmail.com</div>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                  Admin (Setup)
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-stone-900">The Owner</div>
                  <div className="font-mono text-stone-500">Configured in allowed_emails</div>
                </div>
                <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-medium">
                  Owner
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-stone-900">Sales Manager</div>
                  <div className="font-mono text-stone-500">Configured in allowed_emails</div>
                </div>
                <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-medium">
                  Sales Manager
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
              <span>Resend SPF &amp; DKIM Setup Guide</span>
            </div>
            <div className="text-xs text-stone-600 space-y-2">
              <p>To send delivery summaries and reminder emails from <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px] text-stone-800">reminders@jaikrishnaindustries.com</code>, add these DNS records to your domain host (GoDaddy / Cloudflare / Namecheap):</p>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 font-mono text-[11px] space-y-1.5 text-stone-700 overflow-x-auto">
                <div><strong>1. DKIM (TXT):</strong> Host: <span className="text-[#881337]">resend._domainkey</span> · Value: <span className="text-stone-500">p=MIGf... (from resend.com/domains)</span></div>
                <div><strong>2. SPF (TXT):</strong> Host: <span className="text-[#881337]">send</span> · Value: <span className="text-stone-500">v=spf1 include:amazonses.com ~all</span></div>
                <div><strong>3. Return-Path (MX):</strong> Host: <span className="text-[#881337]">send</span> · Value: <span className="text-stone-500">feedback-smtp.us-east-1.amazonses.com (Priority 10)</span></div>
              </div>
              <p className="text-[11px] text-stone-500">Once verified in Resend dashboard, delivery arrives straight to member inboxes without spam filtering.</p>
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
