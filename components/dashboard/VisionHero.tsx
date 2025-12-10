import React, { useState, useEffect } from 'react';
import { AscensionIcon, CrossIcon } from './icons';

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

// Visionary AI Color Palette
const COLORS = {
  gold: '#C9A961',
  goldLight: '#F5E6C3',
  textPrimary: '#F5F0E6',
  textSecondary: '#8a9199',
  bgDark: '#1a1f2e',
  bgCard: '#252b3b',
  border: '#3a4152',
};

// Inspirational quotes for rotation
const INSPIRATIONAL_QUOTES = [
  "Dream it. See it. Achieve it.",
  "Your future self will thank you.",
  "One vision, unlimited possibilities.",
  "The journey of a thousand miles begins with a single step.",
  "Your only limit is your imagination.",
  "Faith and vision create your reality."
];

// Daily affirmations
const DAILY_AFFIRMATIONS = [
  "Today I move closer to my dreams.",
  "I am capable of achieving greatness.",
  "Every step I take leads to success.",
  "My vision is becoming reality.",
  "I attract abundance and opportunity.",
  "I walk in purpose and clarity."
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
          stroke="rgba(201, 169, 97, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#visionaryGoldGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: percentage > 50 ? 'drop-shadow(0 0 8px rgba(201, 169, 97, 0.6))' : 'none'
          }}
        />
        <defs>
          <linearGradient id="visionaryGoldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COLORS.goldLight} />
            <stop offset="100%" stopColor={COLORS.gold} />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{percentage}%</span>
        <span className="text-xs" style={{ color: COLORS.textSecondary }}>complete</span>
      </div>
    </div>
  );
};

// Template Card Types
interface TemplateCardData {
  id: string;
  icon?: string;
  customIcon?: 'ascension' | 'cross';
  title: string;
  description: string;
  gradient: string;
}

const VISION_TEMPLATES: TemplateCardData[] = [
  {
    id: 'ascension',
    customIcon: 'ascension',
    title: 'Ascension Plan',
    description: 'Rise to your highest potential',
    gradient: 'bg-gradient-to-br from-[#1a1f2e] to-[#2a3142]'
  },
  {
    id: 'spiritual',
    customIcon: 'cross',
    title: 'Spiritual Growth',
    description: 'Deepen your faith journey',
    gradient: 'bg-gradient-to-br from-[#1e2433] to-[#2d3548]'
  },
  {
    id: 'retirement',
    icon: '🏝️',
    title: 'Dream Retirement',
    description: 'Design your ideal future',
    gradient: 'bg-gradient-to-br from-[#2a2520] to-[#3d352e]'
  },
  {
    id: 'career',
    icon: '🚀',
    title: 'Career Success',
    description: 'Achieve professional excellence',
    gradient: 'bg-gradient-to-br from-[#1a2433] to-[#253348]'
  },
  {
    id: 'family',
    icon: '🏡',
    title: 'Family & Home',
    description: 'Build your legacy',
    gradient: 'bg-gradient-to-br from-[#2a2a1f] to-[#3d3d2e]'
  },
  {
    id: 'wealth',
    icon: '💎',
    title: 'Wealth Building',
    description: 'Create financial freedom',
    gradient: 'bg-gradient-to-br from-[#1f2a2a] to-[#2e3d3d]'
  }
];

