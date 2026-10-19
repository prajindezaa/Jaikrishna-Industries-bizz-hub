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
  RefreshCw,
  X,
  Code,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RECOMMENDED_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function currentUserEmail() {
      return (request.auth != null && 'email' in request.auth.token && request.auth.token.email != null)
        ? request.auth.token.email.lower()
        : '';
    }
    function isInitialAdmin() {
      return isAuthenticated() && currentUserEmail() in ['prajindezaa142@gmail.com', 'prajindezaa142@gamil.com'];
    }
    function isAllowedMember() {
      return isAuthenticated() && (
        currentUserEmail() in [
          'prajindezaa142@gmail.com',
          'prajindezaa142@gamil.com',
          'jaikrishnaindustries1@gmail.com',
          'srinisrkp@gmail.com'
        ] ||
        (currentUserEmail() != '' && exists(/databases/$(database)/documents/allowed_emails/$(currentUserEmail())))
      );
    }

    match /allowed_emails/{emailId} {
      allow read: if isAuthenticated();
      allow write: if isInitialAdmin() || isAllowedMember();
    }
    match /team_members/{memberId} {
      allow read, write: if isAllowedMember();
    }
    match /customers/{customerId} {
      allow read, write: if isAllowedMember();
    }
    match /tasks/{taskId} {
      allow read, write: if isAllowedMember();
    }
    match /plans/{planId} {
      allow read, write: if isAllowedMember();
    }
    match /orders/{orderId} {
      allow read, write: if isAllowedMember();
    }
    match /trash/{trashId} {
      allow read, write: if isAllowedMember();
    }
    match /activity_logs/{logId} {
      allow read, create: if isAllowedMember();
      allow update, delete: if false;
    }
    match /settings/{settingId} {
      allow read, write: if isAllowedMember();
    }
    match /ai_chats/{chatId} {
      allow read, write: if isAllowedMember();
    }
    match /notification_log/{logId} {
      allow read, write: if isAllowedMember();
    }
    match /saved_filters/{filterId} {
      allow read, write: if isAllowedMember();
    }
  }
}`;

export const DEV_TESTING_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

export const FirestoreRulesNotice: React.FC = () => {
  const { firestorePermissionError, retryConnection, dismissPermissionBanner } = useApp();
  const [copiedType, setCopiedType] = useState<'recommended' | 'dev' | null>(null);
  const [showFullRules, setShowFullRules] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!firestorePermissionError) {
    return null;
  }

  const handleCopy = (type: 'recommended' | 'dev') => {
    const text = type === 'recommended' ? RECOMMENDED_FIRESTORE_RULES : DEV_TESTING_RULES;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleRetry = () => {
    setRetrying(true);
    retryConnection();
    setTimeout(() => setRetrying(false), 1200);
  };

  return (
    <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-amber-950 font-display">
                Firestore Security Rules Update Required
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-200 text-amber-900 rounded-full">
                jaikrishna-industries
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-900 leading-relaxed max-w-3xl">
              Firestore returned <strong className="font-semibold text-amber-950">Missing or insufficient permissions</strong>.
              Firebase blocks database access by default until security rules are published in your Firebase Console.
            </p>
          </div>
        </div>

        <button
          onClick={dismissPermissionBanner}
          title="Dismiss banner"
          className="p-1.5 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded-lg transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-amber-200/80 flex flex-wrap items-center gap-3">
        {/* Step 1: Copy Recommended Rules */}
        <button
          onClick={() => handleCopy('recommended')}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl shadow-xs transition-colors"
        >
          {copiedType === 'recommended' ? (
            <>
              <Check className="w-3.5 h-3.5 text-amber-200" />
              <span>Copied Allowlist Rules!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Allowlist Rules (Recommended)</span>
            </>
          )}
        </button>

        {/* Step 1b: Quick Dev Rules */}
        <button
          onClick={() => handleCopy('dev')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-amber-100/60 border border-amber-300 rounded-xl transition-colors"
        >
          {copiedType === 'dev' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copied Dev Rules!</span>
            </>
          ) : (
            <>
              <Code className="w-3.5 h-3.5 text-stone-600" />
              <span>Copy Quick Dev Rules (Any Auth User)</span>
            </>
          )}
        </button>

        {/* Step 2: Open Firebase Console Rules */}
        <a
          href="https://console.firebase.google.com/project/jaikrishna-industries/firestore/rules"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-xl transition-colors"
        >
          <span>Open Firebase Rules Editor</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Step 3: Retry Connection */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl shadow-2xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${retrying ? 'animate-spin' : ''}`} />
          <span>{retrying ? 'Reconnecting...' : 'Retry Connection'}</span>
        </button>

        {/* Toggle view code */}
        <button
          onClick={() => setShowFullRules((prev) => !prev)}
          className="text-xs font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2"
        >
          {showFullRules ? 'Hide Rules Code' : 'View Rules Code'}
        </button>
      </div>

      {showFullRules && (
        <div className="mt-4 p-3 bg-stone-900 text-stone-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 border border-stone-800">
          <pre>{RECOMMENDED_FIRESTORE_RULES}</pre>
        </div>
      )}
    </div>
  );
};
