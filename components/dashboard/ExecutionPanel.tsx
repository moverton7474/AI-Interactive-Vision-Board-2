import React, { useState } from 'react';
import { ActionTask } from '../../types';
import EmptyState from './EmptyState';

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
  todayTasks: ActionTask[];
  upcomingTasks: ActionTask[];
  habits: HabitData[];
  todayFocus?: string;
  isLoadingTasks?: boolean;
  isLoadingHabits?: boolean;
  onToggleTask: (taskId: string) => void;
  onToggleHabit: (habitId: string) => void;
  onViewAllTasks: () => void;
  onViewAllHabits: () => void;
  onAddTask: () => void;
  onAddHabit: () => void;
  onSetFocus?: (focus: string) => void;
}

const ExecutionPanel: React.FC<Props> = ({
  todayTasks,
  upcomingTasks,
  habits,
  todayFocus,
  isLoadingTasks,
  isLoadingHabits,
  onToggleTask,
  onToggleHabit,
  onViewAllTasks,
  onViewAllHabits,
  onAddTask,
  onAddHabit,
  onSetFocus
}) => {
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusInput, setFocusInput] = useState(todayFocus || '');

  const completedTasks = todayTasks.filter(t => t.isCompleted).length;
  const completedHabits = habits.filter(h => h.completedToday).length;

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'FINANCE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'LIFESTYLE':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const handleSaveFocus = () => {
    if (onSetFocus && focusInput.trim()) {
      onSetFocus(focusInput.trim());
    }
    setEditingFocus(false);
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded-full" />
          <div className="flex-1 h-4 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column - Today's Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <h3 className="font-bold text-gray-900">Today's Actions</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {completedTasks}/{todayTasks.length}
            </span>
            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: todayTasks.length > 0
                    ? `${(completedTasks / todayTasks.length) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="max-h-80 overflow-y-auto">
          {isLoadingTasks ? (
            <div className="p-5">
              <LoadingSkeleton />
            </div>
          ) : todayTasks.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {todayTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      task.isCompleted
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {task.isCompleted && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-gray-400">
                        {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {task.type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getTypeColor(task.type)}`}>
                      {task.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="📋"
              title="No tasks for today"
              description="Add tasks to stay on track"
              actionLabel="Add Task"
              onAction={onAddTask}
              variant="compact"
            />
          )}
        </div>

        {/* Upcoming Tasks Preview */}
        {upcomingTasks.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2">Coming Up</p>
            <div className="space-y-1">
              {upcomingTasks.slice(0, 2).map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400">○</span>
                  <span className="truncate">{task.title}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {todayTasks.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100">
            <button
              onClick={onViewAllTasks}
              className="text-navy-600 hover:text-navy-800 text-sm font-medium"
            >
              View all tasks →
            </button>
          </div>
        )}
      </div>

      {/* Right Column - Habits & Focus */}
      <div className="space-y-4">
        {/* Today's Focus */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h3 className="font-bold text-gray-900">Today's Focus</h3>
            </div>
            {!editingFocus && onSetFocus && (
              <button
                onClick={() => setEditingFocus(true)}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {editingFocus ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                placeholder="What's your focus today?"
                className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFocus()}
              />
              <button
                onClick={handleSaveFocus}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          ) : (
            <p className="text-gray-700 text-sm italic">
              {todayFocus || 'Set your focus for today to stay aligned with your vision.'}
            </p>
          )}
        </div>

        {/* Habits */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <h3 className="font-bold text-gray-900">Daily Habits</h3>
            </div>
            <span className="text-sm font-medium text-gray-500">
              {completedHabits}/{habits.length}
            </span>
          </div>

          {isLoadingHabits ? (
            <div className="p-5">
              <LoadingSkeleton />
            </div>
          ) : habits.length > 0 ? (
            <div className="p-4">
              <div className="flex flex-wrap justify-center gap-3">
                {habits.slice(0, 5).map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => onToggleHabit(habit.id)}
                    className="flex flex-col items-center gap-1 p-2 group relative"
                  >
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all ${
                        habit.completedToday
                          ? 'bg-green-100 ring-2 ring-green-500 ring-offset-2'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {habit.icon || '✨'}
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[60px]">
                      {habit.name}
                    </span>
                    {habit.streak > 0 && (
                      <span className="text-xs text-orange-500 font-semibold">
                        {habit.streak} 🔥
                      </span>
                    )}
                    {habit.completedToday && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: habits.length > 0
                          ? `${(completedHabits / habits.length) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">
                    {habits.length > 0 ? Math.round((completedHabits / habits.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="💪"
              title="No habits set up"
              description="Build daily habits to achieve your vision"
              actionLabel="Add Habit"
              onAction={onAddHabit}
              variant="compact"
            />
          )}

          {habits.length > 5 && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <button
                onClick={onViewAllHabits}
                className="text-navy-600 hover:text-navy-800 text-sm font-medium"
              >
                View all {habits.length} habits →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionPanel;
