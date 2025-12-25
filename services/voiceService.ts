/**
 * Voice Service - v2.9 Premium Voice Integration
 *
 * Frontend service for managing voice TTS operations:
 * - Streaming audio playback from premium providers
 * - Voice settings management
 * - Quota tracking
 * - Browser TTS fallback
 */

import { supabase } from '../lib/supabase';

// Types
export interface VoiceSettings {
  preferredProvider: 'browser' | 'openai' | 'elevenlabs';
  preferredPersona: 'maya' | 'james' | 'tonya' | 'custom' | 'system';  // Tonya added for v2.9
  customVoiceId?: string;
  customVoiceName?: string;
  customVoiceStatus: 'none' | 'pending' | 'processing' | 'ready' | 'failed';
  language: string;
  voiceSpeed: number;
  voicePitch: number;
  autoPlayAffirmations: boolean;
  useClonedVoiceForAffirmations: boolean;
}

export interface VoiceQuota {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string | null;
}

export interface VoicePersona {
  name: string;
  displayName: string;
  description: string;
  gender: string;
  style: string;
  previewUrl: string | null;
  available: boolean;
}

export interface VoiceClone {
  id: string;
  voiceName: string;
  status: 'processing' | 'ready' | 'failed' | 'deleted';
  qualityScore: number | null;
  createdAt: string;
  readyAt: string | null;
}

export interface VoiceFeatures {
  canUseOpenAI: boolean;
  canUseElevenLabs: boolean;
  canCloneVoice: boolean;
  canUseMultiLanguage: boolean;
  maxClones: number;
}

export interface VoiceSettingsResponse {
  settings: VoiceSettings;
  tier: string;
  quota: VoiceQuota;
  usage: Array<{
    provider: string;
    total_characters: number;
    total_requests: number;
    estimated_cost: number;
  }>;
  personas: VoicePersona[];
  voiceClones: VoiceClone[];
  features: VoiceFeatures;
}

export interface TTSResult {
  provider: 'browser' | 'openai' | 'elevenlabs' | 'google';
  audioBlob?: Blob;
  audioUrl?: string;
  text?: string; // For browser fallback
  charactersUsed: number;
  quotaRemaining: number;
  error?: string;
}

// Service class
class VoiceService {
  private audioElement: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private settings: VoiceSettings | null = null;
  private quota: VoiceQuota | null = null;

