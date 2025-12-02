
import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppView, VisionImage, FinancialGoal, OnboardingState, ActionTask } from './types';
import FinancialDashboard from './components/FinancialDashboard';
import VisionBoard from './components/VisionBoard';
import ActionPlanAgent from './components/ActionPlanAgent';
import Gallery from './components/Gallery';
import Login from './components/Login';
import TrustCenter from './components/TrustCenter';
import OrderHistory from './components/OrderHistory';
import Pricing from './components/Pricing';
import SubscriptionModal from './components/SubscriptionModal';
import OnboardingWizard from './components/OnboardingWizard';
import HabitTracker from './components/HabitTracker';
import WorkbookOrderModal from './components/WorkbookOrderModal';
import ThemeSelector from './components/ThemeSelector';
import MasterPromptQnA from './components/MasterPromptQnA';
import WeeklyReviews from './components/WeeklyReviews';
import KnowledgeBase from './components/KnowledgeBase';
import VoiceCoach from './components/VoiceCoach';
import PrintProducts from './components/PrintProducts';
import PartnerDashboard from './components/PartnerDashboard';
import SlackIntegration from './components/SlackIntegration';
import TeamLeaderboards from './components/TeamLeaderboards';
import ManagerDashboard from './components/ManagerDashboard';
import { GuidedOnboarding } from './components/onboarding';
import { Dashboard } from './components/dashboard';
import { SparklesIcon, MicIcon, DocumentIcon, ReceiptIcon, ShieldCheckIcon, FireIcon, BookOpenIcon, CalendarIcon, FolderIcon, PrinterIcon, HeartIcon, GlobeIcon, TrophyIcon, ChartBarIcon } from './components/Icons';
import { sendVisionChatMessage, generateVisionSummary } from './services/geminiService';
import { checkDatabaseConnection, saveDocument } from './services/storageService';
import { SYSTEM_GUIDE_MD } from './lib/systemGuide';

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // Subscription State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'PRO' | 'ELITE'>('PRO');

  // Workbook State
  const [showWorkbookModal, setShowWorkbookModal] = useState(false);

  // AMIE Identity State
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedThemeName, setSelectedThemeName] = useState<string | null>(null);

  // Shared State
  const [activeVisionPrompt, setActiveVisionPrompt] = useState('');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<VisionImage | null>(null);

  // Data Flow State (Plan -> Execute)
  const [financialData, setFinancialData] = useState<FinancialGoal[]>([]);

  // Dashboard State (v1.6)
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [primaryVisionUrl, setPrimaryVisionUrl] = useState<string | undefined>();
  const [primaryVisionTitle, setPrimaryVisionTitle] = useState<string | undefined>();
  const [dashboardTasks, setDashboardTasks] = useState<ActionTask[]>([]);
  const [dashboardHabits, setDashboardHabits] = useState<{id: string; name: string; icon: string; completedToday: boolean; streak: number}[]>([]);
  const [financialTarget, setFinancialTarget] = useState<number | undefined>();
  const [todayFocus, setTodayFocus] = useState<string | undefined>();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  useEffect(() => {
    // 1. Check DB Connection
    checkDatabaseConnection().then(isConnected => {
      setDbConnected(isConnected);
    });

    // 2. Check Auth Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user profile and check onboarding status
  useEffect(() => {
    if (!session?.user) {
      setOnboardingCompleted(null);
      return;
    }

    const loadUserProfile = async () => {
      try {
        // Get profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed, financial_target, primary_vision_id')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setOnboardingCompleted(profile.onboarding_completed ?? false);
          setFinancialTarget(profile.financial_target);

          // Load primary vision if exists
          if (profile.primary_vision_id) {
            const { data: vision } = await supabase
              .from('vision_boards')
              .select('image_url, prompt')
              .eq('id', profile.primary_vision_id)
              .single();

            if (vision) {
              setPrimaryVisionUrl(vision.image_url);
              setPrimaryVisionTitle(vision.prompt?.slice(0, 50));
            }
          }
        } else {
          setOnboardingCompleted(false);
        }

        // Get user identity for theme name
        const { data: identity } = await supabase
          .from('user_identity_profiles')
          .select('theme_id')
          .eq('user_id', session.user.id)
          .single();

        if (identity?.theme_id) {
          setSelectedThemeId(identity.theme_id);
        }

        // Set user name from email
        setUserName(session.user.email?.split('@')[0] || 'Friend');

        // Route to appropriate view
        if (profile?.onboarding_completed) {
          setView(AppView.DASHBOARD);
        } else {
          setView(AppView.GUIDED_ONBOARDING);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setOnboardingCompleted(false);
      }
    };

    loadUserProfile();
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setView(AppView.LANDING);
    setShowChat(false);
  };

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

  const handleVisionCapture = async (nextView: AppView) => {
    // Only capture if we have a conversation history
    if (messages.length > 2) {
       console.log("Capturing vision...");
       // Async - don't block navigation
       generateVisionSummary(messages).then(async (summary) => {
          if (summary) {
             console.log("Vision summarized:", summary);
             setActiveVisionPrompt(summary);
             // Save to Knowledge Base
             await saveDocument({
                name: `Vision Statement (${new Date().toLocaleDateString()})`,
                type: 'VISION',
                structuredData: { prompt: summary, fullChat: messages }
             });
          }
       });
    }
    setView(nextView);
  };

  const handleUpgradeClick = (tier: 'PRO' | 'ELITE') => {
    setSelectedTier(tier);
    setShowUpgradeModal(true);
  };

  // Onboarding Completion Handler
  const handleOnboardingComplete = useCallback(async (state: OnboardingState) => {
    if (!session?.user) return;

    try {
      // Update profile with onboarding data
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          financial_target: state.financialTarget,
          primary_vision_id: state.primaryVisionId
        })
        .eq('id', session.user.id);

      // Save identity profile
      if (state.themeId) {
        await supabase
          .from('user_identity_profiles')
          .upsert({
            user_id: session.user.id,
            theme_id: state.themeId
          });
      }

      // Update local state
      setOnboardingCompleted(true);
      setFinancialTarget(state.financialTarget);
      setPrimaryVisionUrl(state.primaryVisionUrl);
      setSelectedThemeId(state.themeId || null);
      setSelectedThemeName(state.themeName || null);

      // Navigate to dashboard
      setView(AppView.DASHBOARD);
    } catch (err) {
      console.error('Error saving onboarding:', err);
    }
  }, [session]);

  // Dashboard Task Toggle
  const handleToggleTask = useCallback(async (taskId: string) => {
    setDashboardTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t)
    );
  }, []);

  // Dashboard Habit Toggle
  const handleToggleHabit = useCallback(async (habitId: string) => {
    setDashboardHabits(prev =>
      prev.map(h => h.id === habitId ? { ...h, completedToday: !h.completedToday } : h)
    );
  }, []);

  // Generate vision image using Gemini API with fallback
  const generateVisionImage = useCallback(async (prompt: string, photoRef?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Please sign in to generate visions');
    }

    let imageUrl: string | null = null;
    let generatedImage = false;

    // Try to generate image via Gemini API
    try {
      // Build request with optional photo reference
      const requestBody: any = {
        action: 'generate_image',
        prompt,
        images: []
      };

      // If photo reference provided, fetch it and include
      if (photoRef) {
        try {
          const { data: refData } = await supabase
            .from('reference_images')
            .select('image_url')
            .eq('id', photoRef)
            .single();

          if (refData?.image_url) {
            const response = await fetch(refData.image_url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            requestBody.images.push(base64);
          }
        } catch (refError) {
          console.warn('Could not load reference image:', refError);
        }
      }

      // Call Gemini proxy edge function
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!error && data?.success && data?.image) {
        // Upload the generated image to storage
        const imageData = data.image;
        const base64Data = imageData.includes('base64,') ? imageData.split(',')[1] : imageData;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        const fileName = `visions/${session.user.id}/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('visions')
          .upload(fileName, blob, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('visions')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
          generatedImage = true;
        }
      }
    } catch (genError: any) {
      console.warn('Image generation failed, using placeholder:', genError.message);
    }

    // Fallback: Use a high-quality placeholder image
    if (!imageUrl) {
      // Use Unsplash for beautiful placeholder images based on prompt keywords
      const keywords = encodeURIComponent(prompt.slice(0, 50).replace(/[^a-zA-Z\s]/g, ''));
      imageUrl = `https://source.unsplash.com/800x600/?${keywords},inspiration,success`;
      console.log('Using placeholder image from Unsplash');
    }

    // Save to vision_boards table
    const { data: visionData, error: visionError } = await supabase
      .from('vision_boards')
      .insert({
        user_id: session.user.id,
        image_url: imageUrl,
        title: 'My Vision',
        description: prompt,
        metadata: {
          generatedAt: new Date().toISOString(),
          prompt,
          isPlaceholder: !generatedImage
        }
      })
      .select()
      .single();

    if (visionError) {
      console.warn('Vision save error:', visionError);
    }

    return {
      id: visionData?.id || `vision-${Date.now()}`,
      url: imageUrl
    };
  }, []);

  const generateActionPlan = useCallback(async (context: { vision: string; target?: number; theme?: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to generate action plan');
      }

      // Call Gemini proxy for action plan generation
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          action: 'action_plan',
          visionContext: context.vision,
          financialContext: context.target
            ? `Target: $${context.target.toLocaleString()}`
            : 'No specific target set'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Action plan generation error:', error);
        throw new Error(error.message || 'Failed to generate action plan');
      }

      if (!data?.success || !data?.plan) {
        throw new Error(data?.error || 'No action plan generated');
      }

      // Flatten tasks from all milestones
      const allTasks: ActionTask[] = [];
      for (const milestone of data.plan) {
        if (milestone.tasks) {
          for (const task of milestone.tasks) {
            allTasks.push({
              id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: task.title,
              description: task.description || '',
              type: (task.type?.toUpperCase() || 'ADMIN') as ActionTask['type'],
              isCompleted: false,
              dueDate: task.dueDate || new Date().toISOString(),
              aiMetadata: task.aiMetadata
            });
          }
        }
      }

      return allTasks.length > 0 ? allTasks : [
        { id: 'task-1', title: 'Define your goals', description: 'Set clear, measurable objectives', type: 'ADMIN' as const, isCompleted: false, dueDate: new Date().toISOString() },
        { id: 'task-2', title: 'Create savings plan', description: 'Automate monthly contributions', type: 'FINANCE' as const, isCompleted: false, dueDate: new Date().toISOString() },
        { id: 'task-3', title: 'Research your dream', description: 'Explore costs and timelines', type: 'LIFESTYLE' as const, isCompleted: false, dueDate: new Date().toISOString() }
      ];
    } catch (error: any) {
      console.error('generateActionPlan error:', error);
      // Return fallback tasks on error
      return [
        { id: 'task-1', title: 'Define your goals', description: 'Set clear, measurable objectives', type: 'ADMIN' as const, isCompleted: false, dueDate: new Date().toISOString() },
        { id: 'task-2', title: 'Create savings plan', description: 'Automate monthly contributions', type: 'FINANCE' as const, isCompleted: false, dueDate: new Date().toISOString() },
        { id: 'task-3', title: 'Research your dream', description: 'Explore costs and timelines', type: 'LIFESTYLE' as const, isCompleted: false, dueDate: new Date().toISOString() }
      ];
    }
  }, []);

  const uploadPhoto = useCallback(async (file: File) => {
    // Upload to Supabase storage - use 'visions' bucket for reference images
    const fileName = `references/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('visions')
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // Get public URL and save to reference_images table
    const { data: urlData } = supabase.storage
      .from('visions')
      .getPublicUrl(fileName);

    // Save reference to database
    const { data: refData, error: refError } = await supabase
      .from('reference_images')
      .insert({
        image_url: urlData.publicUrl,
        tags: ['onboarding', 'reference']
      })
      .select()
      .single();

    if (refError) {
      console.error('Reference save error:', refError);
    }

    return refData?.id || data?.path || '';
  }, []);

  const saveOnboardingState = useCallback(async (state: Partial<OnboardingState>) => {
    // Can be used for saving intermediate state
    console.log('Saving onboarding state:', state);
  }, []);

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
      case AppView.DASHBOARD:
        return (
          <Dashboard
            userName={userName}
            themeName={selectedThemeName || undefined}
            themeInsight="Every step forward is progress toward your vision."
            todayFocus={todayFocus}
            primaryVisionUrl={primaryVisionUrl}
            primaryVisionTitle={primaryVisionTitle}
            tasks={dashboardTasks}
            habits={dashboardHabits}
            financialTarget={financialTarget}
            financialCurrent={0}
            financialTargetLabel="3-Year Goal"
            onNavigate={setView}
            onToggleTask={handleToggleTask}
            onToggleHabit={handleToggleHabit}
          />
        );

      case AppView.GUIDED_ONBOARDING:
        return session?.user ? (
          <GuidedOnboarding
            userId={session.user.id}
            onComplete={handleOnboardingComplete}
            onNavigate={setView}
            generateVisionImage={generateVisionImage}
            generateActionPlan={generateActionPlan}
            uploadPhoto={uploadPhoto}
            saveOnboardingState={saveOnboardingState}
          />
        ) : null;

      case AppView.LANDING:
        return (
          <>
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in relative overflow-hidden py-12">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 pointer-events-none"></div>
              
              <h1 className="text-5xl md:text-7xl font-serif font-bold text-navy-900 mb-6 tracking-tight z-10">
                Visionary
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl z-10">
                The AI-powered SaaS for designing your future. Visualize your retirement, plan your finances, and manifest your dreams.
              </p>
              
              {!showChat ? (
                <div className="flex flex-col gap-4 z-10">
                  <button 
                    onClick={() => setShowChat(true)}
                    className="bg-navy-900 text-white text-lg font-medium px-10 py-4 rounded-full shadow-xl hover:bg-navy-800 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <SparklesIcon className="w-6 h-6 text-gold-400" />
                    Start Your Journey
                  </button>
                  <button
                    onClick={() => setView(AppView.THEME_SELECTION)}
                    className="text-navy-900 font-bold border-2 border-navy-900 px-10 py-3 rounded-full hover:bg-navy-50 transition-all flex items-center justify-center gap-2"
                  >
                    Launch Vision Wizard
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 text-left transition-all duration-500 z-10">
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
                                  onClick={() => handleVisionCapture(AppView.FINANCIAL)} 
                                  className="text-sm font-bold bg-navy-900 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition-colors">
                                  Next: Financial Plan &rarr;
                                </button>
                                <span className="text-xs text-gray-300">or</span>
                                <button 
                                  onClick={() => handleVisionCapture(AppView.VISION_BOARD)} 
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
            
            {/* Pricing Section */}
            <Pricing onUpgrade={handleUpgradeClick} />
          </>
        );
      case AppView.THEME_SELECTION:
        return (
          <ThemeSelector
            onSelect={(theme) => {
              setSelectedThemeId(theme.id);
              setSelectedThemeName(theme.display_name || theme.name);
              setView(AppView.IDENTITY_QNA);
            }}
            onSkip={() => setView(AppView.ONBOARDING)}
            selectedThemeId={selectedThemeId || undefined}
          />
        );
      case AppView.IDENTITY_QNA:
        return selectedThemeId ? (
          <MasterPromptQnA
            themeId={selectedThemeId}
            themeName={selectedThemeName || undefined}
            onComplete={() => setView(AppView.ONBOARDING)}
            onSkip={() => setView(AppView.ONBOARDING)}
            onBack={() => setView(AppView.THEME_SELECTION)}
          />
        ) : (
          // Redirect to theme selection if no theme selected
          <ThemeSelector
            onSelect={(theme) => {
              setSelectedThemeId(theme.id);
              setSelectedThemeName(theme.display_name || theme.name);
              setView(AppView.IDENTITY_QNA);
            }}
            onSkip={() => setView(AppView.ONBOARDING)}
          />
        );
      case AppView.ONBOARDING:
        return (
          <OnboardingWizard
            onComplete={(prompt) => {
              setActiveVisionPrompt(prompt);
              setView(AppView.VISION_BOARD);
            }}
            onSkip={() => setView(AppView.LANDING)}
          />
        );
      case AppView.FINANCIAL:
        return (
          <FinancialDashboard 
            onComplete={(data) => {
              setFinancialData(data);
              setView(AppView.VISION_BOARD);
            }}
            onLaunchWizard={() => setView(AppView.ONBOARDING)} 
          />
        );
      case AppView.VISION_BOARD:
        return (
          <VisionBoard 
            initialImage={selectedGalleryImage}
            initialPrompt={activeVisionPrompt} // Pass the captured vision prompt
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
      case AppView.TRUST_CENTER:
        return <TrustCenter />;
      case AppView.ORDER_HISTORY:
        return <OrderHistory />;
      case AppView.HABITS:
        return <HabitTracker onBack={() => setView(AppView.LANDING)} />;
      case AppView.WEEKLY_REVIEWS:
        return <WeeklyReviews onBack={() => setView(AppView.LANDING)} />;
      case AppView.KNOWLEDGE_BASE:
        return <KnowledgeBase onBack={() => setView(AppView.LANDING)} />;
      case AppView.VOICE_COACH:
        return <VoiceCoach onBack={() => setView(AppView.LANDING)} />;
      case AppView.PRINT_PRODUCTS:
        return <PrintProducts onBack={() => setView(AppView.LANDING)} />;
      case AppView.PARTNER:
        return <PartnerDashboard onBack={() => setView(AppView.LANDING)} />;
      case AppView.INTEGRATIONS:
        return <SlackIntegration onBack={() => setView(AppView.LANDING)} />;
      case AppView.TEAM_LEADERBOARDS:
        return <TeamLeaderboards onBack={() => setView(AppView.LANDING)} />;
      case AppView.MANAGER_DASHBOARD:
        return <ManagerDashboard onBack={() => setView(AppView.LANDING)} />;
      default:
        return null;
    }
  };

  const sqlCode = `-- 1. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('visions', 'visions', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;

-- 2. Reset & Create Storage Policies (Idempotent)

-- Visions Bucket
DROP POLICY IF EXISTS "Public Access Visions" ON storage.objects;
CREATE POLICY "Public Access Visions" ON storage.objects FOR SELECT USING ( bucket_id = 'visions' );

DROP POLICY IF EXISTS "Public Upload Visions" ON storage.objects;
CREATE POLICY "Public Upload Visions" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'visions' );

DROP POLICY IF EXISTS "Public Delete Visions" ON storage.objects;
CREATE POLICY "Public Delete Visions" ON storage.objects FOR DELETE USING ( bucket_id = 'visions' );

-- Documents Bucket
DROP POLICY IF EXISTS "Public Access Docs" ON storage.objects;
CREATE POLICY "Public Access Docs" ON storage.objects FOR SELECT USING ( bucket_id = 'documents' );

DROP POLICY IF EXISTS "Public Upload Docs" ON storage.objects;
CREATE POLICY "Public Upload Docs" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'documents' );

DROP POLICY IF EXISTS "Public Delete Docs" ON storage.objects;
CREATE POLICY "Public Delete Docs" ON storage.objects FOR DELETE USING ( bucket_id = 'documents' );


-- 3. Create Tables

-- Vision Boards
CREATE TABLE IF NOT EXISTS public.vision_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT false
);

