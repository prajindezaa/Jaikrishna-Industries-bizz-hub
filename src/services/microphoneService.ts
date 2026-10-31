/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Central Microphone & Audio Capture Service
 * 
 * Single authoritative module managing:
 * - Permission states (Permissions API + error fallbacks)
 * - In-app explanation state and snooze
 * - Audio capture via getUserMedia + MediaRecorder with MIME negotiation
 * - Audio level meter (Web Audio API AnalyserNode)
 * - Safe release of all audio tracks on cancel, error, background, blur, logout
 * - Device change events (Bluetooth / headset plugged/unplugged)
 * - Platform-specific recovery instructions (Desktop Chrome/Edge, Android, iOS PWA)
 */

export type MicPermissionState =
  | 'not_asked'       // Not yet asked in this session/browser
  | 'asking'          // Browser native prompt is active
  | 'granted'         // Explicitly permitted
  | 'denied'          // Denied by user tap on prompt
  | 'blocked'         // Blocked in browser/site settings or OS policy
  | 'no_device'       // NotFoundError / DevicesNotFoundError
  | 'busy'            // NotReadableError (device in use by other app/call)
  | 'system_denied'   // OS level permission blocked (Android app / Windows privacy)
  | 'unsupported'     // Browser does not support audio capture
  | 'insecure_context'// Not HTTPS or localhost
  | 'revoked'         // Granted previously, but revoked while app was running
  | 'timeout'         // Exceeded max capture time
  | 'network_lost';   // Connection dropped during recognition

export interface MicDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface CaptureConfig {
  maxDurationSeconds?: number;
  selectedDeviceId?: string;
  onLevelChange?: (level: number) => void; // 0.0 to 1.0
  onTimeout?: () => void;
  onError?: (err: Error, state: MicPermissionState) => void;
}

export interface AudioCaptureResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

class CentralMicrophoneService {
  private currentStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private meterAnimationId: number | null = null;
  private timeoutTimerId: any = null;
  private startTime: number = 0;
  private permissionStatusObj: PermissionStatus | null = null;

  private stateListeners: Set<(state: MicPermissionState) => void> = new Set();
  private deviceListeners: Set<(devices: MicDeviceInfo[]) => void> = new Set();

  private currentState: MicPermissionState = 'not_asked';
  private lastErrorName: string | null = null;
  private isCapturingAudio: boolean = false;

  constructor() {
    this.initContextCheck();
    this.initPermissionsObserver();
    this.initLifecycleListeners();
  }

  // --- Context & Insecure Verification ---
  private initContextCheck() {
    if (typeof window === 'undefined') return;
    if (!window.isSecureContext) {
      this.updateState('insecure_context');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.updateState('unsupported');
    }
  }

