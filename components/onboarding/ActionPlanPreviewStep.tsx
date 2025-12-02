import React, { useState, useEffect } from 'react';
import { ActionTask } from '../../types';

interface Props {
  visionText: string;
  financialTarget?: number;
  themeName?: string;
  onTasksGenerated: (tasks: ActionTask[]) => void;
  generateActionPlan: (context: { vision: string; target?: number; theme?: string }) => Promise<ActionTask[]>;
}

const ActionPlanPreviewStep: React.FC<Props> = ({
  visionText,
  financialTarget,
  themeName,
  onTasksGenerated,
  generateActionPlan
}) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      try {
        setIsGenerating(true);
        setError(null);

        const generatedTasks = await generateActionPlan({
          vision: visionText,
          target: financialTarget,
          theme: themeName
        });

        setTasks(generatedTasks);
        onTasksGenerated(generatedTasks);
      } catch (err: any) {
        console.error('Action plan generation error:', err);
        setError(err.message || 'Failed to generate action plan');

        // Fallback to default tasks
        const fallbackTasks: ActionTask[] = [
          {
            id: 'task-1',
            title: 'Define your 3-year financial milestone',
            description: 'Set a specific savings or investment goal for the next 3 years',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'FINANCE',
            isCompleted: false
          },
          {
            id: 'task-2',
            title: 'Research your dream location',
            description: 'Explore cost of living, neighborhoods, and lifestyle in your target area',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'LIFESTYLE',
            isCompleted: false
          },
          {
            id: 'task-3',
            title: 'Create a weekly review habit',
            description: 'Schedule 30 minutes each Sunday to reflect on progress',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'ADMIN',
            isCompleted: false
          }
        ];
        setTasks(fallbackTasks);
        onTasksGenerated(fallbackTasks);
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
  }, [visionText, financialTarget, themeName]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FINANCE':
        return '💰';
      case 'LIFESTYLE':
        return '🏠';
      case 'ADMIN':
        return '📋';
      default:
        return '✓';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FINANCE':
        return 'bg-green-100 text-green-700';
      case 'LIFESTYLE':
        return 'bg-blue-100 text-blue-700';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

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
          <p className="text-lg font-medium text-navy-900 mb-2">Building your action plan...</p>
          <p className="text-gray-500">Creating personalized tasks based on your vision</p>
        </div>
      </div>
    );
  }

  // Group tasks by type
  const financeTasks = tasks.filter(t => t.type === 'FINANCE');
  const lifestyleTasks = tasks.filter(t => t.type === 'LIFESTYLE');
  const adminTasks = tasks.filter(t => t.type === 'ADMIN');

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
          Using recommended starter tasks. You can customize these later.
        </div>
      )}

      <div className="text-center mb-6">
        <p className="text-gray-600">
          Here's your personalized 3-year action plan with {tasks.length} starter tasks.
        </p>
      </div>

      {/* Task Categories */}
      <div className="space-y-6">
        {/* Financial Tasks */}
        {financeTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-green-50 px-4 py-3 border-b border-green-100">
              <h3 className="font-bold text-green-800 flex items-center gap-2">
                💰 Financial Tasks
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {financeTasks.map((task) => (
                <div key={task.id} className="p-4 flex items-start gap-3">
                  <div className="w-5 h-5 rounded border-2 border-green-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-500">{task.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lifestyle Tasks */}
        {lifestyleTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
              <h3 className="font-bold text-blue-800 flex items-center gap-2">
                🏠 Lifestyle Tasks
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {lifestyleTasks.map((task) => (
                <div key={task.id} className="p-4 flex items-start gap-3">
                  <div className="w-5 h-5 rounded border-2 border-blue-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-500">{task.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Tasks */}
        {adminTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
              <h3 className="font-bold text-purple-800 flex items-center gap-2">
                📋 Admin Tasks
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {adminTasks.map((task) => (
                <div key={task.id} className="p-4 flex items-start gap-3">
                  <div className="w-5 h-5 rounded border-2 border-purple-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <p className="text-sm text-gray-500">{task.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-navy-50 rounded-xl p-4 border border-navy-200">
        <p className="text-sm text-navy-700">
          <span className="font-medium">These tasks will be added to your Execute tab.</span>
          {' '}You can edit, add, or remove tasks at any time. Your AI coach will help you stay on track.
        </p>
      </div>
    </div>
  );
};

export default ActionPlanPreviewStep;
