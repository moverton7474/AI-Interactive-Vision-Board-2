import React from 'react';

interface Theme {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const THEMES: Theme[] = [
  {
    id: 'christian',
    name: 'Faith & Purpose',
    icon: '✝️',
    description: 'Scripture-based encouragement and spiritual growth',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    id: 'executive',
    name: 'Executive Excellence',
    icon: '💼',
    description: 'Results-driven strategy and measurable outcomes',
    color: 'from-navy-700 to-slate-800'
  },
  {
    id: 'fitness',
    name: 'Health & Vitality',
    icon: '💪',
    description: 'Energy, discipline, and physical transformation',
    color: 'from-green-500 to-emerald-600'
  },
  {
    id: 'retirement',
    name: 'Lifestyle & Legacy',
    icon: '🌅',
    description: 'Financial freedom and meaningful next chapters',
    color: 'from-amber-500 to-orange-600'
  },
  {
    id: 'custom',
    name: 'Custom Coach',
    icon: '⚙️',
    description: 'Personalized approach tailored to your style',
    color: 'from-gray-600 to-gray-700'
  }
];

interface Props {
  selectedTheme?: string;
  onSelectTheme: (themeId: string, themeName: string) => void;
}

const ThemeSelectorStep: React.FC<Props> = ({ selectedTheme, onSelectTheme }) => {
  return (
    <div className="space-y-4">
      <p className="text-center text-gray-600 mb-6">
        Choose a coaching style that resonates with your values and goals.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelectTheme(theme.id, theme.name)}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group hover:shadow-lg ${
              selectedTheme === theme.id
                ? 'border-navy-900 bg-navy-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {/* Selection Indicator */}
            {selectedTheme === theme.id && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-navy-900 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {/* Icon */}
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${theme.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
              {theme.icon}
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-navy-900 mb-1">{theme.name}</h3>
            <p className="text-sm text-gray-500">{theme.description}</p>
          </button>
        ))}
      </div>

      {selectedTheme && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Great choice! Your coach will be tailored to the{' '}
            <span className="font-semibold text-navy-900">
              {THEMES.find(t => t.id === selectedTheme)?.name}
            </span>{' '}
            approach.
          </p>
        </div>
      )}
    </div>
  );
};

export default ThemeSelectorStep;
