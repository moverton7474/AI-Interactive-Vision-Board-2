import React from 'react';
import { ActionTask } from '../../types';

interface Props {
  tasks: ActionTask[];
  onToggleTask: (taskId: string) => void;
  onViewAll: () => void;
}

const TodayActionsCard: React.FC<Props> = ({ tasks, onToggleTask, onViewAll }) => {
  const todayTasks = tasks.slice(0, 3); // Show top 3 tasks
  const completedCount = tasks.filter(t => t.isCompleted).length;

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'FINANCE':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'LIFESTYLE':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">✅</span>
          <h3 className="font-bold text-navy-900">Today's Actions</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {completedCount}/{tasks.length}
          </span>
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: tasks.length > 0 ? `${(completedCount / tasks.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Tasks */}
      {todayTasks.length > 0 ? (
        <div className="divide-y divide-gray-50">
          {todayTasks.map((task) => (
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
                <p className={`font-medium ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-sm text-gray-500 truncate">{task.description}</p>
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
        <div className="px-5 py-8 text-center">
          <p className="text-gray-500">No tasks for today</p>
          <button
            onClick={onViewAll}
            className="text-navy-600 hover:text-navy-800 text-sm font-medium mt-2"
          >
            Add tasks →
          </button>
        </div>
      )}

      {/* Footer */}
      {tasks.length > 3 && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onViewAll}
            className="text-navy-600 hover:text-navy-800 text-sm font-medium"
          >
            View all {tasks.length} tasks →
          </button>
        </div>
      )}
    </div>
  );
};

export default TodayActionsCard;
