/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Spoken Voice Controller (Tamil & English)
 *
 * Handles:
 * 1. Spoken clarification questions (ambiguous customer match, missing fields, low confidence)
 * 2. Speech synthesis (browser speechSynthesis) with auto voice selection (ta-IN / en-IN)
 * 3. Voice command shortcuts: "say that again", "slower", "stop", "cancel", "skip"
 * 4. In-place voice corrections ("make it 5 PM", "change to Monday")
 * 5. Low-risk voice confirmation ("confirm", "சரி", "ஆமா") within 5s window
 * 6. Repeated failure fallback: offers text input after 2 misrecognitions
 */

export interface SpokenClarification {
  id: string;
  type: 'ambiguous_customer' | 'missing_field' | 'low_confidence' | 'time_conflict';
  spokenPrompt: string;
  spokenPromptTa: string;
  options?: string[];
  fieldToUpdate?: string;
  originalActionId?: string;
}

export interface VoiceCorrectionIntent {
  isCorrection: boolean;
  field?: 'date' | 'time' | 'assignedTo' | 'title' | 'priority';
  newValue?: string;
  isCancellation?: boolean;
  isConfirmation?: boolean;
  isRepeat?: boolean;
  isSlower?: boolean;
  isTermination?: boolean;
  isUndo?: boolean;
}

