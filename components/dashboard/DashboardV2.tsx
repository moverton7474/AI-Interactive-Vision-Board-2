import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { AppView, ActionTask } from '../../types';
import VisionHero from './VisionHero';
import ExecutionPanel from './ExecutionPanel';
import SupportRow from './SupportRow';
import ToolsGrid from './ToolsGrid';
import PrintPanel from './PrintPanel';

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

interface CoachData {
  lastInteraction?: string;
  themeName?: string;
}

interface FinancialData {
  goalTitle?: string;
  targetAmount?: number;
  currentProgress?: number;
}

interface PrintOrder {
  id: string;
  productType: string;
  status: 'pending' | 'submitted' | 'shipped' | 'delivered';
  createdAt: string;
  trackingUrl?: string;
}

interface Props {
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onNavigate: (view: AppView) => void;
}

const DashboardV2: React.FC<Props> = ({
  userId,
  userEmail,
  userName,
  userRole,
  onNavigate
}) => {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingHabits, setIsLoadingHabits] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Data states
  const [vision, setVision] = useState<VisionData | null>(null);
  const [progress, setProgress] = useState<VisionProgress | null>(null);
  const [todayTasks, setTodayTasks] = useState<ActionTask[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<ActionTask[]>([]);
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [todayFocus, setTodayFocus] = useState<string | undefined>();
  const [coach, setCoach] = useState<CoachData>({});
  const [financial, setFinancial] = useState<FinancialData>({});
  const [recentOrders, setRecentOrders] = useState<PrintOrder[]>([]);
  const [themeName, setThemeName] = useState<string | undefined>();

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

      // Fetch habits (is_active filter removed - column may not exist in all environments)
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, title, description, frequency, current_streak')
        .eq('user_id', userId);

      if (habitsError) {
        console.warn('Habits query error:', habitsError.message);
        // Don't throw - allow graceful fallback to empty habits
      }

      // Fetch today's completions
      const { data: completionsData, error: completionsError } = await supabase
        .from('habit_completions')
        .select('habit_id, completed_at')
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString());

      if (completionsError) throw completionsError;

      const completedHabitIds = new Set(completionsData?.map(c => c.habit_id) || []);

      // Map icons based on habit title (with null safety)
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

  // Fetch coach and theme data
  const fetchCoachData = useCallback(async () => {
    try {
      // Fetch user identity for theme
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
        setCoach(prev => ({ ...prev, themeName: themeDisplayName }));
      }

      // TODO: Fetch last coach interaction from coach_sessions if table exists
      // For now, we'll leave lastInteraction undefined
    } catch (error) {
      console.error('Error fetching coach data:', error);
    }
  }, [userId]);

  // Fetch financial data
  const fetchFinancialData = useCallback(async () => {
    try {
      // Fetch from profile for now
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('financial_target')
        .eq('id', userId)
        .single();

      if (!error && profile?.financial_target) {
        setFinancial({
          goalTitle: '3-Year Financial Goal',
          targetAmount: profile.financial_target,
          currentProgress: 0 // TODO: Calculate from linked accounts
        });
      }

      // TODO: If financial_goals table exists, fetch from there instead
    } catch (error) {
      console.error('Error fetching financial data:', error);
    }
  }, [userId]);

  // Fetch recent print orders
  const fetchRecentOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('poster_orders')
        .select('id, status, created_at, print_config')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      const mappedOrders: PrintOrder[] = (data || []).map(order => ({
        id: order.id,
        productType: order.print_config?.productType || 'poster',
        status: order.status as PrintOrder['status'],
        createdAt: order.created_at,
        trackingUrl: undefined // TODO: Add tracking_url column if needed
      }));

      setRecentOrders(mappedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [userId]);

  // Calculate progress stats
  const calculateProgress = useCallback((): VisionProgress => {
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

  // Update progress when data changes
  useEffect(() => {
    setProgress(calculateProgress());
  }, [calculateProgress]);

  // Initial data fetch
  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchActiveVision(),
        fetchTodayTasks(),
        fetchHabits(),
        fetchCoachData(),
        fetchFinancialData(),
        fetchRecentOrders()
      ]);
      setIsLoading(false);
    };

    loadDashboard();
  }, [fetchActiveVision, fetchTodayTasks, fetchHabits, fetchCoachData, fetchFinancialData, fetchRecentOrders]);

  // Toggle task completion
  const handleToggleTask = useCallback(async (taskId: string) => {
    const task = todayTasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.isCompleted;

    // Optimistic update
    setTodayTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, isCompleted: newCompleted } : t)
    );

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
  }, [todayTasks]);

  // Toggle habit completion
  const handleToggleHabit = useCallback(async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const wasCompleted = habit.completedToday;

    // Optimistic update
    setHabits(prev =>
      prev.map(h => h.id === habitId ? { ...h, completedToday: !wasCompleted } : h)
    );

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
            current_streak: (habit.streak || 0) + 1,
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
  }, [habits]);

  // Handle focus update
  const handleSetFocus = useCallback(async (focus: string) => {
    setTodayFocus(focus);
    // TODO: Persist to day_intention table if it exists
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
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Band 1: Vision Hero */}
        <VisionHero
          vision={vision}
          progress={progress || undefined}
          userName={displayName}
          themeName={themeName}
          onUpdateVision={() => onNavigate(AppView.GALLERY)}
          onPrintVision={() => onNavigate(AppView.PRINT_PRODUCTS)}
          onCreateVision={() => onNavigate(AppView.VISION_BOARD)}
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

        {/* Band 3: Support Row */}
        <SupportRow
          coach={coach}
          mdals={{}}
          financial={financial}
          onCoachClick={() => onNavigate(AppView.VOICE_COACH)}
          onMdalsClick={() => onNavigate(AppView.MDALS_LAB)}
          onFinancialClick={() => onNavigate(AppView.FINANCIAL)}
        />

        {/* Band 4: Tools Grid */}
        <ToolsGrid
          userRole={userRole}
          onNavigate={onNavigate}
        />

        {/* Band 5: Print Panel */}
        <PrintPanel
          vision={vision}
          recentOrders={recentOrders}
          isLoading={isLoadingOrders}
          onPrintPoster={() => onNavigate(AppView.PRINT_PRODUCTS)}
          onPrintCanvas={() => onNavigate(AppView.PRINT_PRODUCTS)}
          onPrintWorkbook={() => onNavigate(AppView.PRINT_PRODUCTS)}
          onViewOrders={() => onNavigate(AppView.ORDER_HISTORY)}
        />
      </div>
    </div>
  );
};

export default DashboardV2;
