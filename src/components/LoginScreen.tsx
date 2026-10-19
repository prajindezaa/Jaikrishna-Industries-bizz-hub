/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  Globe,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const LoginScreen: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerEmailMember,
    loading,
    error,
    clearError,
  } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'google' | 'email_login' | 'email_register'>('google');
  const [submitting, setSubmitting] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyDomain = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.hostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (mode === 'email_register') {
        await registerEmailMember(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isUnauthorizedDomain =
    error === 'AUTH_UNAUTHORIZED_DOMAIN' || (error && error.includes('auth/unauthorized-domain'));

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-200">
      {/* Language Toggle in Top-Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-full shadow-xs transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-amber-700" />
          <span>{language === 'en' ? 'தமிழ் (Tamil)' : 'English'}</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Lockup */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#881337] via-[#701A24] to-[#4C0519] shadow-md border border-amber-300/40 p-2">
            <img src="/icon.svg" alt="Jaikrishna Industries Diya" className="w-full h-full object-contain" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-stone-900 font-display">
            {t('brandName', 'Jaikrishna Industries')}
          </h2>
          <p className="mt-1 text-xs text-stone-600 font-medium tracking-wide">
            {t('brandTagline', 'Pooja Products Manufacturing & Business Hub')}
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-white py-8 px-6 shadow-xl shadow-stone-200/50 sm:rounded-2xl border border-stone-200/80 sm:px-10">
          {/* Strict Allowlist Notice */}
          <div className="mb-6 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold">Private Team Portal:</strong> Restricted exclusively to the 3
              authorized Jaikrishna Industries member accounts (Owner, Admin, and Sales Manager).
            </div>
          </div>

          {/* Special Resolution Card for auth/unauthorized-domain */}
          {isUnauthorizedDomain && (
            <div className="mb-6 p-4 bg-amber-50/95 border-2 border-amber-400 rounded-xl space-y-3.5 text-xs text-amber-950 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 font-display tracking-tight">
                    Quick 1-Minute Step: Add Authorized Domain to Firebase
                  </h4>
                  <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                    Firebase blocked Google Sign-in because this app URL hasn't been added to your authorized domains list yet.
                  </p>
                </div>
              </div>

              {/* Hostname with copy button */}
              <div className="bg-white p-2.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                <span className="font-mono text-[11px] text-stone-800 truncate select-all">
                  {currentHostname}
                </span>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="px-2.5 py-1 text-[11px] font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors shrink-0 inline-flex items-center gap-1"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-800" />}
                  <span>{copiedDomain ? 'Copied!' : 'Copy Domain'}</span>
                </button>
              </div>

              {/* Steps */}
              <div className="space-y-1.5 text-[11px] text-amber-900/90 pl-1 leading-normal">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <span>Click the button below to open <strong>Authentication &gt; Settings &gt; Authorized domains</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <span>Click <strong>Add domain</strong>, paste the domain above, and click <strong>Done</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <span>Return here and click <strong>Try Google Sign-In Again</strong>!</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href="https://console.firebase.google.com/project/jaikrishna-industries/authentication/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 text-center text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <span>Open Firebase Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  disabled={loading}
                  className="py-2 px-3 text-center text-xs font-semibold text-amber-950 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors inline-flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try Again</span>
                </button>
              </div>

              {/* Instant Alternative: Email Password */}
              <div className="pt-2 border-t border-amber-200/60 text-center">
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setMode('email_register');
                  }}
                  className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950"
                >
                  Or enter a password to sign in immediately without Google OAuth &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Standard Error Banner (if not unauthorized domain) */}
          {error && !isUnauthorizedDomain && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="block mt-1.5 text-[11px] font-semibold text-rose-900 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Google Sign-in View */}
          {mode === 'google' && (
            <div className="space-y-4">
              <button
                onClick={() => signInWithGoogle()}
                disabled={loading || submitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-stone-500 font-mono">or email password</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setEmail('');
                    setPassword('');
                    setMode('email_login');
                  }}
                  className="py-2 px-3 text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-center transition-colors"
                >
                  Sign In with Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setEmail('');
                    setPassword('');
                    setMode('email_register');
                  }}
                  className="py-2 px-3 text-xs font-semibold text-[#881337] bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-center transition-colors"
                >
                  Set Member Password
                </button>
              </div>
            </div>
          )}

          {/* Email Login / Set Password View */}
          {mode !== 'google' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-800">
                  {mode === 'email_register' ? 'Set / Register Password' : 'Email & Password Login'}
                </span>
                <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                  Allowlist Checked
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Team Member Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs text-stone-900 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                  />
                </div>
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Must be an authorized Jaikrishna team member email.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {mode === 'email_register' ? 'Choose Password (min 6 chars)' : 'Password'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs text-stone-900 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setMode('google');
                  }}
                  className="text-xs text-stone-500 hover:text-stone-700"
                >
                  &larr; Back to Google
                </button>
                <button
                  type="submit"
                  disabled={loading || submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#881337] hover:bg-[#701A24] rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <span>{mode === 'email_register' ? 'Set Password & Enter' : 'Sign In'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-2 text-center">
                {mode === 'email_login' ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      setEmail('');
                      setPassword('');
                      setMode('email_register');
                    }}
                    className="text-[11px] text-[#881337] hover:underline"
                  >
                    Haven't set a password yet? Click here to set one &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      setEmail('');
                      setPassword('');
                      setMode('email_login');
                    }}
                    className="text-[11px] text-stone-600 hover:underline"
                  >
                    Already have a password? Sign In &rarr;
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
