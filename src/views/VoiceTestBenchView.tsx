/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Voice Benchmark Prototype Test Tool
 * Step 0 Testing Harness for Voice Input & Output
 * (Behind Authentication, Dev/Test Only)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TestScriptItem {
  id: number;
  category: 'Tamil' | 'English' | 'Tanglish';
  text: string;
  expectedEntity: string;
}

const TEST_SCRIPTS: TestScriptItem[] = [
  // 1. Pure Tamil (10 items)
  { id: 1, category: 'Tamil', text: 'ரவி டிரேடர்ஸுக்கு நாளை காலை 10 மணிக்கு கால் டாஸ்க் போடு', expectedEntity: 'Customer: Ravi Traders, Time: Tomorrow 10:00 AM' },
  { id: 2, category: 'Tamil', text: 'ஸ்ரீ முருகன் ஸ்டோர்ஸை காண்டாக்டட் நிலைக்கு மாத்து', expectedEntity: 'Customer: Sri Murugan Stores, Stage: Contacted' },
  { id: 3, category: 'Tamil', text: 'சேலம் பூஜா மார்ட்டுக்கு சாம்பிள் சென்ட் ஆச்சுன்னு நோட் போடு', expectedEntity: 'Customer: Salem Pooja Mart, Stage: Sample sent' },
  { id: 4, category: 'Tamil', text: 'ஸ்ரீனிவாசனுக்கு புதிய பேக்கிங் டாஸ்க் அசைன் பண்ணு', expectedEntity: 'Assignee: Srinivasan, Task: Packing' },
  { id: 5, category: 'Tamil', text: 'அடுத்த திங்கட்கிழமை வாடிக்கையாளர் விசிட் ஏற்பாடு செய்', expectedEntity: 'Task: Visit, Date: Next Monday' },
  { id: 6, category: 'Tamil', text: 'குமார் ஏஜென்ஸீஸ் ஆர்டர் முடிஞ்சிடுச்சு', expectedEntity: 'Customer: Kumar Agencies, Stage: Ordered' },
  { id: 7, category: 'Tamil', text: 'லக்ஷ்மி ஸ்டோர்ஸ் நாட் இன்ட்ரஸ்டட்னு சொல்லிட்டாங்க', expectedEntity: 'Customer: Lakshmi Stores, Stage: Not interested' },
  { id: 8, category: 'Tamil', text: 'இன்று மாலை 4 மணிக்கு பிரஜினுக்கு வாட்ஸ்அப் டாஸ்க் போடு', expectedEntity: 'Assignee: Prajin, Task: WhatsApp, Time: Today 4:00 PM' },
  { id: 9, category: 'Tamil', text: 'நாளை 12 மணிக்கு கலெக்ஷன் டாஸ்க் ஷெட்யூல் பண்ணு', expectedEntity: 'Task: Call, Time: Tomorrow 12:00 PM' },
  { id: 10, category: 'Tamil', text: 'பவானி அம்மன் கோவில் தீபம் ஆயில் ஆர்டர் வந்தது', expectedEntity: 'Customer: Bhavani Amman Kovil, Product: Deepam Oil' },

  // 2. Pure English (10 items)
  { id: 11, category: 'English', text: 'Schedule a call task with Ravi Traders tomorrow at 10 AM', expectedEntity: 'Customer: Ravi Traders, Task: Call, Date: Tomorrow' },
  { id: 12, category: 'English', text: 'Move Sri Murugan Stores to Interested stage', expectedEntity: 'Customer: Sri Murugan Stores, Stage: Interested' },
  { id: 13, category: 'English', text: 'Assign a packing task to Srinivasan for Friday', expectedEntity: 'Assignee: Srinivasan, Task: Packing, Date: Friday' },
  { id: 14, category: 'English', text: 'Log visit outcome for Salem Pooja Mart: interested in camphor tablets', expectedEntity: 'Customer: Salem Pooja Mart, Outcome: Interested' },
  { id: 15, category: 'English', text: 'Change stage for Kumar Agencies to Negotiation', expectedEntity: 'Customer: Kumar Agencies, Stage: Negotiation' },
  { id: 16, category: 'English', text: 'Create WhatsApp task for Sales Manager tomorrow at 3 PM', expectedEntity: 'Assignee: Sales Manager, Task: WhatsApp, Time: 3:00 PM' },
  { id: 17, category: 'English', text: 'Set next follow up date for Lakshmi Stores on 15th November', expectedEntity: 'Customer: Lakshmi Stores, Follow-up: 15 Nov' },
  { id: 18, category: 'English', text: 'Customer Bhavani Amman Kovil placed an order', expectedEntity: 'Customer: Bhavani Amman Kovil, Stage: Ordered' },
  { id: 19, category: 'English', text: 'Mark follow up call with Raja Super Market as Done', expectedEntity: 'Task Status: Done' },
  { id: 20, category: 'English', text: 'Create daily plan for tomorrow with 5 sample deliveries', expectedEntity: 'Plan: Daily, Date: Tomorrow' },

  // 3. Mixed Tanglish (10 items)
  { id: 21, category: 'Tanglish', text: 'Ravi Traders-ku naalai kaalai 10 Manikku follow up call schedule pannu', expectedEntity: 'Customer: Ravi Traders, Time: Tomorrow 10:00 AM' },
  { id: 22, category: 'Tanglish', text: 'Sri Murugan Stores-ah Interested stage-ku mathu', expectedEntity: 'Customer: Sri Murugan Stores, Stage: Interested' },
  { id: 23, category: 'Tanglish', text: 'Salem Pooja Mart-ku sample anupiyachu, stage Sample sent-nu update pannu', expectedEntity: 'Customer: Salem Pooja Mart, Stage: Sample sent' },
  { id: 24, category: 'Tanglish', text: 'Srinivasan-ku oru packing task assign pannu', expectedEntity: 'Assignee: Srinivasan, Task: Packing' },
  { id: 25, category: 'Tanglish', text: 'Prajin-ku innikku maalai 4 manikku WhatsApp task podu', expectedEntity: 'Assignee: Prajin, Task: WhatsApp, Time: Today 4:00 PM' },
  { id: 26, category: 'Tanglish', text: 'Kumar Agencies negotiation mudinji order conform pannitanga', expectedEntity: 'Customer: Kumar Agencies, Stage: Ordered' },
  { id: 27, category: 'Tanglish', text: 'Lakshmi Stores ippo not interested-nu solranga', expectedEntity: 'Customer: Lakshmi Stores, Stage: Not interested' },
  { id: 28, category: 'Tanglish', text: 'Next Monday morning 11 AM-ku customer visit task vai', expectedEntity: 'Task: Visit, Date: Next Monday 11:00 AM' },
  { id: 29, category: 'Tanglish', text: 'Bhavani Amman Kovil-ku next follow up date adutha vaaram vai', expectedEntity: 'Follow-up: Next week' },
  { id: 30, category: 'Tanglish', text: 'Innikku evening review plan-la 8 orders dispatch-nu note pannu', expectedEntity: 'Plan: Daily Review, Notes: 8 dispatches' },
];