-- Reference Images
CREATE TABLE IF NOT EXISTS public.reference_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    image_url TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    user_id UUID
);

-- Financial Documents (Knowledge Base)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL, -- 'UPLOAD', 'MANUAL', 'AI_INTERVIEW', 'VISION'
    structured_data JSONB, -- The parsed financial data
    tags TEXT[] DEFAULT '{}',
    user_id UUID
);

-- Profiles (Credits & Subscriptions)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  credits INT DEFAULT 3,
  subscription_tier TEXT DEFAULT 'FREE', -- 'FREE', 'PRO', 'ELITE'
      stripe_customer_id TEXT,
          subscription_status TEXT DEFAULT 'inactive', -- 'inactive', 'active', 'cancelled'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, credits, subscription_tier)
  VALUES (new.id, 3, 'FREE');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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
    goal_id TEXT, 
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

-- 1. Create Poster Orders Table
CREATE TABLE IF NOT EXISTS public.poster_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID NOT NULL,
    vision_board_id UUID,
    vendor_order_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, submitted, shipped
    total_price NUMERIC(10, 2),
    discount_applied BOOLEAN DEFAULT false,
    shipping_address JSONB, -- Stores name, address, city, etc.
    print_config JSONB -- Stores size, finish, sku
);

-- 4. Enable RLS
ALTER TABLE public.vision_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poster_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


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

