/**
 * GoalsPage - Comprehensive Goals Management Page (v1.8)
 *
 * Features:
 * - Load and display current goal plans
 * - Editable goals with fields for description, metric/KPI, target date, priority, status
 * - Reordering, adding, deleting goals
 * - Draft plan creation and approval workflow
 * - AI coaching integration
 * - Sync with Execute view
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppView, ActionTask, GoalPlan, GoalPlanSource } from '../../types';
import {
  getActivePlan,
  getDraftPlan,
  createDraftPlan,
  saveDraftTask,
  saveDraftTasks,
  deleteDraftTask,
  updateDraftPlan,
  approvePlan,
  getPlanHistory
} from '../../services/storageService';

// Icons
const TargetIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Types
interface Props {
  userId: string;
  onNavigate: (view: AppView) => void;
  onOpenAICoach?: () => void;
  generateActionPlan?: (context: { vision: string; target?: number; theme?: string }) => Promise<ActionTask[]>;
}

type TaskPriority = 'high' | 'medium' | 'low';
type FilterType = 'all' | 'pending' | 'completed' | 'high' | 'medium' | 'low' | 'FINANCE' | 'LIFESTYLE' | 'ADMIN';

interface EditableGoal extends ActionTask {
  metric?: string;
  targetValue?: string;
  isEditing?: boolean;
}

// Priority configuration
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string; borderColor: string }> = {
  high: { label: 'High', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  medium: { label: 'Medium', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  low: { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
};

// Type configuration
const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bgColor: string }> = {
  FINANCE: { icon: '💰', label: 'Financial', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  LIFESTYLE: { icon: '🏠', label: 'Lifestyle', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  ADMIN: { icon: '📋', label: 'Admin', color: 'text-purple-700', bgColor: 'bg-purple-50' },
};

/**
 * GoalsPage Component
 */
