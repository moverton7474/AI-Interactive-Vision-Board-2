import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const VoiceCoachWidget: React.FC = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

    useEffect(() => {
        // Get user session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
            }
        });

        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                setStatus('listening');
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
                if (status === 'listening') {
                    // If we stopped listening but haven't processed yet, it might be silence
                }
            };

            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                        handleUserSpeech(finalTranscript);
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                setTranscript(finalTranscript || interimTranscript);
            };
        }
    }, [sessionId, status]);

    const startSession = async () => {
        try {
            setStatus('processing');
            const { data, error } = await supabase.functions.invoke('voice-coach-session', {
                body: { action: 'start', sessionType: 'check_in' } // Default to check-in
            });

            if (error) throw error;

            setSessionId(data.session.id);
            setResponse(data.openingMessage);
            speak(data.openingMessage);
        } catch (err) {
            console.error('Error starting session:', err);
            setStatus('idle');
        }
    };

    const handleUserSpeech = async (text: string) => {
        if (!text.trim() || !sessionId) return;

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
            speak(data.response);
        } catch (err) {
            console.error('Error processing speech:', err);
            setStatus('idle');
        }
    };

    const speak = (text: string) => {
        if (synthRef.current) {
            setStatus('speaking');
            setIsSpeaking(true);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => {
                setIsSpeaking(false);
                setStatus('idle');
                // Auto-listen after speaking? Maybe optional.
                // startListening(); 
            };
            synthRef.current.speak(utterance);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setTranscript('');
            recognitionRef.current?.start();
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col relative overflow-hidden">
            {/* Background Pulse Animation */}
            {(isListening || isSpeaking) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                    <div className={`w-64 h-64 rounded-full ${isListening ? 'bg-blue-500' : 'bg-purple-500'} animate-ping`} />
                </div>
            )}

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Voice Coach</h3>
                    <p className="text-sm text-slate-500">Talk to AMIE</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${status === 'idle' ? 'bg-slate-100 text-slate-500' :
                        status === 'listening' ? 'bg-red-100 text-red-600' :
                            status === 'speaking' ? 'bg-purple-100 text-purple-600' :
                                'bg-blue-100 text-blue-600'
                    }`}>
                    {status.toUpperCase()}
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center space-y-6 relative z-10">
                {/* Orb Visualization */}
                <div
                    onClick={sessionId ? toggleListening : startSession}
                    className={`w-24 h-24 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 ${status === 'idle' ? 'bg-slate-100 hover:bg-slate-200' :
                            status === 'listening' ? 'bg-red-500 shadow-lg shadow-red-200 scale-110' :
                                status === 'speaking' ? 'bg-purple-500 shadow-lg shadow-purple-200 scale-110' :
                                    'bg-blue-500 animate-pulse'
                        }`}
                >
                    {status === 'idle' && !sessionId ? (
                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ) : (
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </div>

                <div className="text-center max-w-xs">
                    {response ? (
                        <p className="text-slate-700 font-medium animate-fade-in">"{response}"</p>
                    ) : (
                        <p className="text-slate-400 text-sm">Tap to start your session</p>
                    )}

                    {transcript && (
                        <p className="text-slate-400 text-xs mt-2 italic">"{transcript}"</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceCoachWidget;
