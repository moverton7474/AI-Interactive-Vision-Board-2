/**
 * useGeminiLive - React Hook for Gemini Live Voice Sessions
 *
 * Manages state and provides methods for real-time voice
 * conversations with Gemini Live API.
 *
 * Features:
 * - Session lifecycle management
 * - Audio recording and processing
 * - Speech synthesis
 * - Usage tracking
 * - Error handling
 *
 * @module useGeminiLive
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AudioRecorder,
  checkEligibility,
  startSession,
  processAudio,
  processText,
  endSession,
  getUsage,
  speakText,
  stopSpeaking,
  isSpeaking,
  LiveSession,
  LiveSessionType,
  EligibilityResult,
  ProcessResult
} from '../services/geminiLiveService';

// ============================================
// Types
// ============================================

export type ConnectionState =
  | 'idle'
  | 'checking'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UseGeminiLiveReturn {
  // State
  connectionState: ConnectionState;
  voiceState: VoiceState;
  session: LiveSession | null;
  eligibility: EligibilityResult | null;
  transcript: TranscriptEntry[];
  error: string | null;
  isRecording: boolean;
  isSpeaking: boolean;

  // Actions
  checkCanStart: () => Promise<boolean>;
  start: (sessionType?: LiveSessionType) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  sendText: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  end: () => Promise<void>;
  getUsageStats: () => Promise<EligibilityResult | null>;
  clearError: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useGeminiLive(): UseGeminiLiveReturn {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [session, setSession] = useState<LiveSession | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingState, setSpeakingState] = useState(false);

  // Refs
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Keep session ID ref in sync
  useEffect(() => {
    sessionIdRef.current = session?.id || null;
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current).catch(console.error);
      }
    };
  }, []);

  /**
   * Check if user can start a live voice session
   */
  const checkCanStart = useCallback(async (): Promise<boolean> => {
    try {
      setConnectionState('checking');
      setError(null);

      const result = await checkEligibility();
      setEligibility(result);
      setConnectionState('idle');

      return result.allowed;
    } catch (err: any) {
      console.error('Eligibility check failed:', err);
      setError(err.message || 'Failed to check eligibility');
      setConnectionState('error');
      return false;
    }
  }, []);

  /**
   * Start a new live voice session
   */
  const start = useCallback(async (sessionType: LiveSessionType = 'coaching'): Promise<void> => {
    try {
      setConnectionState('connecting');
      setError(null);
      setTranscript([]);

      const result = await startSession(sessionType);

      setSession(result.session);
      setEligibility(result.eligibility);
      setConnectionState('connected');

      // Add opening message to transcript
      const openingEntry: TranscriptEntry = {
        role: 'assistant',
        content: result.openingMessage,
        timestamp: new Date().toISOString()
      };
      setTranscript([openingEntry]);

      // Speak the opening message
      setVoiceState('speaking');
      setSpeakingState(true);
      speakText(result.openingMessage, {
        onEnd: () => {
          setVoiceState('idle');
          setSpeakingState(false);
        },
        onError: () => {
          setVoiceState('idle');
          setSpeakingState(false);
        }
      });

    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(err.message || 'Failed to start session');
      setConnectionState('error');
    }
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async (): Promise<void> => {
    if (!session) {
      setError('No active session');
      return;
    }

    if (speakingState) {
      stopSpeaking();
      setSpeakingState(false);
    }

    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorder();
      }

      await audioRecorderRef.current.start();
      setIsRecording(true);
      setVoiceState('listening');
      setError(null);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
      setVoiceState('idle');
    }
  }, [session, speakingState]);

  /**
   * Stop recording and process audio
   */
  const stopRecording = useCallback(async (): Promise<void> => {
    if (!audioRecorderRef.current || !session) {
      return;
    }

    try {
      setVoiceState('processing');
      setIsRecording(false);

      const audioBlob = await audioRecorderRef.current.stop();

      // Add placeholder for user message
      const userEntry: TranscriptEntry = {
        role: 'user',
        content: '...',
        timestamp: new Date().toISOString()
      };
      setTranscript(prev => [...prev, userEntry]);

      // Process audio
      const result = await processAudio(session.id, audioBlob);

      // Update transcript with actual transcription
      setTranscript(prev => {
        const updated = [...prev];
        const lastUserIndex = updated.length - 1;
        if (updated[lastUserIndex]?.role === 'user') {
          updated[lastUserIndex].content = result.transcribedInput || '[Voice input]';
        }
        // Add AI response
        updated.push({
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString()
        });
        return updated;
      });

      // Speak the response
      setVoiceState('speaking');
      setSpeakingState(true);
      speakText(result.response, {
        onEnd: () => {
          setVoiceState('idle');
          setSpeakingState(false);
        },
        onError: () => {
          setVoiceState('idle');
          setSpeakingState(false);
        }
      });

    } catch (err: any) {
      console.error('Failed to process audio:', err);
      setError(err.message || 'Failed to process audio');
      setVoiceState('idle');

      // Remove the placeholder user message
      setTranscript(prev => prev.slice(0, -1));
    }
  }, [session]);

  /**
   * Send text input (fallback for when voice not available)
   */
  const sendText = useCallback(async (text: string): Promise<void> => {
    if (!session || !text.trim()) {
      return;
    }

    if (speakingState) {
      stopSpeaking();
      setSpeakingState(false);
    }

    try {
      setVoiceState('processing');

      // Add user message to transcript
      const userEntry: TranscriptEntry = {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      };
      setTranscript(prev => [...prev, userEntry]);

      // Process text
      const result = await processText(session.id, text);

      // Add AI response to transcript
      const aiEntry: TranscriptEntry = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString()
      };
      setTranscript(prev => [...prev, aiEntry]);

      // Speak the response
      setVoiceState('speaking');
      setSpeakingState(true);
      speakText(result.response, {
        onEnd: () => {
          setVoiceState('idle');
          setSpeakingState(false);
        },
        onError: () => {
          setVoiceState('idle');
          setSpeakingState(false);
        }
      });

    } catch (err: any) {
      console.error('Failed to send text:', err);
      setError(err.message || 'Failed to send message');
      setVoiceState('idle');
    }
  }, [session, speakingState]);

  /**
   * Stop speaking
   */
  const handleStopSpeaking = useCallback((): void => {
    stopSpeaking();
    setSpeakingState(false);
    setVoiceState('idle');
  }, []);

  /**
   * End the session
   */
  const end = useCallback(async (): Promise<void> => {
    if (!session) {
      return;
    }

    try {
      stopSpeaking();
      setSpeakingState(false);
      setVoiceState('idle');

      await endSession(session.id);

      setSession(null);
      setConnectionState('disconnected');
    } catch (err: any) {
      console.error('Failed to end session:', err);
      // Still clear the session state
      setSession(null);
      setConnectionState('disconnected');
    }
  }, [session]);

  /**
   * Get usage statistics
   */
  const getUsageStats = useCallback(async (): Promise<EligibilityResult | null> => {
    try {
      const result = await getUsage();
      setEligibility(result.usage);
      return result.usage;
    } catch (err: any) {
      console.error('Failed to get usage:', err);
      return null;
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    // State
    connectionState,
    voiceState,
    session,
    eligibility,
    transcript,
    error,
    isRecording,
    isSpeaking: speakingState,

    // Actions
    checkCanStart,
    start,
    startRecording,
    stopRecording,
    sendText,
    stopSpeaking: handleStopSpeaking,
    end,
    getUsageStats,
    clearError
  };
}

export default useGeminiLive;
