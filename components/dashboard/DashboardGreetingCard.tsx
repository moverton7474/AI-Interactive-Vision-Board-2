import React, { useState, useEffect } from 'react';

interface Props {
  userName: string;
  themeName?: string;
  motivationStyle?: 'encouraging' | 'challenging' | 'analytical' | 'spiritual';
  themeInsight?: string;
  onPlayBriefing?: () => void;
  // WOW Optimization: Magic Mirror reveal
  isFirstLogin?: boolean;
  primaryVisionUrl?: string;
  primaryVisionId?: string;
  onMakePrimary?: (visionId: string) => void;
  onRefineVision?: (visionId: string) => void;
  onDismissReveal?: () => void;
}

const DashboardGreetingCard: React.FC<Props> = ({
  userName,
  themeName,
  motivationStyle,
  themeInsight,
  onPlayBriefing,
  isFirstLogin,
  primaryVisionUrl,
  primaryVisionId,
  onMakePrimary,
  onRefineVision,
  onDismissReveal
}) => {
  const [showRevealAnimation, setShowRevealAnimation] = useState<boolean>(
    Boolean(isFirstLogin && primaryVisionUrl)
  );

  // Trigger celebration animation on first load
  useEffect(() => {
    if (isFirstLogin && primaryVisionUrl) {
      setShowRevealAnimation(true);
    }
  }, [isFirstLogin, primaryVisionUrl]);
  const getGreeting = () => {
    const hour = new Date().getHours();

    if (motivationStyle === 'challenging') {
      if (hour < 12) return 'Time to execute';
      return 'Let\'s get to work';
    }

    if (motivationStyle === 'spiritual') {
      if (hour < 12) return 'Blessings this morning';
      return 'Walk in purpose';
    }

    if (motivationStyle === 'analytical') {
      return 'Status update';
    }

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

  const handleMakePrimary = () => {
    if (primaryVisionId && onMakePrimary) {
      onMakePrimary(primaryVisionId);
      setShowRevealAnimation(false);
      onDismissReveal?.();
    }
  };

  const handleRefineVision = () => {
    if (primaryVisionId && onRefineVision) {
      onRefineVision(primaryVisionId);
      setShowRevealAnimation(false);
      onDismissReveal?.();
    }
  };

  // WOW Optimization: Magic Mirror Hero Reveal
  if (showRevealAnimation && primaryVisionUrl) {
    return (
      <div className="relative rounded-2xl overflow-hidden shadow-xl">
        {/* Full-width vision image */}
        <div className="relative h-64 md:h-80">
          <img
            src={primaryVisionUrl}
            alt="Your Vision"
            className="w-full h-full object-cover animate-in fade-in duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Celebration sparkles */}
          <div className="absolute top-4 right-4 animate-bounce">
            <span className="text-4xl">✨</span>
          </div>
          <div className="absolute top-8 left-8 animate-bounce" style={{ animationDelay: '200ms' }}>
            <span className="text-2xl">🎉</span>
          </div>

          {/* Overlay content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <p className="text-sm opacity-80 mb-1 animate-in slide-in-from-bottom duration-500">
              Welcome to your journey
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mb-4 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: '100ms' }}>
              {userName}, your vision awaits
            </h1>

            {/* Action buttons */}
            <div className="flex gap-3 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: '200ms' }}>
              <button
                type="button"
                onClick={handleMakePrimary}
                className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors shadow-lg"
              >
                ✓ Make Primary
              </button>
              <button
                type="button"
                onClick={handleRefineVision}
                className="px-4 py-2 bg-white/20 backdrop-blur text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
              >
                Refine Vision
              </button>
            </div>
          </div>
        </div>

        {/* Theme badge */}
        {themeName && (
          <div className="absolute top-4 left-4">
            <div className="bg-gold-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
              <span className="text-white text-sm font-medium">{themeName}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

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
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
            <p className="text-navy-200 text-sm leading-relaxed italic flex-1">
              "{themeInsight}"
            </p>

            <button
              onClick={onPlayBriefing}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors backdrop-blur-sm whitespace-nowrap"
            >
              <span className="text-lg">🎙️</span>
              Morning Briefing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardGreetingCard;
