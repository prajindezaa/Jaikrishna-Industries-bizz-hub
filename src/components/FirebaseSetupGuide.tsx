/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Key,
  Mail,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { getMissingFirebaseKeys } from '../lib/firebase';

export const FirebaseSetupGuide: React.FC = () => {
  const missingKeys = getMissingFirebaseKeys();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const envTemplate = `# Jaikrishna Industries — Environment Configuration
# Firebase Client Configuration (Paste from Firebase Console > Project Settings > General > Your Apps)
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"

# Gemini AI Assistant (Paid tier required for business customer data processing)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3.8-flash"

# Resend Email Reminders (Scheduled Cloud Function)
RESEND_API_KEY="re_your_api_key"
RESEND_FROM_EMAIL="reminders@yourdomain.com"`;

  const seedPayload = `{
  "allowed": true,
  "email": "prajindezaa142@gmail.com",
  "label": "Admin",
  "createdAt": "2026-10-14T10:00:00Z"
}`;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-rose-200 p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Action Required
                </span>
                <span className="text-xs text-stone-500 font-mono">Strict Firebase Production Mode</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 mt-2 font-display">
                Firebase Configuration Required
              </h1>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                Jaikrishna Industries requires direct, secure connection to your Firebase project for real-time
                CRM lead persistence, task tracking, 3-member allowlist authentication, and push notifications.
                Mock and fallback storage modes are strictly disabled.
              </p>
            </div>
          </div>

          {/* Missing Keys Pill Strip */}
          <div className="mt-6 pt-5 border-t border-stone-100">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
              Missing Client Environment Variables ({missingKeys.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {missingKeys.map((key) => (
                <span
                  key={key}
                  className="font-mono text-xs px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md border border-stone-200"
                >
                  VITE_FIREBASE_{key.replace(/([A-Z])/g, '_$1').toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Step-by-Step Setup Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Firebase Project & Web App */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
                <Flame className="w-4 h-4" /> Step 1: Firebase Project & Web App
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Open{' '}
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-800 underline inline-flex items-center gap-1 font-medium"
                >
                  Firebase Console <ExternalLink className="w-3 h-3" />
                </a>
                . Create a project named <strong>jaikrishna-industries</strong>. Go to <em>Project Settings</em> &gt;{' '}
                <em>General</em> &gt; <em>Your Apps</em>, click <strong>Web</strong> (<code>&lt;/&gt;</code>), and copy
                your config credentials into <code>.env</code>.
              </p>
            </div>
          </div>

          {/* Step 2: Firestore & Location */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
                <Flame className="w-4 h-4" /> Step 2: Cloud Firestore Database
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                In Firebase Console, click <strong>Build &gt; Firestore Database</strong>. Click <em>Create database</em>.
                Select production mode and choose region <strong>asia-south1 (Mumbai)</strong> for optimal latency in
                Tamil Nadu.
              </p>
            </div>
          </div>

          {/* Step 3: Auth Providers */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm mb-2">
                <UserCheck className="w-4 h-4" /> Step 3: Enable Google & Email Auth
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Under <strong>Build &gt; Authentication &gt; Sign-in method</strong>, enable <strong>Google</strong> and{' '}
                <strong>Email/Password</strong>. In <em>Authorized domains</em>, add your Vercel and AI Studio app domains.
              </p>
            </div>
          </div>

          {/* Step 4: Seed Primary Admin */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm mb-2">
                <UserCheck className="w-4 h-4" /> Step 4: Seed Primary Admin Email
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                To bootstrap security rules safely, go to <strong>Firestore &gt; Start collection</strong>.
                Create collection <code>allowed_emails</code> and document ID{' '}
                <code>prajindezaa142@gmail.com</code> with field <code>allowed: true</code>.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] font-mono text-stone-500">Document seed payload</span>
              <button
                onClick={() => copyToClipboard(seedPayload, 'seed')}
                className="text-xs text-stone-700 hover:text-stone-900 inline-flex items-center gap-1 font-medium"
              >
                {copiedSection === 'seed' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSection === 'seed' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Step 5: Gemini AI Key */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-800 font-semibold text-sm mb-2">
                <Key className="w-4 h-4" /> Step 5: Gemini API Paid Tier Key
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Obtain a key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline inline-flex items-center gap-1 font-medium"
                >
                  Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
                . <strong>Important:</strong> Google requires a billing-enabled project for Gemini when processing
                commercial business and customer records. Set a Google Cloud budget alert (e.g. $5/month).
              </p>
            </div>
          </div>

          {/* Step 6: Resend Email Domain */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sky-800 font-semibold text-sm mb-2">
                <Mail className="w-4 h-4" /> Step 6: Resend Domain Verification (SPF & DKIM)
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Sign up at{' '}
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline inline-flex items-center gap-1 font-medium"
                >
                  Resend <ExternalLink className="w-3 h-3" />
                </a>
                . Add your sending domain (e.g. <code>jaikrishnaindustries.com</code>) and add the 3 DNS TXT records
                (SPF <code>v=spf1 include:resend.com ~all</code> and DKIM <code>resend._domainkey</code>) in your domain DNS registrar.
              </p>
            </div>
          </div>
        </div>

        {/* Copyable .env Template */}
        <div className="bg-stone-900 text-stone-100 rounded-xl p-6 shadow-lg border border-stone-800">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs font-mono text-stone-400">.env / Environment Variables Template</span>
            <button
              onClick={() => copyToClipboard(envTemplate, 'env')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1.5"
            >
              {copiedSection === 'env' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedSection === 'env' ? 'Copied to Clipboard' : 'Copy All Variables'}
            </button>
          </div>
          <pre className="mt-4 text-xs font-mono text-stone-300 overflow-x-auto p-2 bg-stone-950/60 rounded-lg leading-relaxed">
            {envTemplate}
          </pre>
        </div>

        {/* Refresh Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-200">
          <div className="text-xs text-stone-500">
            After configuring your variables in <code>.env</code> or Vercel, restart the dev server or reload the page.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-check Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