  constructor() {
    // Initialize audio element for streaming playback
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.preload = 'none';
    }
  }

  /**
   * Get user voice settings and quota info
   */
  async getSettings(): Promise<VoiceSettingsResponse> {
    const { data, error } = await supabase.functions.invoke('voice-settings', {
      method: 'GET',
    });

    if (error) {
      console.error('Failed to fetch voice settings:', error);
      throw new Error('Failed to fetch voice settings');
    }

    // Cache settings and quota
    this.settings = data.settings;
    this.quota = data.quota;

    return data;
  }

  /**
   * Update user voice settings
   */
  async updateSettings(updates: Partial<VoiceSettings>): Promise<VoiceSettings> {
    const { data, error } = await supabase.functions.invoke('voice-settings', {
      method: 'PUT',
      body: updates,
    });

    if (error) {
      console.error('Failed to update voice settings:', error);
      throw new Error(error.message || 'Failed to update voice settings');
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to update settings');
    }

    // Update cached settings
    this.settings = { ...this.settings, ...data.settings };

    return data.settings;
  }

  /**
   * Generate TTS audio from text
   * Returns audio blob for streaming playback or text for browser TTS fallback
   *
   * Uses direct fetch instead of supabase.functions.invoke to properly handle
   * binary audio responses from the Edge Function.
   */
  async generateTTS(
    text: string,
    options?: {
      sessionId?: string;
      usageType?: 'coaching' | 'affirmation' | 'greeting' | 'preview' | 'other';
      preferredPersona?: 'maya' | 'james' | 'tonya' | 'custom' | 'system';
      language?: string;
    }
  ): Promise<TTSResult> {
    try {
      // Get auth session for authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('No auth session for TTS, falling back to browser');
        return {
          provider: 'browser',
          text,
          charactersUsed: 0,
          quotaRemaining: this.quota?.remaining || 0,
          error: 'Not authenticated',
        };
      }

      // Build the Edge Function URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/voice-tts-router`;

      // Use direct fetch to properly handle binary audio responses
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          text,
          sessionId: options?.sessionId,
          usageType: options?.usageType || 'coaching',
          preferredPersona: options?.preferredPersona || this.settings?.preferredPersona || 'maya',
          language: options?.language || this.settings?.language || 'en',
        }),
      });

      // Check response content type
      const contentType = response.headers.get('Content-Type') || '';

      // If response is audio, create blob and return
      if (contentType.includes('audio/')) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Get metadata from headers
        const provider = response.headers.get('X-Voice-Provider') || 'openai';
        const charactersUsed = parseInt(response.headers.get('X-Characters-Used') || '0', 10);
        const quotaRemaining = parseInt(response.headers.get('X-Quota-Remaining') || '0', 10);

        console.log(`TTS success: ${provider}, ${charactersUsed} chars, ${audioBlob.size} bytes`);

        return {
          provider: provider as TTSResult['provider'],
          audioBlob,
          audioUrl,
          charactersUsed,
          quotaRemaining,
        };
      }

      // Otherwise, response is JSON (browser fallback, error, or quota exceeded)
      const data = await response.json();

      // Check for quota exceeded
      if (data.code === 'QUOTA_EXCEEDED') {
        return {
          provider: 'browser',
          text: data.fallbackText || text,
          charactersUsed: 0,
          quotaRemaining: data.quotaInfo?.remaining || 0,
          error: 'Monthly quota exceeded',
        };
      }

      // Browser fallback
      if (data.provider === 'browser') {
        return {
          provider: 'browser',
          text: data.text || text,
          charactersUsed: 0,
          quotaRemaining: this.quota?.remaining || 0,
        };
      }

      // Error with fallback text
      if (data.error) {
        console.warn('TTS error from edge function:', data.error);
        return {
          provider: 'browser',
          text: data.fallbackText || text,
          charactersUsed: 0,
          quotaRemaining: 0,
          error: data.error,
        };
      }

      // Fallback: treat as browser TTS
      return {
        provider: 'browser',
        text,
        charactersUsed: 0,
        quotaRemaining: this.quota?.remaining || 0,
      };
    } catch (error: any) {
      console.error('TTS generation error:', error);
      return {
        provider: 'browser',
        text,
        charactersUsed: 0,
        quotaRemaining: this.quota?.remaining || 0,
        error: error.message,
      };
    }
  }

  /**
   * Play TTS audio with proper cleanup
   */
  async playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioElement) {
        reject(new Error('Audio element not initialized'));
        return;
      }

      // Clean up previous audio URL
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
      }

      this.currentAudioUrl = audioUrl;
      this.audioElement.src = audioUrl;

      this.audioElement.onended = () => {
        resolve();
      };

      this.audioElement.onerror = (e) => {
        reject(new Error('Audio playback failed'));
      };

      this.audioElement.play().catch(reject);
    });
  }

  /**
   * Stop current audio playback
   */
  stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.audioElement ? !this.audioElement.paused : false;
  }

  /**
   * Get current quota status
   */
  getQuota(): VoiceQuota | null {
    return this.quota;
  }

  /**
   * Get cached settings
   */
  getCachedSettings(): VoiceSettings | null {
    return this.settings;
  }

  /**
   * Use browser TTS as fallback
   */
  async speakWithBrowserTTS(
    text: string,
    options?: {
      voice?: SpeechSynthesisVoice;
      rate?: number;
      pitch?: number;
      volume?: number;
      onEnd?: () => void;
      onError?: (error: SpeechSynthesisErrorEvent) => void;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate ?? this.settings?.voiceSpeed ?? 1.0;
      utterance.pitch = options?.pitch ?? this.settings?.voicePitch ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      if (options?.voice) {
        utterance.voice = options.voice;
      } else {
        // Try to find a good default voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            v.name.includes('Samantha') ||
            v.name.includes('Google') ||
            v.name.includes('Microsoft') ||
            v.lang.startsWith('en')
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onend = () => {
        options?.onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        options?.onError?.(event);
        reject(new Error('Speech synthesis error'));
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAudio();
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    this.audioElement = null;
  }
}

// Export singleton instance
export const voiceService = new VoiceService();

// Export class for testing
export { VoiceService };
