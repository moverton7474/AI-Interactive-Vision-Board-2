import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onBack?: () => void;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Session {
  id: string;
  session_type: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  key_topics?: string[];
  sentiment_score?: number;
}

type SessionType = 'morning_routine' | 'check_in' | 'reflection' | 'goal_setting' | 'celebration' | 'accountability' | 'crisis_support';

const SESSION_TYPES: { type: SessionType; label: string; description: string; icon: string }[] = [
  { type: 'morning_routine', label: 'Morning Routine', description: 'Start your day with intention', icon: '🌅' },
  { type: 'check_in', label: 'Check-In', description: 'How are you doing right now?', icon: '💬' },
  { type: 'reflection', label: 'Reflection', description: 'Look back and learn', icon: '🪞' },
  { type: 'goal_setting', label: 'Goal Setting', description: 'Define what you want to achieve', icon: '🎯' },
  { type: 'celebration', label: 'Celebration', description: 'Acknowledge your wins', icon: '🎉' },
  { type: 'accountability', label: 'Accountability', description: 'Review your commitments', icon: '📋' },
  { type: 'crisis_support', label: 'Support', description: 'Get through difficult moments', icon: '🤝' },
];

/**
 * VoiceCoach - Voice-based coaching interface
 *
 * Provides a conversational interface for voice coaching sessions
 * with AMIE personality integration. Uses text input as primary
 * interface with voice support where available.
 */
