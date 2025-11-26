import React, { useState } from 'react';
import { AppView } from './types';
import FinancialDashboard from './components/FinancialDashboard';
import VisionBoard from './components/VisionBoard';
import { SparklesIcon, MicIcon } from './components/Icons';
import { sendVisionChatMessage } from './services/geminiService';

const App = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [chatInput, setChatInput] = useState('');
  
  // Landing/Onboarding State
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: "Welcome to Visionary. I'm your AI guide. Tell me, what does your dream retirement look like? Where are you and who are you with?" }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev + (prev ? ' ' : '') + transcript);
      };
      
      recognition.start();
    } else {
      alert("Voice input is not supported in this browser. Please use Chrome or Safari.");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newHistory = [...messages, { role: 'user' as const, text: chatInput }];
    setMessages(newHistory);
    setChatInput('');
    setChatLoading(true);

    const response = await sendVisionChatMessage(newHistory as any, chatInput);
    setMessages([...newHistory, { role: 'model', text: response }]);
    setChatLoading(false);
  };

  const renderContent = () => {
    switch(view) {
      case AppView.LANDING:
        return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-navy-900 mb-6 tracking-tight">
              Visionary
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl">
              The AI-powered SaaS for designing your future. Visualize your retirement, plan your finances, and manifest your dreams.
            </p>
            
            {!showChat ? (
              <button 
                onClick={() => setShowChat(true)}
                className="bg-navy-900 text-white text-lg font-medium px-10 py-4 rounded-full shadow-xl hover:bg-navy-800 hover:scale-105 transition-all duration-300 flex items-center gap-3"
              >
                <SparklesIcon className="w-6 h-6 text-gold-400" />
                Start Your Journey
              </button>
            ) : (
              <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 text-left transition-all duration-500">
                 <div className="h-80 overflow-y-auto p-6 space-y-4 bg-gray-50">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-navy-900 text-white rounded-br-none' : 'bg-white border border-gray-200 shadow-sm text-gray-800 rounded-bl-none'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && <div className="text-gray-400 text-xs ml-4">Visionary is thinking...</div>}
                 </div>
                 <div className="p-4 bg-white border-t border-gray-100">
                    <form onSubmit={handleChatSubmit} className="flex gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Describe your dream or use voice..."
                          className="w-full border border-gray-300 rounded-full pl-4 pr-12 py-3 outline-none focus:border-gold-500 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={startListening}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'text-gray-400 hover:text-navy-900'}`}
                        >
                          <MicIcon className="w-5 h-5" />
                        </button>
                      </div>
                      <button type="submit" className="bg-gold-500 text-navy-900 font-bold px-6 py-2 rounded-full hover:bg-gold-600 transition-colors">
                        Send
                      </button>
                    </form>
                    
                    {/* Navigation Actions */}
                    <div className="mt-4 flex flex-col md:flex-row justify-between items-center px-2 gap-4">
                       <span className="text-xs text-gray-400">Step 1 of 3: Definition</span>
                       <div className="flex items-center gap-3">
                         {messages.length > 2 && (
                            <>
                              <button 
                                onClick={() => setView(AppView.FINANCIAL)} 
                                className="text-sm font-bold bg-navy-900 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition-colors">
                                Next: Financial Plan &rarr;
                              </button>
                              <span className="text-xs text-gray-300">or</span>
                              <button 
                                onClick={() => setView(AppView.VISION_BOARD)} 
                                className="text-xs text-gray-500 hover:text-navy-900 underline">
                                Skip to Vision Board
                              </button>
                            </>
                         )}
                         {messages.length <= 2 && (
                           <button 
                             onClick={() => setView(AppView.FINANCIAL)} 
                             className="text-xs font-bold text-navy-900 hover:text-gold-600 underline">
                             Skip to Planning
                           </button>
                         )}
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        );
      case AppView.FINANCIAL:
        return <FinancialDashboard onComplete={() => setView(AppView.VISION_BOARD)} />;
      case AppView.VISION_BOARD:
        return <VisionBoard />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView(AppView.LANDING)}>
              <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center mr-3">
                 <span className="text-gold-500 font-serif font-bold text-xl">V</span>
              </div>
              <span className="font-serif font-bold text-xl text-navy-900">Visionary</span>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setView(AppView.FINANCIAL)}
                className={`text-sm font-medium transition-colors ${view === AppView.FINANCIAL ? 'text-gold-600' : 'text-gray-500 hover:text-navy-900'}`}>
                Plan
              </button>
              <button 
                onClick={() => setView(AppView.VISION_BOARD)}
                className={`text-sm font-medium transition-colors ${view === AppView.VISION_BOARD ? 'text-gold-600' : 'text-gray-500 hover:text-navy-900'}`}>
                Visualize
              </button>
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm">
                <img src="https://picsum.photos/100/100" alt="User" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="font-serif text-xl font-bold">Visionary</span>
            <p className="text-gray-400 text-sm mt-1">SaaS Platform for Retirement Design</p>
          </div>
          <div className="text-sm text-gray-400">
            &copy; 2024 Visionary Inc. Powered by Gemini.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
