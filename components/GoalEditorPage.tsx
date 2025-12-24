import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ActionTask, AppView } from '../types';
import DraftPlanReviewStep from './onboarding/DraftPlanReviewStep';

interface Props {
  userId: string;
  onNavigate: (view: AppView) => void;
}

/**
 * GoalEditorPage - Standalone wrapper for the DraftPlanReviewStep
 *
 * This component allows existing users to access and edit their goals/action plan
 * outside of the onboarding flow. It loads existing tasks from the database
 * and provides full editing capabilities.
 */
const GoalEditorPage: React.FC<Props> = ({ userId, onNavigate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [visionText, setVisionText] = useState('');
  const [financialTarget, setFinancialTarget] = useState<number | undefined>();
  const [themeName, setThemeName] = useState<string | undefined>();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load existing data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);

        // Load tasks from action_tasks table
        const { data: taskData, error: taskError } = await supabase
          .from('action_tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('is_completed', false)
          .order('created_at', { ascending: true });

        if (taskError) {
          console.error('Error loading tasks:', taskError);
        } else if (taskData) {
          // Map database format to ActionTask interface
          const mappedTasks: ActionTask[] = taskData.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description || '',
            dueDate: task.due_date || new Date().toISOString(),
            type: (task.type || 'ADMIN') as ActionTask['type'],
            isCompleted: task.is_completed || false,
            priority: task.priority || 'medium',
            aiMetadata: task.ai_metadata
          }));
          setTasks(mappedTasks);
        }

        // Load user profile for financial target
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('financial_target')
          .eq('id', userId)
          .single();

        if (!profileError && profile?.financial_target) {
          setFinancialTarget(profile.financial_target);
        }

        // Load vision text from vision_boards or user_vision_profiles
        const { data: visionProfile, error: visionError } = await supabase
          .from('user_vision_profiles')
          .select('vision_text')
          .eq('user_id', userId)
          .single();

        if (!visionError && visionProfile?.vision_text) {
          setVisionText(visionProfile.vision_text);
        } else {
          // Fallback: use most recent vision board prompt
          const { data: visionBoard } = await supabase
            .from('vision_boards')
            .select('prompt')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (visionBoard?.prompt) {
            setVisionText(visionBoard.prompt);
          }
        }

        // Load theme name from user identity
        const { data: identity } = await supabase
          .from('user_identity_profiles')
          .select('theme_id')
          .eq('user_id', userId)
          .single();

        if (identity?.theme_id) {
          const { data: theme } = await supabase
            .from('motivational_themes')
            .select('display_name')
            .eq('id', identity.theme_id)
            .single();

          if (theme?.display_name) {
            setThemeName(theme.display_name);
          }
        }
      } catch (err) {
        console.error('Error loading goal data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [userId]);

  // Handle task changes - save to database
  const handleTasksChanged = useCallback(async (updatedTasks: ActionTask[]) => {
    setTasks(updatedTasks);
    setSaveStatus('saving');

    try {
      // Delete existing tasks for this user (we'll replace them)
      await supabase
        .from('action_tasks')
        .delete()
        .eq('user_id', userId);

      // Insert updated tasks
      if (updatedTasks.length > 0) {
        const taskRecords = updatedTasks.map(task => ({
          id: task.id,
          user_id: userId,
          title: task.title,
          description: task.description || '',
          type: task.type || 'ADMIN',
          due_date: task.dueDate,
          is_completed: task.isCompleted || false,
          priority: task.priority || 'medium',
          ai_metadata: task.aiMetadata || null
        }));

        const { error } = await supabase
          .from('action_tasks')
          .insert(taskRecords);

        if (error) throw error;
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Error saving tasks:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [userId]);

  // Generate action plan using AI
  const generateActionPlan = useCallback(async (context: {
    vision: string;
    target?: number;
    theme?: string
  }): Promise<ActionTask[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Please sign in to generate action plan');
    }

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
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading your goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 pt-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => onNavigate(AppView.DASHBOARD)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4"
          >
            <span className="text-xl">←</span> Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-navy-900">My Goals & Action Plan</h1>
              <p className="text-gray-600 mt-1">
                Edit, add, or regenerate your personalized action plan
              </p>
            </div>

            {/* Save Status Indicator */}
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm text-red-600">Failed to save</span>
              )}
            </div>
          </div>
        </div>

        {/* Context Info */}
        {(visionText || financialTarget || themeName) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Your Vision Context</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {themeName && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Theme:</span>
                  <span className="font-medium text-navy-900">{themeName}</span>
                </div>
              )}
              {financialTarget && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Target:</span>
                  <span className="font-medium text-green-700">${financialTarget.toLocaleString()}</span>
                </div>
              )}
              {visionText && (
                <div className="col-span-full">
                  <span className="text-gray-500">Vision:</span>
                  <p className="font-medium text-navy-900 mt-1 line-clamp-2">{visionText}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Draft Plan Review Step - Reused Component */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <DraftPlanReviewStep
            visionText={visionText || 'Create a meaningful life with financial security'}
            financialTarget={financialTarget}
            themeName={themeName}
            existingTasks={tasks}
            onTasksChanged={handleTasksChanged}
            generateActionPlan={generateActionPlan}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => onNavigate(AppView.HABITS)}
            className="px-4 py-2 text-sm font-medium text-navy-900 bg-white border border-navy-200 rounded-lg hover:bg-navy-50 transition-colors"
          >
            Manage Habits
          </button>
          <button
            onClick={() => onNavigate(AppView.WEEKLY_REVIEWS)}
            className="px-4 py-2 text-sm font-medium text-navy-900 bg-white border border-navy-200 rounded-lg hover:bg-navy-50 transition-colors"
          >
            View Weekly Reviews
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalEditorPage;
