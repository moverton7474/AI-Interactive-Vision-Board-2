import React from 'react';

interface Props {
  userName: string;
  themeName?: string;
  themeInsight?: string;
}

const DashboardGreetingCard: React.FC<Props> = ({ userName, themeName, themeInsight }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '🌙';
    if (hour < 12) return '☀️';
    if (hour < 17) return '🌤️';
    if (hour < 20) return '🌅';
    return '🌙';
  };

  return (
    <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-2xl p-6 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-navy-300 text-sm mb-1">{getTimeIcon()} {getGreeting()}</p>
            <h1 className="text-2xl font-bold">{userName}</h1>
          </div>
          {themeName && (
            <div className="bg-gold-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <span className="text-gold-400 text-sm font-medium">{themeName}</span>
            </div>
          )}
        </div>

        {themeInsight && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-navy-200 text-sm leading-relaxed italic">
              "{themeInsight}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardGreetingCard;
