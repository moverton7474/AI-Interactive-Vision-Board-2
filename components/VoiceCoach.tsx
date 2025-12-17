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
// Demo responses for when Edge Function is unavailable
const DEMO_RESPONSES: Record<SessionType, string[]> = {
  morning_routine: [
    "Good morning! I'm here to help you start your day with intention. What's one thing you're grateful for today?",
    "That's wonderful to hear. Gratitude sets a positive tone for the day. What's your main focus or priority today?",
    "Great goal! Remember, progress over perfection. What's one small step you can take in the next hour toward that?",
    "I love that approach. You've got a clear vision. Go make it happen - I believe in you!"
  ],
  check_in: [
    "Hey there! I'm glad you're taking a moment to check in. How are you feeling right now, honestly?",
    "Thank you for sharing that with me. It's important to acknowledge our feelings. What's been on your mind the most today?",
    "I hear you. Sometimes just talking through things helps clarify our thoughts. What would make today feel successful for you?",
    "That's a great perspective. Remember, you have the power to shape your day. What's one action you can take right now?"
  ],
  reflection: [
    "Welcome to our reflection session. Taking time to reflect shows real self-awareness. What's been the highlight of your week so far?",
    "That sounds meaningful. What did you learn from that experience?",
    "Insights like that are valuable. Is there anything you'd do differently next time?",
    "Great reflection. These learnings will help you grow. What's one thing you want to carry forward?"
  ],
  goal_setting: [
    "Let's set some powerful goals together! What area of your life are you most excited to improve right now?",
    "That's an important area to focus on. What does success look like to you in 3 months?",
    "I can see that vision clearly. What's the first milestone you need to hit to get there?",
    "Excellent! Now let's make it actionable. What's one thing you'll commit to doing this week?"
  ],
  celebration: [
    "Time to celebrate! 🎉 What's a recent win you're proud of, big or small?",
    "That's absolutely worth celebrating! How did it feel when you accomplished that?",
    "You should be proud of yourself. What strength or quality helped you achieve this?",
    "Acknowledging our wins builds confidence. Carry this positive energy forward!"
  ],
  accountability: [
    "Let's review your commitments. What goals or tasks did you set for yourself recently?",
    "Thanks for sharing. How much progress have you made on those?",
    "Progress is progress, no matter the pace. What's been your biggest obstacle?",
    "I understand. What support or changes would help you stay on track going forward?"
  ],
  crisis_support: [
    "I'm here for you. It takes courage to reach out. What's weighing on you right now?",
    "Thank you for trusting me with this. Your feelings are valid. Have you been able to talk to anyone else about this?",
    "You're not alone in this. What's one small thing that usually helps you feel a bit better?",
    "Remember, difficult moments are temporary. You've overcome challenges before, and you will again. What's one thing you can do right now to take care of yourself?"
  ]
};

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
  const [demoMode, setDemoMode] = useState(false);
  const [demoResponseIndex, setDemoResponseIndex] = useState(0);
  const [autoListen, setAutoListen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

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
      recognitionRef.current.continuous = true; // Keep listening even with pauses
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      let finalTranscript = '';
      let silenceTimer: any = null;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript = transcript;
          }
        }

        // Update input with both final and interim results
        setInputText((finalTranscript + interimTranscript).trim());

        // Reset silence timer - give user 3 seconds of silence before stopping
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (recognitionRef.current && isListening) {
            // Don't auto-stop, let user click button to send
            // But we could implement auto-send here if desired
          }
        }, 3000);
      };

      recognitionRef.current.onend = () => {
        // If continuous mode ends unexpectedly and we're still supposed to be listening, restart
        if (isListening && !isSpeaking) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            setIsListening(false);
            finalTranscript = '';
          }
        } else {
          setIsListening(false);
          finalTranscript = '';
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        // Only stop if it's a real error, not just no-speech
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsListening(false);
        }
      };
    }
  }, [isListening, isSpeaking]);

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
      setDemoMode(false);
      setDemoResponseIndex(0);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to start a session');
      }

      try {
        const response = await supabase.functions.invoke('voice-coach-session', {
          body: { action: 'start', sessionType: type },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          console.error('Voice coach API error:', response.error);
          throw new Error(response.error.message || 'Failed to start session');
        }

        console.log('Voice coach response:', response.data);
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
      } catch (apiErr: any) {
        // Fall back to demo mode if Edge Function fails
        console.warn('Edge Function unavailable, starting demo mode:', apiErr);
        setDemoMode(true);

        const demoGreeting = DEMO_RESPONSES[type][0];
        const demoSession: Session = {
          id: `demo-${Date.now()}`,
          session_type: type,
          started_at: new Date().toISOString()
        };

        setActiveSession(demoSession);
        setSelectedType(type);
        setOpeningMessage(demoGreeting);
        setTranscript([{
          role: 'assistant',
          content: demoGreeting,
          timestamp: new Date().toISOString()
        }]);
        setDemoResponseIndex(1);
        setThemeName('AMIE Coach');
        setView('session');
      }
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
      let aiResponse: string;

      if (demoMode && selectedType) {
        // Use demo responses
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate thinking
        const responses = DEMO_RESPONSES[selectedType];
        aiResponse = responses[Math.min(demoResponseIndex, responses.length - 1)];
        setDemoResponseIndex(prev => prev + 1);
      } else {
        // Use Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Session expired');

        const response = await supabase.functions.invoke('voice-coach-session', {
          body: {
            action: 'process',
            sessionId: activeSession.id,
            transcript: userMessage
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.error) {
          console.error('Voice coach process error:', response.error);
          throw new Error(response.error.message || 'Failed to process message');
        }

        console.log('AI Response:', response.data);
        aiResponse = response.data.response;
      }

      // Add AI response to transcript
      setTranscript(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      }]);

      // Speak response if speech synthesis available
      if ('speechSynthesis' in window && aiResponse) {
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(aiResponse);
        utterance.rate = 0.9;
        utterance.pitch = 1;

        // Try to use a natural voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
          v.name.includes('Samantha') ||
          v.name.includes('Google') ||
          v.name.includes('Microsoft')
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          setIsSpeaking(false);
          // Auto-listen after AI speaks if enabled
          if (autoListen && recognitionRef.current && activeSession) {
            setTimeout(() => {
              try {
                recognitionRef.current.start();
                setIsListening(true);
              } catch (err) {
                console.log('Could not auto-start listening');
              }
            }, 500);
          }
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
        };

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

      if (demoMode) {
        // Create demo summary
        const demoSummary = {
          duration: Math.round((Date.now() - new Date(activeSession.started_at).getTime()) / 60000) || 1,
          keyTopics: ['Personal growth', 'Goal setting', 'Self-reflection'],
          actionItems: ['Review your goals daily', 'Practice gratitude', 'Take one small action today'],
          sentiment: 0.75
        };
        setSessionSummary(demoSummary);
      } else {
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
      }
    } catch (err: any) {
      console.error('Error ending session:', err);
      // Even on error, show a basic summary
      setSessionSummary({
        duration: Math.round((Date.now() - new Date(activeSession.started_at).getTime()) / 60000) || 1,
        keyTopics: [],
        actionItems: [],
        sentiment: 0.5
      });
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
    setDemoMode(false);
    setDemoResponseIndex(0);
    setError(null);
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
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{themeName}</p>
                {demoMode && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Demo Mode
                  </span>
                )}
              </div>
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

          {/* Auto-listen toggle and Speaking indicator */}
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoListen}
                onChange={(e) => setAutoListen(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
              />
              Auto-listen after response
            </label>
            {isSpeaking && (
              <button
                type="button"
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }}
                className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1 hover:bg-purple-200"
              >
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                Speaking... (tap to stop)
              </button>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type or use voice..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-500 focus:border-navy-500 resize-none"
                rows={1}
                disabled={isProcessing || isSpeaking}
              />
              {recognitionRef.current && (
                <button
                  onClick={toggleListening}
                  disabled={isSpeaking}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50'
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
              disabled={!inputText.trim() || isProcessing || isSpeaking}
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
