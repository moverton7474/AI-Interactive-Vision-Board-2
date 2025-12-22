/**
 * Gemini Live Voice Service
 *
 * Provides frontend interface for real-time bidirectional voice
 * conversations with Gemini Live API via edge functions.
 *
 * Features:
 * - Session management (start, process, end)
 * - Audio recording and streaming
 * - Text-to-speech playback
 * - Usage tracking
 *
 * @module geminiLiveService
 */

import { supabase } from '../lib/supabase';

// ============================================
// Types
// ============================================

export interface LiveSession {
  id: string;
  session_type: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  status: 'active' | 'ended' | 'failed' | 'interrupted';
}

export interface EligibilityResult {
  allowed: boolean;
  reason: string;
  tier: string;
  limit_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
}

export interface SessionStartResult {
  session: LiveSession;
  openingMessage: string;
  eligibility: EligibilityResult;
  model: string;
}

export interface ProcessResult {
  response: string;
  transcribedInput?: string;
  audioDurationMs?: number;
  turnCount: number;
}

export interface UsageResult {
  usage: EligibilityResult;
  sessions: LiveSession[];
  month: string;
}

export type LiveSessionType =
  | 'coaching'
  | 'goal_review'
  | 'habit_checkin'
  | 'motivation'
  | 'free_form';

// ============================================
// Audio Recording Utilities
// ============================================

/**
 * Audio Recorder for capturing voice input
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType()
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Failed to start audio recording:', error);
      throw new Error('Microphone access denied or unavailable');
    }
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.getSupportedMimeType()
        });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return 'audio/webm'; // Fallback
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

/**
 * Convert Blob to base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================
// Service Functions
// ============================================

/**
 * Check if user can start a live voice session
 */
export async function checkEligibility(): Promise<EligibilityResult> {
  const { data, error } = await supabase.functions.invoke('gemini-live-session', {
    body: { action: 'check_eligibility' }
  });

  if (error) {
    console.error('Eligibility check failed:', error);
    throw new Error(error.message || 'Failed to check eligibility');
  }

  if (!data.success) {
    throw new Error(data.error || 'Eligibility check failed');
  }

  return data as EligibilityResult;
}

/**
 * Start a new live voice session
 */
export async function startSession(
  sessionType: LiveSessionType = 'coaching'
): Promise<SessionStartResult> {
  const { data, error } = await supabase.functions.invoke('gemini-live-session', {
    body: {
      action: 'start',
      sessionType
    }
  });

  if (error) {
    console.error('Failed to start session:', error);
    throw new Error(error.message || 'Failed to start session');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to start session');
  }

  return data as SessionStartResult;
}

/**
 * Process audio input and get AI response
 */
export async function processAudio(
  sessionId: string,
  audioBlob: Blob
): Promise<ProcessResult> {
  const audioData = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/webm';

  const { data, error } = await supabase.functions.invoke('gemini-live-session', {
    body: {
      action: 'process_audio',
      sessionId,
      audioData,
      mimeType
    }
  });

  if (error) {
    console.error('Failed to process audio:', error);
    throw new Error(error.message || 'Failed to process audio');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to process audio');
  }

  return data as ProcessResult;
}

/**
 * Process text input (fallback when audio not available)
 */
export async function processText(
  sessionId: string,
  text: string
): Promise<ProcessResult> {
  const { data, error } = await supabase.functions.invoke('gemini-live-session', {
    body: {
      action: 'process_text',
      sessionId,
      text
    }
  });

  if (error) {
    console.error('Failed to process text:', error);
    throw new Error(error.message || 'Failed to process text');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to process text');
  }

  return data as ProcessResult;
}

/**
 * End a live voice session
 */
export async function endSession(
  sessionId: string,
  errorMessage?: string,
  errorCode?: string
): Promise<{ session: LiveSession; message: string }> {
  const { data, error } = await supabase.functions.invoke('gemini-live-session', {
    body: {
      action: 'end',
      sessionId,
      errorMessage,
      errorCode
    }
  });

  if (error) {
    console.error('Failed to end session:', error);
    throw new Error(error.message || 'Failed to end session');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to end session');
  }

  return data as { session: LiveSession; message: string };
}

/**
 * Get user's monthly usage statistics
 */
export async function getUsage(): Promise<UsageResult> {
  const { data, error } = await supabase.functions.invoke('gemini-live-session', {
    body: { action: 'get_usage' }
  });

  if (error) {
    console.error('Failed to get usage:', error);
    throw new Error(error.message || 'Failed to get usage');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to get usage');
  }

  return data as UsageResult;
}

// ============================================
// Text-to-Speech Utility
// ============================================

/**
 * Speak text using browser's speech synthesis
 */
export function speakText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    onEnd?: () => void;
    onError?: (error: Error) => void;
  }
): SpeechSynthesisUtterance {
  const synth = window.speechSynthesis;

  // Cancel any ongoing speech
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 1.0;
  utterance.pitch = options?.pitch ?? 1.0;

  // Try to use a natural voice
  const voices = synth.getVoices();
  const preferredVoice = voices.find(v =>
    v.name.includes('Samantha') ||
    v.name.includes('Google') ||
    v.name.includes('Microsoft')
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }

  if (options?.onError) {
    utterance.onerror = () => options.onError!(new Error('Speech synthesis error'));
  }

  synth.speak(utterance);
  return utterance;
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}

/**
 * Check if speech synthesis is speaking
 */
export function isSpeaking(): boolean {
  return window.speechSynthesis.speaking;
}

// ============================================
// Export all
// ============================================

export default {
  checkEligibility,
  startSession,
  processAudio,
  processText,
  endSession,
  getUsage,
  speakText,
  stopSpeaking,
  isSpeaking,
  AudioRecorder,
  blobToBase64
};
