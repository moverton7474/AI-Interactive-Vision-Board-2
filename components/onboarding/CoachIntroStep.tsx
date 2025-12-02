import React from 'react';

interface Props {
  themeName?: string;
  themeId?: string;
}

const COACH_INTROS: Record<string, { greeting: string; description: string; traits: string[] }> = {
  christian: {
    greeting: "Hello! I'm your Faith & Purpose Vision Coach.",
    description: "I'll guide you with scripture-based encouragement and help you align your dreams with your spiritual values. Together, we'll build a vision that honors your faith while achieving meaningful goals.",
    traits: ['Scripture-inspired guidance', 'Prayer & gratitude focus', 'Purpose-driven planning', 'Community & service mindset']
  },
  executive: {
    greeting: "Welcome! I'm your Executive Excellence Vision Coach.",
    description: "I'll help you turn ambitious goals into measurable results. We'll use strategic frameworks, data-driven insights, and accountability systems to maximize your potential and achieve peak performance.",
    traits: ['Strategic goal-setting', 'KPI & metrics focus', 'Time optimization', 'Leadership development']
  },
  fitness: {
    greeting: "Hey there! I'm your Health & Vitality Vision Coach.",
    description: "I'll energize your journey with discipline, consistency, and positive momentum. We'll build habits that transform not just your body, but your entire approach to achieving goals.",
    traits: ['Energy & momentum', 'Habit stacking', 'Progress tracking', 'Mind-body connection']
  },
  retirement: {
    greeting: "Hello! I'm your Lifestyle & Legacy Vision Coach.",
    description: "I'll help you design a meaningful, financially secure next chapter. We'll focus on what truly matters—experiences, relationships, and leaving a lasting impact.",
    traits: ['Financial freedom planning', 'Life design focus', 'Legacy mindset', 'Simplicity & clarity']
  },
  custom: {
    greeting: "Hi! I'm your personalized Vision Coach.",
    description: "I'll adapt my approach to match your unique style and preferences. Tell me what motivates you, and I'll tailor our journey together to help you achieve your dreams.",
    traits: ['Flexible approach', 'Personalized guidance', 'Adaptive communication', 'Your pace, your way']
  }
};

const CoachIntroStep: React.FC<Props> = ({ themeName, themeId = 'custom' }) => {
  const intro = COACH_INTROS[themeId] || COACH_INTROS.custom;

  return (
    <div className="text-center">
      {/* Coach Avatar */}
      <div className="relative w-32 h-32 mx-auto mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 to-navy-700 rounded-full animate-pulse" />
        <div className="absolute inset-1 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center">
          <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        </div>
      </div>

      {/* Greeting */}
      <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-100">
        <h2 className="text-2xl font-serif font-bold text-navy-900 mb-4">
          {intro.greeting}
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed mb-6">
          {intro.description}
        </p>

        {/* Traits */}
        <div className="grid grid-cols-2 gap-3">
          {intro.traits.map((trait, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2"
            >
              <svg className="w-4 h-4 text-gold-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{trait}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Encouragement */}
      <p className="text-gray-500 text-sm">
        Ready to start building your vision? Let's capture your dreams.
      </p>
    </div>
  );
};

export default CoachIntroStep;
