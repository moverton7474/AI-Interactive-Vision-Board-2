import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { voiceService, VoiceSettings, VoiceQuota } from '../services/voiceService';

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
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
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

    // v2.9 Premium Voice State
    const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
    const [voiceQuota, setVoiceQuota] = useState<VoiceQuota | null>(null);
    const [userTier, setUserTier] = useState<string>('free');
    const [voiceProvider, setVoiceProvider] = useState<'browser' | 'openai' | 'elevenlabs'>('browser');
    const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);

    const recognitionRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
    const historyRef = useRef<HTMLDivElement>(null);
    const voicesLoadedRef = useRef(false);
    const audioUnlockedRef = useRef(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSWarning, setShowIOSWarning] = useState(false);

    // Refs to track state in callbacks (avoid stale closures)
    const isListeningRef = useRef(isListening);
    const isSpeakingRef = useRef(isSpeaking);
    const sessionIdRef = useRef(sessionId);
    const accumulatedTranscriptRef = useRef('');
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recognitionRunningRef = useRef(false); // Track if recognition is actually running
    const voiceSettingsLoadedRef = useRef(false); // Track if voice settings are loaded
    const voiceProviderRef = useRef<'browser' | 'openai' | 'elevenlabs'>('browser');
    const lastInterimTranscriptRef = useRef(''); // Track last interim result for auto-send

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
        voiceProviderRef.current = voiceProvider;
    }, [voiceProvider]);

    useEffect(() => {
        // Detect iOS for special handling
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIOS(iOS);

        // Load voices and set up voiceschanged listener for iOS
        if (synthRef.current) {
            const loadVoices = () => {
                const voices = synthRef.current?.getVoices() || [];
                if (voices.length > 0) {
                    voicesLoadedRef.current = true;
                }
            };
            loadVoices();
            // iOS needs this event to load voices
            if (typeof window !== 'undefined') {
                window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
            }
        }

        // Get user session and profile
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
                loadSessionStats(session.user.id);

                // Load user profile for email display and tier
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('email, full_name, first_name, subscription_tier')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    setUserEmail(profile.email || session.user.email || null);
                    setUserName(profile.first_name || profile.full_name?.split(' ')[0] || null);
                    // Set user tier for voice provider selection
                    setUserTier(profile.subscription_tier || 'free');
                } else {
                    setUserEmail(session.user.email || null);
                }

                // Load voice settings for premium voice integration (v2.9)
                try {
                    const voiceData = await voiceService.getSettings();
                    setVoiceSettings(voiceData.settings);
                    setVoiceQuota(voiceData.quota);
                    setUserTier(voiceData.tier);
                    // Set effective provider based on tier
                    let provider: 'browser' | 'openai' | 'elevenlabs' = 'browser';
                    if (voiceData.tier === 'elite') {
                        provider = 'elevenlabs';
                    } else if (voiceData.tier === 'pro') {
                        provider = 'openai';
                    }
                    setVoiceProvider(provider);
                    voiceProviderRef.current = provider;
                    setVoiceSettingsLoaded(true);
                    voiceSettingsLoadedRef.current = true;
                    console.log('Voice settings loaded, provider:', provider, 'tier:', voiceData.tier);
                } catch (voiceErr) {
                    console.log('Voice settings not available, using browser TTS:', voiceErr);
                    setVoiceProvider('browser');
                    voiceProviderRef.current = 'browser';
                    setVoiceSettingsLoaded(true);
                    voiceSettingsLoadedRef.current = true;
                }
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
                recognitionRunningRef.current = true;
                setIsListening(true);
                setStatus('listening');
                setError(null);
            };

            recognitionRef.current.onend = () => {
                recognitionRunningRef.current = false;
                // If continuous mode ends unexpectedly and we're still supposed to be listening, restart
                if (isListeningRef.current && !isSpeakingRef.current && sessionIdRef.current) {
                    // Add a small delay before restarting to prevent rapid restart loops
                    setTimeout(() => {
                        if (isListeningRef.current && !isSpeakingRef.current && recognitionRef.current && !recognitionRunningRef.current) {
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
                        lastInterimTranscriptRef.current = ''; // Clear interim when we get a final
                    } else {
                        interimTranscript = transcript;
                        lastInterimTranscriptRef.current = transcript; // Track last interim
                    }
                }

                // Update display with accumulated + interim
                const displayText = (accumulatedTranscriptRef.current + interimTranscript).trim();
                setTranscript(displayText);

                // Reset silence timer - give user 2.5 seconds of silence before sending
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                silenceTimerRef.current = setTimeout(() => {
                    // Include both final results AND last interim result for auto-send
                    // This fixes the issue where speech stays as "interim" in continuous mode
                    const finalText = accumulatedTranscriptRef.current.trim();
                    const interimText = lastInterimTranscriptRef.current.trim();
                    const textToSend = (finalText + ' ' + interimText).trim();

                    console.log('Auto-send triggered:', { finalText, interimText, textToSend });

                    if (textToSend && sessionIdRef.current) {
                        // Stop recognition to finalize any pending results
                        if (recognitionRunningRef.current) {
                            recognitionRef.current?.stop();
                        }
                        handleUserSpeech(textToSend);
                        accumulatedTranscriptRef.current = '';
                        lastInterimTranscriptRef.current = '';
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

    // iOS audio unlock - must be called from user gesture
    const unlockIOSAudio = () => {
        if (audioUnlockedRef.current) return;

        if (synthRef.current) {
            // Cancel any stuck speech
            synthRef.current.cancel();

            // Speak a silent/empty utterance to unlock iOS audio
            const silentUtterance = new SpeechSynthesisUtterance('');
            silentUtterance.volume = 0;
            synthRef.current.speak(silentUtterance);

            // Also try with actual content but very short
            setTimeout(() => {
                if (synthRef.current) {
                    synthRef.current.cancel();
                    const warmupUtterance = new SpeechSynthesisUtterance(' ');
                    warmupUtterance.volume = 0.01;
                    warmupUtterance.rate = 10; // Very fast
                    synthRef.current.speak(warmupUtterance);
                }
            }, 100);

            audioUnlockedRef.current = true;
        }
    };

    const startSession = async () => {
        try {
            // CRITICAL: Unlock iOS audio from user gesture BEFORE any async calls
            if (isIOS) {
                unlockIOSAudio();
                // Show iOS warning if first time
                if (!audioUnlockedRef.current) {
                    setShowIOSWarning(true);
                    setTimeout(() => setShowIOSWarning(false), 5000);
                }
            }

            setStatus('processing');
            setError(null);
            setConversationHistory([]);

            // Wait for voice settings to load if not yet loaded (max 3 seconds)
            if (!voiceSettingsLoadedRef.current) {
                console.log('Waiting for voice settings to load...');
                let waitTime = 0;
                while (!voiceSettingsLoadedRef.current && waitTime < 3000) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    waitTime += 100;
                }
                console.log('Voice settings loaded, provider:', voiceProviderRef.current);
            }

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

    // Premium voice TTS using voiceService (Pro/Elite tiers)
    const speakWithPremiumVoice = async (text: string) => {
        setStatus('speaking');
        setIsSpeaking(true);

        try {
            const result = await voiceService.generateTTS(text, {
                sessionId: sessionIdRef.current || undefined,
                usageType: 'coaching',
                preferredPersona: voiceSettings?.preferredPersona || 'maya',
                language: voiceSettings?.language || 'en',
            });

            // Update quota after usage
            if (result.quotaRemaining !== undefined) {
                setVoiceQuota(prev => prev ? { ...prev, remaining: result.quotaRemaining } : null);
            }

            // Check if we got audio or need to fall back to browser TTS
            if (result.audioUrl && result.audioBlob) {
                // Create and play audio element
                if (!audioRef.current) {
                    audioRef.current = new Audio();
                }

                audioRef.current.src = result.audioUrl;

                audioRef.current.onended = () => {
                    setIsSpeaking(false);
                    setStatus('idle');
                    // Clean up blob URL
                    if (result.audioUrl) {
                        URL.revokeObjectURL(result.audioUrl);
                    }
                    // Auto-listen after AI speaks if enabled
                    handleAutoListen();
                };

                audioRef.current.onerror = () => {
                    console.error('Premium audio playback failed, falling back to browser TTS');
                    if (result.audioUrl) {
                        URL.revokeObjectURL(result.audioUrl);
                    }
                    // Fall back to browser TTS
                    speakWithBrowserTTS(text);
                };

                await audioRef.current.play();
                console.log(`Playing ${result.provider} TTS, ${result.charactersUsed} chars used`);
            } else {
                // No audio, use browser TTS fallback
                console.log('No audio from premium provider, using browser TTS:', result.error || 'fallback');
                speakWithBrowserTTS(result.text || text);
            }
        } catch (err) {
            console.error('Premium TTS error:', err);
            // Fall back to browser TTS
            speakWithBrowserTTS(text);
        }
    };

    // Helper function for auto-listen after speaking
    const handleAutoListen = () => {
        if (autoListen && sessionIdRef.current && !recognitionRunningRef.current) {
            setTimeout(() => {
                if (!recognitionRunningRef.current && sessionIdRef.current) {
                    accumulatedTranscriptRef.current = '';
                    lastInterimTranscriptRef.current = '';
                    setTranscript('');
                    try {
                        recognitionRef.current?.start();
                        setIsListening(true);
                        setStatus('listening');
                    } catch (e) {
                        console.log('Could not auto-start listening:', e);
                    }
                }
            }, 500);
        }
    };

    // Browser TTS (Free tier or fallback)
    const speakWithBrowserTTS = (text: string, retryCount = 0) => {
        if (synthRef.current) {
            setStatus('speaking');
            setIsSpeaking(true);

            // Cancel any ongoing speech (important for iOS)
            synthRef.current.cancel();

            // Small delay after cancel for iOS
            setTimeout(() => {
                if (!synthRef.current) return;

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = voiceSettings?.voiceSpeed || 1.0;
                utterance.pitch = voiceSettings?.voicePitch || 1.0;
                utterance.volume = 1.0;

                // Try to use a natural voice - prefer iOS Samantha
                const voices = synthRef.current.getVoices();
                const preferredVoice = voices.find(v =>
                    v.name.includes('Samantha') || // iOS default
                    v.name.includes('Google') ||
                    v.name.includes('Microsoft') ||
                    v.lang.startsWith('en')
                );
                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }

                utterance.onend = () => {
                    setIsSpeaking(false);
                    setStatus('idle');
                    handleAutoListen();
                };

                utterance.onerror = (event) => {
                    console.error('Speech synthesis error:', event);
                    // iOS sometimes fails on first attempt - retry once
                    if (isIOS && retryCount < 2) {
                        console.log('Retrying speech synthesis for iOS...');
                        setTimeout(() => speakWithBrowserTTS(text, retryCount + 1), 200);
                        return;
                    }
                    setIsSpeaking(false);
                    setStatus('idle');
                    // Show iOS-specific error
                    if (isIOS) {
                        setError('Audio not playing? Check your iPhone is not on silent mode (flip the side switch).');
                        setShowIOSWarning(true);
                    }
                };

                // iOS workaround: Check if speaking actually started
                synthRef.current.speak(utterance);

                // iOS bug: speechSynthesis can get stuck, monitor and retry
                if (isIOS) {
                    setTimeout(() => {
                        if (synthRef.current && !synthRef.current.speaking && isSpeakingRef.current && retryCount < 2) {
                            console.log('iOS speech synthesis stuck, retrying...');
                            speakWithBrowserTTS(text, retryCount + 1);
                        }
                    }, 500);
                }
            }, isIOS ? 100 : 0); // Add delay for iOS
        }
    };

    // Main speak function - routes to premium or browser TTS based on tier
    const speak = (text: string) => {
        // Use ref to get most current provider value (avoids stale closure issues)
        const currentProvider = voiceProviderRef.current;
        console.log('Speaking with provider:', currentProvider);
        // Use premium voice for Pro/Elite tiers, browser TTS for Free
        if (currentProvider === 'openai' || currentProvider === 'elevenlabs') {
            speakWithPremiumVoice(text);
        } else {
            speakWithBrowserTTS(text);
        }
    };

    const toggleListening = () => {
        if (isListening || recognitionRunningRef.current) {
            recognitionRef.current?.stop();
            // Clear any pending silence timer and send accumulated text
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
            // Include both finals and last interim when stopping
            const finalText = accumulatedTranscriptRef.current.trim();
            const interimText = lastInterimTranscriptRef.current.trim();
            const textToSend = (finalText + ' ' + interimText).trim();
            if (textToSend && sessionId) {
                handleUserSpeech(textToSend);
            }
            accumulatedTranscriptRef.current = '';
            lastInterimTranscriptRef.current = '';
            setIsListening(false);
        } else {
            setTranscript('');
            accumulatedTranscriptRef.current = '';
            lastInterimTranscriptRef.current = '';
            if (!recognitionRunningRef.current) {
                try {
                    recognitionRef.current?.start();
                } catch (e) {
                    console.log('Could not start recognition:', e);
                    setError('Voice recognition unavailable. Please try again.');
                }
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

    // Manual send function for when auto-send doesn't trigger
    const manualSend = () => {
        // Include accumulated finals + last interim + current transcript display
        const finalText = accumulatedTranscriptRef.current.trim();
        const interimText = lastInterimTranscriptRef.current.trim();
        const textToSend = (finalText + ' ' + interimText).trim() || transcript.trim();
        if (!textToSend || !sessionId) return;

        // Stop listening first
        if (recognitionRunningRef.current) {
            recognitionRef.current?.stop();
        }

        // Clear timers
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        // Send the text
        handleUserSpeech(textToSend);
        accumulatedTranscriptRef.current = '';
        lastInterimTranscriptRef.current = '';
        setTranscript('');
        setIsListening(false);
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

            {/* User Email Indicator (shown during active session) */}
            {sessionId && userEmail && (
                <div className="mb-2 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 relative z-10">
                    <span className="text-green-400 text-sm">📧</span>
                    <span className="text-green-300 text-xs">
                        Email on file: <span className="font-medium">{userEmail}</span>
                    </span>
                </div>
            )}

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

            {/* iOS Audio Warning Banner */}
            {isIOS && showIOSWarning && (
                <div className="mb-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg relative z-10">
                    <div className="flex items-start gap-2">
                        <span className="text-amber-400 text-sm">🔔</span>
                        <div className="flex-1">
                            <p className="text-amber-200 text-xs font-medium">No audio on iPhone?</p>
                            <p className="text-amber-300/80 text-xs mt-0.5">
                                Flip the silent switch on the side of your iPhone to enable sound.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowIOSWarning(false)}
                            className="text-amber-400 hover:text-amber-200"
                            aria-label="Dismiss warning"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
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

                    {transcript && (status === 'listening' || status === 'idle') && sessionId && (
                        <div className="mt-2 bg-slate-800/50 px-2 py-1 rounded">
                            <p className="text-indigo-300 text-xs italic">
                                "{transcript}"
                            </p>
                            <button
                                type="button"
                                onClick={manualSend}
                                className="mt-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-full transition-colors flex items-center gap-1 mx-auto"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                Send
                            </button>
                        </div>
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
