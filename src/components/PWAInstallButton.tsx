/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';

export const PWAInstallButton: React.FC<{ variant?: 'sidebar' | 'header' | 'minimal' }> = ({
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { t } = useLanguage();

  if (isInstalled) return null;
  if (!isInstallable && !isIOS) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' && (
        <button
          onClick={handleClick}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-amber-900 bg-gradient-to-r from-amber-100 to-amber-200 hover:from-amber-200 hover:to-amber-300 rounded-lg transition-colors border border-amber-300 shadow-xs"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t('installApp', 'Install App')}</span>
        </button>
      )}

      {variant === 'header' && (
        <button
          onClick={handleClick}
          type="button"
          title="Install Jaikrishna Industries PWA"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('installApp', 'Install App')}</span>
        </button>
      )}

      {variant === 'minimal' && (
        <button
          onClick={handleClick}
          type="button"
          title="Install PWA"
          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md"
        >
          <Download className="w-4 h-4" />
        </button>
      )}

      {/* iOS Safari Guided Walkthrough Modal */}
      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-base font-semibold text-stone-900">Install on iPhone / iPad</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-stone-700">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
                  1
                </div>
                <div className="flex-1 pt-0.5">
                  Tap the <Share2 className="inline w-4 h-4 text-sky-600 mx-0.5 align-text-bottom" /> <strong>Share</strong> button in Safari toolbar.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
                  2
                </div>
                <div className="flex-1 pt-0.5">
                  Scroll down and tap <PlusSquare className="inline w-4 h-4 text-stone-800 mx-0.5 align-text-bottom" /> <strong>Add to Home Screen</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
                  3
                </div>
                <div className="flex-1 pt-0.5">
                  Tap <strong>Add</strong> in the top-right corner to launch Jaikrishna Hub as a full app!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full rounded-lg bg-stone-900 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
