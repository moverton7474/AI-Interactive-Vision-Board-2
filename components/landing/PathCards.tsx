import React from 'react';

interface PathCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const PathCard: React.FC<PathCardProps> = ({ icon, title, description, color, bgColor }) => (
  <div className={`group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
    {/* Background Gradient on Hover */}
    <div className={`absolute inset-0 ${bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

    <div className="relative">
      <div className={`w-14 h-14 ${color} bg-opacity-10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>

      <h3 className="text-xl font-bold text-navy-900 mb-2 group-hover:text-navy-900">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  </div>
);

interface PathCardsProps {
  onGetStarted: () => void;
}

export const PathCards: React.FC<PathCardsProps> = ({ onGetStarted }) => {
  const paths = [
    {
      icon: (
        <svg className="w-7 h-7 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      title: "Ascension Plan",
      description: "Map your journey from where you are to where you want to be with AI-generated milestones and actionable steps.",
      color: "bg-gold-500",
      bgColor: "bg-gradient-to-br from-gold-50 to-transparent"
    },
    {
      icon: (
        <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      title: "Spiritual Growth",
      description: "Integrate your faith and values into your vision. Receive encouragement rooted in spiritual wisdom and purpose.",
      color: "bg-purple-500",
      bgColor: "bg-gradient-to-br from-purple-50 to-transparent"
    },
    {
      icon: (
        <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: "Business Mindset",
      description: "Think like an entrepreneur. Build wealth strategies, track financial goals, and create legacy plans.",
      color: "bg-emerald-500",
      bgColor: "bg-gradient-to-br from-emerald-50 to-transparent"
    },
    {
      icon: (
        <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      title: "Life Design",
      description: "Design every aspect of your ideal life - from travel destinations to daily habits that compound into transformation.",
      color: "bg-blue-500",
      bgColor: "bg-gradient-to-br from-blue-50 to-transparent"
    },
    {
      icon: (
        <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "Relationship Goals",
      description: "Align with your partner on shared visions. Build accountability and celebrate milestones together.",
      color: "bg-rose-500",
      bgColor: "bg-gradient-to-br from-rose-50 to-transparent"
    },
    {
      icon: (
        <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Daily Execution",
      description: "Turn big dreams into daily habits. Track streaks, get AI coaching, and build unstoppable momentum.",
      color: "bg-amber-500",
      bgColor: "bg-gradient-to-br from-amber-50 to-transparent"
    }
  ];

  return (
    <section id="features" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-navy-900 mb-4">
            Choose Your Path to Transformation
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Whether you're planning retirement, building a business, or pursuing spiritual growth,
            Visionary adapts to your unique journey.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map((path, index) => (
            <PathCard key={index} {...path} />
          ))}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 bg-navy-900 text-white font-semibold px-8 py-4 rounded-full hover:bg-navy-800 transition-all shadow-lg hover:shadow-xl"
          >
            Explore All Features
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default PathCards;