// Template Card Component (v0 Design)
const TemplateCard: React.FC<{
  template: TemplateCardData;
  onClick: () => void;
}> = ({ template, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden rounded-xl p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${template.gradient}`}
    style={{
      border: `1px solid ${COLORS.border}`,
      boxShadow: 'none'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'rgba(201, 169, 97, 0.3)';
      e.currentTarget.style.boxShadow = '0 20px 40px rgba(201, 169, 97, 0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = COLORS.border;
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    <div className="relative z-10">
      {template.customIcon === 'ascension' ? (
        <AscensionIcon className="w-12 h-12 mb-3" />
      ) : template.customIcon === 'cross' ? (
        <CrossIcon className="w-12 h-12 mb-3" />
      ) : (
        <span className="text-3xl mb-3 block">{template.icon}</span>
      )}
      <h3 className="text-lg font-semibold mb-1" style={{ color: COLORS.textPrimary }}>
        {template.title}
      </h3>
      <p className="text-sm" style={{ color: COLORS.textSecondary }}>
        {template.description}
      </p>
    </div>
    {/* Hover glow effect with Visionary AI gold */}
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{
        background: `linear-gradient(to top, rgba(201, 169, 97, 0.2), transparent)`
      }}
    />
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
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${COLORS.bgDark} 0%, #0f1219 100%)`,
          minHeight: '600px'
        }}
      >
        {/* Animated Particles Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating particles */}
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                backgroundColor: `rgba(201, 169, 97, ${0.2 + Math.random() * 0.3})`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${10 + Math.random() * 5}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
          {/* Gradient orbs */}
          <div
            className="absolute w-96 h-96 rounded-full blur-3xl animate-pulse"
            style={{
              background: `radial-gradient(circle, rgba(201, 169, 97, 0.1) 0%, transparent 70%)`,
              top: '10%',
              left: '20%'
            }}
          />
          <div
            className="absolute w-64 h-64 rounded-full blur-3xl animate-pulse"
            style={{
              background: `radial-gradient(circle, rgba(100, 120, 180, 0.08) 0%, transparent 70%)`,
              bottom: '20%',
              right: '15%',
              animationDelay: '2s'
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6">
          {/* Icon with glow */}
          <div className="relative mb-8">
            <div
              className="absolute inset-0 rounded-full blur-2xl animate-pulse"
              style={{ background: `rgba(201, 169, 97, 0.3)` }}
            />
            <span className="relative text-7xl">✨</span>
          </div>

          {/* Headlines */}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-4 text-center"
            style={{ color: COLORS.textPrimary }}
          >
            Your Vision Awaits
          </h1>
          <p
            className="text-lg md:text-xl mb-6 text-center max-w-lg"
            style={{ color: COLORS.textSecondary }}
          >
            Transform your dreams into a visual reality that inspires daily action
          </p>

          {/* Rotating Quote */}
          <div className="h-8 mb-10">
            <p
              className={`italic text-center transition-opacity duration-500 ${quoteVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{ color: COLORS.gold }}
            >
              "{INSPIRATIONAL_QUOTES[currentQuoteIndex]}"
            </p>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-w-4xl">
            {VISION_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={onCreateVision}
              />
            ))}
          </div>

          {/* CTA Button with pulse */}
          <button
            onClick={onCreateVision}
            className="relative group px-10 py-4 font-bold text-lg rounded-full transition-all duration-300 hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%)`,
              color: COLORS.bgDark,
              boxShadow: `0 4px 20px rgba(201, 169, 97, 0.3)`
            }}
          >
            <span className="relative z-10">Start Manifesting Your Vision</span>
            {/* Pulse animation */}
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: COLORS.gold }}
            />
          </button>

          {/* Social Proof */}
          <p className="mt-8 text-sm" style={{ color: `${COLORS.textSecondary}80` }}>
            Join 10,000+ dreamers building their future
          </p>
        </div>

        {/* CSS for float animation */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
            25% { transform: translateY(-30px) translateX(15px); opacity: 0.7; }
            50% { transform: translateY(-50px) translateX(-15px); opacity: 0.4; }
            75% { transform: translateY(-25px) translateX(8px); opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  // ============ ACTIVE VISION STATE ============
  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${COLORS.bgDark} 0%, #0f1219 100%)`,
        minHeight: '450px'
      }}
    >
      {/* Background Image with Ken Burns effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${vision.imageUrl})`,
            animation: 'kenburns 20s ease-in-out infinite alternate'
          }}
        />
        {/* Overlays */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, ${COLORS.bgDark}f5 0%, ${COLORS.bgDark}cc 50%, ${COLORS.bgDark}80 100%)`
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${COLORS.bgDark}ee 0%, transparent 50%, ${COLORS.bgDark}40 100%)`
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 md:p-10 lg:p-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Left Side - Vision Info */}
          <div className="flex-1 max-w-xl">
            {/* Time-based Greeting */}
            <p className="font-medium mb-2 text-sm md:text-base" style={{ color: COLORS.gold }}>
              {getTimeGreeting(displayName)}
            </p>

            {/* Main Title */}
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-4"
              style={{ color: COLORS.textPrimary }}
            >
              My Active Vision
            </h1>

            {/* Vision Description */}
            <p
              className="text-base md:text-lg mb-5 line-clamp-2"
              style={{ color: `${COLORS.textPrimary}cc` }}
            >
              {vision.title || 'Your personalized vision board guiding you to success'}
            </p>

            {/* Theme Badge */}
            {themeName && (
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-4"
                style={{
                  background: 'rgba(201, 169, 97, 0.1)',
                  border: `1px solid ${COLORS.border}`
                }}
              >
                <span className="text-sm">🎯</span>
                <span className="font-medium" style={{ color: `${COLORS.textPrimary}e0` }}>
                  {themeName}
                </span>
              </div>
            )}

            {/* Daily Affirmation */}
            <p className="italic text-sm mb-6" style={{ color: `${COLORS.gold}cc` }}>
              "{getTodayAffirmation()}"
            </p>

            {/* Stats Row */}
            {progress && (
              <div className="flex flex-wrap gap-3 mb-6 text-sm">
                <div
                  className="flex items-center gap-2 rounded-full px-4 py-2"
                  style={{
                    background: 'rgba(201, 169, 97, 0.1)',
                    border: `1px solid ${COLORS.border}`
                  }}
                >
                  <span>✅</span>
                  <span style={{ color: `${COLORS.textPrimary}cc` }}>
                    {progress.tasksCompleted}/{progress.tasksTotal} tasks
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 rounded-full px-4 py-2"
                  style={{
                    background: 'rgba(201, 169, 97, 0.1)',
                    border: `1px solid ${COLORS.border}`
                  }}
                >
                  <span>🔥</span>
                  <span style={{ color: `${COLORS.textPrimary}cc` }}>
                    {progress.habitsCompleted}/{progress.habitsTotal} habits
                  </span>
                </div>
                {progress.streakDays > 0 && (
                  <div
                    className="flex items-center gap-2 rounded-full px-4 py-2"
                    style={{
                      background: progress.streakDays > 7
                        ? 'rgba(249, 115, 22, 0.15)'
                        : 'rgba(201, 169, 97, 0.1)',
                      border: `1px solid ${progress.streakDays > 7 ? 'rgba(249, 115, 22, 0.3)' : COLORS.border}`,
                      boxShadow: progress.streakDays > 7 ? '0 0 20px rgba(249, 115, 22, 0.2)' : 'none'
                    }}
                  >
                    <span>⚡</span>
                    <span
                      className="font-semibold"
                      style={{ color: progress.streakDays > 7 ? '#fb923c' : COLORS.gold }}
                    >
                      {progress.streakDays} day streak!
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onUpdateVision}
                className="px-6 py-3 font-semibold rounded-full transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: COLORS.textPrimary,
                  color: COLORS.bgDark,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                Update Vision
              </button>
              <button
                onClick={onPrintVision}
                className="px-6 py-3 font-semibold rounded-full transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%)`,
                  color: COLORS.bgDark,
                  boxShadow: `0 4px 20px rgba(201, 169, 97, 0.3)`
                }}
              >
                Print & Frame
              </button>
            </div>
          </div>

          {/* Right Side - Progress Ring & Vision Preview */}
          <div className="flex flex-col items-center gap-6">
            {/* Circular Progress */}
            {progress && (
              <CircularProgress percentage={overallProgress} size={140} />
            )}

            {/* Vision Preview */}
            <div className="relative group">
              <div
                className="w-64 md:w-80 rounded-2xl overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]"
                style={{
                  border: `2px solid ${COLORS.border}`,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
                  animation: 'gentleFloat 6s ease-in-out infinite'
                }}
              >
                <img
                  src={vision.imageUrl}
                  alt={vision.title || 'Your Vision'}
                  className="w-full aspect-[4/3] object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)'
                  }}
                />

                {/* Hover overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                >
                  <button
                    onClick={onUpdateVision}
                    className="rounded-full px-5 py-2.5 font-semibold text-sm transition-colors"
                    style={{
                      background: `${COLORS.textPrimary}f0`,
                      color: COLORS.bgDark
                    }}
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
          100% { transform: scale(1.08); }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default VisionHero;
