/**
 * LiveVoiceCoach - Real-time Voice Conversation Component
 *
 * Provides a UI for real-time bidirectional voice conversations
 * with Gemini Live API. This is a NEW feature separate from the
 * existing VoiceCoach component.
 *
 * Features:
 * - Real-time audio recording and streaming
 * - Speech synthesis for AI responses
 * - Visual feedback for connection and voice states
 * - Usage tracking and tier gating
 * - Text fallback when audio not available
 *
 * Tier Requirements: PRO and ELITE only
 *
 * @module LiveVoiceCoach
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGeminiLive, TranscriptEntry } from '../hooks/useGeminiLive';
import { LiveSessionType } from '../services/geminiLiveService';

interface Props {
  onBack?: () => void;
}

const SESSION_TYPES: { type: LiveSessionType; label: string; icon: string; description: string }[] = [
  { type: 'coaching', label: 'Live Coaching', icon: '🎙️', description: 'Real-time conversation' },
  { type: 'goal_review', label: 'Goal Review', icon: '🎯', description: 'Review your goals' },
  { type: 'habit_checkin', label: 'Habit Check', icon: '✅', description: 'Quick habit review' },
  { type: 'motivation', label: 'Motivation', icon: '⚡', description: 'Get energized' },
  { type: 'free_form', label: 'Free Talk', icon: '💬', description: 'Open conversation' },
];

const LiveVoiceCoach: React.FC<Props> = ({ onBack }) => {
  const {
    connectionState,
    voiceState,
    session,
    eligibility,
    transcript,
    error,
    isRecording,
    isSpeaking,
    checkCanStart,
    start,
    startRecording,
    stopRecording,
    sendText,
    stopSpeaking,
    end,
    getUsageStats,
    clearError
  } = useGeminiLive();

  const [view, setView] = useState<'check' | 'select' | 'session'>('check');
  const [inputText, setInputText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when transcript updates
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Check eligibility on mount
  useEffect(() => {
    checkCanStart().then(canStart => {
      if (canStart) {
        setView('select');
      }
    });
  }, [checkCanStart]);

  const handleStartSession = async (type: LiveSessionType) => {
    await start(type);
    setView('session');
  };

  const handleEndSession = async () => {
    await end();
    setView('select');
    getUsageStats(); // Refresh usage
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendText(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Eligibility Check / Upgrade View
  if (view === 'check' && !eligibility?.allowed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎙️</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-navy-900 mb-2">
            Gemini Live Voice
          </h2>
          <p className="text-gray-600 mb-6">
            Real-time bidirectional voice conversation with AI
          </p>

          {connectionState === 'checking' ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : connectionState === 'error' ? (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4">
              {error || 'Failed to check eligibility'}
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
                <p className="text-amber-800">
                  {eligibility?.reason || 'Live voice requires PRO subscription or higher'}
                </p>
              </div>

              <button
                onClick={() => window.location.href = '/settings?tab=subscription'}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
              >
                Upgrade to PRO
              </button>
            </>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to Voice Coach
            </button>
          )}
        </div>
      </div>
    );
  }

  // Session Type Selection View
  if (view === 'select') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🎙️</span>
              <h1 className="text-3xl font-serif font-bold text-navy-900">Gemini Live Voice</h1>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                BETA
              </span>
            </div>
            <p className="text-gray-500">Real-time AI conversation</p>
          </div>
          <div className="flex items-center gap-4">
            {eligibility && (
              <div className="text-right text-sm">
                <div className="text-gray-500">
                  {eligibility.remaining_minutes.toFixed(1)} min remaining
                </div>
                <div className="text-xs text-gray-400">
                  of {eligibility.limit_minutes} min/month
                </div>
              </div>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        )}

        {/* Session Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {SESSION_TYPES.map(({ type, label, icon, description }) => (
            <button
              key={type}
              onClick={() => handleStartSession(type)}
              disabled={connectionState === 'connecting'}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-navy-900 group-hover:text-purple-700">
                    {label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-navy-900">How Live Voice Works</h4>
              <p className="text-sm text-navy-700 mt-1">
                Have a natural, real-time conversation with AMIE. Press and hold the microphone
                to speak, release to hear the response. You can interrupt at any time.
                This uses Gemini's advanced audio processing for a more natural experience.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Session View
  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-2xl mx-auto">
      {/* Session Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionState === 'connected' ? 'bg-green-400 animate-pulse' :
            connectionState === 'error' ? 'bg-red-400' : 'bg-yellow-400'
          }`} />
          <div>
            <h2 className="font-semibold">Live Session</h2>
            <p className="text-xs text-purple-200">
              {SESSION_TYPES.find(t => t.type === session?.session_type)?.label || 'Coaching'}
            </p>
          </div>
        </div>
        <button
          onClick={handleEndSession}
          className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {transcript.map((entry, index) => (
          <div
            key={index}
            className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                entry.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
              }`}
            >
              {entry.role === 'assistant' && (
                <p className="text-xs font-medium text-purple-600 mb-1">AMIE</p>
              )}
              <p className="text-sm leading-relaxed">{entry.content}</p>
            </div>
          </div>
        ))}

        {voiceState === 'processing' && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 rounded-bl-md">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Voice Control Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {/* Voice State Indicator */}
        <div className="flex items-center justify-center mb-4">
          <div className={`text-sm px-3 py-1 rounded-full ${
            voiceState === 'listening' ? 'bg-red-100 text-red-600 animate-pulse' :
            voiceState === 'processing' ? 'bg-purple-100 text-purple-600' :
            voiceState === 'speaking' ? 'bg-green-100 text-green-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {voiceState === 'listening' ? '● Recording...' :
             voiceState === 'processing' ? 'Processing...' :
             voiceState === 'speaking' ? '🔊 Speaking...' :
             'Ready'}
          </div>
        </div>

        {/* Main Voice Button */}
        <div className="flex flex-col items-center gap-4">
          {isSpeaking ? (
            <button
              onClick={stopSpeaking}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
              </svg>
            </button>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center animate-pulse"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={voiceState === 'processing'}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}

          <p className="text-xs text-gray-500">
            {isRecording ? 'Tap to send' :
             isSpeaking ? 'Tap to interrupt' :
             'Tap to speak'}
          </p>
        </div>

        {/* Text Input Toggle */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
          >
            <svg className={`w-3 h-3 transition-transform ${showTextInput ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showTextInput ? 'Hide' : 'Show'} text input
          </button>

          {showTextInput && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type instead..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  rows={1}
                  disabled={voiceState === 'processing' || isSpeaking}
                />
              </div>
              <button
                onClick={handleSendText}
                disabled={!inputText.trim() || voiceState === 'processing' || isSpeaking}
                className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceCoach;
