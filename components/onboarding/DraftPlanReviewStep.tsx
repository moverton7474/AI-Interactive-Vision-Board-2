import React, { useState, useEffect, useCallback } from 'react';
import { ActionTask } from '../../types';

interface Props {
  visionText: string;
  financialTarget?: number;
  themeName?: string;
  existingTasks?: ActionTask[];
  onTasksChanged: (tasks: ActionTask[]) => void;
  generateActionPlan: (context: { vision: string; target?: number; theme?: string }) => Promise<ActionTask[]>;
}

type TaskPriority = 'high' | 'medium' | 'low';

interface EditableTask extends ActionTask {
  priority?: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  high: { label: 'High', color: 'text-red-700', bgColor: 'bg-red-100' },
  medium: { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  low: { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' },
};

const TYPE_CONFIG: Record<string, { icon: string; label: string; headerBg: string; headerText: string; borderColor: string }> = {
  FINANCE: {
    icon: '💰',
    label: 'Financial Tasks',
    headerBg: 'bg-green-50',
    headerText: 'text-green-800',
    borderColor: 'border-green-200'
  },
  LIFESTYLE: {
    icon: '🏠',
    label: 'Lifestyle Tasks',
    headerBg: 'bg-blue-50',
    headerText: 'text-blue-800',
    borderColor: 'border-blue-200'
  },
  ADMIN: {
    icon: '📋',
    label: 'Admin Tasks',
    headerBg: 'bg-purple-50',
    headerText: 'text-purple-800',
    borderColor: 'border-purple-200'
  },
};

/**
 * DraftPlanReviewStep - Editable Action Plan Review
 *
 * This component allows users to review and customize their AI-generated
 * action plan before approving it. Users can:
 * - Edit task titles and descriptions
 * - Change due dates and priorities
 * - Add new tasks
 * - Delete tasks
 * - Regenerate with AI assistance
 */
const DraftPlanReviewStep: React.FC<Props> = ({
  visionText,
  financialTarget,
  themeName,
  existingTasks,
  onTasksChanged,
  generateActionPlan
}) => {
  const [isGenerating, setIsGenerating] = useState(!existingTasks || existingTasks.length === 0);
  const [tasks, setTasks] = useState<EditableTask[]>(existingTasks || []);
  const [error, setError] = useState<string | null>(null);
  const [showAiInsights, setShowAiInsights] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // AI-generated insights based on the plan
  const [aiInsights, setAiInsights] = useState<string[]>([
    `Based on your vision and ${financialTarget ? `financial target of $${financialTarget.toLocaleString()}` : 'goals'}:`,
    '• Financial tasks are prioritized for the first year',
    '• Lifestyle tasks align with your selected theme',
    '• Consider adding specific milestones for tracking progress'
  ]);

  // Generate tasks on mount if none exist
  useEffect(() => {
    if (!existingTasks || existingTasks.length === 0) {
      generateTasks();
    }
  }, []);

  // Auto-save when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      onTasksChanged(tasks);
      setLastSaved(new Date());
    }
  }, [tasks]);

  const generateTasks = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const generatedTasks = await generateActionPlan({
        vision: visionText,
        target: financialTarget,
        theme: themeName
      });

      // Add default priority to generated tasks
      const tasksWithPriority: EditableTask[] = generatedTasks.map((task, index) => ({
        ...task,
        priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low'
      }));

      setTasks(tasksWithPriority);

      // Update AI insights based on generation
      setAiInsights([
        `Based on your vision and ${financialTarget ? `financial target of $${financialTarget.toLocaleString()}` : 'goals'}:`,
        `• Created ${generatedTasks.length} personalized tasks`,
        '• Financial tasks are prioritized for immediate action',
        themeName ? `• Tasks aligned with your "${themeName}" coaching style` : '• Tasks aligned with your goals'
      ]);

    } catch (err: any) {
      console.error('Action plan generation error:', err);
      setError(err.message || 'Failed to generate action plan');

      // Fallback to default tasks
      const fallbackTasks: EditableTask[] = [
        {
          id: crypto.randomUUID(),
          title: 'Define your 3-year financial milestone',
          description: 'Set a specific savings or investment goal for the next 3 years',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'FINANCE',
          isCompleted: false,
          priority: 'high'
        },
        {
          id: crypto.randomUUID(),
          title: 'Research your dream location',
          description: 'Explore cost of living, neighborhoods, and lifestyle in your target area',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'LIFESTYLE',
          isCompleted: false,
          priority: 'medium'
        },
        {
          id: crypto.randomUUID(),
          title: 'Create a weekly review habit',
          description: 'Schedule 30 minutes each Sunday to reflect on progress',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'ADMIN',
          isCompleted: false,
          priority: 'medium'
        }
      ];
      setTasks(fallbackTasks);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateTask = useCallback((taskId: string, updates: Partial<EditableTask>) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    ));
  }, []);

  const addTask = useCallback((type: 'FINANCE' | 'LIFESTYLE' | 'ADMIN') => {
    const newTask: EditableTask = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      type,
      isCompleted: false,
      priority: 'medium'
    };
    setTasks(prev => [...prev, newTask]);
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setDeleteConfirmId(null);
  }, []);

  const handleRegenerateWithAI = async () => {
    if (confirm('This will regenerate your plan. Any edits will be lost. Continue?')) {
      await generateTasks();
    }
  };

  // Format date for input
  const formatDateForInput = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  // Render loading state
  if (isGenerating) {
    return (
      <div className="text-center space-y-6 py-8">
        <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-navy-900 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-medium text-navy-900 mb-2">Building your draft plan...</p>
          <p className="text-gray-500">Creating personalized tasks based on your vision</p>
        </div>
      </div>
    );
  }

  // Group tasks by type
  const tasksByType = {
    FINANCE: tasks.filter(t => t.type === 'FINANCE'),
    LIFESTYLE: tasks.filter(t => t.type === 'LIFESTYLE'),
    ADMIN: tasks.filter(t => t.type === 'ADMIN'),
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
          Using recommended starter tasks. You can customize these below.
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-gray-600">
          Review and customize your action plan. Edit tasks, change priorities, or add new ones.
        </p>
      </div>

      {/* AI Insights Panel */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 overflow-hidden">
        <button
          onClick={() => setShowAiInsights(!showAiInsights)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-indigo-100/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <span className="font-medium text-indigo-900">AI Insights</span>
          </div>
          <svg
            className={`w-5 h-5 text-indigo-600 transition-transform ${showAiInsights ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showAiInsights && (
          <div className="px-4 pb-4">
            <ul className="space-y-1 text-sm text-indigo-800">
              {aiInsights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
            <button
              onClick={handleRegenerateWithAI}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate plan with AI
            </button>
          </div>
        )}
      </div>

      {/* Task Categories */}
      <div className="space-y-6">
        {(['FINANCE', 'LIFESTYLE', 'ADMIN'] as const).map(type => {
          const config = TYPE_CONFIG[type];
          const typeTasks = tasksByType[type];

          return (
            <div key={type} className={`bg-white rounded-xl shadow-sm border ${config.borderColor} overflow-hidden`}>
              {/* Category Header */}
              <div className={`${config.headerBg} px-4 py-3 border-b ${config.borderColor}`}>
                <h3 className={`font-bold ${config.headerText} flex items-center gap-2`}>
                  {config.icon} {config.label}
                  <span className="text-sm font-normal opacity-70">({typeTasks.length})</span>
                </h3>
              </div>

              {/* Tasks */}
              <div className="divide-y divide-gray-100">
                {typeTasks.map((task) => (
                  <div key={task.id} className="p-4 space-y-3 hover:bg-gray-50 transition-colors">
                    {/* Title Row */}
                    <div className="flex items-start gap-3">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => updateTask(task.id, { title: e.target.value })}
                        placeholder="Task title..."
                        className="flex-1 font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-navy-500 focus:outline-none py-1 transition-colors"
                      />

                      {/* Delete Button */}
                      {deleteConfirmId === task.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(task.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete task"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <textarea
                      value={task.description}
                      onChange={(e) => updateTask(task.id, { description: e.target.value })}
                      placeholder="Add a description..."
                      rows={2}
                      className="w-full text-sm text-gray-600 bg-transparent border border-transparent hover:border-gray-200 focus:border-navy-300 rounded-lg p-2 focus:outline-none resize-none transition-colors"
                    />

                    {/* Meta Row */}
                    <div className="flex items-center gap-4 text-sm">
                      {/* Due Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Due:</span>
                        <input
                          type="date"
                          value={formatDateForInput(task.dueDate)}
                          onChange={(e) => updateTask(task.id, { dueDate: new Date(e.target.value).toISOString() })}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:border-navy-300 focus:outline-none"
                        />
                      </div>

                      {/* Priority */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Priority:</span>
                        <select
                          value={task.priority || 'medium'}
                          onChange={(e) => updateTask(task.id, { priority: e.target.value as TaskPriority })}
                          className={`border rounded-lg px-2 py-1 font-medium focus:outline-none ${
                            PRIORITY_CONFIG[task.priority || 'medium'].bgColor
                          } ${PRIORITY_CONFIG[task.priority || 'medium'].color}`}
                        >
                          {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                            <option key={value} value={value}>{config.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty State */}
                {typeTasks.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <p className="text-sm">No {config.label.toLowerCase()} yet</p>
                  </div>
                )}

                {/* Add Task Button */}
                <button
                  onClick={() => addTask(type)}
                  className="w-full px-4 py-3 text-sm text-gray-600 hover:text-navy-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add {type === 'FINANCE' ? 'Financial' : type === 'LIFESTYLE' ? 'Lifestyle' : 'Admin'} Task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="bg-navy-50 rounded-xl p-4 border border-navy-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-navy-700">
            <span className="font-medium">{tasks.length} tasks total.</span>
            {' '}Click "Continue" to approve your plan and start working on your goals.
          </p>
          {lastSaved && (
            <span className="text-xs text-navy-500">
              Auto-saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Validation Warning */}
      {tasks.length === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Please add at least one task to continue.
        </div>
      )}

      {tasks.some(t => !t.title.trim()) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Some tasks are missing titles. Please fill them in before continuing.
        </div>
      )}
    </div>
  );
};

export default DraftPlanReviewStep;
