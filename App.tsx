
import React, { useState, useEffect } from 'react';
import { AppView, VisionImage, FinancialGoal } from './types';
import FinancialDashboard from './components/FinancialDashboard';
import VisionBoard from './components/VisionBoard';
import ActionPlanAgent from './components/ActionPlanAgent';
import Gallery from './components/Gallery';
import { SparklesIcon, MicIcon, DocumentIcon, SaveIcon } from './components/Icons';
import { sendVisionChatMessage } from './services/geminiService';
import { checkDatabaseConnection } from './services/storageService';
import { SYSTEM_GUIDE_MD } from './lib/systemGuide';

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
  
  // Database State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  // Shared State
  const [activeVisionPrompt, setActiveVisionPrompt] = useState('');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<VisionImage | null>(null);
  
  // Data Flow State (Plan -> Execute)
  const [financialData, setFinancialData] = useState<FinancialGoal[]>([]);

  useEffect(() => {
    // Check DB connection on mount
    checkDatabaseConnection().then(isConnected => {
      setDbConnected(isConnected);
    });
  }, []);

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

  const downloadGuide = () => {
    const blob = new Blob([SYSTEM_GUIDE_MD], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Visionary_System_Guide.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        return (
          <FinancialDashboard 
            onComplete={(data) => {
              setFinancialData(data);
              setView(AppView.VISION_BOARD);
            }} 
          />
        );
      case AppView.VISION_BOARD:
        return (
          <VisionBoard 
            initialImage={selectedGalleryImage}
            onAgentStart={(prompt) => {
              setActiveVisionPrompt(prompt);
              setView(AppView.ACTION_PLAN);
            }} 
          />
        );
      case AppView.GALLERY:
        return (
          <Gallery onSelect={(img) => {
             setSelectedGalleryImage(img);
             setView(AppView.VISION_BOARD);
          }} />
        );
      case AppView.ACTION_PLAN:
        return (
          <ActionPlanAgent 
            visionPrompt={activeVisionPrompt} 
            financialData={financialData}
            onBack={() => setView(AppView.VISION_BOARD)} 
          />
        );
      default:
        return null;
    }
  };

  const sqlCode = `-- 1. Create Storage Bucket (Ignore if exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('visions', 'visions', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Reset & Create Storage Policies (Fixes Error 42710)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'visions' );

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'visions' );

DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'visions' );

-- 3. Create Tables
CREATE TABLE IF NOT EXISTS public.vision_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.reference_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    image_url TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    user_id UUID
);

-- PHASE 2: FINANCIAL AUTOMATION TABLES (Optional for now)
CREATE TABLE IF NOT EXISTS public.plaid_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID,
    access_token TEXT NOT NULL, -- In production, this must be encrypted
    institution_id TEXT,
    status TEXT DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    goal_id TEXT, -- Logical link to a vision/goal
    source_account_id TEXT NOT NULL,
    destination_account_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    frequency TEXT DEFAULT 'MONTHLY',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.transfer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    rule_id UUID REFERENCES public.automation_rules(id),
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT, -- PENDING, SETTLED, FAILED
    ai_rationale TEXT
);

-- 4. Enable RLS
ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;

-- 5. Reset & Create Table Policies (Public for Demo)

-- Vision Boards
DROP POLICY IF EXISTS "Allow public read VB" ON public.vision_boards;
CREATE POLICY "Allow public read VB" ON public.vision_boards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert VB" ON public.vision_boards;
CREATE POLICY "Allow public insert VB" ON public.vision_boards FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete VB" ON public.vision_boards;
CREATE POLICY "Allow public delete VB" ON public.vision_boards FOR DELETE USING (true);

-- Reference Images
DROP POLICY IF EXISTS "Allow public read RI" ON public.reference_images;
CREATE POLICY "Allow public read RI" ON public.reference_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert RI" ON public.reference_images;
CREATE POLICY "Allow public insert RI" ON public.reference_images FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete RI" ON public.reference_images;
CREATE POLICY "Allow public delete RI" ON public.reference_images FOR DELETE USING (true);

-- Financial Tables (Public for Demo - Secure in Prod)
DROP POLICY IF EXISTS "Allow public read Auto" ON public.automation_rules;
CREATE POLICY "Allow public read Auto" ON public.automation_rules FOR SELECT USING (true);
`;

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
                onClick={() => { setSelectedGalleryImage(null); setView(AppView.VISION_BOARD); }}
                className={`text-sm font-medium transition-colors ${view === AppView.VISION_BOARD ? 'text-gold-600' : 'text-gray-500 hover:text-navy-900'}`}>
                Visualize
              </button>
              <button 
                onClick={() => setView(AppView.GALLERY)}
                className={`text-sm font-medium transition-colors ${view === AppView.GALLERY ? 'text-gold-600' : 'text-gray-500 hover:text-navy-900'}`}>
                Gallery
              </button>
              <button 
                onClick={() => {
                  if (activeVisionPrompt) setView(AppView.ACTION_PLAN);
                  else alert("Create a vision first!");
                }}
                className={`text-sm font-medium transition-colors ${view === AppView.ACTION_PLAN ? 'text-gold-600' : 'text-gray-500 hover:text-navy-900'}`}>
                Execute
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
          <div className="flex flex-col md:flex-row items-center gap-6">
             <button 
               onClick={downloadGuide}
               className="flex items-center gap-2 text-sm text-gold-500 hover:text-gold-400 transition-colors"
             >
               <DocumentIcon className="w-4 h-4" />
               Download System Guide
             </button>

             {dbConnected ? (
               <div className="flex items-center gap-2 text-green-400 text-sm">
                 <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                 System Online
               </div>
             ) : (
               <button 
                  onClick={() => setShowSqlModal(true)}
                  className="text-sm text-gray-400 hover:text-white underline decoration-dotted"
               >
                  Database Setup
               </button>
             )}
             <div className="text-sm text-gray-400">
               &copy; 2024 Visionary Inc. Powered by Gemini.
             </div>
          </div>
        </div>
      </footer>

      {/* Database Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-navy-900 mb-4">Initialize Supabase Database</h3>
            <p className="text-sm text-gray-600 mb-4">
              Since this is a new project, you need to run the following SQL commands in your 
              <a href="https://supabase.com/dashboard" target="_blank" className="text-blue-600 underline ml-1">Supabase SQL Editor</a> 
              to create the required tables and storage buckets.
            </p>
            <div className="bg-gray-900 text-gray-200 p-4 rounded-lg overflow-x-auto text-xs font-mono mb-6 max-h-[300px]">
              <pre>{sqlCode}</pre>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(sqlCode);
                  alert("SQL copied to clipboard!");
                }}
                className="bg-gray-100 hover:bg-gray-200 text-navy-900 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Copy SQL
              </button>
              <button 
                onClick={() => setShowSqlModal(false)}
                className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
