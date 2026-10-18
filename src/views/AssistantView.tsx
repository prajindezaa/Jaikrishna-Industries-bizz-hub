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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

export const AssistantView: React.FC = () => {
  const { user, member } = useAuth();
  const { t } = useLanguage();
  const { customers, tasks, orders, plans, metaAds, festivalEvents } = useApp();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Vanakkam! I am your Jaikrishna Industries business assistant powered by Google Gemini. You can ask me any question about your CRM leads, Meta ad campaign metrics, follow-up dates, orders, team members, or notification settings. Please note: I operate under a strict READ-ONLY guarantee and will never create, update, or delete data on your behalf.',
      time: '10:00 AM',
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // Voice Input via Web Speech API
  const handleToggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
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
        totalOrders: orders.length,
        totalTasks: tasks.length,
        totalMetaAds: metaAds.length,
        totalFestivals: festivalEvents.length,
      },
      customers: customers.slice(0, 30).map((c) => ({
        id: c.id,
        companyName: c.companyName,
        contactPerson: c.contactPerson,
        phone: c.phone,
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
      orders: orders.slice(0, 15).map((o) => ({
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        date: o.orderDate,
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
        { email: 'prajindezaa142@gmail.com', role: 'Primary Admin' },
        { email: 'theowner@jaikrishnaindustries.com', role: 'Owner' },
        { email: 'salesmanager@jaikrishnaindustries.com', role: 'Sales Manager' },
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
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `Error connecting to assistant: ${err instanceof Error ? err.message : String(err)}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setThinking(false);
    }
  };

  const sampleQuestions = [
    'Which ad had the lowest cost per conversation?',
    'What did the last Diwali ad spend and earn?',
    'Which ads are waiting for results?',
    'What is planned next month?',
    'Compare my last 3 ads.',
    'How many new customers from Salem do we have?',
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
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" /> Strict Read-Only
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

      {/* Input Bar with Voice Input */}
      <div className="p-3 border-t border-stone-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice input button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2 rounded-xl border transition-colors ${
              isListening
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border-stone-200'
            }`}
            title={isListening ? 'Listening... click to stop' : 'Click to speak (Voice Input)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            placeholder={
              isListening
                ? 'Listening to your voice in English or Tamil...'
                : 'Ask Gemini about leads, orders, schedules, or team settings...'
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
    </div>
  );
};