class SpokenVoiceController {
  private lastSpokenText: string = '';
  private lastSpokenLang: 'en-IN' | 'ta-IN' = 'en-IN';
  private speechRate: number = 0.95; // comfortable default speed
  private consecutiveFailures: number = 0;
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // --- Voice Synthesis Output (TTS) ---
  public hasTamilVoice(): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const voices = window.speechSynthesis.getVoices();
    return voices.some((v) => v.lang.toLowerCase().startsWith('ta'));
  }

  public speak(
    text: string,
    lang: 'en-IN' | 'ta-IN' = 'en-IN',
    options: { onEnd?: () => void; isRepeat?: boolean } = {}
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onEnd?.();
      return;
    }

    this.stopSpeaking();

    // Cache for "say that again"
    if (!options.isRepeat) {
      this.lastSpokenText = text;
      this.lastSpokenLang = lang;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    utterance.lang = lang;
    utterance.rate = this.speechRate;
    utterance.pitch = 1.0;

    // Pick best matching device voice
    const voices = window.speechSynthesis.getVoices();
    const targetLangCode = lang === 'ta-IN' ? 'ta' : 'en';
    const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLangCode));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    } else if (lang === 'ta-IN') {
      // If no Tamil voice exists on device, do not silently mangle speech with an English voice
      console.warn('[SpokenVoiceController] No Tamil TTS voice found on this device');
    }

    // Prevent browser garbage collection bug in Chromium/WebKit where utterance is GC-ed mid-sentence
    (window as any).__activeUtterance = utterance;

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      (window as any).__activeUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('[SpokenVoiceController] TTS error:', e);
      this.isSpeaking = false;
      this.currentUtterance = null;
      (window as any).__activeUtterance = null;
      options.onEnd?.();
    };

    // Ensure audio subsystem is active before speak
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      (window as any).__activeUtterance = null;
    }
  }

  public repeatLastSpoken(options: { onEnd?: () => void } = {}): void {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, this.lastSpokenLang, { ...options, isRepeat: true });
    } else {
      this.speak("There is nothing to repeat yet.", 'en-IN', options);
    }
  }

  public speakSlower(options: { onEnd?: () => void } = {}): void {
    this.speechRate = Math.max(0.65, this.speechRate - 0.2);
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, this.lastSpokenLang, { ...options, isRepeat: true });
    }
  }

  public resetRate(): void {
    this.speechRate = 0.95;
  }

  // --- Voice Command & Intent Parser ---
  public parseVoiceIntent(transcript: string, activePendingAction?: any): VoiceCorrectionIntent {
    const raw = transcript.trim().toLowerCase();

    // 1. Navigation / Playback control commands
    if (
      raw === 'say that again' ||
      raw === 'repeat' ||
      raw === 'மறுபடியும் சொல்லு' ||
      raw === 'திரும்ப சொல்லு'
    ) {
      return { isCorrection: false, isRepeat: true };
    }

    if (raw === 'slower' || raw === 'slow' || raw === 'மெதுவாக' || raw === 'மெதுவா சொல்லு') {
      return { isCorrection: false, isSlower: true };
    }

    // Termination commands (end conversation)
    if (
      raw === "that's all" ||
      raw === 'thats all' ||
      raw === 'போதும்' ||
      raw === 'நிறுத்து' ||
      raw === 'bye' ||
      raw === 'goodbye' ||
      raw === 'முடிந்தது'
    ) {
      return { isCorrection: false, isTermination: true };
    }

    // Undo commands
    if (
      raw === 'undo that' ||
      raw === 'undo' ||
      raw === 'அதை திருப்பு' ||
      raw === 'திருப்பு' ||
      raw === 'முந்தையதை ரத்து செய்'
    ) {
      return { isCorrection: false, isUndo: true };
    }

    if (
      raw === 'stop' ||
      raw === 'cancel' ||
      raw === 'skip' ||
      raw === 'wait' ||
      raw === 'no' ||
      raw === 'வேண்டாம்' ||
      raw === 'ரத்து செய்' ||
      raw === 'பொறு'
    ) {
      return { isCorrection: false, isCancellation: true };
    }

    // 2. Spoken Confirmations
    if (
      raw === 'confirm' ||
      raw === 'yes' ||
      raw === 'proceed' ||
      raw === 'சரி' ||
      raw === 'ஆமா' ||
      raw === 'உறுதி செய்' ||
      raw === 'ok'
    ) {
      return { isCorrection: false, isConfirmation: true };
    }

    // 3. In-Place Corrections for Pending Action (e.g. "make it 5 PM", "change to Monday")
    if (activePendingAction) {
      // Time corrections
      const timeMatch = raw.match(
        /(?:make it|change time to|change to|set to|at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
      );
      if (timeMatch) {
        return { isCorrection: true, field: 'time', newValue: timeMatch[1].trim() };
      }

      // Date corrections
      const dateMatch = raw.match(
        /(?:change date to|change to|make it|set date to)\s+(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+)/i
      );
      if (dateMatch) {
        return { isCorrection: true, field: 'date', newValue: dateMatch[1].trim() };
      }

      // Assignee corrections
      if (raw.includes('sales manager') || raw.includes('விற்பனை மேலாளர்')) {
        return { isCorrection: true, field: 'assignedTo', newValue: 'jaikrishnaindustries1@gmail.com' };
      }
      if (raw.includes('owner') || raw.includes('உரிமையாளர்') || raw.includes('srini')) {
        return { isCorrection: true, field: 'assignedTo', newValue: 'srinisrkp@gmail.com' };
      }
      if (raw.includes('admin') || raw.includes('நிர்வாகி') || raw.includes('prajin')) {
        return { isCorrection: true, field: 'assignedTo', newValue: 'prajindezaa142@gmail.com' };
      }
    }

    return { isCorrection: false, isConfirmation: false };
  }

  // --- Failure Counter & Misunderstanding Recovery ---
  public recordFailure(): { shouldOfferTextInput: boolean; count: number } {
    this.consecutiveFailures += 1;
    return {
      shouldOfferTextInput: this.consecutiveFailures >= 2,
      count: this.consecutiveFailures,
    };
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  // --- Ambiguity Detection Helper (Customer Names) ---
  public checkCustomerAmbiguity(
    nameQuery: string,
    customersList: Array<{ id: string; companyName: string; place?: { city?: string } }>
  ): { isAmbiguous: boolean; options?: Array<{ id: string; label: string }> } {
    const q = nameQuery.trim().toLowerCase();
    if (!q || q.length < 2) return { isAmbiguous: false };

    const matches = customersList.filter((c) =>
      c.companyName.toLowerCase().includes(q)
    );

    if (matches.length > 1 && matches.length <= 4) {
      return {
        isAmbiguous: true,
        options: matches.map((m) => ({
          id: m.id,
          label: `${m.companyName}${m.place?.city ? `, ${m.place.city}` : ''}`,
        })),
      };
    }

    return { isAmbiguous: false };
  }
}

export const spokenVoiceController = new SpokenVoiceController();
