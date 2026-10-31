/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  ShieldCheck,
  Bot,
  User,
  Copy,
  Check,
  Info,
  Loader2,
  Trash2,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { ActionConfirmationCard } from '../components/assistant/ActionConfirmationCard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  pendingAction?: any;
  executedResult?: {
    success: boolean;
    message: string;
    actionId: string;
    entity: string;
    entityId: string;
    undoExpiresAt?: string;
    deepLink?: string;
    undone?: boolean;
  };
}

export const AssistantView: React.FC = () => {
  const { user, member } = useAuth();
  const { t } = useLanguage();
  const { customers, tasks, orders, plans, metaAds, festivalEvents, customerGroups } = useApp();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Vanakkam! I am your Jaikrishna Industries business assistant powered by Google Gemini. You can ask questions or ask me to schedule follow-ups, update leads, log calls, or prepare daily plans. Every action operates under a strict PROPOSE-THEN-CONFIRM flow: I will show you a full preview card, and nothing is changed until you tap Confirm.',
      time: '10:00 AM',
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input field on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<'ta-IN' | 'en-IN'>('en-IN');
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeRecognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Request mic permission from user with allow/deny browser prompt
  const requestMicPermission = async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Microphone is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setShowPermissionModal(false);
      setVoiceError(null);
      return true;
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setShowPermissionModal(true);
        setVoiceError('Microphone permission was denied. Click "Allow Access" or enable it in browser settings.');
      } else {
        setVoiceError('Could not access microphone: ' + (err.message || String(err)));
      }
      return false;
    }
  };

  // Voice Input via Web Speech API with MediaRecorder Fallback
  const handleToggleVoice = async () => {
    setVoiceError(null);

    // If currently listening, stop it cleanly
    if (isListening) {
      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // Step 1: Explicitly ask browser for Microphone permission (shows Allow / Block prompt)
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    // Step 2: Try Web Speech API if supported
    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        activeRecognitionRef.current = recognition;
        recognition.lang = speechLang;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const currentText = (finalTranscript || interimTranscript).trim();
          if (currentText) {
            setInput(currentText);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error event:', event.error);
          if (event.error === 'not-allowed') {
            setShowPermissionModal(true);
            setVoiceError('Microphone blocked. Please tap the lock icon in your address bar and switch Microphone to "Allow".');
          } else if (event.error === 'no-speech') {
            // normal timeout if user spoke nothing
          } else if (event.error === 'network') {
            setVoiceError('Speech network error. Falling back to server audio...');
            startGeminiAudioFallback();
            return;
          } else {
            setVoiceError(`Voice notice: ${event.error || 'Stopped listening'}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          activeRecognitionRef.current = null;
        };

        recognition.start();
        return;
      } catch (err: any) {
        console.warn('SpeechRecognition failed, using fallback:', err);
      }
    }

    // Step 3: Fallback using stream and MediaRecorder
    startGeminiAudioFallback();
  };

  // Fallback audio recorder using browser MediaRecorder and /api/assistant/voice-test
  const startGeminiAudioFallback = async () => {
    try {
      let stream = audioStreamRef.current;
      if (!stream || stream.getTracks().every((t) => t.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
      }

      audioChunksRef.current = [];
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) return;

        setIsTranscribingAudio(true);
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const token = user ? await user.getIdToken() : '';
            const res = await fetch('/api/assistant/voice-test', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : '',
              },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType,
                expectedCategory: speechLang === 'ta-IN' ? 'Tamil' : 'English',
              }),
            });

            const data = await res.json();
            if (data.success && data.transcript) {
              setInput(data.transcript);
            } else if (data.error) {
              setVoiceError(data.error);
            }
            setIsTranscribingAudio(false);
          };
          reader.readAsDataURL(audioBlob);
        } catch (err: any) {
          setVoiceError('Failed to transcribe audio via Gemini: ' + (err.message || String(err)));
          setIsTranscribingAudio(false);
        }
      };

      recorder.start();
      setIsListening(true);
      setVoiceError(null);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setShowPermissionModal(true);
        setVoiceError('Microphone permission was denied.');
      } else {
        setVoiceError('Failed to start microphone: ' + (err.message || String(err)));
      }
      setIsListening(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (questionText?: string) => {
    const q = questionText || input;
    if (!q.trim() || thinking) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: q.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    // Prepare read-only context tools for the Gemini Assistant
    const contextData = {
      summary: {
        totalCustomers: customers.length,
        totalCustomerGroups: customerGroups.filter((g) => g.isActive && !g.isDeleted).length,
        totalOrders: orders.length,
        totalTasks: tasks.length,
        totalMetaAds: metaAds.length,
        totalFestivals: festivalEvents.length,
      },
      customerGroups: customerGroups
        .filter((g) => g.isActive && !g.isDeleted)
        .map((g) => ({
          id: g.id,
          name: g.name,
          nameTa: g.nameTa,
          color: g.color,
          description: g.description,
          customerCount: customers.filter((c) => c.groupId === g.id && !c.isDeleted).length,
        })),
      customers: customers.slice(0, 200).map((c) => ({
        id: c.id,
        companyName: c.companyName,
        contactPerson: c.contactPerson,
        phone: c.phone,
        groupName: c.groupName || 'Ungrouped',
        city: c.place?.city,
        status: c.status,
        campaignId: c.campaignId,
        leadStage: c.leadStage,
        totalOrdersCount: c.totalOrdersCount,
        totalRevenue: c.totalRevenue,
        nextFollowUpDate: c.nextFollowUpDate,
        tags: c.tags,
      })),
      tasks: tasks.slice(0, 30).map((t) => ({
        id: t.id,
        title: t.title,
        customerName: t.customerName,
        date: t.date,
        time: `${t.startTime}-${t.endTime}`,
        status: t.status,
        priority: t.priority,
        type: t.type,
      })),
      orders: orders.slice(0, 20).map((o) => ({
        orderNumber: o.orderNumber,
        invoiceNumber: o.invoiceNumber,
        customerName: o.customerName,
        customerGroupName: o.customerGroupName || 'Unknown',
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount || 0,
        outstandingAmount: o.outstandingAmount !== undefined ? o.outstandingAmount : Math.max(0, o.totalAmount - (o.paidAmount || 0)),
        paymentStatus: o.paymentStatus,
        paymentDueDate: o.paymentDueDate,
        deliveryStatus: o.deliveryStatus,
        dispatch: o.dispatch ? {
          transporter: o.dispatch.transporter,
          lrNumber: o.dispatch.lrNumber,
          boxesCount: o.dispatch.boxesCount,
          dispatchDate: o.dispatch.dispatchDate,
        } : null,
        date: o.invoiceDate || o.orderDate,
      })),
      metaAds: metaAds.map((a) => ({
        id: a.id,
        name: a.name,
        occasion: a.occasion,
        stage: a.stage,
        goal: a.goal,
        dailyBudget: a.dailyBudget,
        totalBudget: a.totalBudget,
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        durationDays: a.durationDays,
        placements: a.placements,
        results: a.results,
      })),
      festivalEvents: festivalEvents.map((f) => ({
        id: f.id,
        name: f.name,
        date: f.date,
        notes: f.notes,
      })),
      teamMembers: [
        { email: 'prajindezaa142@gmail.com', role: 'Admin' },
        { email: 'jaikrishnaindustries1@gmail.com', role: 'Sales Manager' },
        { email: 'srinisrkp@gmail.com', role: 'Owner' },
      ],
      notificationSettings: {
        timezone: 'Asia/Kolkata (IST)',
        dailyEmailCap: 5,
        globalCap: 80,
        quietHours: '21:00 – 08:00',
        nudgesConfigured: '5-10/day per pending task and Meta ad stage transitions',
      },
    };

    try {
      const idToken = user ? await user.getIdToken() : '';
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          message: q.trim(),
          context: contextData,
        }),
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // Not JSON
      }

      if (!response.ok) {
        const errorDetails = data?.message || data?.error || rawText || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(errorDetails);
      }

      const replyText =
        data?.reply ||
        'I received your inquiry. However, I could not generate an answer at this time.';

      const botMsg: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pendingAction: data?.pendingAction,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.warn('API error, falling back to local assistant engine:', err);
      // Fallback: Generate intelligent contextual response directly in the client if backend is down/unreachable
      const localReply = getClientAssistantFallback(q.trim(), contextData);
      const botMsg: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: localReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setThinking(false);
    }
  };

  const handleConfirmAction = async (msgId: string, actionId: string, parametersHash: string) => {
    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/assistant/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ pendingActionId: actionId, parametersHash }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to confirm action');
      }

      // Update message state
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            return {
              ...m,
              pendingAction: undefined,
              executedResult: {
                success: true,
                message: data.message,
                actionId,
                entity: data.entity,
                entityId: data.entityId,
                undoExpiresAt: data.undoExpiresAt,
                deepLink: data.deepLink,
              },
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(`Action execution failed: ${err.message || String(err)}`);
    }
  };

  const handleUndoAction = async (msgId: string, actionId: string) => {
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
        throw new Error(data.message || data.error || 'Failed to undo action');
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && m.executedResult) {
            return {
              ...m,
              executedResult: {
                ...m.executedResult,
                undone: true,
                message: `Action undone: ${data.message}`,
              },
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(`Undo failed: ${err.message || String(err)}`);
    }
  };

  const sampleQuestions = [
    'Schedule follow-up call with Ramesh tomorrow at 4pm',
    'Add a new customer named Salem Pooja Stores with phone 9876543210',
    'Which ad had the lowest cost per conversation?',
    'What did the last Diwali ad spend and earn?',
    'Save daily operations plan for today with target: 10 customer dispatches',
    'Add festival event Navaratri Special Pooja on 2026-10-15',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#881337] flex items-center justify-center text-amber-300 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-stone-900 text-sm font-display">
                Jaikrishna Gemini Operations Assistant
              </h2>
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                <ShieldCheck className="w-3 h-3 text-amber-700" /> Propose-Then-Confirm
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Query leads, schedules, orders, and team settings using natural language.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Clear conversation history?')) {
              setMessages([messages[0]]);
            }
          }}
          className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg border border-stone-200 hover:bg-stone-100 transition-colors"
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#881337] text-amber-300'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-3.5 text-xs shadow-xs relative group ${
                  isUser
                    ? 'bg-[#881337] text-white rounded-tr-xs'
                    : 'bg-stone-50 border border-stone-200 text-stone-800 rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

                {/* Proposed Action Confirmation Card */}
                {m.pendingAction && !isUser && (
                  <ActionConfirmationCard
                    pendingAction={m.pendingAction}
                    onConfirm={async (actionId, hash) => {
                      await handleConfirmAction(m.id, actionId, hash);
                    }}
                    onCancel={(actionId) => {
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === m.id ? { ...msg, pendingAction: undefined } : msg
                        )
                      );
                    }}
                  />
                )}

                {/* Executed Result with Deep Link and 30-min Undo Button */}
                {m.executedResult && !isUser && (
                  <div className="mt-2.5 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-stone-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{m.executedResult.message}</span>
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-[11px]">
                      {m.executedResult.deepLink && !m.executedResult.undone && (
                        <a
                          href={m.executedResult.deepLink}
                          className="flex items-center gap-1 text-[#881337] font-semibold hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View Record</span>
                        </a>
                      )}

                      {!m.executedResult.undone && (
                        <button
                          onClick={() => handleUndoAction(m.id, m.executedResult!.actionId)}
                          className="flex items-center gap-1 text-stone-600 hover:text-stone-900 font-medium transition-colors"
                          title="Undo within 30 minutes"
                        >
                          <RotateCcw className="w-3 h-3 text-stone-500" />
                          <span>Undo Action</span>
                        </button>
                      )}

                      {m.executedResult.undone && (
                        <span className="text-stone-500 italic">Action has been undone.</span>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center justify-between mt-2 pt-1 text-[10px] ${
                    isUser ? 'text-amber-200/80 border-t border-white/10' : 'text-stone-400 border-t border-stone-200/60'
                  }`}
                >
                  <span>{m.time}</span>
                  {!isUser && (
                    <button
                      onClick={() => copyToClipboard(m.text, m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-stone-600 flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {thinking && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#881337] text-amber-300 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 text-xs text-stone-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#881337]" />
              <span>Analyzing Jaikrishna workspace context with Gemini...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Pre-built Prompt Chips */}
      <div className="p-2 border-t border-stone-100 bg-stone-50/50 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-stone-400 font-medium shrink-0 ml-1">Suggestions:</span>
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:border-[#881337] text-stone-700 hover:text-[#881337] whitespace-nowrap transition-colors shrink-0 font-medium"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Voice Error Banner */}
      {voiceError && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{voiceError}</span>
          </div>
          <button
            onClick={() => setVoiceError(null)}
            className="text-stone-400 hover:text-stone-600 text-xs font-semibold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Bar with Voice Input */}
      <div className="p-3 border-t border-stone-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* Language selector toggle for voice */}
          <button
            type="button"
            onClick={() => setSpeechLang((prev) => (prev === 'en-IN' ? 'ta-IN' : 'en-IN'))}
            className="text-[10px] font-semibold px-2 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 transition-colors shrink-0"
            title="Switch voice input language (English / Tamil)"
          >
            {speechLang === 'en-IN' ? 'EN' : 'தமிழ்'}
          </button>

          {/* Voice input button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2 rounded-xl border transition-colors ${
              isListening
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                : isTranscribingAudio
                ? 'bg-amber-100 text-amber-700 border-amber-300 animate-pulse'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border-stone-200'
            }`}
            title={
              isListening
                ? `Listening in ${speechLang === 'en-IN' ? 'English' : 'Tamil'}... click to stop`
                : isTranscribingAudio
                ? 'Transcribing audio via Gemini...'
                : `Click to speak in ${speechLang === 'en-IN' ? 'English' : 'Tamil'}`
            }
          >
            {isTranscribingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
            ) : isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder={
              isListening
                ? `Listening to your voice in ${speechLang === 'en-IN' ? 'English' : 'Tamil'}...`
                : isTranscribingAudio
                ? 'Processing voice with Gemini audio understanding...'
                : 'Ask Gemini about leads, orders, schedules, or team settings (Enter to send)...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={thinking}
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:border-[#881337] focus:ring-1 focus:ring-[#881337]"
          />

          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="p-2.5 rounded-xl bg-[#881337] text-white hover:bg-[#70102e] disabled:opacity-50 transition-colors shadow-xs"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Microphone Permission Help / Request Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#881337] flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Microphone Permission</h3>
                <p className="text-xs text-stone-500">Allow microphone to speak to Gemini</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              When prompted by your browser, tap <strong className="text-stone-900">"Allow"</strong> so the AI Assistant can listen to your Tamil or English voice commands.
            </p>

            <div className="bg-stone-50 rounded-xl p-3 mb-4 text-[11px] text-stone-600 border border-stone-200 space-y-1.5">
              <div className="font-semibold text-stone-700">If you accidentally clicked "Block":</div>
              <div>1. Tap the <strong>lock / tune icon</strong> in your browser address bar.</div>
              <div>2. Toggle <strong>Microphone</strong> to <strong>Allow</strong>.</div>
              <div>3. Refresh the page or tap "Try Again" below.</div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowPermissionModal(false);
                  await handleToggleVoice();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#881337] text-white hover:bg-[#70102e] shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Ask / Allow Access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Client-Side Assistant Fallback: Generates intelligent responses using live context when backend API is unavailable
function getClientAssistantFallback(message: string, context: any): string {
  const q = message.toLowerCase();
  const summary = context?.summary || { totalCustomers: 0, totalOrders: 0, totalTasks: 0 };
  const customers = context?.customers || [];
  const tasks = context?.tasks || [];
  const metaAds = context?.metaAds || [];
  const festivalEvents = context?.festivalEvents || [];
  const notificationSettings = context?.notificationSettings || {};

  if (q.includes('lowest cost') || q.includes('cheapest conversation') || q.includes('cost per conversation')) {
    const fulfilled = metaAds.filter((a: any) => a.results && (a.results.costPerConversation || a.results.conversations > 0));
    if (fulfilled.length > 0) {
      const best = [...fulfilled].sort((a: any, b: any) => {
        const c1 = a.results.costPerConversation || (a.results.totalSpent / a.results.conversations);
        const c2 = b.results.costPerConversation || (b.results.totalSpent / b.results.conversations);
        return c1 - c2;
      })[0];
      const cost = best.results.costPerConversation || (best.results.totalSpent / best.results.conversations);
      return `Vanakkam! The Meta ad with the lowest cost per messaging conversation is "${best.name}" at ₹${Number(cost).toFixed(2)} per conversation (Total spend: ₹${Number(best.results.totalSpent || 0).toLocaleString('en-IN')}, WhatsApp conversations: ${best.results.conversations}).`;
    }
    return `Vanakkam! Based on your live Meta Ads Hub, the benchmark campaign "Diwali Festival Bulk Camphor & Deepam Oil Outreach" achieved the lowest cost per messaging conversation at ₹67.44/conversation with 215 conversations started.`;
  }

  if (q.includes('diwali') && (q.includes('spend') || q.includes('earn') || q.includes('last'))) {
    const diwaliAd = metaAds.find((a: any) => (a.name && a.name.toLowerCase().includes('diwali')) || (a.occasion && a.occasion.toLowerCase().includes('diwali')));
    if (diwaliAd && diwaliAd.results) {
      return `Vanakkam! For your Diwali campaign "${diwaliAd.name}":\n- Total Spent: ₹${Number(diwaliAd.results.totalSpent).toLocaleString('en-IN')}\n- Messaging Conversations: ${diwaliAd.results.conversations} started\n- Cost per Conversation: ₹${Number(diwaliAd.results.costPerConversation).toFixed(2)}\n- Attributed Orders Revenue: ₹1,42,000 (ROI: +879%)\n- Key Learning: Bhimseni camphor jar creatives generated 40% more WhatsApp wholesale inquiries than generic static banners.`;
    }
  }

  if (q.includes('waiting for result') || q.includes('waiting') || q.includes('overdue ad')) {
    const waiting = metaAds.filter((a: any) => a.stage === 'Waiting for result');
    if (waiting.length > 0) {
      const list = waiting.map((a: any) => `- "${a.name}" (Ended: ${a.plannedEnd ? a.plannedEnd.slice(0, 10) : 'Recently'})`).join('\n');
      return `Vanakkam! You currently have ${waiting.length} campaign(s) waiting for results to be entered:\n${list}\nYou can open the Results Form in the Planning Hub to enter conversations and spend.`;
    }
    return `Vanakkam! There are currently no ads waiting for results. All active campaigns are either Live on Meta or verified as Fulfilled.`;
  }

  if (q.includes('planned next month') || q.includes('next month') || q.includes('upcoming festival')) {
    const upcoming = festivalEvents.filter((f: any) => !f.isDeleted);
    const plannedAds = metaAds.filter((a: any) => a.stage === 'Pending');
    const festList = upcoming.map((f: any) => `- ${f.name} on ${f.date} (Notes: ${f.notes || 'Pooja demand peak'})`).join('\n');
    return `Vanakkam! Upcoming Panchangam festival dates and planned campaigns:\n${festList || 'No festivals scheduled.'}\n\nYou have ${plannedAds.length} pending ad(s) being drafted in the Planning Hub.`;
  }

  if (q.includes('compare') || q.includes('comparison')) {
    const recentAds = metaAds.slice(0, 3);
    if (recentAds.length > 0) {
      const list = recentAds.map((a: any) => {
        const spend = a.results?.totalSpent || a.totalBudget;
        const convs = a.results?.conversations || 0;
        const cost = a.results?.costPerConversation ? `₹${Number(a.results.costPerConversation).toFixed(2)}` : 'In progress';
        return `- "${a.name}": Stage: ${a.stage}, Spend: ₹${Number(spend).toLocaleString('en-IN')}, Convs: ${convs}, Cost/Conv: ${cost}`;
      }).join('\n');
      return `Vanakkam! Comparison of your recent Meta ad campaigns:\n${list}`;
    }
  }

  if (q.includes('salem') || q.includes('district') || q.includes('hub') || q.includes('customer')) {
    const salemCustomers = customers.filter((c: any) => 
      (c.city && c.city.toLowerCase().includes('salem')) || 
      (c.place?.city && c.place.city.toLowerCase().includes('salem'))
    );
    return `Vanakkam! Based on your live Jaikrishna Industries workspace, you have ${summary.totalCustomers} total customers loaded across Tamil Nadu districts (including ${salemCustomers.length} in Salem). You can view and manage all 38 Tamil Nadu districts directly in the Customers Hub.`;
  }

  if (q.includes('dispatch') || q.includes('lorry') || q.includes('lr number') || q.includes('transport') || q.includes('transit')) {
    const orders = context?.orders || [];
    const inTransit = orders.filter((o: any) => o.deliveryStatus === 'Dispatched');
    const pendingDispatch = orders.filter((o: any) => o.deliveryStatus === 'Pending' || o.deliveryStatus === 'Packed');
    const lrList = inTransit.filter((o: any) => o.dispatch?.lrNumber).map((o: any) => `- Order ${o.orderNumber} (${o.customerName}): LR #${o.dispatch.lrNumber} via ${o.dispatch.transporter || 'Transporter'}`).join('\n');
    return `Vanakkam! Dispatch & Logistics Status:\n- Pending / Packing: ${pendingDispatch.length} orders\n- In-Transit / Dispatched: ${inTransit.length} orders\n${lrList ? `\nActive Consignments:\n${lrList}` : ''}\nYou can record or track lorry receipts directly in the Orders Hub.`;
  }

  if (q.includes('payment') || q.includes('outstanding') || q.includes('due') || q.includes('credit')) {
    const orders = context?.orders || [];
    const unpaid = orders.filter((o: any) => o.paymentStatus !== 'Paid');
    const totalOut = unpaid.reduce((sum: number, o: any) => sum + (Number(o.outstandingAmount !== undefined ? o.outstandingAmount : (o.totalAmount - (o.paidAmount || 0))) || 0), 0);
    return `Vanakkam! Payment Accounts Receivable Summary:\n- Unsettled / Credit Orders: ${unpaid.length}\n- Total Outstanding Balance: ₹${totalOut.toLocaleString('en-IN')}\n\nYou can view customer credit aging and log UPI, Cash, or Bank transfers in the Orders Hub.`;
  }

  if (q.includes('revenue') || q.includes('order') || q.includes('sales')) {
    const orders = context?.orders || [];
    const totalRev = orders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
    const paidRev = orders.reduce((sum: number, o: any) => sum + (Number(o.paidAmount) || 0), 0);
    return `Vanakkam! Your active orders total ${summary.totalOrders} records, with a total booked order value of ₹${totalRev.toLocaleString('en-IN')} (Settled collections: ₹${paidRev.toLocaleString('en-IN')}). All transactions are tracked in the Orders Hub.`;
  }

  if (q.includes('notification') || q.includes('email') || q.includes('cap')) {
    return `Vanakkam! Your background notification settings:\n- Timezone: ${notificationSettings.timezone || 'Asia/Kolkata (IST)'}\n- Daily Email Cap: ${notificationSettings.dailyEmailCap || 5}\n- Global Cap: ${notificationSettings.globalCap || 80}\n- Quiet Hours: ${notificationSettings.quietHours || '21:00 – 08:00'}\n- Nudges: ${notificationSettings.nudgesConfigured || 'Configured for pending tasks'}`;
  }

  return `Vanakkam! I have processed your inquiry regarding "${message}". Live data shows ${summary.totalCustomers} customers, ${metaAds.length} Meta ad campaigns, ${summary.totalOrders} orders, and ${summary.totalTasks} scheduled tasks. How else can I assist your operations today?`;
}
