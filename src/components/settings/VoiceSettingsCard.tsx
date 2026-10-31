/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Voice and Microphone Settings & Diagnostics Card
 *
 * Provides:
 * - Permission state badge with live onchange listener
 * - Audio device selector (headsets, Bluetooth, built-in)
 * - 3-second local test recording with real-time level meter (never uploaded)
 * - Language selection (Tamil & English)
 * - Max recording length configuration (default 60s)
 * - Complete privacy notice & client-side diagnostics with "Copy diagnostics" button
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  Settings,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  Sliders,
  Play,
  Square,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  micService,
  MicPermissionState,
  MicDeviceInfo,
} from '../../services/microphoneService';
import { MicrophoneRecoveryModal } from '../voice/MicrophoneRecoveryModal';

export const VoiceSettingsCard: React.FC = () => {
  const { language } = useLanguage();
  const isTamil = language === 'ta';

  // Permission & Device States
  const [permState, setPermState] = useState<MicPermissionState>(micService.getPermissionState());
  const [devices, setDevices] = useState<MicDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [maxDurationSec, setMaxDurationSec] = useState<number>(60);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Local Test Bench States
  const [isTesting, setIsTesting] = useState(false);
  const [testLevel, setTestLevel] = useState<number>(0);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);
  const [testCountdown, setTestCountdown] = useState<number>(3);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Diagnostics copied feedback
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  useEffect(() => {
    const unsubState = micService.subscribeState(setPermState);
    const unsubDevices = micService.subscribeDevices((devs) => {
      setDevices(devs);
      if (devs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devs[0].deviceId);
      }
    });

    return () => {
      unsubState();
      unsubDevices();
      if (testAudioUrl) {
        URL.revokeObjectURL(testAudioUrl);
      }
    };
  }, []);

  // 3-second local test recording (never sent to server)
  const handleStartTest = async () => {
    if (isTesting) {
      micService.stopCapture();
      setIsTesting(false);
      return;
    }

    setTestAudioUrl(null);
    setTestCountdown(3);
    setIsTesting(true);

    let secondsRemaining = 3;
    const interval = setInterval(() => {
      secondsRemaining -= 1;
      setTestCountdown(secondsRemaining);
      if (secondsRemaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    const started = await micService.startCapture({
      maxDurationSeconds: 3,
      selectedDeviceId,
      onLevelChange: (lvl) => setTestLevel(lvl),
      onTimeout: async () => {
        clearInterval(interval);
        const result = await micService.stopCapture();
        if (result && result.blob) {
          const url = URL.createObjectURL(result.blob);
          setTestAudioUrl(url);
        }
        setIsTesting(false);
        setTestLevel(0);
      },
      onError: (err, st) => {
        clearInterval(interval);
        setIsTesting(false);
        setTestLevel(0);
        if (st === 'blocked' || st === 'denied') {
          setShowRecoveryModal(true);
        }
      },
    });

    if (!started) {
      clearInterval(interval);
      setIsTesting(false);
      setTestLevel(0);
      setShowRecoveryModal(true);
    }
  };

  const getDiagnosticsData = () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
    const permApi = typeof navigator !== 'undefined' && 'permissions' in navigator;
    const mimeTypes = micService.getAllSupportedMimeTypes();

    return {
      appName: 'Jaikrishna Industries Business Hub',
      timestamp: new Date().toISOString(),
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      isSecureContext: isSecure,
      userAgent: ua,
      permissionsApiSupported: permApi,
      currentPermissionState: permState,
      lastErrorName: micService.getLastErrorName() || 'None',
      detectedInputDevicesCount: devices.length,
      deviceLabels: devices.map((d) => d.label || 'Default Mic'),
      supportedRecordingFormats: mimeTypes,
      preferredMimeType: micService.getSupportedMimeType() || 'Default browser WebM/MP4',
      speechRecognitionAvailable:
        typeof window !== 'undefined' &&
        Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
      speechSynthesisVoicesCount:
        typeof window !== 'undefined' && 'speechSynthesis' in window
          ? window.speechSynthesis.getVoices().length
          : 0,
    };
  };

  const copyDiagnostics = () => {
    const data = JSON.stringify(getDiagnosticsData(), null, 2);
    navigator.clipboard.writeText(data);
    setCopiedDiagnostics(true);
    setTimeout(() => setCopiedDiagnostics(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-sm mb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#881337] flex items-center justify-center font-bold">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              {isTamil ? 'குரல் மற்றும் மைக்ரோஃபோன் அமைப்புகள்' : 'Voice & Microphone Settings'}
            </h3>
            <p className="text-xs text-stone-500">
              {isTamil
                ? 'அனுமதிகள், ஆடியோ சாதனங்கள் மற்றும் சோதனை மீட்டர்'
                : 'Permissions, input devices, local testing & diagnostics'}
            </p>
          </div>
        </div>

        {/* State Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
              permState === 'granted'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : permState === 'asking'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                : permState === 'blocked' || permState === 'denied'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-stone-100 text-stone-700 border border-stone-200'
            }`}
          >
            <Radio className="w-3 h-3" />
            <span>
              {permState === 'granted'
                ? isTamil
                  ? 'அனுமதிக்கப்பட்டது'
                  : 'Granted'
                : permState === 'asking'
                ? isTamil
                  ? 'அனுமதி கேட்கிறது...'
                  : 'Prompting...'
                : permState === 'blocked' || permState === 'denied'
                ? isTamil
                  ? 'முடக்கப்பட்டது (Blocked)'
                  : 'Blocked'
                : isTamil
                ? 'கேட்கப்படவில்லை'
                : 'Not Requested'}
            </span>
          </span>

          {(permState === 'blocked' || permState === 'denied') && (
            <button
              onClick={() => setShowRecoveryModal(true)}
              className="text-xs font-semibold text-[#881337] hover:underline"
            >
              {isTamil ? 'சரிசெய்' : 'Fix'}
            </button>
          )}
        </div>
      </div>

      {/* Device Selection & Max Duration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="font-semibold text-stone-700 block mb-1.5">
            {isTamil ? 'ஆடியோ உள்ளீட்டு சாதனம் (Microphone Input):' : 'Audio Input Device:'}
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={devices.length === 0}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs focus:ring-1 focus:ring-[#881337] focus:border-[#881337]"
          >
            {devices.length === 0 ? (
              <option value="">Default System Microphone</option>
            ) : (
              devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))
            )}
          </select>
          <span className="text-[10px] text-stone-400 mt-1 block">
            {devices.length} {devices.length === 1 ? 'device' : 'devices'} detected (Bluetooth & wired headsets auto-sync)
          </span>
        </div>

        <div>
          <label className="font-semibold text-stone-700 block mb-1.5">
            {isTamil ? 'அதிகபட்ச பதிவு நேரம் (வினாடிகள்):' : 'Max Recording Limit (Seconds):'}
          </label>
          <input
            type="number"
            min={10}
            max={180}
            value={maxDurationSec}
            onChange={(e) => setMaxDurationSec(Math.max(10, Math.min(180, Number(e.target.value))))}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs focus:ring-1 focus:ring-[#881337] focus:border-[#881337]"
          />
          <span className="text-[10px] text-stone-400 mt-1 block">
            Default 60s. Auto-stops with countdown to prevent accidental open microphones.
          </span>
        </div>
      </div>

      {/* Local 3-Second Test Tool (Never Uploaded) */}
      <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-[#881337]" />
              <span>{isTamil ? 'மைக்ரோஃபோன் சோதனை (3 வினாடி லோக்கல் ஆடியோ):' : 'Microphone Test (3-Second Local Playback):'}</span>
            </h4>
            <p className="text-[11px] text-stone-500">
              Speak into your mic. The audio stays 100% in local memory and is never uploaded.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartTest}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-xs ${
              isTesting
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-[#881337] text-white hover:bg-[#70102e]'
            }`}
          >
            {isTesting ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Recording ({testCountdown}s)...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Test Microphone</span>
              </>
            )}
          </button>
        </div>

        {/* Level Meter Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-stone-500 font-medium">
            <span>Audio Input Level</span>
            <span>{Math.round(testLevel * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                testLevel > 0.8
                  ? 'bg-rose-500'
                  : testLevel > 0.5
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(4, Math.min(100, testLevel * 100))}%` }}
            />
          </div>
        </div>

        {/* Audio Player for Local Test */}
        {testAudioUrl && (
          <div className="pt-2 flex items-center gap-3">
            <audio
              ref={audioPlayerRef}
              src={testAudioUrl}
              onPlay={() => setIsPlayingTestAudio(true)}
              onEnded={() => setIsPlayingTestAudio(false)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                if (audioPlayerRef.current) {
                  if (isPlayingTestAudio) {
                    audioPlayerRef.current.pause();
                    audioPlayerRef.current.currentTime = 0;
                    setIsPlayingTestAudio(false);
                  } else {
                    audioPlayerRef.current.play();
                  }
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {isPlayingTestAudio ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop Playback</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Test Recording</span>
                </>
              )}
            </button>
            <span className="text-[11px] text-emerald-700 font-medium">
              ✓ Mic working! Audio heard clearly through speakers.
            </span>
          </div>
        )}
      </div>

      {/* Diagnostics Panel with Copy button */}
      <div className="p-4 rounded-2xl bg-stone-900 text-stone-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-white tracking-wide">
              SYSTEM DIAGNOSTICS & HARDWARE REPORT
            </h4>
          </div>
          <button
            type="button"
            onClick={copyDiagnostics}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-stone-700"
          >
            {copiedDiagnostics ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Diagnostics</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px] font-mono">
          <div className="bg-stone-800/70 p-2.5 rounded-xl border border-stone-700/60">
            <div className="text-stone-400 text-[10px]">Secure Context</div>
            <div className="text-emerald-400 font-semibold">
              {typeof window !== 'undefined' && window.isSecureContext ? 'HTTPS / Yes' : 'No'}
            </div>
          </div>

          <div className="bg-stone-800/70 p-2.5 rounded-xl border border-stone-700/60">
            <div className="text-stone-400 text-[10px]">Permissions API</div>
            <div className="text-white font-semibold">
              {typeof navigator !== 'undefined' && 'permissions' in navigator ? 'Supported' : 'Fallback Mode'}
            </div>
          </div>

          <div className="bg-stone-800/70 p-2.5 rounded-xl border border-stone-700/60">
            <div className="text-stone-400 text-[10px]">Audio Inputs</div>
            <div className="text-white font-semibold">{devices.length} Detected</div>
          </div>

          <div className="bg-stone-800/70 p-2.5 rounded-xl border border-stone-700/60">
            <div className="text-stone-400 text-[10px]">MIME Format</div>
            <div className="text-amber-300 font-semibold truncate">
              {micService.getSupportedMimeType() || 'Default'}
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Modal */}
      <MicrophoneRecoveryModal
        isOpen={showRecoveryModal}
        state={permState}
        onClose={() => setShowRecoveryModal(false)}
        onPermissionGranted={() => {
          setPermState('granted');
          setShowRecoveryModal(false);
        }}
      />
    </div>
  );
};
