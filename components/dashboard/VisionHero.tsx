import React from 'react';
import EmptyState from './EmptyState';

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

const VisionHero: React.FC<Props> = ({
  vision,
  progress,
  userName,
  themeName,
  onUpdateVision,
  onPrintVision,
  onCreateVision
}) => {
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

  // Empty state - no vision created yet
  if (!vision || !vision.imageUrl) {
    return (
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-8 py-12">
          <EmptyState
            icon="✨"
            title="Let's Create Your First Vision"
            description="Transform your dreams into a visual reality. Your vision board will guide your journey to success."
            actionLabel="Create Vision"
            onAction={onCreateVision}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-3xl overflow-hidden shadow-xl">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={vision.imageUrl}
          alt={vision.title || 'Your Vision'}
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/70 to-navy-900/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Side - Vision Info */}
          <div className="flex-1">
            {/* Greeting */}
            {userName && (
              <p className="text-gold-400 text-sm font-medium mb-2">
                Welcome back, {userName}
              </p>
            )}

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              My Active Vision
            </h1>

            {/* Vision Title/Prompt */}
            <p className="text-white/80 text-sm md:text-base mb-4 line-clamp-2">
              {vision.title || 'Your personalized vision board'}
            </p>

            {/* Theme Badge */}
            {themeName && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 mb-4">
                <span className="text-sm">🎯</span>
                <span className="text-white/90 text-sm font-medium">{themeName}</span>
              </div>
            )}

            {/* Progress Section */}
            {progress && (
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full transition-all duration-500"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  <span className="text-white font-bold text-sm">{overallProgress}%</span>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1 text-white/70">
                    <span>✅</span>
                    <span>{progress.tasksCompleted}/{progress.tasksTotal} tasks</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/70">
                    <span>🔥</span>
                    <span>{progress.habitsCompleted}/{progress.habitsTotal} habits</span>
                  </div>
                  {progress.streakDays > 0 && (
                    <div className="flex items-center gap-1 text-orange-400">
                      <span>⚡</span>
                      <span>{progress.streakDays} day streak</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={onUpdateVision}
                className="px-5 py-2.5 bg-white text-navy-900 font-semibold rounded-full hover:bg-gray-100 transition-colors shadow-lg"
              >
                Update Vision
              </button>
              <button
                onClick={onPrintVision}
                className="px-5 py-2.5 bg-gold-500 text-navy-900 font-semibold rounded-full hover:bg-gold-400 transition-colors shadow-lg"
              >
                Print Vision
              </button>
            </div>
          </div>

          {/* Right Side - Vision Preview */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
              <img
                src={vision.imageUrl}
                alt={vision.title || 'Your Vision'}
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

              {/* View Gallery Overlay */}
              <button
                onClick={onUpdateVision}
                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
              >
                <span className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-navy-900 font-medium text-sm shadow-lg">
                  View Gallery
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionHero;