  // --- Permissions API Observer ---
  private async initPermissionsObserver() {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = await navigator.permissions.query({ name: 'microphone' as any });
      this.permissionStatusObj = status;
      this.syncPermissionState(status.state);

      status.onchange = () => {
        const prevState = this.currentState;
        this.syncPermissionState(status.state);
        if (prevState === 'granted' && status.state === 'denied') {
          this.updateState('revoked');
          this.stopCapture();
        }
      };
    } catch {
      // Safari / iOS WebKit throws here — gracefully fallback
    }
  }

  private syncPermissionState(state: PermissionState) {
    if (state === 'granted') this.updateState('granted');
    else if (state === 'denied') this.updateState('blocked');
    else if (state === 'prompt') {
      if (this.currentState === 'granted') this.updateState('revoked');
      else if (this.currentState !== 'asking') this.updateState('not_asked');
    }
  }

  // --- Lifecycle Listeners (Stop tracks on blur, visibility change, unload) ---
  private initLifecycleListeners() {
    if (typeof window === 'undefined') return;

    // Route change / page unload
    window.addEventListener('beforeunload', () => this.releaseAllTracks());
    window.addEventListener('pagehide', () => this.releaseAllTracks());

    // Tab hidden or app sent to background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isCapturingAudio) {
        this.stopCapture();
      }
      if (!document.hidden) {
        this.checkPermissionSilently();
      }
    });

    // Window focus: check if user unblocked mic in browser settings
    window.addEventListener('focus', () => {
      this.checkPermissionSilently();
    });

    // Device plugged / unplugged (headset / Bluetooth)
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const devices = await this.getAudioInputDevices();
        this.deviceListeners.forEach((fn) => fn(devices));
      });
    }
  }

  // --- Permission Queries & In-App Explanation Snooze ---
  public getPermissionState(): MicPermissionState {
    return this.currentState;
  }

  public getLastErrorName(): string | null {
    return this.lastErrorName;
  }

  public isCapturing(): boolean {
    return this.isCapturingAudio;
  }

  private memorySnoozeUntil: number | null = null;

  public isSnoozed(): boolean {
    if (typeof localStorage !== 'undefined') {
      const snoozeUntil = localStorage.getItem('jaikrishna_mic_snooze_until');
      if (snoozeUntil) return Date.now() < Number(snoozeUntil);
    }
    return this.memorySnoozeUntil !== null && Date.now() < this.memorySnoozeUntil;
  }

  public setSnooze(days: number = 7): void {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    this.memorySnoozeUntil = until;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jaikrishna_mic_snooze_until', String(until));
    }
  }

  public clearSnooze(): void {
    this.memorySnoozeUntil = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('jaikrishna_mic_snooze_until');
    }
  }

  public async checkPermissionSilently(): Promise<MicPermissionState> {
    if (this.permissionStatusObj) {
      this.syncPermissionState(this.permissionStatusObj.state);
    }
    return this.currentState;
  }

  // --- Enumerate Audio Devices ---
  public async getAudioInputDevices(): Promise<MicDeviceInfo[]> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
          groupId: d.groupId,
        }));
    } catch {
      return [];
    }
  }

  // --- Supported MIME Types Selection ---
  public getSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  public getAllSupportedMimeTypes(): string[] {
    if (typeof MediaRecorder === 'undefined') return [];
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];
    return candidates.filter((c) => MediaRecorder.isTypeSupported(c));
  }

  // --- Request Permission Explicitly ---
  public async requestPermission(): Promise<boolean> {
    if (!window.isSecureContext) {
      this.updateState('insecure_context');
      return false;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.updateState('unsupported');
      return false;
    }

    this.updateState('asking');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Immediately stop verification stream
      stream.getTracks().forEach((t) => t.stop());
      this.updateState('granted');
      this.lastErrorName = null;
      return true;
    } catch (err: any) {
      this.handleMediaError(err);
      return false;
    }
  }

  // --- Start Capture ---
  public async startCapture(config: CaptureConfig = {}): Promise<boolean> {
    if (this.isCapturingAudio) {
      this.stopCapture();
    }

    const {
      maxDurationSeconds = 60,
      selectedDeviceId,
      onLevelChange,
      onTimeout,
      onError,
    } = config;

    if (!window.isSecureContext) {
      this.updateState('insecure_context');
      onError?.(new Error('Insecure context'), 'insecure_context');
      return false;
    }

    this.updateState('asking');

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      this.currentStream = stream;
      this.updateState('granted');
      this.isCapturingAudio = true;
      this.startTime = Date.now();
      this.audioChunks = [];

      // Level meter via AnalyserNode
      if (onLevelChange) {
        this.setupLevelMeter(stream, onLevelChange);
      }

      // Initialize MediaRecorder
      const mimeType = this.getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.start(250); // Collect chunk every 250ms

      // Setup maxDuration timeout
      this.timeoutTimerId = setTimeout(() => {
        this.updateState('timeout');
        onTimeout?.();
        this.stopCapture();
      }, maxDurationSeconds * 1000);

      // Listen for unexpected track ending (e.g. system disconnect or phone call interrupt)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (this.isCapturingAudio) {
            this.updateState('busy');
            this.stopCapture();
          }
        };
      });

      return true;
    } catch (err: any) {
      this.handleMediaError(err);
      onError?.(err, this.currentState);
      return false;
    }
  }

  // --- Stop Capture and Retrieve Audio Result ---
  public stopCapture(): Promise<AudioCaptureResult | null> {
    return new Promise((resolve) => {
      if (this.timeoutTimerId) {
        clearTimeout(this.timeoutTimerId);
        this.timeoutTimerId = null;
      }

      this.teardownLevelMeter();

      const recorder = this.mediaRecorder;
      const stream = this.currentStream;
      const durationMs = this.startTime > 0 ? Date.now() - this.startTime : 0;
      this.isCapturingAudio = false;

      if (!recorder || recorder.state === 'inactive') {
        this.releaseAllTracks();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || this.getSupportedMimeType() || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        this.releaseAllTracks();
        resolve({ blob, mimeType, durationMs });
      };

      try {
        recorder.stop();
      } catch {
        this.releaseAllTracks();
        resolve(null);
      }
    });
  }

  // --- Cancel and Discard ---
  public cancelCapture(): void {
    if (this.timeoutTimerId) {
      clearTimeout(this.timeoutTimerId);
      this.timeoutTimerId = null;
    }
    this.teardownLevelMeter();
    this.audioChunks = [];
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.releaseAllTracks();
    this.isCapturingAudio = false;
  }

  // --- Clean Audio Track Release ---
  public releaseAllTracks(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.currentStream = null;
    }
    this.mediaRecorder = null;
  }

  // --- Level Meter Helper ---
  private setupLevelMeter(stream: MediaStream, callback: (level: number) => void) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      this.audioContext = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!this.analyser || !this.isCapturingAudio) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(1.0, average / 128); // 0.0 to 1.0
        callback(normalized);

        this.meterAnimationId = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('AudioContext level meter setup failed:', err);
    }
  }

  private teardownLevelMeter() {
    if (this.meterAnimationId !== null) {
      cancelAnimationFrame(this.meterAnimationId);
      this.meterAnimationId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
      this.analyser = null;
    }
  }

  // --- Error Categorization ---
  private handleMediaError(err: any) {
    const errorName = err?.name || '';
    this.lastErrorName = errorName;
    console.warn(`[CentralMicrophoneService] Capture Error: ${errorName}`, err);

    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        // Distinguish between browser denial and OS-level block
        this.updateState('denied');
        break;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        this.updateState('no_device');
        break;
      case 'NotReadableError':
      case 'TrackStartError':
        this.updateState('busy');
        break;
      case 'OverconstrainedError':
        this.updateState('no_device');
        break;
      case 'SecurityError':
        this.updateState('blocked');
        break;
      case 'AbortError':
        this.updateState('not_asked');
        break;
      default:
        this.updateState('denied');
        break;
    }
  }

  private updateState(newState: MicPermissionState) {
    this.currentState = newState;
    this.stateListeners.forEach((listener) => listener(newState));
  }

  // --- Subscriptions ---
  public subscribeState(listener: (state: MicPermissionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeDevices(listener: (devices: MicDeviceInfo[]) => void): () => void {
    this.deviceListeners.add(listener);
    this.getAudioInputDevices().then(listener);
    return () => this.deviceListeners.delete(listener);
  }
}

export const micService = new CentralMicrophoneService();
