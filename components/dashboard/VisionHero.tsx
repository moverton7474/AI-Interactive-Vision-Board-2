import React from 'react';
import { VisionaryIcon, AscensionIcon } from '../Icons';

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
  onRefineVision?: () => void;
  onPrintVision: () => void;
  onCreateVision: () => void;
  onWorkbook?: () => void;
}

// Time-based greeting with ascension theme
const getTimeGreeting = (name: string): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return `Rise and shine, ${name}`;
  } else if (hour >= 12 && hour < 17) {
    return `Keep climbing, ${name}`;
  } else if (hour >= 17 && hour < 21) {
    return `Evening ascension, ${name}`;
  } else {
    return `Night visionary, ${name}`;
  }
};

// Calculate current phase based on progress
const getCurrentPhase = (percentage: number): { phase: number; label: string } => {
  if (percentage >= 75) return { phase: 4, label: 'Mastery' };
  if (percentage >= 50) return { phase: 3, label: 'Momentum' };
  if (percentage >= 25) return { phase: 2, label: 'Building' };
  return { phase: 1, label: 'Foundation' };
};

// Circular Progress Component with Visionary AI branding
const CircularProgress: React.FC<{ percentage: number; size?: number }> = ({ percentage, size = 100 }) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const { phase, label } = getCurrentPhase(percentage);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(197, 165, 114, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#C5A572"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white">{percentage}%</span>
        <span className="text-xs text-gold-400">Phase {phase}</span>
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
  onRefineVision,
  onPrintVision,
  onCreateVision,
  onWorkbook
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
      <div className="bg-gradient-to-br from-navy-900 via-charcoal-900 to-navy-950 rounded-2xl overflow-hidden shadow-lg border border-gold-500/20">
        <div className="p-8 md:p-12 text-center">
          {/* Greeting */}
          <p className="text-gold-400 font-medium mb-2">
            {getTimeGreeting(displayName)}
          </p>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3">
            Begin Your Ascension
          </h1>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Transform your dreams into a visual reality that guides your daily climb to success
          </p>

          {/* CTA Button */}
          <button
            onClick={onCreateVision}
            className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 hover:shadow-gold-500/25 text-navy-900 font-bold px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 shadow-lg inline-flex items-center gap-2"
          >
            <VisionaryIcon size={20} color="#1A1A2E" />
            Start My Ascension
          </button>
        </div>
      </div>
    );
  }

  // ============ ACTIVE VISION STATE ============
  const { phase, label } = getCurrentPhase(overallProgress);

  return (
    <div className="bg-gradient-to-br from-charcoal-900 via-navy-900 to-charcoal-800 rounded-2xl overflow-hidden shadow-lg border border-gold-500/20">
      <div className="flex flex-col md:flex-row">
        {/* Left - Vision Image */}
        <div className="md:w-1/3 relative group">
          <img
            src={vision.imageUrl}
            alt={vision.title || 'Your Vision'}
            className="w-full h-48 md:h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 to-transparent" />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-navy-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              onClick={onUpdateVision}
              className="bg-gold-500 text-navy-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gold-400 transition-colors"
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
              <p className="text-gold-400 font-medium text-sm mb-1">
                {getTimeGreeting(displayName)}
              </p>

              {/* Title */}
              <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-2">
                My Ascension Plan
              </h2>

              {/* Current Phase Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-gold-500/20 text-gold-400 px-3 py-1 rounded-full text-xs font-medium border border-gold-500/30">
                  <AscensionIcon size={14} progress={overallProgress} />
                  Current Climb: Phase {phase} - {label}
                </span>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {vision.title || 'Your personalized vision guiding your ascension'}
              </p>

              {/* Theme Badge */}
              {themeName && (
                <span className="inline-flex items-center gap-1 bg-navy-800 text-gold-400 px-3 py-1 rounded-full text-xs font-medium mb-4 border border-gold-500/20">
                  <VisionaryIcon size={12} color="#C5A572" /> {themeName}
                </span>
              )}

              {/* Stats */}
              {progress && (
                <div className="flex flex-wrap gap-4 text-sm mb-4">
                  <span className="text-gray-300 flex items-center gap-1">
                    <span className="text-status-success">✓</span> {progress.tasksCompleted}/{progress.tasksTotal} steps
                  </span>
                  <span className="text-gray-300 flex items-center gap-1">
                    <span className="text-gold-400">◆</span> {progress.habitsCompleted}/{progress.habitsTotal} habits
                  </span>
                  {progress.streakDays > 0 && (
                    <span className="text-gold-400 font-medium flex items-center gap-1">
                      <span>⚡</span> {progress.streakDays} day streak
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons - Always Visible */}
              <div className="flex flex-wrap gap-3">
                {/* Edit This Vision */}
                {onRefineVision && (
                  <button
                    onClick={onRefineVision}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-900 rounded-xl font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Refine Vision
                  </button>
                )}

                {/* Create New Vision */}
                <button
                  onClick={onCreateVision}
                  className="flex items-center gap-2 px-4 py-2.5 bg-status-success hover:bg-emerald-400 text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Vision
                </button>

                {/* Print This Vision */}
                <button
                  onClick={onPrintVision}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-gold-400 rounded-xl font-medium transition-colors shadow-md hover:shadow-lg border border-gold-500/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>

                {/* Create Workbook */}
                {onWorkbook && (
                  <button
                    onClick={onWorkbook}
                    className="flex items-center gap-2 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-gold-400 rounded-xl font-medium transition-colors shadow-md hover:shadow-lg border border-gold-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Workbook
                  </button>
                )}

                {/* View Gallery */}
                <button
                  onClick={onUpdateVision}
                  className="flex items-center gap-2 px-4 py-2.5 bg-charcoal-800 border border-gold-500/20 hover:bg-charcoal-700 text-gray-300 rounded-xl font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Gallery
                </button>
              </div>
            </div>

            {/* Progress Ring */}
            {progress && (
              <div className="hidden md:block ml-4 bg-navy-800/50 p-4 rounded-2xl border border-gold-500/20">
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
