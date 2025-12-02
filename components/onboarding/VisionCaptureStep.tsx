import React, { useState, useRef, useEffect } from 'react';

interface Props {
  visionText?: string;
  onVisionChange: (text: string) => void;
}

const VisionCaptureStep: React.FC<Props> = ({ visionText = '', onVisionChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(visionText);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    onVisionChange(transcript.trim());
  }, [transcript, onVisionChange]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setInputMode('voice')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'voice'
              ? 'bg-navy-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🎤 Voice
        </button>
        <button
          onClick={() => setInputMode('text')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'text'
              ? 'bg-navy-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✏️ Type
        </button>
      </div>

      {inputMode === 'voice' && hasSpeechRecognition ? (
        <div className="text-center">
          {/* Mic Button */}
          <button
            onClick={toggleRecording}
            className={`relative w-32 h-32 rounded-full mx-auto mb-6 transition-all duration-300 ${
              isRecording
                ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110'
                : 'bg-gradient-to-br from-navy-900 to-navy-700 hover:shadow-lg hover:scale-105'
            }`}
          >
            {/* Pulse Animation */}
            {isRecording && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
                <span className="absolute inset-2 rounded-full bg-red-400 animate-pulse opacity-30" />
              </>
            )}

            {/* Mic Icon */}
            <svg
              className={`w-12 h-12 mx-auto ${isRecording ? 'text-white' : 'text-gold-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          <p className="text-lg text-gray-600 mb-2">
            {isRecording ? (
              <span className="text-red-500 font-medium">Listening... Speak your vision</span>
            ) : (
              'Tap to start speaking'
            )}
          </p>
          <p className="text-sm text-gray-400">
            Describe your ideal future - where you live, what you do, who you're with
          </p>
        </div>
      ) : (
        <div className="text-center mb-4">
          <p className="text-gray-600 mb-2">
            Describe your ideal future in your own words
          </p>
          <p className="text-sm text-gray-400">
            Where do you live? What does your day look like? Who are you with?
          </p>
        </div>
      )}

      {/* Text Area (Always shown for editing) */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Vision Statement
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="In my ideal future, I see myself living in a beautiful home by the coast. I wake up each morning feeling grateful and energized. My family is thriving, and I have the financial freedom to pursue my passions..."
          className="w-full h-40 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 placeholder-gray-400"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">
            {transcript.length} characters
          </span>
          {transcript.length > 0 && (
            <button
              onClick={() => setTranscript('')}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Prompts */}
      <div className="bg-gold-50 rounded-xl p-4 border border-gold-200">
        <p className="text-sm font-medium text-gold-800 mb-2">Need inspiration? Try answering:</p>
        <ul className="text-sm text-gold-700 space-y-1">
          <li>• What does your perfect morning look like?</li>
          <li>• Where in the world do you want to be?</li>
          <li>• What legacy do you want to leave?</li>
          <li>• How do you want to feel every day?</li>
        </ul>
      </div>
    </div>
  );
};

export default VisionCaptureStep;