-- Documents
DROP POLICY IF EXISTS "Allow public read Docs" ON public.documents;
CREATE POLICY "Allow public read Docs" ON public.documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert Docs" ON public.documents;
CREATE POLICY "Allow public insert Docs" ON public.documents FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete Docs" ON public.documents;
CREATE POLICY "Allow public delete Docs" ON public.documents FOR DELETE USING (true);

-- Financial Tables
DROP POLICY IF EXISTS "Allow public read Auto" ON public.automation_rules;
CREATE POLICY "Allow public read Auto" ON public.automation_rules FOR SELECT USING (true);

-- Print Orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.poster_orders;
CREATE POLICY "Users can view own orders" 
ON public.poster_orders FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create orders" ON public.poster_orders;
CREATE POLICY "Users can create orders" 
ON public.poster_orders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);
`;

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div></div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar - Simplified v1.6 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView(onboardingCompleted ? AppView.DASHBOARD : AppView.LANDING)}>
              <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center mr-2">
                <span className="text-gold-500 font-serif font-bold text-xl">V</span>
              </div>
              <span className="text-xl font-serif font-bold text-navy-900">Visionary</span>
            </div>

            <div className="flex items-center gap-4">
              {/* Primary Navigation - v1.6 Simplified */}
              <button onClick={() => setView(AppView.DASHBOARD)} className={`text-sm font-medium transition-colors ${view === AppView.DASHBOARD ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                Dashboard
              </button>
              <button onClick={() => setView(AppView.VISION_BOARD)} className={`text-sm font-medium transition-colors ${view === AppView.VISION_BOARD ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                Visualize
              </button>
              <button onClick={() => setView(AppView.GALLERY)} className={`text-sm font-medium transition-colors ${view === AppView.GALLERY ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                Gallery
              </button>
              <button onClick={() => setView(AppView.ACTION_PLAN)} className={`text-sm font-medium transition-colors ${view === AppView.ACTION_PLAN ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                Execute
              </button>
              <button onClick={() => setView(AppView.HABITS)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${view === AppView.HABITS ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                <FireIcon className="w-4 h-4" /> Habits
              </button>
              <button onClick={() => setView(AppView.VOICE_COACH)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${view === AppView.VOICE_COACH ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                <MicIcon className="w-4 h-4" /> Coach
              </button>
              <button onClick={() => setView(AppView.PRINT_PRODUCTS)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${view === AppView.PRINT_PRODUCTS ? 'text-navy-900' : 'text-gray-500 hover:text-navy-900'}`}>
                <PrinterIcon className="w-4 h-4" /> Print
              </button>

              {/* More Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="text-sm font-medium text-gray-500 hover:text-navy-900 transition-colors flex items-center gap-1"
                >
                  More
                  <svg className={`w-4 h-4 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50">
                    <button onClick={() => { setView(AppView.WEEKLY_REVIEWS); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" /> Reviews
                    </button>
                    <button onClick={() => { setView(AppView.KNOWLEDGE_BASE); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <FolderIcon className="w-4 h-4" /> Knowledge
                    </button>
                    <button onClick={() => { setView(AppView.PARTNER); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <HeartIcon className="w-4 h-4" /> Partner
                    </button>
                    <button onClick={() => { setView(AppView.INTEGRATIONS); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <GlobeIcon className="w-4 h-4" /> Apps
                    </button>
                    <button onClick={() => { setView(AppView.TEAM_LEADERBOARDS); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <TrophyIcon className="w-4 h-4" /> Teams
                    </button>
                    <button onClick={() => { setView(AppView.MANAGER_DASHBOARD); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <ChartBarIcon className="w-4 h-4" /> Manager
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { setShowWorkbookModal(true); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <BookOpenIcon className="w-4 h-4" /> Workbook
                    </button>
                    <button onClick={() => { setView(AppView.ORDER_HISTORY); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <ReceiptIcon className="w-4 h-4" /> Orders
                    </button>
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-gray-200 mx-2"></div>

              {/* User Menu */}
              <span className="text-xs text-gray-400 hidden md:block">{session.user.email}</span>
              <button onClick={handleSignOut} className="text-xs font-bold text-navy-900 hover:text-red-500 transition-colors">Sign Out</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Click outside to close dropdown */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-400">
            © 2024 Visionary Inc. Powered by Gemini.
          </div>
          <div className="flex gap-6 text-sm font-medium">
             <button onClick={downloadGuide} className="flex items-center gap-2 hover:text-gold-400 transition-colors">
               <DocumentIcon className="w-4 h-4" /> Download System Guide
             </button>
             <button onClick={() => setView(AppView.ORDER_HISTORY)} className="flex items-center gap-2 hover:text-gold-400 transition-colors">
               <ReceiptIcon className="w-4 h-4" /> Order History
             </button>
             <button onClick={() => setView(AppView.TRUST_CENTER)} className="flex items-center gap-2 hover:text-gold-400 transition-colors">
               <ShieldCheckIcon className="w-4 h-4" /> Trust & Security
             </button>
             <button 
               onClick={() => setShowSqlModal(true)} 
               className={`flex items-center gap-2 transition-colors ${dbConnected ? 'text-green-400' : 'text-red-400'}`}
             >
               <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
               {dbConnected ? 'System Online' : 'Database Setup'}
             </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-bold mb-2 text-navy-900">Database Setup (Supabase)</h3>
            <p className="text-sm text-gray-600 mb-4">Run this SQL in your Supabase Dashboard to create the necessary tables.</p>
            <div className="bg-gray-100 p-4 rounded text-xs font-mono h-64 overflow-y-auto mb-4 select-all">
              <pre>{sqlCode}</pre>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => navigator.clipboard.writeText(sqlCode)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-bold">Copy SQL</button>
              <button onClick={() => setShowSqlModal(false)} className="px-4 py-2 bg-navy-900 text-white rounded hover:bg-navy-800 text-sm font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <SubscriptionModal tier={selectedTier} onClose={() => setShowUpgradeModal(false)} />
      )}

      {showWorkbookModal && (
        <WorkbookOrderModal
          onClose={() => setShowWorkbookModal(false)}
          onSuccess={() => setView(AppView.ORDER_HISTORY)}
        />
      )}
    </div>
  );
};

export default App;
