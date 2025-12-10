import React, { useState, useEffect } from 'react';

interface VisionData {
  id: string;
  title?: string;
  imageUrl?: string;
  isPrimary?: boolean;
  createdAt?: string;
}

interface VisionProgress {
  tasksCompleted: number;
  tasksTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
  streakDays: number;
}

interface Props {
  vision?: VisionData | null;
  progress?: VisionProgress;
  userName?: string;
  themeName?: string;
  onUpdateVision: () => void;
  onPrintVision: () => void;
  onCreateVision: () => void;
}

// Inspirational quotes for rotation
const INSPIRATIONAL_QUOTES = [
  "Dream it. See it. Achieve it.",
  "Your future self will thank you.",
  "One vision, unlimited possibilities.",
  "The journey of a thousand miles begins with a single step.",
  "Your only limit is your imagination."
];

// Daily affirmations
const DAILY_AFFIRMATIONS = [
  "Today I move closer to my dreams.",
  "I am capable of achieving greatness.",
  "Every step I take leads to success.",
  "My vision is becoming reality.",
  "I attract abundance and opportunity."
];

// Time-based greeting
const getTimeGreeting = (name: string): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return `Good morning, ${name}. Ready to manifest?`;
  } else if (hour >= 12 && hour < 17) {
    return `Keep building your vision, ${name}`;
  } else if (hour >= 17 && hour < 21) {
    return `Evening reflection time, ${name}`;
  } else {
    return `Dream big, ${name}`;
  }
};

// Get today's affirmation (consistent for the day)
const getTodayAffirmation = (): string => {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_AFFIRMATIONS[dayOfYear % DAILY_AFFIRMATIONS.length];
};

// Circular Progress Component
const CircularProgress: React.FC<{ percentage: number; size?: number }> = ({ percentage, size = 120 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#goldGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: percentage > 50 ? 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.6))' : 'none'
          }}
        />
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{percentage}%</span>
        <span className="text-xs text-white/60">complete</span>
      </div>
    </div>
  );
};

