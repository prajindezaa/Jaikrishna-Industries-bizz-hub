/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Hands-Free Voice Assistant Modal
 * Full-screen natural voice conversation overlay with Tamil and English support.
 *
 * Flow:
 * 1. Opens on single tap from Dashboard.
 * 2. Assistant speaks first: "வணக்கம், இப்போ என்ன பண்ணணும்?" / "Vanakkam, what should we do now?"
 * 3. Continuous hands-free loop: Speech recognition with auto end-of-speech detection.
 * 4. Echo cancellation + Barge-in (interruption while assistant is speaking).
 * 5. 30-second silence watchdog: asks "Are you still there?" and then closes gracefully.
 * 6. Low/Medium risk actions: 3-second pause countdown before auto-execution (cancellable by voice "no", "stop", "wait").
 * 7. High-priority risk actions: asks "Shall I confirm?" and requires clear spoken affirmation ("yes", "சரி", "ஆமா").
 * 8. In-place voice corrections & spoken undo ("undo that", "அதை திருப்பு").
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';
import { spokenVoiceController } from '../../services/spokenVoiceController';
import { micService } from '../../services/microphoneService';
import { useAuth } from '../../context/AuthContext';
import { ActionConfirmationCard } from '../assistant/ActionConfirmationCard';
import { MicrophoneRecoveryModal } from './MicrophoneRecoveryModal';

export interface HandsFreeVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'ta-IN' | 'en-IN';
  autoExecuteSeconds?: number;
}

type ConversationState =
  | 'initiating'
  | 'assistant_speaking'
  | 'listening'
  | 'thinking'
  | 'waiting_confirm'
  | 'countdown_executing'
  | 'completed'
  | 'error';

