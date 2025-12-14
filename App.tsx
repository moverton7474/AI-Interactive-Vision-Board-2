import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AppView, VisionImage, FinancialGoal, OnboardingState, ActionTask, Habit, UserProfile } from './types';
import { withRetry } from './utils/retry';
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
import MdalsTestPanel from './components/mdals/MdalsTestPanel';
import { GuidedOnboarding } from './components/onboarding';
import { Dashboard, DashboardV2 } from './components/dashboard';
import { LandingPage } from './components/landing';
import { SparklesIcon, MicIcon, DocumentIcon, ReceiptIcon, ShieldCheckIcon, FireIcon, BookOpenIcon, CalendarIcon, FolderIcon, PrinterIcon, HeartIcon, GlobeIcon, TrophyIcon, ChartBarIcon, MusicNoteIcon, BeakerIcon, VisionaryLogo, VisionaryIcon } from './components/Icons';
import { sendVisionChatMessage, generateVisionSummary } from './services/geminiService';
import { checkDatabaseConnection, saveDocument } from './services/storageService';
import { SYSTEM_GUIDE_MD } from './lib/systemGuide';
import { ToastProvider } from './components/ToastContext';
import NotificationSettings from './components/settings/NotificationSettings';
import { useEntitlementPolling } from './hooks';

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLoginForm, setShowLoginForm] = useState(false);

  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [chatInput, setChatInput] = useState('');
  const [credits, setCredits] = useState<number>(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'FREE' | 'PRO' | 'ELITE'>('FREE');

  // Landing/Onboarding State
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: "Welcome to Visionary. I'm your AI architect. What is the biggest dream you want to achieve in the next 3 years?" }
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
  const [motivationStyle, setMotivationStyle] = useState<'encouraging' | 'challenging' | 'analytical' | 'spiritual' | undefined>(undefined);

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
  const [primaryVisionId, setPrimaryVisionId] = useState<string | undefined>();
  const [dashboardTasks, setDashboardTasks] = useState<ActionTask[]>([]);
  const [dashboardHabits, setDashboardHabits] = useState<{ id: string; name: string; icon: string; completedToday: boolean; streak: number }[]>([]);
  const [financialTarget, setFinancialTarget] = useState<number | undefined>();
  const [todayFocus, setTodayFocus] = useState<string | undefined>();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Profile loading guard to prevent duplicate fetches
  const [profileLoadingInProgress, setProfileLoadingInProgress] = useState(false);
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null);

  // ==============================
  // CHECKOUT RETURN POLLING (P0-B)
  // ==============================
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [showEntitlementToast, setShowEntitlementToast] = useState(false);

  // Extract session_id from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      console.log('[App] Checkout return detected, session_id:', sessionId);
      setCheckoutSessionId(sessionId);
    }
  }, []);

  // Use the entitlement polling hook
  const { isPolling: entitlementPolling, subscriptionTier: polledTier, pollError } = useEntitlementPolling({
    sessionId: checkoutSessionId,
    onSuccess: (tier) => {
      console.log('[App] Entitlement confirmed:', tier);
      setSubscriptionTier(tier as 'FREE' | 'PRO' | 'ELITE');
      setShowEntitlementToast(true);
      setCheckoutSessionId(null);

      // Auto-hide toast after 5 seconds
      setTimeout(() => setShowEntitlementToast(false), 5000);
    },
    onTimeout: () => {
      console.warn('[App] Entitlement polling timeout');
      setCheckoutSessionId(null);
    },
    maxAttempts: 20,
    intervalMs: 1000,
  });

  useEffect(() => {
    // 1. Check DB Connection
    checkDatabaseConnection().then(isConnected => {
      setDbConnected(isConnected);
    });

    // 2. Check Auth Session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("Session check error:", error.message);
        // Handle invalid refresh token by clearing session
        if (error.message.includes("Refresh Token Not Found") || error.message.includes("Invalid Refresh Token")) {
          supabase.auth.signOut().catch(() => { });
          setSession(null);
        }
      } else {
        setSession(session);
      }
      setAuthLoading(false);
    }).catch(() => {
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
      setLastLoadedUserId(null);
      return;
    }

    // Guard: Skip if already loading or if we've already loaded this user's profile
    if (profileLoadingInProgress) {
      return;
    }

    if (lastLoadedUserId === session.user.id) {
      return;
    }

    const loadUserProfile = async (retryCount = 0) => {
      const MAX_RETRIES = 1;

      // Set loading guard
      setProfileLoadingInProgress(true);

      console.log('🔍 Loading user profile...', { userId: session.user.id, email: session.user.email, attempt: retryCount + 1 });

      try {
        // Get profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_completed, financial_target, primary_vision_id, credits, subscription_tier')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('❌ Profile fetch error:', {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            timestamp: new Date().toISOString()
          });

          // If profile doesn't exist (PGRST116 = row not found), create it
          if (profileError.code === 'PGRST116' && retryCount < MAX_RETRIES) {
            console.log('📝 Profile not found, creating new profile...');

            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email,
                onboarding_completed: false,
                credits: 10,
                subscription_tier: 'FREE',
                created_at: new Date().toISOString()
              });

            if (createError) {
              console.error('❌ Failed to create profile:', createError);
            } else {
              console.log('✅ Profile created successfully, retrying load...');
              // Retry loading the profile
              return loadUserProfile(retryCount + 1);
            }
          }

          // Set safe defaults if profile fetch failed
          console.log('⚠️ Using safe defaults for profile data');
          setOnboardingCompleted(false);
          setFinancialTarget(undefined);
          setCredits(10);
          setSubscriptionTier('FREE');
          setPrimaryVisionUrl(undefined);
          setPrimaryVisionTitle(undefined);
        } else if (profile) {
          console.log('✅ Profile loaded successfully:', {
            onboardingCompleted: profile.onboarding_completed,
            hasFinancialTarget: !!profile.financial_target,
            hasPrimaryVision: !!profile.primary_vision_id,
            credits: profile.credits,
            tier: profile.subscription_tier
          });

          setOnboardingCompleted(profile.onboarding_completed ?? false);
          setFinancialTarget(profile.financial_target);
          if (profile.credits !== undefined) setCredits(profile.credits);
          if (profile.subscription_tier) setSubscriptionTier(profile.subscription_tier as any);

          // Load primary vision if exists
          if (profile.primary_vision_id) {
            console.log('🔍 Loading primary vision...', { visionId: profile.primary_vision_id });
            setPrimaryVisionId(profile.primary_vision_id);

            const { data: vision, error: visionError } = await supabase
              .from('vision_boards')
              .select('image_url, prompt')
              .eq('id', profile.primary_vision_id)
              .single();

            if (visionError) {
              console.error('❌ Primary vision fetch error:', visionError);
            } else if (vision) {
              console.log('✅ Primary vision loaded successfully');
              setPrimaryVisionUrl(vision.image_url);
              setPrimaryVisionTitle(vision.prompt?.slice(0, 50));
            }
          }
        } else {
          // Profile is null but no error - shouldn't happen, but handle it
          console.log('⚠️ Profile returned null without error');
          setOnboardingCompleted(false);
        }

        // Get user identity for theme - using simpler query to avoid JOIN issues
        try {
          const { data: identity, error: identityError } = await supabase
            .from('user_identity_profiles')
            .select('theme_id')
            .eq('user_id', session.user.id)
            .maybeSingle(); // Use maybeSingle to avoid error when not found

          if (identityError) {
            console.warn('⚠️ Identity profile query warning:', identityError.message);
          } else if (identity?.theme_id) {
            // Fetch theme details separately to avoid JOIN issues
            const { data: theme, error: themeError } = await supabase
              .from('motivational_themes')
              .select('name, display_name, motivation_style')
              .eq('id', identity.theme_id)
              .single();

            if (!themeError && theme) {
              console.log('✅ Theme loaded:', { theme: theme.display_name });
              setSelectedThemeId(identity.theme_id);
              setSelectedThemeName(theme.display_name);
              setMotivationStyle(theme.motivation_style as any);
            }
          } else {
            console.log('ℹ️ No theme selected yet (user will choose during onboarding)');
          }
        } catch (identityErr) {
          // Non-blocking error - identity profile is optional until onboarding
          console.warn('⚠️ Could not load identity profile:', identityErr);
        }

        // Set user name from email
        const displayName = session.user.email?.split('@')[0] || 'Friend';
        setUserName(displayName);
        console.log('✅ User name set:', { displayName });

        // Check if user has ANY vision boards (not just primary)
        let hasAnyVisions = false;
        try {
          const { data: visionData, error: countError } = await supabase
            .from('vision_boards')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1);

          if (!countError && visionData && visionData.length > 0) {
            hasAnyVisions = true;
            console.log('✅ User has vision boards:', visionData.length);
          }
        } catch (e) {
          console.warn('Could not check vision boards:', e);
        }

        // Route to appropriate view
        // User goes to Dashboard if:
        // 1. onboarding_completed is true, OR
        // 2. They have a primary vision, OR
        // 3. They have ANY vision boards
        const shouldGoToDashboard = profile?.onboarding_completed || profile?.primary_vision_id || hasAnyVisions;

        if (shouldGoToDashboard) {
          console.log('🏠 Routing to Dashboard', {
            onboardingCompleted: profile?.onboarding_completed,
            hasPrimaryVision: !!profile?.primary_vision_id,
            hasAnyVisions
          });
          setView(AppView.DASHBOARD);
          // Also mark onboarding as complete if they have content
          if (!profile?.onboarding_completed && (profile?.primary_vision_id || hasAnyVisions)) {
            setOnboardingCompleted(true);
          }
        } else {
          console.log('📋 Routing to Onboarding (new user)');
          setView(AppView.GUIDED_ONBOARDING);
        }

        console.log('✅ Profile load complete');

        // Mark this user as loaded to prevent duplicate fetches
        setLastLoadedUserId(session.user.id);
      } catch (err) {
        console.error('❌ Unexpected error loading profile:', {
          error: err,
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });

        // Set safe defaults on unexpected error
        setOnboardingCompleted(false);
        setFinancialTarget(undefined);
        setCredits(10);
        setSubscriptionTier('FREE');
        setUserName(session.user.email?.split('@')[0] || 'Friend');
        setView(AppView.GUIDED_ONBOARDING);

        // Still mark as loaded to prevent retry loops
        setLastLoadedUserId(session.user.id);
      } finally {
        // Clear loading guard
        setProfileLoadingInProgress(false);
      }
    };

    loadUserProfile();
  }, [session, profileLoadingInProgress, lastLoadedUserId]);

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

      // Save generated tasks to action_tasks table
      if (state.generatedTasks && state.generatedTasks.length > 0) {
        const taskRecords = state.generatedTasks.map(task => ({
          user_id: session.user.id,
          title: task.title,
          description: task.description || '',
          type: task.type || 'ADMIN',
          due_date: task.dueDate,
          is_completed: false,
          ai_metadata: task.aiMetadata || null
        }));

        const { error: tasksError } = await supabase
          .from('action_tasks')
          .insert(taskRecords);

        if (tasksError) {
          console.error('Error saving tasks:', tasksError);
        } else {
          console.log(`Saved ${taskRecords.length} tasks from onboarding`);
        }
      }

      // Save selected habits to habits table
      if (state.selectedHabits && state.selectedHabits.length > 0) {
        const habitRecords = state.selectedHabits.map((habit: any) => ({
          user_id: session.user.id,
          title: typeof habit === 'string' ? habit : habit.name,
          description: '',
          frequency: 'daily',
          is_active: true,
          current_streak: 0
        }));

        const { error: habitsError } = await supabase
          .from('habits')
          .insert(habitRecords);

        if (habitsError) {
          console.error('Error saving habits:', habitsError);
        } else {
          console.log(`Saved ${habitRecords.length} habits from onboarding`);
        }
      }

      // Ingest onboarding data into Knowledge Base
      try {
        const onboardingContent = buildOnboardingKBContent(state);
        if (onboardingContent) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            await supabase.functions.invoke('knowledge-ingest?action=ingest', {
              body: {
                sourceType: 'notes',
                sourceName: 'Vision & Goals (Onboarding)',
                content: onboardingContent
              },
              headers: {
                Authorization: `Bearer ${currentSession.access_token}`
              }
            });
            console.log('Onboarding data ingested into Knowledge Base');
          }
        }
      } catch (kbError) {
        console.error('Error ingesting onboarding to KB:', kbError);
      }

      // Update local state
      setOnboardingCompleted(true);
      setFinancialTarget(state.financialTarget);
      setPrimaryVisionUrl(state.primaryVisionUrl);
      setSelectedThemeId(state.themeId || null);
      setSelectedThemeName(state.themeName || null);
      if (state.generatedTasks) {
        setDashboardTasks(state.generatedTasks);
      }

      // Navigate to dashboard
      setView(AppView.DASHBOARD);
    } catch (err) {
      console.error('Error saving onboarding:', err);
    }
  }, [session]);

  // Helper function to build Knowledge Base content from onboarding
  const buildOnboardingKBContent = (state: OnboardingState): string => {
    const sections: string[] = [];

    sections.push('# My Vision & Goals');
    sections.push(`Created: ${new Date().toLocaleDateString()}`);
    sections.push('');

    if (state.themeName) {
      sections.push(`## Coaching Theme: ${state.themeName}`);
      sections.push('');
    }

    if (state.visionText) {
      sections.push('## My Vision Statement');
      sections.push(state.visionText);
      sections.push('');
    }

    if (state.financialTarget !== undefined && state.financialTargetLabel) {
      sections.push('## Financial Goal');
      sections.push(`Target: $${state.financialTarget.toLocaleString()}`);
      sections.push(`Description: ${state.financialTargetLabel}`);
      sections.push('');
    }

    if (state.generatedTasks && state.generatedTasks.length > 0) {
      sections.push('## Action Plan Tasks');
      state.generatedTasks.forEach((task, i) => {
        sections.push(`${i + 1}. **${task.title}**`);
        if (task.description) sections.push(`   ${task.description}`);
        sections.push(`   Type: ${task.type}`);
      });
      sections.push('');
    }

    if (state.selectedHabits && state.selectedHabits.length > 0) {
      sections.push('## Selected Habits');
      state.selectedHabits.forEach((habit: any) => {
        const habitName = typeof habit === 'string' ? habit : habit.name;
        sections.push(`- ${habitName}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  };

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

  // Set a vision as the primary (displayed on dashboard)
  const handleSetPrimaryVision = useCallback(async (image: { id: string; url: string; prompt: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Update profile with new primary vision ID
      const { error } = await supabase
        .from('profiles')
        .update({ primary_vision_id: image.id })
        .eq('id', session.user.id);

      if (error) {
        console.error('Failed to set primary vision:', error);
        return;
      }

      // Update local state
      setPrimaryVisionId(image.id);
      setPrimaryVisionUrl(image.url);
      setPrimaryVisionTitle(image.prompt?.slice(0, 50));

      console.log('✅ Primary vision updated successfully:', image.id);
    } catch (err) {
      console.error('Error setting primary vision:', err);
    }
  }, []);

  // Generate vision image using Gemini API
  // Note: This function throws an error if generation fails - callers should handle this gracefully
  const generateVisionImage = useCallback(async (prompt: string, photoRef?: string, onStatusChange?: (status: string) => void) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Please sign in to generate visions');
    }

    // Check credits before generating
    if (credits < 1) {
      throw new Error("You've run out of credits! Please upgrade or purchase more to continue dreaming.");
    }

    let imageUrl: string | null = null;
    let generationError: string | null = null;

    // Try to generate image via Gemini API
    try {
      if (onStatusChange) onStatusChange('Preparing your vision...');

      // Build request with optional photo reference
      const requestBody: any = {
        action: 'generate_image',
        prompt,
        images: []
      };

      // If photo reference provided, fetch it and include with identity description
      if (photoRef) {
        try {
          if (onStatusChange) onStatusChange('Processing reference photo...');
          const { data: refData } = await supabase
            .from('reference_images')
            .select('image_url, identity_description')
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

            // Include identity description in prompt if available
            if (refData.identity_description) {
              requestBody.identityDescription = refData.identity_description;
              // Append identity preservation instruction to prompt
              requestBody.prompt = `${prompt}\n\nIMPORTANT: The reference photo shows the person who should appear in this vision. Their appearance: ${refData.identity_description}. Preserve their exact likeness, facial features, skin tone, and distinguishing characteristics in the generated image. The person in the output MUST look like the same person in the reference photo.`;
            }
          }
        } catch (refError) {
          console.warn('Could not load reference image:', refError);
        }
      }

      // Call Gemini proxy edge function with retry
      if (onStatusChange) onStatusChange('Dreaming up your vision (this may take a moment)...');

      const { data, error } = await withRetry(async () => {
        return await supabase.functions.invoke('gemini-proxy', {
          body: requestBody,
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
      });

      if (error) {
        generationError = error.message || 'Failed to connect to image generation service';
        console.error('Gemini proxy error:', error);
      } else if (!data?.success) {
        generationError = data?.error || 'Image generation returned unsuccessful response';
        console.error('Gemini generation failed:', data);
      } else if (data?.image) {
        // Upload the generated image to storage
        if (onStatusChange) onStatusChange('Saving your masterpiece...');

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

        // Retry upload logic
        const { error: uploadError } = await withRetry(async () => {
          return await supabase.storage
            .from('visions')
            .upload(fileName, blob, { upsert: true });
        });

        if (uploadError) {
          generationError = 'Failed to upload generated image to storage';
          console.error('Upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('visions')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;

          // Deduct credit
          const newCredits = credits - 1;
          setCredits(newCredits);
          await supabase.from('profiles').update({ credits: newCredits }).eq('id', session.user.id);
        }
      } else {
        generationError = 'No image returned from generation service';
      }
    } catch (genError: any) {
      generationError = genError.message || 'Image generation failed';
      console.error('Image generation exception:', genError);
    }

    // If generation failed, throw error - don't save placeholder to database
    // The UI components handle failures gracefully with their own in-memory placeholders
    if (!imageUrl) {
      throw new Error(generationError || 'Image generation unavailable. Please try again later.');
    }

    // Only save successfully generated images to the database
    if (onStatusChange) onStatusChange('Finalizing...');

    const { data: visionData, error: visionError } = await supabase
      .from('vision_boards')
      .insert({
        user_id: session.user.id,
        image_url: imageUrl,
        prompt: prompt
      })
      .select()
      .single();

    if (visionError) {
      console.warn('Vision save error:', visionError);
      // Still return the image URL even if DB save failed
      return {
        id: `vision-${Date.now()}`,
        url: imageUrl
      };
    }

    if (onStatusChange) onStatusChange('Complete!');

    return {
      id: visionData.id,
      url: imageUrl
    };
  }, [credits]);

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
    // Save onboarding state to user_vision_profiles for scene prompt generation
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user authenticated, skipping vision profile save');
        return;
      }

      const payload: Record<string, any> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      // Map OnboardingState fields to user_vision_profiles columns
      if (state.visionText !== undefined) payload.vision_text = state.visionText;
      if (state.financialTarget !== undefined) payload.financial_target = state.financialTarget;
      if (state.financialTargetLabel !== undefined) payload.financial_target_label = state.financialTargetLabel;
      if (state.primaryVisionUrl !== undefined) payload.primary_vision_url = state.primaryVisionUrl;
      if (state.primaryVisionId !== undefined) payload.primary_vision_id = state.primaryVisionId;

      // Infer domain from theme name if available
      if (state.themeName) {
        const themeLower = state.themeName.toLowerCase();
        if (themeLower.includes('retire') || themeLower.includes('legacy')) {
          payload.domain = 'RETIREMENT';
        } else if (themeLower.includes('career') || themeLower.includes('business')) {
          payload.domain = 'CAREER';
        } else if (themeLower.includes('travel') || themeLower.includes('adventure')) {
          payload.domain = 'TRAVEL';
        } else if (themeLower.includes('health') || themeLower.includes('wellness')) {
          payload.domain = 'HEALTH';
        }
      }

      const { error } = await supabase
        .from('user_vision_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving to user_vision_profiles:', error);
      } else {
        console.log('Vision profile saved successfully:', payload);
      }
    } catch (err) {
      console.error('Error saving onboarding state to user_vision_profiles:', err);
    }
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

  const handleUpgrade = async (tier: 'PRO' | 'ELITE') => {
    try {
      const priceId = tier === 'PRO' ? 'price_pro_monthly' : 'price_elite_monthly'; // Replace with real Stripe Price IDs

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          successUrl: window.location.origin + '?session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: window.location.origin,
          mode: 'subscription'
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
      alert('Failed to start checkout. Please try again.');
    }
  };

  const handlePlayBriefing = async () => {
    if (!session?.user) return;
    try {
      // alert("Connecting to your AI Coach..."); // Optional: Remove alert for better UX or use toast
      const { data, error } = await supabase.functions.invoke('communication-router', {
        body: {
          userId: session.user.id,
          type: 'morning_briefing',
          urgency: 'high'
        }
      });
      if (error) throw error;
      console.log('Briefing triggered:', data);
      alert('Your AI Coach is calling you now!');
    } catch (err) {
      console.error('Failed to trigger briefing:', err);
      alert('Failed to connect to AI Coach. Please try again.');
    }
  };

  const renderContent = () => {
    switch (view) {
      case AppView.DASHBOARD:
        return session?.user ? (
          <DashboardV2
            userId={session.user.id}
            userEmail={session.user.email}
            userName={userName}
            onNavigate={setView}
            onRefineVision={(vision) => {
              // Set the vision as the selected image for the VisionBoard editor
              setSelectedGalleryImage({
                id: vision.id,
                url: vision.imageUrl || '',
                prompt: vision.title || '',
                createdAt: Date.now()
              });
              setView(AppView.VISION_BOARD);
            }}
            primaryVision={primaryVisionId && primaryVisionUrl ? {
              id: primaryVisionId,
              url: primaryVisionUrl,
              title: primaryVisionTitle || ''
            } : undefined}
            onboardingCompleted={onboardingCompleted ?? undefined}
          />
        ) : null;

      case AppView.SETTINGS:
        return (
          <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white transition-colors duration-300">
            <div className="max-w-4xl mx-auto p-4 pt-8">
              <button
                onClick={() => setView(AppView.DASHBOARD)}
                className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-medium"
              >
                <span className="text-xl">←</span> Back to Dashboard
              </button>
              <NotificationSettings />
            </div>
          </div>
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
            <Pricing onUpgrade={handleUpgrade} />
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
          <Gallery
            onSelect={(img) => {
              setSelectedGalleryImage(img);
              setView(AppView.VISION_BOARD);
            }}
            onSetPrimary={handleSetPrimaryVision}
            primaryVisionId={primaryVisionId}
            onNavigateToVisionBoard={() => {
              setSelectedGalleryImage(null);
              setView(AppView.VISION_BOARD);
            }}
          />
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
        return <HabitTracker onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.WEEKLY_REVIEWS:
        return <WeeklyReviews onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.KNOWLEDGE_BASE:
        return <KnowledgeBase onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.VOICE_COACH:
        return <VoiceCoach onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.PRINT_PRODUCTS:
        return <PrintProducts onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.PARTNER:
        return <PartnerDashboard onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.INTEGRATIONS:
        return <SlackIntegration onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.TEAM_LEADERBOARDS:
        return <TeamLeaderboards onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.MANAGER_DASHBOARD:
        return <ManagerDashboard onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.MDALS_LAB:
        return session?.user?.id ? (
          <MdalsTestPanel
            userId={session.user.id}
            onClose={() => setView(AppView.DASHBOARD)}
          />
        ) : null;
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
                  tags TEXT[] DEFAULT '{ }',
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
                  tags TEXT[] DEFAULT '{ }',
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 'N' for New Vision (Navigate to Dashboard)
      if (e.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        setView(AppView.DASHBOARD);
      }
      // 'Esc' to close modals or return to dashboard from deep views
      if (e.key === 'Escape') {
        if (view === AppView.GALLERY || view === AppView.ACTION_PLAN) {
          setView(AppView.DASHBOARD);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  // Safety check: Redirect logged-in users appropriately if they're on an unexpected view
  useEffect(() => {
    // Only run this check if user is logged in and we've finished loading profile
    if (session && onboardingCompleted !== null) {
      // If user has completed onboarding but is on LANDING, redirect to Dashboard
      if (onboardingCompleted === true && view === AppView.LANDING) {
        console.log('🔄 Safety redirect: Moving logged-in user from LANDING to DASHBOARD');
        setView(AppView.DASHBOARD);
      }
      // If user has NOT completed onboarding and is on LANDING, redirect to onboarding
      // This bypasses the internal landing page for new users after signup
      if (onboardingCompleted === false && view === AppView.LANDING) {
        console.log('🔄 Safety redirect: Moving new user from LANDING to GUIDED_ONBOARDING');
        setView(AppView.GUIDED_ONBOARDING);
      }
    }
  }, [session, onboardingCompleted, view]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div></div>;
  }

  if (!session) {
    // Show either the marketing landing page or login form
    if (showLoginForm) {
      return (
        <div className="min-h-screen bg-slate-50">
          {/* Back to Landing button */}
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => setShowLoginForm(false)}
              className="flex items-center gap-2 text-gray-500 hover:text-navy-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
          </div>
          <Login />
        </div>
      );
    }

    // Show the marketing landing page
    return (
      <LandingPage
        onGetStarted={() => setShowLoginForm(true)}
        onLogin={() => setShowLoginForm(true)}
      />
    );
  }

  // Show loading while profile is being loaded for logged-in users
  if (onboardingCompleted === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div></div>;
  }



  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Navbar - Mobile Optimized v1.7 - Visionary AI Branded */}
        <nav className="bg-navy-900 border-b border-gold-500/20 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-14 md:h-16">
              {/* Logo */}
              <div className="flex items-center cursor-pointer" onClick={() => setView(onboardingCompleted ? AppView.DASHBOARD : AppView.LANDING)}>
                <VisionaryLogo variant="full" size="sm" theme="light" />
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden flex items-center p-2 text-gold-400 hover:text-gold-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showMobileMenu ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-4">
                {/* Primary Navigation - v1.6 Simplified */}
                <button onClick={() => setView(AppView.DASHBOARD)} className={`text-sm font-medium transition-colors ${view === AppView.DASHBOARD ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  Ascension
                </button>
                <button onClick={() => setView(AppView.VISION_BOARD)} className={`text-sm font-medium transition-colors ${view === AppView.VISION_BOARD ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  Visualize
                </button>
                <button onClick={() => setView(AppView.GALLERY)} className={`text-sm font-medium transition-colors ${view === AppView.GALLERY ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  Gallery
                </button>
                <button onClick={() => setView(AppView.ACTION_PLAN)} className={`text-sm font-medium transition-colors ${view === AppView.ACTION_PLAN ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  Execute
                </button>
                <button onClick={() => setView(AppView.HABITS)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${view === AppView.HABITS ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  <FireIcon className="w-4 h-4" /> Habits
                </button>
                <button onClick={() => setView(AppView.VOICE_COACH)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${view === AppView.VOICE_COACH ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  <MicIcon className="w-4 h-4" /> Coach
                </button>
                <button onClick={() => setView(AppView.PRINT_PRODUCTS)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${view === AppView.PRINT_PRODUCTS ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  <PrinterIcon className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setShowWorkbookModal(true)} className={`text-sm font-medium flex items-center gap-1 transition-colors ${showWorkbookModal ? 'text-gold-400' : 'text-gray-400 hover:text-gold-400'}`}>
                  <BookOpenIcon className="w-4 h-4" /> Workbook
                </button>

                {/* More Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="text-sm font-medium text-gray-400 hover:text-gold-400 transition-colors flex items-center gap-1"
                  >
                    More
                    <svg className={`w-4 h-4 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-charcoal-800 rounded-lg shadow-xl border border-gold-500/20 py-2 z-50">
                      <button onClick={() => { setView(AppView.WEEKLY_REVIEWS); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" /> Reviews
                      </button>
                      <button onClick={() => { setView(AppView.KNOWLEDGE_BASE); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <FolderIcon className="w-4 h-4" /> Knowledge
                      </button>
                      <button onClick={() => { setView(AppView.PARTNER); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <HeartIcon className="w-4 h-4" /> Partner
                      </button>
                      <button onClick={() => { setView(AppView.INTEGRATIONS); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <GlobeIcon className="w-4 h-4" /> Apps
                      </button>
                      <button onClick={() => { setView(AppView.TEAM_LEADERBOARDS); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <TrophyIcon className="w-4 h-4" /> Teams
                      </button>
                      <button onClick={() => { setView(AppView.MANAGER_DASHBOARD); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4" /> Manager
                      </button>
                      <button onClick={() => { setView(AppView.MDALS_LAB); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gold-400 hover:bg-navy-800 flex items-center gap-2">
                        <MusicNoteIcon className="w-4 h-4" /> MDALS Lab
                      </button>
                      <div className="border-t border-gold-500/20 my-1" />
                      <button onClick={() => { setView(AppView.ORDER_HISTORY); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-navy-800 hover:text-gold-400 flex items-center gap-2">
                        <ReceiptIcon className="w-4 h-4" /> Orders
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-6 w-px bg-gold-500/20 mx-2"></div>

                {/* User Menu */}
                <span className="text-xs text-gray-500 hidden lg:block">{session.user.email}</span>
                <button onClick={handleSignOut} className="text-xs font-bold text-gold-400 hover:text-red-400 transition-colors">Sign Out</button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {showMobileMenu && (
            <div className="md:hidden bg-charcoal-800 border-t border-gold-500/20 shadow-lg">
              <div className="px-4 py-3 space-y-1">
                {/* Primary Nav Items */}
                <button onClick={() => { setView(AppView.DASHBOARD); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.DASHBOARD ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <VisionaryIcon size={16} color={view === AppView.DASHBOARD ? '#C5A572' : '#9CA3AF'} /> Ascension
                </button>
                <button onClick={() => { setView(AppView.VISION_BOARD); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.VISION_BOARD ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <SparklesIcon className="w-4 h-4" /> Visualize
                </button>
                <button onClick={() => { setView(AppView.GALLERY); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.GALLERY ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <SparklesIcon className="w-4 h-4" /> Gallery
                </button>
                <button onClick={() => { setView(AppView.ACTION_PLAN); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.ACTION_PLAN ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <SparklesIcon className="w-4 h-4" /> Execute
                </button>

                <div className="border-t border-gold-500/20 my-2" />

                {/* Secondary Nav */}
                <button onClick={() => { setView(AppView.HABITS); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.HABITS ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <FireIcon className="w-4 h-4" /> Habits
                </button>
                <button onClick={() => { setView(AppView.VOICE_COACH); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.VOICE_COACH ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <MicIcon className="w-4 h-4" /> Voice Coach
                </button>
                <button onClick={() => { setView(AppView.PRINT_PRODUCTS); setShowMobileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${view === AppView.PRINT_PRODUCTS ? 'bg-gold-500/20 text-gold-400' : 'text-gray-300 hover:bg-navy-800'}`}>
                  <PrinterIcon className="w-4 h-4" /> Print Products
                </button>
                <button onClick={() => { setShowWorkbookModal(true); setShowMobileMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-gray-300 hover:bg-navy-800">
                  <BookOpenIcon className="w-4 h-4" /> Workbook
                </button>

                <div className="border-t border-gold-500/20 my-2" />

                {/* More Items */}
                <button onClick={() => { setView(AppView.WEEKLY_REVIEWS); setShowMobileMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-gray-300 hover:bg-navy-800">
                  <CalendarIcon className="w-4 h-4" /> Reviews
                </button>
                <button onClick={() => { setView(AppView.KNOWLEDGE_BASE); setShowMobileMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-gray-300 hover:bg-navy-800">
                  <FolderIcon className="w-4 h-4" /> Knowledge Base
                </button>
                <button onClick={() => { setView(AppView.ORDER_HISTORY); setShowMobileMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 text-gray-300 hover:bg-navy-800">
                  <ReceiptIcon className="w-4 h-4" /> Order History
                </button>

                <div className="border-t border-gold-500/20 my-2" />

                {/* User Section */}
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-500 mb-2">{session.user.email}</p>
                  <button onClick={() => { handleSignOut(); setShowMobileMenu(false); }} className="text-sm font-bold text-red-400 hover:text-red-300">
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Click outside to close dropdowns */}
        {(showMoreMenu || showMobileMenu) && (
          <div className="fixed inset-0 z-40" onClick={() => { setShowMoreMenu(false); setShowMobileMenu(false); }} />
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
            onNavigateToGenerator={() => {
              setShowWorkbookModal(false);
              setView(AppView.VISION_BOARD);
            }}
            onNavigateToHabits={() => {
              setShowWorkbookModal(false);
              setView(AppView.HABITS);
            }}
          />
        )}

        {/* Entitlement Polling Toast (P0-B) */}
        {entitlementPolling && (
          <div className="fixed bottom-4 right-4 z-50 bg-navy-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Confirming your subscription...</span>
          </div>
        )}

        {showEntitlementToast && (
          <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Welcome to {polledTier}! Your subscription is now active.</span>
          </div>
        )}

        {pollError && (
          <div className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-navy-900 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-fade-in">
            <p className="text-sm font-medium">{pollError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs underline mt-1"
            >
              Refresh page
            </button>
          </div>
        )}
      </div>
    </ToastProvider>
  );
};

export default App;
