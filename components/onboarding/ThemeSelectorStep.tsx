import React from 'react';

interface Theme {
  id: string;
  name: string;
  icon: string;
  description: string;
  traits: string[];
  color: string;
  bgColor: string;
}

const THEMES: Theme[] = [
  {
    id: 'christian',
    name: 'Faith & Purpose',
    icon: '✝️',
    description: 'Scripture-based encouragement and spiritual growth aligned with your beliefs',
    traits: ['Biblical wisdom', 'Prayer-centered', 'Purpose-driven', 'Grace-focused'],
    color: 'from-purple-500 to-indigo-600',
    bgColor: 'bg-purple-50'
  },
  {
    id: 'executive',
    name: 'Business Executive',
    icon: '💼',
    description: 'Results-driven strategy with measurable outcomes and analytical insights',
    traits: ['Data-driven', 'Strategic', 'Accountable', 'ROI-focused'],
    color: 'from-navy-700 to-slate-800',
    bgColor: 'bg-slate-50'
  },
  {
    id: 'fitness',
    name: 'Health & Fitness',
    icon: '💪',
    description: 'Energy optimization, discipline building, and physical transformation',
    traits: ['High-energy', 'Disciplined', 'Progressive', 'Holistic wellness'],
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-50'
  },
  {
    id: 'retirement',
    name: 'Retirement & Legacy',
    icon: '🌅',
    description: 'Financial freedom planning and creating meaningful next chapters',
    traits: ['Long-term vision', 'Legacy-minded', 'Peaceful', 'Wisdom-focused'],
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50'
  },
  {
    id: 'custom',
    name: 'Custom Style',
    icon: '⚙️',
    description: 'Build a completely personalized coaching approach tailored to your unique needs',
    traits: ['Fully flexible', 'Your vocabulary', 'Adaptive style', 'Unique to you'],
    color: 'from-gray-600 to-gray-700',
    bgColor: 'bg-gray-50'
  }
];

interface Props {
  selectedTheme?: string;
  onSelectTheme: (themeId: string, themeName: string) => void;
}

const ThemeSelectorStep: React.FC<Props> = ({ selectedTheme, onSelectTheme }) => {
  return (
    <div className="space-y-6">
      <p className="text-center text-gray-600 mb-8">
        Your AI Coach will adapt its language, examples, and approach based on your chosen identity.
        <br />
        <span className="text-gray-500 text-sm">Select the style that resonates most with you.</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelectTheme(theme.id, theme.name)}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group hover:shadow-xl ${
              selectedTheme === theme.id
                ? `border-navy-900 ${theme.bgColor} shadow-lg ring-2 ring-navy-900/20`
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            {/* Selection Indicator */}
            {selectedTheme === theme.id && (
              <div className="absolute top-4 right-4 w-7 h-7 bg-navy-900 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${theme.color} flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
              {theme.icon}
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-navy-900 mb-2">{theme.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{theme.description}</p>

            {/* Traits */}
            <div className="flex flex-wrap gap-2">
              {theme.traits.map((trait, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-1 rounded-full ${
                    selectedTheme === theme.id
                      ? 'bg-navy-900/10 text-navy-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {trait}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selectedTheme && (
        <div className="mt-8 p-4 bg-gradient-to-r from-gold-50 to-amber-50 rounded-xl border border-gold-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center justify-center">
              <span className="text-xl">{THEMES.find(t => t.id === selectedTheme)?.icon}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-navy-900">
                {THEMES.find(t => t.id === selectedTheme)?.name} selected
              </p>
              <p className="text-xs text-gray-500">
                Your AI Coach will use language and examples tailored to this approach.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelectorStep;
