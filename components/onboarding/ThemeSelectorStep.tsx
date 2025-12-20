import React, { useState } from 'react';

interface Theme {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  sampleGreeting: string;
  sampleMotivation: string;
  features: string[];
}

const THEMES: Theme[] = [
  {
    id: 'christian',
    name: 'Faith & Purpose',
    icon: '✝️',
    description: 'Scripture-based encouragement and spiritual growth',
    color: 'from-purple-500 to-indigo-600',
    sampleGreeting: "Good morning! Remember, 'I can do all things through Christ who strengthens me.' What vision has God placed on your heart today?",
    sampleMotivation: "Your dedication is bearing fruit. Keep your eyes fixed on the eternal purpose behind your daily efforts.",
    features: ['Scripture integration', 'Prayer prompts', 'Stewardship focus']
  },
  {
    id: 'executive',
    name: 'Executive Excellence',
    icon: '💼',
    description: 'Results-driven strategy and measurable outcomes',
    color: 'from-navy-700 to-slate-800',
    sampleGreeting: "Good morning. Let's review your KPIs and identify the highest-leverage activities for today. What's your primary objective?",
    sampleMotivation: "Excellent ROI on your efforts this week. Time to scale what's working and eliminate friction points.",
    features: ['KPI tracking', 'Strategic frameworks', 'Performance metrics']
  },
  {
    id: 'fitness',
    name: 'Health & Vitality',
    icon: '💪',
    description: 'Energy, discipline, and physical transformation',
    color: 'from-green-500 to-emerald-600',
    sampleGreeting: "Rise and shine! Your body is ready for another day of progress. How's your energy level this morning?",
    sampleMotivation: "You're building momentum! Every healthy choice compounds. Your future self thanks you for showing up today.",
    features: ['Wellness tracking', 'Habit stacking', 'Mind-body balance']
  },
  {
    id: 'retirement',
    name: 'Lifestyle & Legacy',
    icon: '🌅',
    description: 'Financial freedom and meaningful next chapters',
    color: 'from-amber-500 to-orange-600',
    sampleGreeting: "Good morning! Let's make today count toward the life you've envisioned. What would make this day meaningful?",
    sampleMotivation: "You're on track for financial independence. But more importantly, you're building memories that matter.",
    features: ['Legacy planning', 'Financial tracking', 'Life transition support']
  },
  {
    id: 'custom',
    name: 'Custom Coach',
    icon: '⚙️',
    description: 'Personalized approach tailored to your style',
    color: 'from-gray-600 to-gray-700',
    sampleGreeting: "Hello! I'm here to support your unique journey. Tell me about what matters most to you.",
    sampleMotivation: "You're making progress on your own terms. That's what authentic growth looks like.",
    features: ['Fully customizable', 'Upload your own content', 'Adaptive style']
  }
];

interface Props {
  selectedTheme?: string;
  onSelectTheme: (themeId: string, themeName: string) => void;
}

const ThemeSelectorStep: React.FC<Props> = ({ selectedTheme, onSelectTheme }) => {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);
  const activePreview = hoveredTheme || selectedTheme;
  const previewTheme = THEMES.find(t => t.id === activePreview);

  return (
    <div className="space-y-6">
      <p className="text-center text-gray-600 mb-2">
        Choose a coaching style that resonates with your values and goals.
      </p>

      {/* Preview Panel - Shows sample coach response */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-5 mb-6 min-h-[140px] transition-all duration-300">
        {previewTheme ? (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${previewTheme.color} flex items-center justify-center text-lg`}>
                {previewTheme.icon}
              </div>
              <div>
                <p className="text-gold-400 text-xs font-semibold uppercase tracking-wide">Preview: {previewTheme.name}</p>
                <p className="text-white/60 text-xs">Sample morning greeting</p>
              </div>
            </div>
            <p className="text-white/90 text-sm leading-relaxed italic">
              "{previewTheme.sampleGreeting}"
            </p>
            {/* Feature Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {previewTheme.features.map((feature, i) => (
                <span key={i} className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white/50 text-sm">
            <span>Hover over a theme to preview how your coach will sound</span>
          </div>
        )}
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelectTheme(theme.id, theme.name)}
            onMouseEnter={() => setHoveredTheme(theme.id)}
            onMouseLeave={() => setHoveredTheme(null)}
            className={`relative p-5 rounded-2xl border-2 transition-all duration-300 text-left group hover:shadow-lg ${
              selectedTheme === theme.id
                ? 'border-navy-900 bg-navy-50 shadow-md ring-2 ring-navy-900/20'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {/* Selection Indicator */}
            {selectedTheme === theme.id && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-navy-900 rounded-full flex items-center justify-center animate-scale-in">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${theme.color} flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg`}>
                {theme.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-navy-900 mb-1">{theme.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{theme.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selection Confirmation */}
      {selectedTheme && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">
                {THEMES.find(t => t.id === selectedTheme)?.name} Selected
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Your AI coach will adapt its personality, language, and motivation style to match this theme.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelectorStep;
