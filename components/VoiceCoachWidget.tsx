import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface TranscriptMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface SessionStats {
    total_sessions: number;
    total_minutes: number;
    avg_sentiment: number;
    sessions_this_week: number;
}

const SESSION_TYPES = [
    { id: 'check_in', label: 'Check-in', icon: '💬', description: 'Daily emotional check-in' },
    { id: 'morning_routine', label: 'Morning', icon: '☀️', description: 'Start your day right' },
    { id: 'reflection', label: 'Reflect', icon: '🪞', description: 'Deep reflection session' },
    { id: 'goal_setting', label: 'Goals', icon: '🎯', description: 'Clarify your goals' },
    { id: 'celebration', label: 'Celebrate', icon: '🎉', description: 'Celebrate your wins' },
    { id: 'accountability', label: 'Review', icon: '📊', description: 'Progress accountability' },
];

const VoiceCoachWidget: React.FC = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [selectedType, setSelectedType] = useState('check_in');
    const [conversationHistory, setConversationHistory] = useState<TranscriptMessage[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [stats, setStats] = useState<SessionStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoListen, setAutoListen] = useState(false);

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
    const historyRef = useRef<HTMLDivElement>(null);

    // Refs to track state in callbacks (avoid stale closures)
    const isListeningRef = useRef(isListening);
    const isSpeakingRef = useRef(isSpeaking);
    const sessionIdRef = useRef(sessionId);
    const accumulatedTranscriptRef = useRef('');
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep refs in sync with state
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        isSpeakingRef.current = isSpeaking;
    }, [isSpeaking]);

    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    useEffect(() => {
        // Get user session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
                loadSessionStats(session.user.id);
            }
        });

        // Initialize Speech Recognition
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true; // Keep listening even with pauses
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.maxAlternatives = 1;

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                setStatus('listening');
                setError(null);
            };

            recognitionRef.current.onend = () => {
                // If continuous mode ends unexpectedly and we're still supposed to be listening, restart
                if (isListeningRef.current && !isSpeakingRef.current && sessionIdRef.current) {
                    // Add a small delay before restarting to prevent rapid restart loops
                    setTimeout(() => {
                        if (isListeningRef.current && !isSpeakingRef.current && recognitionRef.current) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {
                                console.log('Could not restart recognition:', e);
                                setIsListening(false);
                                setStatus('idle');
                            }
                        }
                    }, 300);
                } else {
                    setIsListening(false);
                    if (!isSpeakingRef.current) {
                        setStatus('idle');
                    }
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                // Provide specific error messages based on error type
                let errorMessage: string;
                switch (event.error) {
                    case 'not-allowed':
                        errorMessage = 'Microphone access denied. Please enable it in your browser settings.';
                        break;
                    case 'no-speech':
                        // Don't show error for no-speech, just reset
                        setIsListening(false);
                        setStatus('idle');
                        return;
                    case 'audio-capture':
                        errorMessage = 'No microphone found. Please connect a microphone and try again.';
                        break;
                    case 'network':
                        errorMessage = 'Network error. Please check your internet connection and try again.';
                        break;
                    case 'aborted':
                        // User or system aborted - don't show error
                        setIsListening(false);
                        setStatus('idle');
                        return;
                    case 'service-not-allowed':
                        errorMessage = 'Voice recognition service not available. Please try again later.';
                        break;
                    default:
                        errorMessage = 'Voice recognition error. Please try again.';
                }
                setError(errorMessage);
                setIsListening(false);
                setStatus('idle');
            };

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        accumulatedTranscriptRef.current += transcript + ' ';
                    } else {
                        interimTranscript = transcript;
                    }
                }

                // Update display with accumulated + interim
                setTranscript((accumulatedTranscriptRef.current + interimTranscript).trim());

                // Reset silence timer - give user 2.5 seconds of silence before sending
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                silenceTimerRef.current = setTimeout(() => {
                    const textToSend = accumulatedTranscriptRef.current.trim();
                    if (textToSend && sessionIdRef.current) {
                        handleUserSpeech(textToSend);
                        accumulatedTranscriptRef.current = '';
                        setTranscript('');
                    }
                }, 2500);
            };
        }

        return () => {
            recognitionRef.current?.stop();
            synthRef.current?.cancel();
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
        };
    }, []);

    // Scroll to bottom of history when new messages added
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [conversationHistory]);

    const loadSessionStats = async (uid: string) => {
        try {
            const { data, error } = await supabase.rpc('get_voice_session_stats', { p_user_id: uid });
            if (!error && data && data.length > 0) {
                setStats(data[0]);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const startSession = async () => {
        try {
            setStatus('processing');
            setError(null);
            setConversationHistory([]);

            const { data, error } = await supabase.functions.invoke('voice-coach-session', {
                body: { action: 'start', sessionType: selectedType }
            });

            if (error) throw error;

            setSessionId(data.session.id);
            setResponse(data.openingMessage);

            // Add opening message to history
            setConversationHistory([{
                role: 'assistant',
                content: data.openingMessage,
                timestamp: new Date().toISOString()
            }]);

            speak(data.openingMessage);
        } catch (err: any) {
            console.error('Error starting session:', err);
            setError(err.message || 'Failed to start session');
            setStatus('idle');
        }
    };

    const handleUserSpeech = async (text: string) => {
        if (!text.trim() || !sessionId) return;

        // Add user message to history
        setConversationHistory(prev => [...prev, {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        }]);

        setStatus('processing');
        try {
            const { data, error } = await supabase.functions.invoke('voice-coach-session', {
                body: {
                    action: 'process',
                    sessionId,
                    transcript: text
                }
            });

            if (error) throw error;

            setResponse(data.response);

            // Add AI response to history
            setConversationHistory(prev => [...prev, {
                role: 'assistant',
                content: data.response,
                timestamp: new Date().toISOString()
            }]);

            speak(data.response);
        } catch (err: any) {
            console.error('Error processing speech:', err);
            setError(err.message || 'Failed to process');
            setStatus('idle');
        }
    };

    const speak = (text: string) => {
        if (synthRef.current) {
            setStatus('speaking');
            setIsSpeaking(true);

            // Cancel any ongoing speech
            synthRef.current.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            // Try to use a natural voice
            const voices = synthRef.current.getVoices();
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
                setStatus('idle');
                // Auto-listen after AI speaks if enabled
                if (autoListen && sessionIdRef.current) {
                    setTimeout(() => {
                        accumulatedTranscriptRef.current = '';
                        setTranscript('');
                        try {
                            recognitionRef.current?.start();
                            setIsListening(true);
                            setStatus('listening');
                        } catch (e) {
                            console.log('Could not auto-start listening:', e);
                        }
                    }, 500);
                }
            };

            utterance.onerror = () => {
                setIsSpeaking(false);
                setStatus('idle');
            };

            synthRef.current.speak(utterance);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            // Clear any pending silence timer and send accumulated text
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
            const textToSend = accumulatedTranscriptRef.current.trim();
            if (textToSend && sessionId) {
                handleUserSpeech(textToSend);
            }
            accumulatedTranscriptRef.current = '';
            setIsListening(false);
        } else {
            setTranscript('');
            accumulatedTranscriptRef.current = '';
            try {
                recognitionRef.current?.start();
            } catch (e) {
                console.log('Could not start recognition:', e);
                setError('Voice recognition unavailable. Please try again.');
            }
        }
    };

    const endSession = async () => {
        if (!sessionId) return;

        try {
            setStatus('processing');
            const { data, error } = await supabase.functions.invoke('voice-coach-session', {
                body: { action: 'end', sessionId }
            });

            if (error) throw error;

            // Show summary if available
            if (data.summary) {
                setResponse(`Session complete! ${data.summary}`);
            }

            setSessionId(null);
            setStatus('idle');

            // Refresh stats
            if (userId) {
                loadSessionStats(userId);
            }
        } catch (err: any) {
            console.error('Error ending session:', err);
            setSessionId(null);
            setStatus('idle');
        }
    };

    const stopSpeaking = () => {
        synthRef.current?.cancel();
        setIsSpeaking(false);
        setStatus('idle');
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4 h-full flex flex-col relative overflow-hidden min-h-[400px]">
            {/* Background Pulse Animation */}
            {(isListening || isSpeaking) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-48 h-48 rounded-full ${isListening ? 'bg-red-500' : 'bg-purple-500'} opacity-20 animate-ping`} />
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">🎙️</span> Voice Coach
                    </h3>
                    <p className="text-xs text-slate-400">Talk to AMIE</p>
                </div>
                <div className="flex items-center gap-2">
                    {stats && (
                        <div className="text-xs text-slate-400 text-right hidden sm:block">
                            <div>{stats.sessions_this_week} this week</div>
                        </div>
                    )}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        status === 'idle' ? 'bg-slate-700 text-slate-400' :
                        status === 'listening' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                        status === 'speaking' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-blue-500/20 text-blue-400 animate-pulse'
                    }`}>
                        {status === 'listening' ? '● REC' : status.toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Session Type Selector (only when no active session) */}
            {!sessionId && (
                <div className="mb-3 relative z-10">
                    <div className="grid grid-cols-3 gap-1.5">
                        {SESSION_TYPES.map(type => (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => setSelectedType(type.id)}
                                className={`p-2 rounded-lg text-center transition-all ${
                                    selectedType === type.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                <div className="text-lg">{type.icon}</div>
                                <div className="text-xs font-medium truncate">{type.label}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Conversation History Toggle */}
            {sessionId && conversationHistory.length > 0 && (
                <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="mb-2 text-xs text-slate-400 hover:text-white flex items-center gap-1 relative z-10"
                >
                    <svg className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {showHistory ? 'Hide' : 'Show'} conversation ({conversationHistory.length})
                </button>
            )}

            {/* Conversation History Panel */}
            {showHistory && conversationHistory.length > 0 && (
                <div
                    ref={historyRef}
                    className="mb-3 max-h-32 overflow-y-auto bg-slate-800/50 rounded-lg p-2 space-y-2 relative z-10"
                >
                    {conversationHistory.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`text-xs p-2 rounded ${
                                msg.role === 'user'
                                    ? 'bg-indigo-600/30 text-indigo-200 ml-4'
                                    : 'bg-slate-700/50 text-slate-300 mr-4'
                            }`}
                        >
                            <span className="font-medium">{msg.role === 'user' ? 'You' : 'AMIE'}:</span>{' '}
                            {msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content}
                        </div>
                    ))}
                </div>
            )}

            {/* Main Interaction Area */}
            <div className="flex-1 flex flex-col justify-center items-center space-y-4 relative z-10">
                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/20 text-red-300 text-xs px-3 py-2 rounded-lg max-w-xs text-center">
                        {error}
                    </div>
                )}

                {/* Orb Visualization */}
                <button
                    type="button"
                    onClick={sessionId ? (isSpeaking ? stopSpeaking : toggleListening) : startSession}
                    className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
                        status === 'idle' && !sessionId
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-105 shadow-lg shadow-indigo-500/30'
                            : status === 'listening'
                                ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/30 scale-110'
                                : status === 'speaking'
                                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30 scale-105'
                                    : 'bg-gradient-to-br from-blue-500 to-cyan-600 animate-pulse'
                    }`}
                >
                    {status === 'idle' && !sessionId ? (
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    ) : status === 'processing' ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isSpeaking ? (
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                        </svg>
                    ) : (
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </button>

                {/* Status Text */}
                <div className="text-center max-w-xs px-2">
                    {response ? (
                        <p className="text-white text-sm font-medium leading-relaxed">
                            {response.length > 150 ? response.slice(0, 150) + '...' : response}
                        </p>
                    ) : sessionId ? (
                        <p className="text-slate-400 text-sm">
                            {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Tap to speak'}
                        </p>
                    ) : (
                        <p className="text-slate-400 text-sm">
                            Select a session type and tap to start
                        </p>
                    )}

                    {transcript && status === 'listening' && (
                        <p className="text-indigo-300 text-xs mt-2 italic bg-slate-800/50 px-2 py-1 rounded">
                            "{transcript}"
                        </p>
                    )}
                </div>
            </div>

            {/* Footer Controls */}
            {sessionId && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-700 relative z-10">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoListen}
                            onChange={(e) => setAutoListen(e.target.checked)}
                            className="w-3 h-3 rounded bg-slate-700 border-slate-600"
                            aria-label="Enable auto-listen after AI speaks"
                        />
                        Auto-listen
                    </label>
                    <button
                        type="button"
                        onClick={endSession}
                        disabled={status === 'processing'}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                        End Session
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceCoachWidget;