// Template Card Component
const TemplateCard: React.FC<{
  icon: string;
  title: string;
  gradient: string;
  onClick: () => void;
}> = ({ icon, title, gradient, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative w-40 h-48 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${gradient}`}
  >
    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
    <div className="relative h-full flex flex-col items-center justify-center p-4">
      <span className="text-5xl mb-3 transform group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-white font-semibold text-center text-sm">{title}</span>
    </div>
  </button>
);

const VisionHero: React.FC<Props> = ({
  vision,
  progress,
  userName,
  themeName,
  onUpdateVision,
  onPrintVision,
  onCreateVision
}) => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  // Rotate quotes every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % INSPIRATIONAL_QUOTES.length);
        setQuoteVisible(true);
      }, 500);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate overall progress percentage
  const calculateOverallProgress = (): number => {
    if (!progress) return 0;
    const taskProgress = progress.tasksTotal > 0
      ? (progress.tasksCompleted / progress.tasksTotal) * 50
      : 0;
    const habitProgress = progress.habitsTotal > 0
      ? (progress.habitsCompleted / progress.habitsTotal) * 50
      : 0;
    return Math.round(taskProgress + habitProgress);
  };

  const overallProgress = calculateOverallProgress();
  const displayName = userName || 'Visionary';

  // ============ EMPTY STATE ============
  if (!vision || !vision.imageUrl) {
    return (
      <div className="relative bg-gradient-to-br from-navy-900 via-slate-800 to-navy-900 rounded-3xl overflow-hidden shadow-2xl min-h-[500px]">
        {/* Animated Particles Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-gold-400/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${8 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
          {/* Gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6">
          {/* Icon with glow */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gold-500/30 rounded-full blur-xl animate-pulse" />
            <span className="relative text-6xl">✨</span>
          </div>

          {/* Headlines */}
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-3 text-center">
            Your Vision Awaits
          </h1>
          <p className="text-white/70 text-lg mb-4 text-center max-w-md">
            Transform your dreams into a visual reality that inspires daily action
          </p>

          {/* Rotating Quote */}
          <div className="h-8 mb-8">
            <p
              className={`text-gold-400 italic text-center transition-opacity duration-500 ${quoteVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              "{INSPIRATIONAL_QUOTES[currentQuoteIndex]}"
            </p>
          </div>

          {/* Template Cards */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <TemplateCard
              icon="🏝️"
              title="Dream Retirement"
              gradient="bg-gradient-to-br from-orange-400 to-pink-500"
              onClick={onCreateVision}
            />
            <TemplateCard
              icon="🚀"
              title="Career Success"
              gradient="bg-gradient-to-br from-blue-500 to-purple-600"
              onClick={onCreateVision}
            />
            <TemplateCard
              icon="🏡"
              title="Family & Home"
              gradient="bg-gradient-to-br from-amber-400 to-orange-500"
              onClick={onCreateVision}
            />
          </div>

          {/* CTA Button with pulse */}
          <button
            onClick={onCreateVision}
            className="relative group px-8 py-4 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 font-bold text-lg rounded-full shadow-xl hover:shadow-gold-500/25 transition-all duration-300 hover:scale-105"
          >
            <span className="relative z-10">Start Manifesting</span>
            {/* Pulse animation */}
            <div className="absolute inset-0 rounded-full bg-gold-400 animate-ping opacity-20" />
          </button>

          {/* Social Proof */}
          <p className="mt-6 text-white/40 text-sm">
            Join 10,000+ dreamers building their future
          </p>
        </div>

        {/* CSS for float animation */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
            25% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
            50% { transform: translateY(-40px) translateX(-10px); opacity: 0.4; }
            75% { transform: translateY(-20px) translateX(5px); opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  // ============ ACTIVE VISION STATE ============
  return (
    <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-3xl overflow-hidden shadow-2xl min-h-[400px]">
      {/* Background Image with Ken Burns effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[15000ms] ease-linear"
          style={{
            backgroundImage: `url(${vision.imageUrl})`,
            animation: 'kenburns 15s ease-in-out infinite alternate'
          }}
        />
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/80 to-navy-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-transparent to-navy-900/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 md:p-10">
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Left Side - Vision Info */}
          <div className="flex-1 max-w-xl">
            {/* Time-based Greeting */}
            <p className="text-gold-400 font-medium mb-2 text-sm md:text-base">
              {getTimeGreeting(displayName)}
            </p>

            {/* Main Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-3">
              My Active Vision
            </h1>

            {/* Vision Description */}
            <p className="text-white/80 text-base md:text-lg mb-4 line-clamp-2">
              {vision.title || 'Your personalized vision board guiding you to success'}
            </p>

            {/* Theme Badge */}
            {themeName && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
                <span className="text-sm">🎯</span>
                <span className="text-white/90 font-medium">{themeName}</span>
              </div>
            )}

            {/* Daily Affirmation */}
            <p className="text-gold-300/80 italic text-sm mb-6">
              "{getTodayAffirmation()}"
            </p>

            {/* Stats Row */}
            {progress && (
              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span>✅</span>
                  <span className="text-white/90">{progress.tasksCompleted}/{progress.tasksTotal} tasks</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span>🔥</span>
                  <span className="text-white/90">{progress.habitsCompleted}/{progress.habitsTotal} habits</span>
                </div>
                {progress.streakDays > 0 && (
                  <div
                    className="flex items-center gap-2 bg-orange-500/20 backdrop-blur-sm rounded-full px-3 py-1.5"
                    style={{
                      boxShadow: progress.streakDays > 7 ? '0 0 15px rgba(249, 115, 22, 0.4)' : 'none'
                    }}
                  >
                    <span>⚡</span>
                    <span className="text-orange-300 font-semibold">{progress.streakDays} day streak!</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onUpdateVision}
                className="px-6 py-3 bg-white text-navy-900 font-semibold rounded-full hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Update Vision
              </button>
              <button
                onClick={onPrintVision}
                className="px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-900 font-semibold rounded-full hover:from-gold-300 hover:to-gold-400 transition-all duration-300 shadow-lg hover:shadow-gold-500/25 hover:-translate-y-0.5"
              >
                Print & Frame
              </button>
            </div>
          </div>

          {/* Right Side - Progress Ring & Vision Preview */}
          <div className="flex flex-col items-center gap-6">
            {/* Circular Progress */}
            {progress && (
              <CircularProgress percentage={overallProgress} size={130} />
            )}

            {/* Vision Preview */}
            <div className="relative group">
              <div
                className="w-64 md:w-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 transition-transform duration-300 group-hover:scale-[1.02]"
                style={{
                  animation: 'gentleFloat 6s ease-in-out infinite'
                }}
              >
                <img
                  src={vision.imageUrl}
                  alt={vision.title || 'Your Vision'}
                  className="w-full aspect-[4/3] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <button
                    onClick={onUpdateVision}
                    className="bg-white/95 backdrop-blur-sm rounded-full px-5 py-2.5 text-navy-900 font-semibold text-sm shadow-xl hover:bg-white transition-colors"
                  >
                    View Gallery
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
};

export default VisionHero;
