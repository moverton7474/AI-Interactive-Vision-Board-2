import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { AppView, ActionTask } from '../../types';
import VisionHero from './VisionHero';
import ExecutionPanel from './ExecutionPanel';
import QuickActions from './QuickActions';
import ProgressPredictionWidget from './ProgressPredictionWidget';
import AchievementGallery from './AchievementGallery';
import WorkbookOrderModal from '../WorkbookOrderModal';
import PrintOrderModal from '../PrintOrderModal';
import VoiceCoachWidget from '../VoiceCoachWidget';

// Data types
interface VisionData {
  id: string;
  title?: string;
  imageUrl?: string;
  isPrimary?: boolean;
  createdAt?: string;
}

interface VisionProgress {
  tasksCompleted: number;
  tasksTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
  streakDays: number;
}

interface HabitData {
  id: string;
  name: string;
  icon: string;
  completedToday: boolean;
  streak: number;
  targetPerDay?: number;
  completedCount?: number;
}

interface Props {
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onNavigate: (view: AppView) => void;
  onRefineVision?: (vision: VisionData) => void;
  primaryVision?: {
    id: string;
    url: string;
    title: string;
  };
  onboardingCompleted?: boolean;
}

const DashboardV2: React.FC<Props> = ({
  userId,
  userEmail,
  userName,
  userRole,
  onNavigate,
  onRefineVision,
  primaryVision,
  onboardingCompleted
}) => {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showWorkbookModal, setShowWorkbookModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showVoiceCoach, setShowVoiceCoach] = useState(false);

  // Re-engagement banner state (only dismiss for current session)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingHabits, setIsLoadingHabits] = useState(true);

  // Data states
  const [vision, setVision] = useState<VisionData | null>(null);
  const [todayTasks, setTodayTasks] = useState<ActionTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<ActionTask[]>([]);
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [todayFocus, setTodayFocus] = useState<string | undefined>();
  const [themeName, setThemeName] = useState<string | undefined>();

  // Ref to prevent duplicate fetches
  const fetchInProgress = useRef(false);
  const hasFetched = useRef(false);

  // Fetch active vision
  const fetchActiveVision = useCallback(async () => {
    try {
      const { data: boards, error } = await supabase
        .from('vision_boards')
        .select('id, prompt, image_url, is_favorite, created_at')
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (boards && boards.length > 0) {
        setVision({
          id: boards[0].id,
          title: boards[0].prompt?.slice(0, 100),
          imageUrl: boards[0].image_url,
          isPrimary: boards[0].is_favorite,
          createdAt: boards[0].created_at
        });
      }
    } catch (error) {
      console.error('Error fetching vision:', error);
    }
  }, [userId]);

  // Fetch today's tasks
  const fetchTodayTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch today's tasks
      const { data: todayData, error: todayError } = await supabase
        .from('action_tasks')
        .select('id, title, description, due_date, type, is_completed, ai_metadata')
        .eq('user_id', userId)
        .gte('due_date', today.toISOString())
        .lt('due_date', tomorrow.toISOString())
        .order('due_date', { ascending: true });

      if (todayError) throw todayError;

      const mappedTodayTasks: ActionTask[] = (todayData || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        dueDate: task.due_date,
        type: task.type as ActionTask['type'],
        isCompleted: task.is_completed,
        aiMetadata: task.ai_metadata
      }));

      setTodayTasks(mappedTodayTasks);

      // Fetch upcoming tasks
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('action_tasks')
        .select('id, title, description, due_date, type, is_completed')
        .eq('user_id', userId)
        .gte('due_date', tomorrow.toISOString())
        .eq('is_completed', false)
        .order('due_date', { ascending: true })
        .limit(3);

      if (upcomingError) throw upcomingError;

      const mappedUpcomingTasks: ActionTask[] = (upcomingData || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        dueDate: task.due_date,
        type: task.type as ActionTask['type'],
        isCompleted: task.is_completed
      }));

      setUpcomingTasks(mappedUpcomingTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [userId]);

  // Fetch habits with today's completions
  const fetchHabits = useCallback(async () => {
    setIsLoadingHabits(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, title, description, frequency, current_streak')
        .eq('user_id', userId);

      if (habitsError) {
        console.warn('Habits query error:', habitsError.message);
      }

      // Fetch today's completions
      const { data: completionsData, error: completionsError } = await supabase
        .from('habit_completions')
        .select('habit_id, completed_at')
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString());

      if (completionsError) throw completionsError;

      const completedHabitIds = new Set(completionsData?.map(c => c.habit_id) || []);

      // Map icons based on habit title
      const getHabitIcon = (title: string | undefined | null): string => {
        if (!title) return '⭐';
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('meditat') || lowerTitle.includes('mindful')) return '🧘';
        if (lowerTitle.includes('exercise') || lowerTitle.includes('workout') || lowerTitle.includes('gym')) return '💪';
        if (lowerTitle.includes('read')) return '📚';
        if (lowerTitle.includes('water') || lowerTitle.includes('hydrat')) return '💧';
        if (lowerTitle.includes('sleep') || lowerTitle.includes('rest')) return '😴';
        if (lowerTitle.includes('journal') || lowerTitle.includes('write')) return '✍️';
        if (lowerTitle.includes('walk') || lowerTitle.includes('step')) return '🚶';
        if (lowerTitle.includes('vitamin') || lowerTitle.includes('supplement')) return '💊';
        if (lowerTitle.includes('gratitude') || lowerTitle.includes('thankful')) return '🙏';
        if (lowerTitle.includes('pray') || lowerTitle.includes('spirit')) return '✨';
        return '⭐';
      };

      const mappedHabits: HabitData[] = (habitsData || []).map(habit => ({
        id: habit.id,
        name: habit.title,
        icon: getHabitIcon(habit.title),
        completedToday: completedHabitIds.has(habit.id),
        streak: habit.current_streak || 0
      }));

      setHabits(mappedHabits);
    } catch (error) {
      console.error('Error fetching habits:', error);
    } finally {
      setIsLoadingHabits(false);
    }
  }, [userId]);

  // Fetch theme data
  const fetchThemeData = useCallback(async () => {
    try {
      const { data: identity, error: identityError } = await supabase
        .from('user_identity_profiles')
        .select(`
          theme_id,
          theme:motivational_themes (
            name,
            display_name
          )
        `)
        .eq('user_id', userId)
        .single();

      if (!identityError && identity?.theme) {
        // @ts-ignore - theme is joined
        const themeDisplayName = identity.theme.display_name || identity.theme.name;
        setThemeName(themeDisplayName);
      }
    } catch (error) {
      console.error('Error fetching theme data:', error);
    }
  }, [userId]);

  // Calculate progress stats using useMemo (no separate useEffect needed)
  const progress = useMemo((): VisionProgress => {
    const tasksCompleted = todayTasks.filter(t => t.isCompleted).length;
    const habitsCompleted = habits.filter(h => h.completedToday).length;
    const maxStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

    return {
      tasksCompleted,
      tasksTotal: todayTasks.length,
      habitsCompleted,
      habitsTotal: habits.length,
      streakDays: maxStreak
    };
  }, [todayTasks, habits]);

  // Initial data fetch - runs once on mount
  useEffect(() => {
    // Prevent duplicate fetches (React StrictMode double-mount protection)
    if (hasFetched.current || fetchInProgress.current) {
      return;
    }

    const loadDashboard = async () => {
      fetchInProgress.current = true;
      setIsLoading(true);

      try {
        await Promise.all([
          // Only fetch vision from DB if no primaryVision prop provided
          primaryVision ? Promise.resolve() : fetchActiveVision(),
          fetchTodayTasks(),
          fetchHabits(),
          fetchThemeData()
        ]);
        hasFetched.current = true;
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setIsLoading(false);
        fetchInProgress.current = false;
      }
    };

    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Only depend on userId - callbacks are stable because they only depend on userId

  // Use primaryVision prop if provided (from App.tsx state)
  useEffect(() => {
    if (primaryVision) {
      setVision({
        id: primaryVision.id,
        title: primaryVision.title,
        imageUrl: primaryVision.url,
        isPrimary: true
      });
    }
  }, [primaryVision]);

  // Toggle task completion - uses functional updates to avoid state dependency
  const handleToggleTask = useCallback(async (taskId: string) => {
    let newCompleted: boolean | undefined;

    // Optimistic update with functional state to get current value
    setTodayTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      newCompleted = !task.isCompleted;
      return prev.map(t => t.id === taskId ? { ...t, isCompleted: newCompleted! } : t);
    });

    // If task wasn't found, newCompleted will be undefined
    if (newCompleted === undefined) return;

    try {
      const { error } = await supabase
        .from('action_tasks')
        .update({ is_completed: newCompleted })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling task:', error);
      // Revert on error
      setTodayTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, isCompleted: !newCompleted } : t)
      );
    }
  }, []); // No dependencies needed - uses functional updates

  // Toggle habit completion - uses functional updates to avoid state dependency
  const handleToggleHabit = useCallback(async (habitId: string) => {
    let wasCompleted: boolean | undefined;
    let currentStreak = 0;

    // Optimistic update with functional state to get current values
    setHabits(prev => {
      const habit = prev.find(h => h.id === habitId);
      if (!habit) return prev;
      wasCompleted = habit.completedToday;
      currentStreak = habit.streak || 0;
      return prev.map(h => h.id === habitId ? { ...h, completedToday: !wasCompleted } : h);
    });

    // If habit wasn't found, wasCompleted will be undefined
    if (wasCompleted === undefined) return;

    try {
      if (wasCompleted) {
        // Delete today's completion
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .gte('completed_at', today.toISOString())
          .lt('completed_at', tomorrow.toISOString());

        if (error) throw error;
      } else {
        // Add completion
        const { error } = await supabase
          .from('habit_completions')
          .insert({
            habit_id: habitId,
            completed_at: new Date().toISOString()
          });

        if (error) throw error;

        // Update streak
        const { error: streakError } = await supabase
          .from('habits')
          .update({
            current_streak: currentStreak + 1,
            last_completed: new Date().toISOString()
          })
          .eq('id', habitId);

        if (streakError) console.error('Error updating streak:', streakError);
      }
    } catch (error) {
      console.error('Error toggling habit:', error);
      // Revert on error
      setHabits(prev =>
        prev.map(h => h.id === habitId ? { ...h, completedToday: wasCompleted } : h)
      );
    }
  }, []); // No dependencies needed - uses functional updates

  // Handle focus update
  const handleSetFocus = useCallback(async (focus: string) => {
    setTodayFocus(focus);
  }, []);

  // Derived display name
  const displayName = userName || userEmail?.split('@')[0] || 'Friend';

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Re-engagement Banner - show for users who skipped onboarding */}
        {onboardingCompleted === false && showOnboardingBanner && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Complete your profile for personalized AI coaching
                  </p>
                  <p className="text-sm text-gray-500">
                    Get custom habits, action plans, and a dedicated coach based on your goals
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onNavigate(AppView.GUIDED_ONBOARDING)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-medium transition-colors"
                >
                  Complete Setup
                </button>
                <button
                  onClick={() => setShowOnboardingBanner(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Dismiss"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Band 1: Vision Hero */}
        <VisionHero
          vision={vision}
          progress={progress}
          userName={displayName}
          themeName={themeName}
          onUpdateVision={() => onNavigate(AppView.GALLERY)}
          onRefineVision={vision && onRefineVision ? () => onRefineVision(vision) : undefined}
          onPrintVision={() => setShowPrintModal(true)}
          onCreateVision={() => onNavigate(AppView.VISION_BOARD)}
          onWorkbook={() => setShowWorkbookModal(true)}
        />

        {/* Band 2: Execution Panel */}
        <ExecutionPanel
          todayTasks={todayTasks}
          upcomingTasks={upcomingTasks}
          habits={habits}
          todayFocus={todayFocus}
          isLoadingTasks={isLoadingTasks}
          isLoadingHabits={isLoadingHabits}
          onToggleTask={handleToggleTask}
          onToggleHabit={handleToggleHabit}
          onViewAllTasks={() => onNavigate(AppView.ACTION_PLAN)}
          onViewAllHabits={() => onNavigate(AppView.HABITS)}
          onAddTask={() => onNavigate(AppView.ACTION_PLAN)}
          onAddHabit={() => onNavigate(AppView.HABITS)}
          onSetFocus={handleSetFocus}
        />

        {/* Band 3: Progress & Achievements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProgressPredictionWidget userId={userId} />
          <AchievementGallery userId={userId} compact />
        </div>

        {/* Band 4: Quick Actions */}
        <QuickActions
          onCoachClick={() => onNavigate(AppView.VOICE_COACH)}
          onReviewClick={() => onNavigate(AppView.WEEKLY_REVIEWS)}
          onSettingsClick={() => onNavigate(AppView.SETTINGS)}
        />
      </div>

      {/* Workbook Order Modal */}
      {showWorkbookModal && (
        <WorkbookOrderModal
          onClose={() => setShowWorkbookModal(false)}
          primaryVision={primaryVision ? {
            id: primaryVision.id,
            url: primaryVision.url,
            prompt: primaryVision.title
          } : undefined}
        />
      )}

      {/* Print Order Modal */}
      {showPrintModal && vision?.imageUrl && (
        <PrintOrderModal
          image={{
            id: vision.id,
            url: vision.imageUrl,
            prompt: vision.title || ''
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Floating Voice Coach Widget - Always accessible */}
      <div className="fixed bottom-6 right-6 z-50">
        {showVoiceCoach ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVoiceCoach(false)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-10 transition-colors"
              title="Close Voice Coach"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-[380px] max-h-[600px]">
              <VoiceCoachWidget />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowVoiceCoach(true)}
            className="group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
            title="Talk to your AI Coach"
          >
            {/* Animated pulse ring */}
            <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-25"></span>
            {/* Microphone icon */}
            <svg className="w-7 h-7 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {/* Tooltip on hover */}
            <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Talk to Coach 🎙️
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardV2;