const VoiceCoach: React.FC<Props> = ({ onBack }) => {
  const [view, setView] = useState<'select' | 'session' | 'history'>('select');
  const [selectedType, setSelectedType] = useState<SessionType | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [openingMessage, setOpeningMessage] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  const [themeName, setThemeName] = useState<string>('AMIE');

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom when transcript updates
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Initialize speech recognition if available
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInputText(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('voice-coach-session', {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.data?.sessions) {
        setSessions(response.data.sessions);
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (type: SessionType) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to start a session');
      }

      const response = await supabase.functions.invoke('voice-coach-session', {
        body: { sessionType: type },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to start session');
      }

      const { session: newSession, openingMessage: greeting, theme } = response.data;

      setActiveSession(newSession);
      setSelectedType(type);
      setOpeningMessage(greeting);
      setTranscript([{
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toISOString()
      }]);
      setThemeName(theme?.name || 'AMIE');
      setView('session');
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeSession || isProcessing) return;

    const userMessage = inputText.trim();
    setInputText('');
    setIsProcessing(true);

    // Add user message to transcript immediately
    setTranscript(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');

      const response = await supabase.functions.invoke('voice-coach-session', {
        body: {
          sessionId: activeSession.id,
          transcript: userMessage
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to process message');
      }

      const { response: aiResponse } = response.data;

      // Add AI response to transcript
      setTranscript(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      }]);

      // Speak response if speech synthesis available
      if ('speechSynthesis' in window && aiResponse) {
        const utterance = new SpeechSynthesisUtterance(aiResponse);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');

      const response = await supabase.functions.invoke('voice-coach-session', {
        body: { sessionId: activeSession.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to end session');
      }

      setSessionSummary(response.data.summary);
    } catch (err: any) {
      console.error('Error ending session:', err);
      setError(err.message || 'Failed to end session');
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Voice input not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const resetSession = () => {
    setActiveSession(null);
    setTranscript([]);
    setOpeningMessage('');
    setSessionSummary(null);
    setSelectedType(null);
    setView('select');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Session Summary View
  if (sessionSummary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-serif font-bold text-navy-900">Session Complete</h2>
            <p className="text-gray-500 mt-1">{sessionSummary.duration} minute session</p>
          </div>

          {/* Key Topics */}
          {sessionSummary.keyTopics?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Key Topics</h3>
              <div className="flex flex-wrap gap-2">
                {sessionSummary.keyTopics.map((topic: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-navy-50 text-navy-700 rounded-full text-sm">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {sessionSummary.actionItems?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Action Items</h3>
              <ul className="space-y-2">
                {sessionSummary.actionItems.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                These have been added to your tasks
              </p>
            </div>
          )}

          {/* Sentiment */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Session Sentiment</h3>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  sessionSummary.sentiment > 0.6 ? 'bg-green-500' :
                  sessionSummary.sentiment > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${sessionSummary.sentiment * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Challenging</span>
              <span>Positive</span>
            </div>
          </div>

          <button
            onClick={resetSession}
            className="w-full bg-navy-900 text-white py-3 rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // Session History View
  if (view === 'history') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Session History</h1>
            <p className="text-gray-500 mt-1">Your past coaching conversations</p>
          </div>
          <button
            onClick={() => setView('select')}
            className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
          >
            ← Back
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎙️</span>
            </div>
            <h3 className="text-lg font-bold text-navy-900 mb-2">No Sessions Yet</h3>
            <p className="text-gray-500 mb-6">Start your first coaching session</p>
            <button
              onClick={() => setView('select')}
              className="bg-navy-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-navy-800"
            >
              Start Session
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const typeInfo = SESSION_TYPES.find(t => t.type === session.session_type);
              return (
                <div key={session.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeInfo?.icon || '💬'}</span>
                      <div>
                        <h3 className="font-semibold text-navy-900">{typeInfo?.label || session.session_type}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(session.started_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    {session.duration_minutes && (
                      <span className="text-sm text-gray-500">
                        {session.duration_minutes} min
                      </span>
                    )}
                  </div>
                  {session.key_topics && session.key_topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.key_topics.map((topic: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Active Session View
  if (view === 'session' && activeSession) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] max-w-2xl mx-auto">
        {/* Session Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {SESSION_TYPES.find(t => t.type === selectedType)?.icon || '💬'}
            </span>
            <div>
              <h2 className="font-semibold text-navy-900">
                {SESSION_TYPES.find(t => t.type === selectedType)?.label || 'Session'}
              </h2>
              <p className="text-xs text-gray-500">{themeName}</p>
            </div>
          </div>
          <button
            onClick={endSession}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
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
                    ? 'bg-navy-900 text-white rounded-br-md'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                }`}
              >
                {entry.role === 'assistant' && (
                  <p className="text-xs font-medium text-gold-600 mb-1">{themeName}</p>
                )}
                <p className="text-sm leading-relaxed">{entry.content}</p>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 rounded-bl-md">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type or use voice..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-500 focus:border-navy-500 resize-none"
                rows={1}
                disabled={isProcessing}
              />
              {recognitionRef.current && (
                <button
                  onClick={toggleListening}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || isProcessing}
              className="p-3 bg-navy-900 text-white rounded-xl hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {isListening && (
            <p className="text-xs text-center text-red-600 mt-2 animate-pulse">
              Listening... Speak now
            </p>
          )}
        </div>
      </div>
    );
  }

  // Session Type Selection View
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Voice Coach</h1>
          <p className="text-gray-500 mt-1">Have a conversation with your AI coach</p>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
            >
              ← Back
            </button>
          )}
          <button
            onClick={() => {
              fetchSessions();
              setView('history');
            }}
            className="text-navy-900 font-medium hover:text-gold-600 transition-colors"
          >
            History
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Session Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SESSION_TYPES.map(({ type, label, description, icon }) => (
          <button
            key={type}
            onClick={() => startSession(type)}
            disabled={loading}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-navy-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{icon}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-navy-900 group-hover:text-navy-700">
                  {label}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{description}</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-300 group-hover:text-navy-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-navy-50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-navy-900">How Voice Coach Works</h4>
            <p className="text-sm text-navy-700 mt-1">
              Choose a session type to begin a conversation with your personalized AI coach.
              Type your responses or use voice input (where supported). Your coach adapts
              to your communication style and remembers context from your vision board and goals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCoach;
