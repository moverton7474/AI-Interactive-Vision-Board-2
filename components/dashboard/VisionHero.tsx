import React from 'react';

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

// Time-based greeting
const getTimeGreeting = (name: string): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return `Good morning, ${name}`;
  } else if (hour >= 12 && hour < 17) {
    return `Good afternoon, ${name}`;
  } else if (hour >= 17 && hour < 21) {
    return `Good evening, ${name}`;
  } else {
    return `Hello, ${name}`;
  }
};

// Circular Progress Component
const CircularProgress: React.FC<{ percentage: number; size?: number }> = ({ percentage, size = 100 }) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(201, 169, 97, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#C9A961"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{percentage}%</span>
        <span className="text-xs text-gray-500">today</span>
      </div>
    </div>
  );
};

const VisionHero: React.FC<Props> = ({
  vision,
  progress,
  userName,
  themeName,
  onUpdateVision,
  onPrintVision,
  onCreateVision
}) => {
  const displayName = userName || 'Friend';

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

  // ============ EMPTY STATE ============
  if (!vision || !vision.imageUrl) {
    return (
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-8 md:p-12 text-center">
          {/* Greeting */}
          <p className="text-gold-400 font-medium mb-2">
            {getTimeGreeting(displayName)}
          </p>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3">
            Create Your Vision Board
          </h1>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Transform your dreams into a visual reality that inspires daily action
          </p>

          {/* CTA Button */}
          <button
            onClick={onCreateVision}
            className="bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 shadow-lg"
          >
            ✨ Start Creating Your Vision
          </button>
        </div>
      </div>
    );
  }

  // ============ ACTIVE VISION STATE ============
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100">
      <div className="flex flex-col md:flex-row">
        {/* Left - Vision Image */}
        <div className="md:w-1/3 relative group">
          <img
            src={vision.imageUrl}
            alt={vision.title || 'Your Vision'}
            className="w-full h-48 md:h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              onClick={onUpdateVision}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
            >
              View Gallery
            </button>
          </div>
        </div>

        {/* Right - Info & Actions */}
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Greeting */}
              <p className="text-gold-600 font-medium text-sm mb-1">
                {getTimeGreeting(displayName)}
              </p>

              {/* Title */}
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                My Active Vision
              </h2>

              {/* Description */}
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {vision.title || 'Your personalized vision guiding you to success'}
              </p>

              {/* Theme Badge */}
              {themeName && (
                <span className="inline-flex items-center gap-1 bg-navy-50 text-navy-700 px-3 py-1 rounded-full text-xs font-medium mb-4">
                  🎯 {themeName}
                </span>
              )}

              {/* Stats */}
              {progress && (
                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  <span className="text-gray-600">
                    ✅ {progress.tasksCompleted}/{progress.tasksTotal} tasks
                  </span>
                  <span className="text-gray-600">
                    🔥 {progress.habitsCompleted}/{progress.habitsTotal} habits
                  </span>
                  {progress.streakDays > 0 && (
                    <span className="text-orange-600 font-medium">
                      ⚡ {progress.streakDays} day streak
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onUpdateVision}
                  className="bg-navy-900 hover:bg-navy-800 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Update Vision
                </button>
                <button
                  onClick={onPrintVision}
                  className="bg-gold-500 hover:bg-gold-600 text-navy-900 px-5 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  🖨️ Print
                </button>
              </div>
            </div>

            {/* Progress Ring */}
            {progress && (
              <div className="hidden md:block ml-4">
                <CircularProgress percentage={overallProgress} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionHero;
