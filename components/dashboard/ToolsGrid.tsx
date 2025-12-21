import React from 'react';
import { AppView } from '../../types';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  view: AppView;
  color: string;
  requiresRole?: 'admin' | 'manager';
  badge?: string;
}

interface Props {
  userRole?: string;
  onNavigate: (view: AppView) => void;
}

const ToolsGrid: React.FC<Props> = ({ userRole, onNavigate }) => {
  const tools: ToolItem[] = [
    {
      id: 'knowledge',
      title: 'Knowledge Base',
      description: 'Your personal AI-powered notes',
      icon: '📚',
      view: AppView.KNOWLEDGE_BASE,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'partner',
      title: 'Partner Workspace',
      description: 'Collaborate on shared goals',
      icon: '💑',
      view: AppView.PARTNER,
      color: 'from-pink-500 to-rose-500'
    },
    {
      id: 'apps',
      title: 'Apps & Integrations',
      description: 'Connect your favorite tools',
      icon: '🔌',
      view: AppView.INTEGRATIONS,
      color: 'from-cyan-500 to-teal-500'
    },
    {
      id: 'systems',
      title: 'My Systems',
      description: 'Accounts, automations & more',
      icon: '🏦',
      view: AppView.MY_SYSTEMS,
      color: 'from-emerald-500 to-green-500'
    },
    {
      id: 'teams',
      title: 'Teams',
      description: 'Team leaderboards & challenges',
      icon: '🏆',
      view: AppView.TEAM_LEADERBOARDS,
      color: 'from-amber-500 to-orange-500'
    },
    {
      id: 'manager',
      title: 'Manager Dashboard',
      description: 'Team management & analytics',
      icon: '📊',
      view: AppView.MANAGER_DASHBOARD,
      color: 'from-slate-600 to-slate-700',
      requiresRole: 'manager'
    },
    {
      id: 'reviews',
      title: 'Weekly Review',
      description: 'Reflect and plan ahead',
      icon: '📅',
      view: AppView.WEEKLY_REVIEWS,
      color: 'from-purple-500 to-violet-500'
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Preferences & notifications',
      icon: '⚙️',
      view: AppView.SETTINGS,
      color: 'from-gray-500 to-gray-600'
    }
  ];

  // Filter tools based on user role
  const visibleTools = tools.filter((tool) => {
    if (!tool.requiresRole) return true;
    if (tool.requiresRole === 'admin') return userRole === 'admin';
    if (tool.requiresRole === 'manager') return userRole === 'manager' || userRole === 'admin';
    return false;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛠️</span>
          <h3 className="font-bold text-gray-900">Tools & Resources</h3>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onNavigate(tool.view)}
              className="relative group flex flex-col items-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all hover:shadow-md"
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 bg-gradient-to-br ${tool.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}
              >
                <span className="text-2xl">{tool.icon}</span>
              </div>

              {/* Text */}
              <h4 className="font-semibold text-gray-800 text-sm text-center">
                {tool.title}
              </h4>
              <p className="text-xs text-gray-500 text-center mt-1 hidden sm:block">
                {tool.description}
              </p>

              {/* Badge */}
              {tool.badge && (
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-gold-500 text-white text-xs font-bold rounded-full">
                  {tool.badge}
                </span>
              )}

              {/* Role indicator */}
              {tool.requiresRole && (
                <span className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full" title={`${tool.requiresRole} only`} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ToolsGrid;