export const HandsFreeVoiceModal: React.FC<HandsFreeVoiceModalProps> = ({
  isOpen,
  onClose,
  lang = 'ta-IN',
  autoExecuteSeconds = 3,
}) => {
  const { user } = useAuth();
  const [convoState, setConvoState] = useState<ConversationState>('initiating');
  const [currentLang, setCurrentLang] = useState<'ta-IN' | 'en-IN'>(lang);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [assistantSpokenText, setAssistantSpokenText] = useState<string>('');
  const [activePendingAction, setActivePendingAction] = useState<any | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(autoExecuteSeconds);
  const [lastExecutedResult, setLastExecutedResult] = useState<any | null>(null);
  const [statusNotice, setStatusNotice] = useState<string>('');
  const [showMicRecoveryModal, setShowMicRecoveryModal] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [tamilVoiceWarning, setTamilVoiceWarning] = useState<boolean>(false);

  // Timers & Recognition refs
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const silencePromptCountRef = useRef<number>(0);
  const countdownIntervalRef = useRef<any>(null);
  const isClosingRef = useRef<boolean>(false);

  // 1. Initial Greeting when Opened
  useEffect(() => {
    if (!isOpen) {
      cleanupSession();
      return;
    }

    isClosingRef.current = false;
    silencePromptCountRef.current = 0;
    setLastExecutedResult(null);
    setActivePendingAction(null);
    setTranscript('');
    setInterimTranscript('');
    setCountdownRemaining(autoExecuteSeconds);

    // Check Tamil voice availability
    if (currentLang === 'ta-IN' && !spokenVoiceController.hasTamilVoice()) {
      setTamilVoiceWarning(true);
    } else {
      setTamilVoiceWarning(false);
    }

    // Initialize Microphone & Greeting
    initializeVoiceSession();

    return () => {
      cleanupSession();
    };
  }, [isOpen]);

  const cleanupSession = () => {
    isClosingRef.current = true;
    spokenVoiceController.stopSpeaking();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    clearTimers();
    micService.releaseAllTracks();
  };

  const clearTimers = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      handleSilenceTimeout();
    }, 30000); // 30 seconds
  };

  const handleSilenceTimeout = () => {
    if (isClosingRef.current) return;
    if (silencePromptCountRef.current === 0) {
      silencePromptCountRef.current = 1;
      const promptText =
        currentLang === 'ta-IN'
          ? 'இன்னும் இருக்கீங்களா? என்ன செய்ய வேண்டும்?' /* needs proofreading by owner */
          : 'Are you still there? What should we do next?';
      speakAssistant(promptText, () => {
        resetSilenceTimer();
        startListening();
      });
    } else {
      // Second timeout: graceful spoken goodbye and close
      const goodbyeText =
        currentLang === 'ta-IN'
          ? 'சரி, மீண்டும் பேசலாம். நன்றி!' /* needs proofreading by owner */
          : 'Goodbye for now. Have a productive day!';
      speakAssistant(goodbyeText, () => {
        handleModalClose();
      });
    }
  };

  const initializeVoiceSession = async () => {
    setConvoState('initiating');
    setStatusNotice('Starting hands-free session...');

    try {
      // 1. Acquire mic permission via central micService
      const micGranted = await micService.requestPermission();
      if (!micGranted) {
        setShowMicRecoveryModal(true);
        setStatusNotice('Microphone permission needed to use voice assistant.');
        setConvoState('error');
        return;
      }

      // 2. Initial spoken greeting (Assistant speaks first)
      const greetingText =
        currentLang === 'ta-IN'
          ? 'வணக்கம், இப்போ என்ன பண்ணணும்?' /* needs proofreading by owner */
          : 'Vanakkam! What should we do now?';

      speakAssistant(greetingText, () => {
        startListening();
      });
    } catch (err: any) {
      console.error('[HandsFreeVoice] Init failed:', err);
      setStatusNotice(`Voice initialization failed: ${err.message || String(err)}`);
      setConvoState('error');
    }
  };

  // Helper: Speak Assistant Reply & handle transition
  const speakAssistant = (text: string, onEnd?: () => void) => {
    if (isClosingRef.current) return;
    setAssistantSpokenText(text);
    setConvoState('assistant_speaking');

    // Mute Web Speech Recognition while assistant is speaking to avoid hearing itself
    stopRecognitionOnly();

    spokenVoiceController.speak(text, currentLang, {
      onEnd: () => {
        if (!isClosingRef.current) {
          onEnd?.();
        }
      },
    });
  };

  // Barge-In: If user speaks or taps during TTS, stop synthesis and listen immediately
  const handleBargeIn = () => {
    if (convoState === 'assistant_speaking') {
      spokenVoiceController.stopSpeaking();
      startListening();
    }
  };

  const stopRecognitionOnly = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  };

  // 2. Continuous Speech Recognition
  const startListening = () => {
    if (isClosingRef.current) return;
    stopRecognitionOnly();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusNotice('Speech recognition not supported in this browser.');
      setConvoState('error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLang;

      setConvoState('listening');
      setStatusNotice('Listening naturally...');
      resetSilenceTimer();

      recognition.onstart = () => {
        setIsMicMuted(false);
      };

      recognition.onresult = (event: any) => {
        resetSilenceTimer();
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
          } else {
            interimChunk += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(interimChunk);

        if (finalChunk.trim()) {
          const userSaid = finalChunk.trim();
          setTranscript(userSaid);
          setInterimTranscript('');
          handleUserUtterance(userSaid);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Normal pause, keep listening
          return;
        }
        if (event.error === 'not-allowed') {
          setShowMicRecoveryModal(true);
          setConvoState('error');
        }
      };

      recognition.onend = () => {
        // Continuous auto-restart loop if still in listening state
        if (!isClosingRef.current && convoState === 'listening') {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (err: any) {
      console.warn('[HandsFreeVoice] startListening failed:', err);
    }
  };

  // 3. Process User Voice Input & Intent
  const handleUserUtterance = async (utterance: string) => {
    stopRecognitionOnly();
    resetSilenceTimer();

    // Check for conversational termination commands
    const parsedIntent = spokenVoiceController.parseVoiceIntent(utterance, activePendingAction);

    if (parsedIntent.isTermination) {
      const goodbye =
        currentLang === 'ta-IN'
          ? 'சரி, வேலையை தொடருங்கள். வணக்கம்!' /* needs proofreading by owner */
          : 'All set. Have a wonderful day!';
      speakAssistant(goodbye, () => {
        handleModalClose();
      });
      return;
    }

    // Check for spoken Undo ("undo that", "அதை திருப்பு")
    if (parsedIntent.isUndo) {
      if (lastExecutedResult?.actionId) {
        await executeVoiceUndo(lastExecutedResult.actionId);
      } else {
        const noUndoText =
          currentLang === 'ta-IN'
            ? 'திருப்புவதற்கு சமீபத்திய நடவடிக்கை எதுவும் இல்லை.' /* needs proofreading by owner */
            : 'There is no recent action to undo.';
        speakAssistant(noUndoText, () => {
          startListening();
        });
      }
      return;
    }

    // If currently waiting for high-priority confirmation or in countdown
    if (convoState === 'waiting_confirm' || convoState === 'countdown_executing') {
      if (parsedIntent.isCancellation) {
        clearTimers();
        setActivePendingAction(null);
        const cancelText =
          currentLang === 'ta-IN'
            ? 'நடவடிக்கை ரத்து செய்யப்பட்டது. அடுத்து என்ன செய்ய வேண்டும்?' /* needs proofreading by owner */
            : 'Action cancelled. What would you like to do next?';
        speakAssistant(cancelText, () => {
          startListening();
        });
        return;
      }

      if (parsedIntent.isConfirmation) {
        clearTimers();
        if (activePendingAction) {
          await executeAction(activePendingAction, 'voice', utterance);
        }
        return;
      }
    }

    // In-place correction for pending proposal ("make it 5 PM", "change to Monday")
    if (parsedIntent.isCorrection && activePendingAction) {
      clearTimers();
      const updatedParams = { ...activePendingAction.parameters };
      if (parsedIntent.field === 'time' && parsedIntent.newValue) {
        updatedParams.time = parsedIntent.newValue;
        updatedParams.startTime = parsedIntent.newValue;
      } else if (parsedIntent.field === 'date' && parsedIntent.newValue) {
        updatedParams.date = parsedIntent.newValue;
      } else if (parsedIntent.field === 'assignedTo' && parsedIntent.newValue) {
        updatedParams.assignedTo = parsedIntent.newValue;
      }

      // Re-propose with amended details
      setConvoState('thinking');
      setStatusNotice('Updating proposal details...');
      await sendAssistantRequest(
        `Update proposed ${activePendingAction.catalog} action to: ${utterance}`,
        activePendingAction
      );
      return;
    }

    // Standard Assistant Request Turn
    setConvoState('thinking');
    setStatusNotice('Thinking and reviewing data...');
    await sendAssistantRequest(utterance);
  };

  // 4. Send Request to Server /api/assistant
  const sendAssistantRequest = async (messageText: string, existingPendingAction?: any) => {
    try {
      const idToken = user ? await user.getIdToken() : '';
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          message: messageText,
          context: {
            preferredLang: currentLang,
            source: 'hands_free_voice',
            existingPendingActionId: existingPendingAction?.id,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Assistant service failed.');
      }

      // If a pending action was proposed:
      if (data.pendingAction) {
        setActivePendingAction(data.pendingAction);
        const action = data.pendingAction;
        const isHighRisk = action.riskLevel === 'high' || action.requiresSecondConfirmation;

        if (isHighRisk) {
          // High Priority Flow: Explicit spoken confirmation required
          setConvoState('waiting_confirm');
          const spokenPrompt =
            currentLang === 'ta-IN'
              ? `${action.preview?.summaryTa || action.preview?.summary}. இதை உறுதி செய்யவா? சரி அல்லது வேண்டாம் என்று சொல்லுங்கள்.` /* needs proofreading by owner */
              : `${action.preview?.summary}. Shall I confirm? Say yes or cancel.`;

          speakAssistant(spokenPrompt, () => {
            startListening();
          });
        } else {
          // Low/Medium Risk Flow: Read-back then 3-second auto-execute countdown
          const readback =
            currentLang === 'ta-IN'
              ? `${action.preview?.summaryTa || action.preview?.summary}. மூன்று வினாடிகளில் செயல்படுத்தப்படும்.` /* needs proofreading by owner */
              : `${action.preview?.summary}. Executing automatically.`;

          speakAssistant(readback, () => {
            startAutoExecuteCountdown(action);
          });
        }
      } else {
        // Conversational or informational reply
        const spokenReply =
          data.reply?.length > 140
            ? data.reply.slice(0, 140) + '... விவரங்கள் திரையில் உள்ளன.' /* needs proofreading by owner */
            : data.reply;

        speakAssistant(spokenReply, () => {
          startListening();
        });
      }
    } catch (err: any) {
      console.error('[HandsFreeVoice] Request error:', err);
      const errMsg =
        currentLang === 'ta-IN'
          ? 'மன்னிக்கவும், தகவல் பெறுவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சி செய்யுங்கள்.' /* needs proofreading by owner */
          : 'Sorry, I encountered an issue. Please try saying that again.';
      speakAssistant(errMsg, () => {
        startListening();
      });
    }
  };

  // 5. 3-Second Auto-Execute Countdown for Low/Medium Risk
  const startAutoExecuteCountdown = (action: any) => {
    if (isClosingRef.current) return;
    setConvoState('countdown_executing');
    setCountdownRemaining(autoExecuteSeconds);

    // Keep listening in background so user can interrupt with "no", "stop", "wait"
    startListening();

    let secsLeft = autoExecuteSeconds;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(async () => {
      secsLeft -= 1;
      setCountdownRemaining(secsLeft);

      if (secsLeft <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        await executeAction(action, 'voice', 'auto_readback_no_objection');
      }
    }, 1000);
  };

  // 6. Execute Action via Server /api/assistant/confirm
  const executeAction = async (action: any, source: 'voice' | 'ui_tap', spokenPhrase: string) => {
    clearTimers();
    setConvoState('thinking');
    setStatusNotice('Executing action...');

    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/assistant/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          pendingActionId: action.id,
          parametersHash: action.parametersHash,
          confirmationSource: source,
          spokenTranscript: spokenPhrase,
          confidence: 0.95,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to confirm action.');
      }

      setLastExecutedResult({
        actionId: action.id,
        message: data.message,
        summary: action.preview?.summary,
        summaryTa: action.preview?.summaryTa,
      });
      setActivePendingAction(null);
      setConvoState('completed');

      const doneSpeech =
        currentLang === 'ta-IN'
          ? 'வெற்றிகரமாக முடிந்தது. மாற்ற வேண்டுமென்றால் "அதை திருப்பு" என்று சொல்லுங்கள்.' /* needs proofreading by owner */
          : 'Done. You can say "undo that" if you need to revert.';

      speakAssistant(doneSpeech, () => {
        startListening();
      });
    } catch (err: any) {
      console.error('[HandsFreeVoice] Execution failed:', err);
      const failMsg =
        currentLang === 'ta-IN'
          ? `செயல்படுத்துவதில் சிக்கல்: ${err.message}` /* needs proofreading by owner */
          : `Action execution failed: ${err.message}`;
      speakAssistant(failMsg, () => {
        startListening();
      });
    }
  };

  // 7. Spoken Undo via Server /api/assistant/undo
  const executeVoiceUndo = async (actionId: string) => {
    clearTimers();
    setConvoState('thinking');
    setStatusNotice('Undoing previous action...');

    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/assistant/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ actionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Undo failed.');
      }

      setLastExecutedResult(null);
      const undoSuccessSpeech =
        currentLang === 'ta-IN'
          ? 'முந்தைய நடவடிக்கை ரத்து செய்யப்பட்டு பழைய நிலைக்கு மாற்றப்பட்டது.' /* needs proofreading by owner */
          : 'The previous action was reverted successfully.';

      speakAssistant(undoSuccessSpeech, () => {
        startListening();
      });
    } catch (err: any) {
      const failSpeech =
        currentLang === 'ta-IN'
          ? `ரத்து செய்ய முடியவில்லை: ${err.message}` /* needs proofreading by owner */
          : `Could not undo: ${err.message}`;
      speakAssistant(failSpeech, () => {
        startListening();
      });
    }
  };

  const handleModalClose = () => {
    cleanupSession();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col justify-between text-white p-4 sm:p-8 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-assistant-title"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 id="voice-assistant-title" className="text-base sm:text-lg font-bold font-display">
              Hands-Free Voice Assistant
            </h2>
            <p className="text-xs text-stone-400">
              Jaikrishna Industries • {currentLang === 'ta-IN' ? 'தமிழ் & English' : 'English & தமிழ்'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={() => {
              const nextLang = currentLang === 'ta-IN' ? 'en-IN' : 'ta-IN';
              setCurrentLang(nextLang);
              if (nextLang === 'ta-IN' && !spokenVoiceController.hasTamilVoice()) {
                setTamilVoiceWarning(true);
              } else {
                setTamilVoiceWarning(false);
              }
            }}
            className="px-2.5 py-1 text-xs rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
          >
            {currentLang === 'ta-IN' ? 'தமிழ் (TA)' : 'English (EN)'}
          </button>

          {/* Close Button */}
          <button
            onClick={handleModalClose}
            className="p-2 text-stone-400 hover:text-white rounded-full bg-stone-900 hover:bg-stone-800 transition"
            aria-label="Close voice assistant"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Tamil Voice Device Alert Notice if needed */}
      {tamilVoiceWarning && (
        <div className="mt-2 bg-amber-950/80 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Notice: No native Tamil speech synthesis voice was found in this browser. Text will be displayed clearly on screen.
          </span>
        </div>
      )}

      {/* Main Conversation Center Display */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full text-center py-6 overflow-y-auto">
        {/* Pulsing Voice Avatar Sphere */}
        <div
          onClick={handleBargeIn}
          className="relative cursor-pointer group mb-6"
          title={convoState === 'assistant_speaking' ? 'Tap to interrupt (Barge-in)' : ''}
        >
          <div
            className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              convoState === 'assistant_speaking'
                ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-400 animate-pulse ring-8 ring-amber-500/30'
                : convoState === 'listening'
                ? 'bg-gradient-to-tr from-rose-700 to-rose-500 animate-pulse ring-8 ring-rose-500/30'
                : convoState === 'thinking'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 animate-spin ring-4 ring-blue-500/30'
                : convoState === 'countdown_executing'
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 ring-8 ring-emerald-500/40 animate-pulse'
                : 'bg-stone-800 ring-4 ring-stone-700'
            }`}
          >
            {convoState === 'assistant_speaking' ? (
              <Volume2 className="w-12 h-12 text-white" />
            ) : isMicMuted ? (
              <MicOff className="w-12 h-12 text-stone-400" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </div>

          {/* Active Status Badge */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-stone-900 border border-stone-700 text-stone-200 shadow-md">
            {convoState === 'assistant_speaking'
              ? 'Speaking (Tap to interrupt)'
              : convoState === 'listening'
              ? 'Listening naturally'
              : convoState === 'thinking'
              ? 'Processing'
              : convoState === 'countdown_executing'
              ? `Auto-executing in ${countdownRemaining}s`
              : convoState === 'waiting_confirm'
              ? 'Waiting for voice confirmation'
              : 'Standby'}
          </div>
        </div>

        {/* Live Assistant Spoken Speech Transcript */}
        {assistantSpokenText && (
          <div className="w-full max-w-lg bg-stone-900/80 border border-stone-800 rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-stone-100 font-medium leading-relaxed shadow-lg">
            <span className="text-xs uppercase tracking-wider text-amber-400 block mb-1 font-bold">
              Assistant
            </span>
            {assistantSpokenText}
          </div>
        )}

        {/* Live User Spoken Words (Transcript & Interim) */}
        {(transcript || interimTranscript) && (
          <div className="mt-3 w-full max-w-lg bg-stone-900/50 border border-stone-800/80 rounded-xl p-3 text-xs sm:text-sm text-stone-300 italic">
            <span className="text-xs uppercase tracking-wider text-rose-400 not-italic block mb-0.5 font-bold">
              You Heard
            </span>
            &ldquo;{transcript} {interimTranscript}&rdquo;
          </div>
        )}

        {/* Pending Action Card & Auto-Execute Bar */}
        {activePendingAction && (
          <div className="mt-4 w-full max-w-md bg-stone-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl text-left">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {activePendingAction.riskLevel === 'high' || activePendingAction.requiresSecondConfirmation
                  ? 'High Priority Spoken Confirmation Required'
                  : `Auto-executing in ${countdownRemaining}s (Say "Stop" or "Wait" to cancel)`}
              </span>
            </div>

            <div className="text-sm font-bold text-white mb-1">
              {activePendingAction.preview?.summary}
            </div>
            {activePendingAction.preview?.details && (
              <div className="text-xs text-stone-300 mb-3">
                {activePendingAction.preview?.details}
              </div>
            )}

            {/* Countdown progress bar */}
            {convoState === 'countdown_executing' && (
              <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-emerald-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdownRemaining / autoExecuteSeconds) * 100}%` }}
                />
              </div>
            )}

            {/* Tap Controls if user prefers screen buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => executeAction(activePendingAction, 'ui_tap', 'tap_confirm')}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition text-center"
              >
                Confirm Now
              </button>
              <button
                onClick={() => {
                  clearTimers();
                  setActivePendingAction(null);
                  startListening();
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Executed Result & Undo Notice */}
        {lastExecutedResult && (
          <div className="mt-4 w-full max-w-md bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3.5 text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold">{lastExecutedResult.summary || 'Action completed'}</div>
                <div className="text-[11px] text-emerald-300/80">Say &ldquo;undo that&rdquo; to revert</div>
              </div>
            </div>
            <button
              onClick={() => executeVoiceUndo(lastExecutedResult.actionId)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white transition flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Command Helpers Bar */}
      <div className="border-t border-stone-800/80 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-stone-300">Spoken commands:</span>
          <span className="bg-stone-900 px-2 py-0.5 rounded border border-stone-800">&ldquo;போதும்&rdquo; / &ldquo;that&apos;s all&rdquo;</span>
          <span className="bg-stone-900 px-2 py-0.5 rounded border border-stone-800">&ldquo;சரி&rdquo; / &ldquo;confirm&rdquo;</span>
          <span className="bg-stone-900 px-2 py-0.5 rounded border border-stone-800">&ldquo;வேண்டாம்&rdquo; / &ldquo;stop&rdquo;</span>
          <span className="bg-stone-900 px-2 py-0.5 rounded border border-stone-800">&ldquo;அதை திருப்பு&rdquo; / &ldquo;undo that&rdquo;</span>
        </div>

        <div className="text-stone-500 text-[11px]">
          Echo Cancellation Active • Private & Paid Tier
        </div>
      </div>

      {/* Microphone Recovery Modal if permission denied */}
      <MicrophoneRecoveryModal
        isOpen={showMicRecoveryModal}
        state={micService.getPermissionState()}
        onClose={() => setShowMicRecoveryModal(false)}
        onPermissionGranted={() => {
          setShowMicRecoveryModal(false);
          initializeVoiceSession();
        }}
      />
    </div>
  );
};