export const VoiceTestBenchView: React.FC = () => {
  const { user } = useAuth();

  // Device Voice Inventory
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [tamilVoiceFound, setTamilVoiceFound] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Selected test script item
  const [activeItem, setActiveItem] = useState<TestScriptItem>(TEST_SCRIPTS[0]);

  // Browser Web Speech Recognition State
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [browserTranscript, setBrowserTranscript] = useState('');
  const [browserTimingMs, setBrowserTimingMs] = useState<number | null>(null);

  // MediaRecorder + Gemini Server Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimingMs, setRecordingTimingMs] = useState<number | null>(null);
  const [geminiResult, setGeminiResult] = useState<any>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // TTS Output
  const [ttsSampleText, setTtsSampleText] = useState('வணக்கம், ரவி டிரேடர்ஸுக்கு நாளை காலை 10 மணிக்கு டாஸ்க் உருவாக்கப்பட்டது.');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 1. Enumerate device voices
  useEffect(() => {
    function loadVoices() {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        setDeviceVoices(voices);
        const ta = voices.find((v) => v.lang.toLowerCase().includes('ta'));
        setTamilVoiceFound(Boolean(ta));
        if (ta) setSelectedVoice(ta);
        else if (voices.length > 0) setSelectedVoice(voices[0]);
      }
    }

    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // 2. Browser Web Speech Recognition
  const handleStartBrowserSpeech = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      alert('SpeechRecognition is not supported on this browser (Chrome / Edge recommended).');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = activeItem.category === 'English' ? 'en-IN' : 'ta-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    const start = Date.now();
    setIsRecognizing(true);
    setBrowserTranscript('');

    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      setBrowserTranscript(text);
      setBrowserTimingMs(Date.now() - start);
      setIsRecognizing(false);
    };

    rec.onerror = (err: any) => {
      console.warn('SpeechRecognition error:', err);
      setIsRecognizing(false);
    };

    rec.onend = () => {
      setIsRecognizing(false);
    };

    rec.start();
  };

  // 3. MediaRecorder -> Server Gemini Audio
  const handleToggleRecord = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];

        // Check supported MIME type
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        const recStartTime = Date.now();

        recorder.onstop = async () => {
          const recDuration = Date.now() - recStartTime;
          setRecordingTimingMs(recDuration);

          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          // Stop stream tracks
          stream.getTracks().forEach((t) => t.stop());

          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            await sendAudioToServer(base64Audio, mimeType);
          };
        };

        recorder.start();
        setIsRecording(true);
        setGeminiResult(null);
      } catch (err: any) {
        alert(`Mic access error: ${err.message || String(err)}`);
      }
    }
  };

  const sendAudioToServer = async (base64Audio: string, mimeType: string) => {
    setGeminiLoading(true);
    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/assistant/voice-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ audioBase64: base64Audio, mimeType }),
      });

      const data = await res.json();
      setGeminiResult(data);
    } catch (err: any) {
      alert(`Server audio error: ${err.message}`);
    } finally {
      setGeminiLoading(false);
    }
  };

  // 4. TTS Speak Test
  const handleSpeakTts = () => {
    if (!('speechSynthesis' in window)) {
      alert('SpeechSynthesis not supported on this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(ttsSampleText);
    utterance.lang = selectedVoice ? selectedVoice.lang : 'ta-IN';
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-stone-900 text-lg font-display">
              AI Voice Test Bench (Step 0 Prototype)
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              Dev Only
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Compare Browser Web Speech API vs. Gemini Server Audio Understanding on real Android, PC, and iPhone devices.
          </p>
        </div>
      </div>

      {/* Device Voice Capabilities Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2 font-semibold text-sm text-stone-800">
            <Volume2 className="w-4 h-4 text-amber-700" />
            <span>Device SpeechSynthesis Voice Capabilities</span>
          </div>
          {tamilVoiceFound ? (
            <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Native Tamil Voice Found
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              <AlertCircle className="w-3.5 h-3.5" /> No Tamil Voice Found on Device
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-stone-500 font-medium mb-1">
              Select Voice to Test ({deviceVoices.length} installed):
            </label>
            <select
              value={selectedVoice?.name || ''}
              onChange={(e) => {
                const v = deviceVoices.find((x) => x.name === e.target.value);
                setSelectedVoice(v || null);
              }}
              className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-800"
            >
              {deviceVoices.map((v, i) => (
                <option key={i} value={v.name}>
                  {v.name} ({v.lang}) {v.default ? '— Default' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-500 font-medium mb-1">
              Test Spoken Sentence:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ttsSampleText}
                onChange={(e) => setTtsSampleText(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-800 text-xs font-tamil"
              />
              <button
                onClick={handleSpeakTts}
                disabled={isSpeaking}
                className="px-3 py-1.5 bg-[#881337] text-white rounded-lg font-semibold hover:bg-[#9f1239] transition-colors flex items-center gap-1 shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'Playing...' : 'Play'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scripted Test Sentences Selector */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="font-semibold text-sm text-stone-800">
            Select Test Sentence from 30 Scripted Scenarios:
          </div>
          <span className="text-xs text-stone-500">
            Current: #{activeItem.id} ({activeItem.category})
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {TEST_SCRIPTS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveItem(item);
                setBrowserTranscript('');
                setGeminiResult(null);
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-colors ${
                activeItem.id === item.id
                  ? 'bg-[#881337] text-white border-[#881337] font-bold'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
              }`}
            >
              #{item.id} {item.category}
            </button>
          ))}
        </div>

        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider">
            Sentence to Speak into Microphone:
          </span>
          <p className="text-sm font-semibold text-stone-900 font-tamil">
            "{activeItem.text}"
          </p>
          <p className="text-xs text-stone-500">
            <strong>Expected Interpretation:</strong> {activeItem.expectedEntity}
          </p>
        </div>
      </div>

      {/* Comparison Grid: Browser Web Speech vs Gemini Server Audio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Method A: Browser Web Speech */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-sm text-stone-900">
                Method A: Browser SpeechRecognition
              </span>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                Zero Cost / Web Speech API
              </span>
            </div>

            <p className="text-xs text-stone-500">
              Uses browser's internal engine ({activeItem.category === 'English' ? 'en-IN' : 'ta-IN'}).
            </p>

            <button
              onClick={handleStartBrowserSpeech}
              disabled={isRecognizing}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors ${
                isRecognizing
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
            >
              {isRecognizing ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isRecognizing ? 'Listening... Speak Now' : 'Click & Speak (Browser API)'}</span>
            </button>

            {browserTranscript ? (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Transcribed Text:
                </span>
                <p className="font-semibold text-stone-900 font-tamil">
                  "{browserTranscript}"
                </p>
                {browserTimingMs && (
                  <span className="text-[10px] text-stone-500 block pt-1">
                    Latency: {browserTimingMs} ms
                  </span>
                )}
              </div>
            ) : (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-400 italic text-center">
                Transcript will appear here after speaking.
              </div>
            )}
          </div>
        </div>

        {/* Method B: Server-Side Gemini Audio */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="font-bold text-sm text-stone-900">
                Method B: Server Gemini Audio
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                Multimodal / MediaRecorder
              </span>
            </div>

            <p className="text-xs text-stone-500">
              Records audio blob and sends to Gemini with business entity hints.
            </p>

            <button
              onClick={handleToggleRecord}
              disabled={geminiLoading}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-[#881337] text-white hover:bg-[#9f1239]'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isRecording ? 'Click to Stop & Send Audio' : 'Record Audio (Gemini Path)'}</span>
            </button>

            {geminiLoading && (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-600 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#881337]" />
                <span>Processing audio with Gemini...</span>
              </div>
            )}

            {geminiResult && (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1.5">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">
                  Gemini Transcript & Detected Entities:
                </span>
                <p className="font-semibold text-stone-900 font-tamil">
                  "{geminiResult.result?.transcript}"
                </p>
                <div className="text-[11px] bg-white p-2 rounded border border-stone-200 text-stone-700">
                  <pre className="whitespace-pre-wrap font-mono text-[10px]">
                    {JSON.stringify(geminiResult.result?.entitiesDetected, null, 2)}
                  </pre>
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1">
                  <span>Language: {geminiResult.result?.languageDetected}</span>
                  <span>Server latency: {geminiResult.elapsedMs} ms</span>
                </div>
              </div>
            )}

            {!geminiResult && !geminiLoading && (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-400 italic text-center">
                Server response and detected entities will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
