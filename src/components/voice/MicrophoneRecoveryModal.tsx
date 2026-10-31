/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Microphone Recovery Guidance Dialog
 * 
 * Platform-detected step-by-step instructions for:
 * - Desktop Chrome / Edge (lock/tune icon)
 * - Android Chrome (site settings & OS App Permission)
 * - iPhone Safari & Installed Home Screen PWA (iOS Settings)
 * - Firefox / Samsung Internet
 * Plus real-time "Check again" verification without requiring page reload.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Smartphone,
  Monitor,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { micService, MicPermissionState } from '../../services/microphoneService';

interface MicrophoneRecoveryModalProps {
  isOpen: boolean;
  state: MicPermissionState;
  onClose: () => void;
  onPermissionGranted: () => void;
}

export const MicrophoneRecoveryModal: React.FC<MicrophoneRecoveryModalProps> = ({
  isOpen,
  state,
  onClose,
  onPermissionGranted,
}) => {
  const { language } = useLanguage();
  const isTamil = language === 'ta';
  const [checking, setChecking] = useState(false);
  const [recheckFeedback, setRecheckFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  // Platform detection
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg|OPR/.test(ua);
  const isEdge = /Edg/.test(ua);

  const handleCheckAgain = async () => {
    setChecking(true);
    setRecheckFeedback(null);
    try {
      const ok = await micService.requestPermission();
      if (ok) {
        setRecheckFeedback(isTamil ? 'அனுமதி வழங்கப்பட்டது!' : 'Permission granted successfully!');
        setTimeout(() => {
          onPermissionGranted();
          onClose();
        }, 800);
      } else {
        const newState = micService.getPermissionState();
        if (newState === 'denied' || newState === 'blocked') {
          setRecheckFeedback(
            isTamil
              ? 'இன்னும் அனுமதிக்கப்படவில்லை. தயவுசெய்து கீழே உள்ள படிகளைப் பின்பற்றி அனுமதிக்கவும்.'
              : 'Still blocked. Please follow the platform steps below and allow microphone in settings.'
          );
        } else {
          setRecheckFeedback(`State: ${newState}`);
        }
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900">
              {isTamil ? 'மைக்ரோஃபோன் அணுகல் முடக்கப்பட்டுள்ளது' : 'Microphone Access Blocked'}
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              {isTamil
                ? 'உங்கள் உலாவியில் மைக்ரோஃபோன் அனுமதியை எவ்வாறு அனுமதிப்பது:'
                : 'How to re-enable microphone access on your device:'}
            </p>
          </div>
        </div>

        {/* Feedback Alert if test ran */}
        {recheckFeedback && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{recheckFeedback}</span>
          </div>
        )}

        {/* Platform Step-by-Step Instructions */}
        <div className="space-y-4 mb-5 text-xs text-stone-700">
          {/* iOS / iPhone Safari / Home Screen PWA */}
          {isIos && (
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <Smartphone className="w-4 h-4 text-[#881337]" />
                <span>iPhone / iPad (Safari & Installed Home Screen App)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-stone-600">
                <li>Open iPhone <strong>Settings (அமைப்புகள்)</strong>.</li>
                <li>Scroll down and tap <strong>Safari</strong> (or find this web app).</li>
                <li>Under <em>Settings for Websites</em>, tap <strong>Microphone</strong>.</li>
                <li>Select <strong>Allow</strong> or <strong>Ask</strong>.</li>
                <li>Return to this app and tap <strong>"Check again"</strong> below.</li>
              </ol>
            </div>
          )}

          {/* Android Chrome & Installed PWA */}
          {isAndroid && (
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <Smartphone className="w-4 h-4 text-[#881337]" />
                <span>Android Chrome & Installed App</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-stone-600">
                <li>Tap the <strong>tune / lock icon 🔒</strong> in Chrome's address bar (or 3-dot menu → <em>Settings → Site settings</em>).</li>
                <li>Tap <strong>Microphone</strong> and toggle it to <strong>Allow</strong>.</li>
                <li>If still blocked: Open phone <strong>Settings → Apps → Chrome → Permissions → Microphone</strong> and choose <strong>"Allow only while using the app"</strong>.</li>
                <li>Tap <strong>"Check again"</strong> below.</li>
              </ol>
            </div>
          )}

          {/* Desktop Chrome / Edge */}
          {!isIos && !isAndroid && (
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <Monitor className="w-4 h-4 text-[#881337]" />
                <span>Desktop Google Chrome & Microsoft Edge</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-stone-600">
                <li>Look at the top-left of your address bar (next to <code>jaikrishnabizzhub.in</code>).</li>
                <li>Click the <strong>tune / lock icon 🔒</strong> (Site information).</li>
                <li>Next to <strong>Microphone</strong>, change the toggle from <em>Block</em> to <strong>Allow</strong>.</li>
                <li>Click <strong>"Check again"</strong> below (or press Ctrl+F5 to reload).</li>
              </ol>
            </div>
          )}

          {/* Windows / Mac OS Level Privacy check */}
          <div className="p-3 rounded-xl bg-stone-100/70 border border-stone-200 text-[11px] text-stone-500">
            <strong>OS Privacy Reminder:</strong> If browser permission is allowed but mic still does not work, verify that your computer or phone's main OS settings (e.g. <em>Windows Settings → Privacy & Security → Microphone</em>) has "Allow desktop apps to access your microphone" turned ON.
          </div>
        </div>

        {/* Tamil Proofreading tag */}
        {isTamil && (
          <div className="text-[10px] text-stone-400 italic mb-4">
            * தமிழ் உரை உரிமையாளரால் சரிபார்க்கப்பட வேண்டியுள்ளது (needs proofreading by owner)
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 justify-end pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
          >
            {isTamil ? 'மூடு (Close)' : 'Close'}
          </button>
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckAgain}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#881337] text-white hover:bg-[#70102e] shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{isTamil ? 'மீண்டும் சரிபார்' : 'Check again'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