const GoalsPage: React.FC<Props> = ({
  userId,
  onNavigate,
  onOpenAICoach,
  generateActionPlan
}) => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<GoalPlan | null>(null);
  const [draftPlan, setDraftPlan] = useState<GoalPlan | null>(null);
  const [goals, setGoals] = useState<EditableGoal[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [planHistory, setPlanHistory] = useState<GoalPlan[]>([]);
  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // New goal form state
  const [newGoal, setNewGoal] = useState<Partial<EditableGoal>>({
    title: '',
    description: '',
    type: 'ADMIN',
    priority: 'medium',
    dueDate: '',
    metric: '',
    targetValue: ''
  });

  // Load plans on mount
  useEffect(() => {
    loadPlans();
  }, [userId]);

  const loadPlans = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to get draft plan first
      const draft = await getDraftPlan();
      if (draft) {
        setDraftPlan(draft);
        setGoals(draft.tasks?.map(t => ({ ...t, isEditing: false })) || []);
      } else {
        // Get active plan
        const active = await getActivePlan();
        if (active) {
          setActivePlan(active);
          setGoals(active.tasks?.map(t => ({ ...t, isEditing: false })) || []);
        }
      }

      // Load plan history
      const history = await getPlanHistory();
      setPlanHistory(history);
    } catch (err: any) {
      console.error('Error loading plans:', err);
      setError('Failed to load goals. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter goals
  const filteredGoals = goals.filter(goal => {
    // Search filter
    if (searchTerm && !goal.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !goal.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status/priority/type filter
    switch (filter) {
      case 'pending':
        return !goal.isCompleted;
      case 'completed':
        return goal.isCompleted;
      case 'high':
      case 'medium':
      case 'low':
        return goal.priority === filter;
      case 'FINANCE':
      case 'LIFESTYLE':
      case 'ADMIN':
        return goal.type === filter;
      default:
        return true;
    }
  });

  // Stats
  const stats = {
    total: goals.length,
    completed: goals.filter(g => g.isCompleted).length,
    pending: goals.filter(g => !g.isCompleted).length,
    highPriority: goals.filter(g => g.priority === 'high' && !g.isCompleted).length
  };

  // Create draft from active plan for editing
  const startEditing = async () => {
    if (!activePlan) return;

    setIsSaving(true);
    try {
      const newDraft = await createDraftPlan({
        visionText: activePlan.visionText,
        financialTarget: activePlan.financialTarget,
        themeId: activePlan.themeId,
        source: 'revision' as GoalPlanSource,
        aiInsights: activePlan.aiInsights
      });

      if (newDraft && activePlan.tasks) {
        // Copy tasks to new draft
        await saveDraftTasks(newDraft.id, activePlan.tasks);
        const updatedDraft = await getDraftPlan();
        setDraftPlan(updatedDraft);
        setGoals(updatedDraft?.tasks?.map(t => ({ ...t, isEditing: false })) || []);
      }
    } catch (err: any) {
      console.error('Error creating draft:', err);
      setError('Failed to start editing. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save goal changes
  const saveGoal = async (goal: EditableGoal) => {
    const planId = draftPlan?.id;
    if (!planId) {
      // Need to create a draft first
      await startEditing();
      return;
    }

    setIsSaving(true);
    try {
      const savedTask = await saveDraftTask(planId, {
        ...goal,
        displayOrder: goals.findIndex(g => g.id === goal.id)
      });

      if (savedTask) {
        setGoals(prev => prev.map(g => g.id === goal.id ? { ...savedTask, isEditing: false } : g));
        setLastSaved(new Date());
        setEditingGoalId(null);
      }
    } catch (err: any) {
      console.error('Error saving goal:', err);
      setError('Failed to save goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add new goal
  const addGoal = async () => {
    let planId = draftPlan?.id;

    // Create draft if needed
    if (!planId) {
      const newDraft = await createDraftPlan({
        source: 'manual' as GoalPlanSource
      });
      if (newDraft) {
        planId = newDraft.id;
        setDraftPlan(newDraft);
      }
    }

    if (!planId) {
      setError('Failed to create plan for new goal.');
      return;
    }

    setIsSaving(true);
    try {
      const goalToSave: Partial<ActionTask> = {
        title: newGoal.title || 'New Goal',
        description: newGoal.description || '',
        type: (newGoal.type as ActionTask['type']) || 'ADMIN',
        priority: (newGoal.priority as TaskPriority) || 'medium',
        dueDate: newGoal.dueDate || new Date().toISOString(),
        isCompleted: false,
        displayOrder: goals.length,
        source: 'manual'
      };

      const savedTask = await saveDraftTask(planId, goalToSave);
      if (savedTask) {
        setGoals(prev => [...prev, { ...savedTask, isEditing: false }]);
        setNewGoal({
          title: '',
          description: '',
          type: 'ADMIN',
          priority: 'medium',
          dueDate: '',
          metric: '',
          targetValue: ''
        });
        setShowNewGoalForm(false);
        setLastSaved(new Date());
      }
    } catch (err: any) {
      console.error('Error adding goal:', err);
      setError('Failed to add goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete goal
  const deleteGoal = async (goalId: string) => {
    const planId = draftPlan?.id;
    if (!planId) return;

    setIsSaving(true);
    try {
      const success = await deleteDraftTask(planId, goalId);
      if (success) {
        setGoals(prev => prev.filter(g => g.id !== goalId));
        setLastSaved(new Date());
      }
    } catch (err: any) {
      console.error('Error deleting goal:', err);
      setError('Failed to delete goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle goal completion
  const toggleGoalCompletion = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const updatedGoal = { ...goal, isCompleted: !goal.isCompleted };
    setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));

    // Save if we have a draft
    if (draftPlan?.id) {
      await saveDraftTask(draftPlan.id, updatedGoal);
      setLastSaved(new Date());
    }
  };

  // Approve draft plan
  const approveDraft = async () => {
    if (!draftPlan?.id) return;

    if (goals.length === 0) {
      setError('Please add at least one goal before approving.');
      return;
    }

    setIsSaving(true);
    try {
      const success = await approvePlan(draftPlan.id);
      if (success) {
        // Reload plans
        await loadPlans();
      } else {
        setError('Failed to approve plan. Please try again.');
      }
    } catch (err: any) {
      console.error('Error approving plan:', err);
      setError('Failed to approve plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate with AI
  const regenerateWithAI = async () => {
    if (!generateActionPlan) {
      setError('AI generation is not available.');
      return;
    }

    setIsRegenerating(true);
    try {
      const visionText = draftPlan?.visionText || activePlan?.visionText || 'Achieve my goals';
      const financialTarget = draftPlan?.financialTarget || activePlan?.financialTarget;

      const newTasks = await generateActionPlan({
        vision: visionText,
        target: financialTarget
      });

      if (newTasks.length > 0) {
        // Create draft if needed
        let planId = draftPlan?.id;
        if (!planId) {
          const newDraft = await createDraftPlan({
            visionText,
            financialTarget,
            source: 'ai_regenerate' as GoalPlanSource
          });
          planId = newDraft?.id;
          if (newDraft) setDraftPlan(newDraft);
        }

        if (planId) {
          await saveDraftTasks(planId, newTasks);
          const updatedDraft = await getDraftPlan();
          setGoals(updatedDraft?.tasks?.map(t => ({ ...t, isEditing: false })) || []);
          setLastSaved(new Date());
        }
      }
    } catch (err: any) {
      console.error('Error regenerating with AI:', err);
      setError('Failed to regenerate goals. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Navigate to Execute
  const goToExecute = () => {
    onNavigate(AppView.ACTION_PLAN);
  };

  // Render loading
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <TargetIcon />
            Goals
          </h1>
          <p className="text-gray-600 mt-1">
            {draftPlan ? 'Draft Plan - Editing Mode' : 'Manage and track your vision goals'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Coach Button */}
          {onOpenAICoach && (
            <button
              onClick={onOpenAICoach}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all shadow-sm"
            >
              <SparklesIcon />
              <span className="hidden sm:inline">AI Coach</span>
            </button>
          )}

          {/* Regenerate with AI */}
          {generateActionPlan && (
            <button
              onClick={regenerateWithAI}
              disabled={isRegenerating}
              className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              ) : (
                <RefreshIcon />
              )}
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}

          {/* History */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <HistoryIcon />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Actions based on state */}
          {draftPlan ? (
            <button
              onClick={approveDraft}
              disabled={isSaving || goals.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <CheckIcon />
              Approve Plan
            </button>
          ) : activePlan ? (
            <button
              onClick={startEditing}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
            >
              <EditIcon />
              Edit Plan
            </button>
          ) : null}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">Total Goals</p>
          <p className="text-2xl font-bold text-navy-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm">High Priority</p>
          <p className="text-2xl font-bold text-red-600">{stats.highPriority}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round((stats.completed / stats.total) * 100)}% Complete</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search goals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <span>Filters</span>
            <ChevronDownIcon />
          </button>

          {/* Add Goal Button */}
          <button
            onClick={() => setShowNewGoalForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            <PlusIcon />
            Add Goal
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'high', label: 'High Priority' },
                { value: 'medium', label: 'Medium Priority' },
                { value: 'low', label: 'Low Priority' },
                { value: 'FINANCE', label: '💰 Financial' },
                { value: 'LIFESTYLE', label: '🏠 Lifestyle' },
                { value: 'ADMIN', label: '📋 Admin' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value as FilterType)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    filter === option.value
                      ? 'bg-navy-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Goal Form */}
      {showNewGoalForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">Add New Goal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                placeholder="Enter goal title..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newGoal.type}
                onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value as ActionTask['type'] })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              >
                <option value="FINANCE">💰 Financial</option>
                <option value="LIFESTYLE">🏠 Lifestyle</option>
                <option value="ADMIN">📋 Admin</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Describe your goal..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={newGoal.priority}
                onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value as TaskPriority })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
              <input
                type="date"
                value={newGoal.dueDate?.split('T')[0] || ''}
                onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric/KPI (optional)</label>
              <input
                type="text"
                value={newGoal.metric}
                onChange={(e) => setNewGoal({ ...newGoal, metric: e.target.value })}
                placeholder="e.g., Monthly savings"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Value (optional)</label>
              <input
                type="text"
                value={newGoal.targetValue}
                onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                placeholder="e.g., $1,000/month"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowNewGoalForm(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={addGoal}
              disabled={!newGoal.title || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PlusIcon />
              )}
              Add Goal
            </button>
          </div>
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
            <TargetIcon />
            <h3 className="text-lg font-medium text-gray-900 mt-4">No goals found</h3>
            <p className="text-gray-500 mt-2">
              {searchTerm || filter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first goal'}
            </p>
            {!searchTerm && filter === 'all' && (
              <button
                onClick={() => setShowNewGoalForm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors mx-auto"
              >
                <PlusIcon />
                Add Your First Goal
              </button>
            )}
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isEditing={editingGoalId === goal.id}
              onEdit={() => setEditingGoalId(goal.id)}
              onSave={saveGoal}
              onDelete={() => deleteGoal(goal.id)}
              onToggleComplete={() => toggleGoalCompletion(goal.id)}
              onCancelEdit={() => setEditingGoalId(null)}
              isSaving={isSaving}
            />
          ))
        )}
      </div>

      {/* Plan History Modal */}
      {showHistory && (
        <PlanHistoryModal
          history={planHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Last saved indicator */}
      {lastSaved && (
        <div className="fixed bottom-4 right-4 bg-green-50 text-green-700 px-4 py-2 rounded-lg shadow-sm text-sm flex items-center gap-2">
          <CheckIcon />
          Saved {lastSaved.toLocaleTimeString()}
        </div>
      )}

      {/* Sync with Execute */}
      {(activePlan || draftPlan) && (
        <div className="mt-8 bg-gradient-to-r from-navy-900 to-indigo-900 rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Ready to Execute?</h3>
              <p className="text-white/70 text-sm mt-1">
                View your goals in the execution timeline and start tracking progress
              </p>
            </div>
            <button
              onClick={goToExecute}
              className="flex items-center gap-2 px-6 py-3 bg-gold-500 text-navy-900 rounded-lg hover:bg-gold-400 transition-colors font-medium"
            >
              Go to Execute
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Goal Card Component
// ============================================

interface GoalCardProps {
  goal: EditableGoal;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (goal: EditableGoal) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onCancelEdit: () => void;
  isSaving: boolean;
}

const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onToggleComplete,
  onCancelEdit,
  isSaving
}) => {
  const [editedGoal, setEditedGoal] = useState(goal);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const typeConfig = TYPE_CONFIG[goal.type] || TYPE_CONFIG.ADMIN;
  const priorityConfig = PRIORITY_CONFIG[goal.priority || 'medium'];

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-gold-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={editedGoal.title}
              onChange={(e) => setEditedGoal({ ...editedGoal, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editedGoal.description}
              onChange={(e) => setEditedGoal({ ...editedGoal, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={editedGoal.type}
              onChange={(e) => setEditedGoal({ ...editedGoal, type: e.target.value as ActionTask['type'] })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            >
              <option value="FINANCE">💰 Financial</option>
              <option value="LIFESTYLE">🏠 Lifestyle</option>
              <option value="ADMIN">📋 Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={editedGoal.priority}
              onChange={(e) => setEditedGoal({ ...editedGoal, priority: e.target.value as TaskPriority })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
            <input
              type="date"
              value={editedGoal.dueDate?.split('T')[0] || ''}
              onChange={(e) => setEditedGoal({ ...editedGoal, dueDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancelEdit}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editedGoal)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckIcon />
            )}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border transition-all ${
      goal.isCompleted ? 'border-green-200 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'
    }`}>
      <div className="flex items-start gap-4">
        {/* Completion Checkbox */}
        <button
          onClick={onToggleComplete}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            goal.isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-500'
          }`}
        >
          {goal.isCompleted && <CheckIcon />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`font-semibold ${goal.isCompleted ? 'text-gray-500 line-through' : 'text-navy-900'}`}>
                {goal.title}
              </h3>
              {goal.description && (
                <p className={`text-sm mt-1 ${goal.isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                  {goal.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-navy-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit"
              >
                <EditIcon />
              </button>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onDelete}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color}`}>
              {typeConfig.icon} {typeConfig.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}>
              {priorityConfig.label} Priority
            </span>
            {goal.dueDate && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 text-xs">
                <ClockIcon />
                {new Date(goal.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Plan History Modal
// ============================================

interface PlanHistoryModalProps {
  history: GoalPlan[];
  onClose: () => void;
}

const PlanHistoryModal: React.FC<PlanHistoryModalProps> = ({ history, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">Plan History</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              &times;
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No plan history available</p>
          ) : (
            <div className="space-y-4">
              {history.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border ${
                    plan.status === 'active'
                      ? 'border-green-200 bg-green-50'
                      : plan.status === 'draft'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        plan.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : plan.status === 'draft'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">Version {plan.version}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {plan.visionText && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{plan.visionText}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Source: {plan.source} | Tasks: {plan.tasks?.length || 0}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalsPage;
