/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Microphone Educational Explanation Modal
 * 
 * First-use onboarding sheet:
 * - Why the mic is needed
 * - What is recorded (audio in memory, discarded immediately)
 * - Who processes it (Google Gemini paid tier, no ad training)
 * - When it is on (visual badge, never silent)
 * - How to turn it off (toggle button or Settings kill switch)
 * - "Allow microphone" and "Not now" (with 7-day snooze)
 */

import React from 'react';
import { Mic, ShieldCheck, Clock, X, Lock, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface MicrophoneExplanationModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}

export const MicrophoneExplanationModal: React.FC<MicrophoneExplanationModalProps> = ({
  isOpen,
  onAllow,
  onNotNow,
}) => {
  const { language } = useLanguage();
  const isTamil = language === 'ta';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 relative animate-in zoom-in-95">
        {/* Close / Not Now */}
        <button
          onClick={onNotNow}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
          title="Close / Not Now"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-[#881337] flex items-center justify-center shrink-0 shadow-xs border border-rose-100">
            <Mic className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 leading-snug">
              {isTamil
                ? 'மைக்ரோஃபோன் அனுமதி விளக்கம்'
                : 'Microphone Permission & Privacy'}
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              {isTamil
                ? 'ஜெய்கிருஷ்ணா தொழில் உதவியாளருக்கு குரல் உள்ளீடு'
                : 'Voice commands for Jaikrishna Business Assistant'}
            </p>
          </div>
        </div>

        {/* Value Points */}
        <div className="space-y-3 mb-5 text-xs text-stone-700">
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900">
                {isTamil ? 'ஏன் தேவைப்படுகிறது:' : 'Why it is needed:'}
              </strong>{' '}
              {isTamil
                ? 'தமிழ் அல்லது ஆங்கிலத்தில் ஆர்டர்கள், வாடிக்கையாளர் குறிப்புகள் மற்றும் ஃபாலோ-அப்களை தட்டச்சு செய்யாமல் பேச.'
                : 'To speak customer notes, schedule follow-ups, and log tasks in Tamil or English without typing.'}
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900">
                {isTamil ? 'பதிவு சேமிப்பு கொள்கை:' : 'Zero permanent storage:'}
              </strong>{' '}
              {isTamil
                ? 'உங்கள் குரல் சாதனத்திலோ அல்லது சர்வரிலோ சேமிக்கப்படாது. உரை மாற்றியவுடன் நினைவகத்திலிருந்து அழிக்கப்படும்.'
                : 'Audio is never stored permanently on device or server. Recordings in memory are discarded immediately after transcription.'}
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900">
                {isTamil ? 'யார் செயலாக்குகிறார்கள்:' : 'Who processes it:'}
              </strong>{' '}
              {isTamil
                ? 'பாதுகாப்பான Google Gemini API (கார்ப்பரேட் கட்டண அடுக்கு). உங்கள் ஆடியோ பயிற்சிக்கு பயன்படுத்தப்படாது.'
                : 'Google Gemini secure API enterprise tier. Your voice data is not used for model training or advertising.'}
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-stone-900">
                {isTamil ? 'எப்போது இயங்கும்:' : 'When it is active:'}
              </strong>{' '}
              {isTamil
                ? 'நீங்கள் மைக் பட்டனை தட்டும்போது மட்டுமே. அதிகபட்சம் 60 வினாடிகள். அமைப்புகளில் எப்போது வேண்டுமானாலும் முடக்கலாம்.'
                : 'Only while you tap the microphone button (max 60 seconds). Visual indicator is always shown, and you can disable voice in Settings anytime.'}
            </div>
          </div>
        </div>

        {/* Tamil Proofreading notice tag */}
        {isTamil && (
          <div className="text-[10px] text-stone-400 italic mb-4">
            * தமிழ் உரை உரிமையாளரால் சரிபார்க்கப்பட வேண்டியுள்ளது (needs proofreading by owner)
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 justify-end pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onNotNow}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
          >
            {isTamil ? 'இப்போது வேண்டாம் (Not now)' : 'Not now'}
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#881337] text-white hover:bg-[#70102e] shadow-sm transition-all flex items-center gap-2"
          >
            <Mic className="w-4 h-4" />
            <span>{isTamil ? 'மைக்ரோஃபோனை அனுமதி' : 'Allow microphone'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
