import React, { useState, useEffect, useCallback } from 'react';
import { AppView, ActionTask } from '../../types';
import { supabase } from '../../lib/supabase';
import DashboardGreetingCard from './DashboardGreetingCard';
import TodayFocusCard from './TodayFocusCard';
import PrimaryVisionCard from './PrimaryVisionCard';
import TodayActionsCard from './TodayActionsCard';
import HabitStreakBar from './HabitStreakBar';
import FinancialProgressCard from './FinancialProgressCard';
import TalkToCoachButton from './TalkToCoachButton';
import PrintCenterCard from './PrintCenterCard';

interface Habit {
  id: string;
  name: string;
  icon: string;
  completedToday: boolean;
  streak: number;
}

interface Props {
  userName: string;
  themeName?: string;
  motivationStyle?: 'encouraging' | 'challenging' | 'analytical' | 'spiritual';
  themeInsight?: string;
  todayFocus?: string;
  primaryVisionUrl?: string;
  primaryVisionTitle?: string;
  primaryVisionId?: string;
  tasks: ActionTask[];
  habits: Habit[];
  financialTarget?: number;
  financialCurrent?: number;
  financialTargetLabel?: string;
  onNavigate: (view: AppView) => void;
  onToggleTask: (taskId: string) => void;
  onToggleHabit: (habitId: string) => void;
  isLoadingFocus?: boolean;
  onPlayBriefing?: () => void;
  // WOW Optimization: First login props
  userId?: string;
  onboardingCompletedAt?: string;
  onSetPrimaryVision?: (visionId: string) => void;
}

const Dashboard: React.FC<Props> = ({
  userName,
  themeName,
  motivationStyle,
  themeInsight,
  todayFocus,
  primaryVisionUrl,
  primaryVisionTitle,
  primaryVisionId,
  tasks,
  habits,
  financialTarget,
  financialCurrent,
  financialTargetLabel,
  onNavigate,
  onToggleTask,
  onToggleHabit,
  isLoadingFocus,
  onPlayBriefing,
  userId,
  onboardingCompletedAt,
  onSetPrimaryVision
}) => {
  // WOW Optimization: First login detection for Magic Mirror reveal
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [hasSeenReveal, setHasSeenReveal] = useState(false);

  useEffect(() => {
    // Check if onboarding was completed within the last 24 hours
    if (onboardingCompletedAt && !hasSeenReveal) {
      const completedAt = new Date(onboardingCompletedAt);
      const now = new Date();
      const hoursSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      // Show hero reveal if completed within last 24 hours
      if (hoursSinceCompletion < 24) {
        setIsFirstLogin(true);
      }
    }
  }, [onboardingCompletedAt, hasSeenReveal]);

  // Handle "Make Primary" action from Magic Mirror reveal
  const handleMakePrimary = useCallback((visionId: string) => {
    console.log('Making vision primary:', visionId);
    onSetPrimaryVision?.(visionId);
    setHasSeenReveal(true);
    setIsFirstLogin(false);
  }, [onSetPrimaryVision]);

  // Handle "Refine Vision" action - navigate to vision board
  const handleRefineVision = useCallback((visionId: string) => {
    console.log('Refining vision:', visionId);
    setHasSeenReveal(true);
    setIsFirstLogin(false);
    onNavigate(AppView.VISION_BOARD);
  }, [onNavigate]);

  // Handle dismiss reveal
  const handleDismissReveal = useCallback(() => {
    setHasSeenReveal(true);
    setIsFirstLogin(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Greeting Card with Magic Mirror Reveal */}
        <DashboardGreetingCard
          userName={userName}
          themeName={themeName}
          motivationStyle={motivationStyle}
          themeInsight={themeInsight}
          onPlayBriefing={onPlayBriefing}
          // WOW Optimization: Magic Mirror reveal props
          isFirstLogin={isFirstLogin}
          primaryVisionUrl={primaryVisionUrl}
          primaryVisionId={primaryVisionId}
          onMakePrimary={handleMakePrimary}
          onRefineVision={handleRefineVision}
          onDismissReveal={handleDismissReveal}
        />

        {/* HERO SECTION: Voice Coach - Primary CTA */}
        <div className="relative">
          <TalkToCoachButton
            themeName={themeName || 'Your Vision Coach'}
            onClick={() => onNavigate(AppView.VOICE_COACH)}
          />
          {/* Attention badge */}
          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            AI Coach Ready
          </div>
        </div>

        {/* Core User Journey - Quick Access Cards */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Your Journey</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => onNavigate(AppView.VISION_BOARD)}
              className="flex flex-col items-center p-4 bg-gradient-to-br from-navy-50 to-navy-100 rounded-xl hover:shadow-md transition-all group"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">✨</span>
              <span className="text-sm font-medium text-navy-800">Create Vision</span>
              <span className="text-xs text-navy-500">Step 1</span>
            </button>
            <button
              onClick={() => onNavigate(AppView.ACTION_PLAN)}
              className="flex flex-col items-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:shadow-md transition-all group"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📋</span>
              <span className="text-sm font-medium text-purple-800">Action Plan</span>
              <span className="text-xs text-purple-500">Step 2</span>
            </button>
            <button
              onClick={() => onNavigate(AppView.PRINT_PRODUCTS)}
              className="flex flex-col items-center p-4 bg-gradient-to-br from-gold-50 to-gold-100 rounded-xl hover:shadow-md transition-all group"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🖼️</span>
              <span className="text-sm font-medium text-gold-800">Print & Order</span>
              <span className="text-xs text-gold-600">Step 3</span>
            </button>
            <button
              onClick={() => onNavigate(AppView.VOICE_COACH)}
              className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover:shadow-md transition-all group"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🎙️</span>
              <span className="text-sm font-medium text-green-800">AI Coaching</span>
              <span className="text-xs text-green-500">Ongoing</span>
            </button>
          </div>
        </div>

        {/* Today's Focus */}
        <TodayFocusCard
          focus={todayFocus}
          isLoading={isLoadingFocus}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Primary Vision */}
            <PrimaryVisionCard
              visionUrl={primaryVisionUrl}
              visionTitle={primaryVisionTitle}
              onClick={() => onNavigate(AppView.GALLERY)}
            />

            {/* Financial Progress */}
            <FinancialProgressCard
              target={financialTarget}
              current={financialCurrent}
              targetLabel={financialTargetLabel}
              onClick={() => onNavigate(AppView.FINANCIAL)}
            />

            {/* MDALS Lab Button */}
            <button
              onClick={() => onNavigate(AppView.MDALS_LAB)}
              className="w-full bg-gradient-to-r from-purple-900 to-navy-900 text-white p-4 rounded-xl shadow-lg flex items-center justify-between hover:scale-105 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <div className="text-left">
                  <h3 className="font-bold">MDALS Engine Lab</h3>
                  <p className="text-xs text-purple-200">Song Finder & Music Analysis</p>
                </div>
              </div>
              <span>→</span>
            </button>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Today's Actions */}
            <TodayActionsCard
              tasks={tasks}
              onToggleTask={onToggleTask}
              onViewAll={() => onNavigate(AppView.ACTION_PLAN)}
            />

            {/* Habit Streaks */}
            <HabitStreakBar
              habits={habits}
              onToggleHabit={onToggleHabit}
              onViewAll={() => onNavigate(AppView.HABITS)}
            />
          </div>
        </div>

        {/* Print Center - Prominent CTA for physical products */}
        <PrintCenterCard
          hasPrimaryVision={!!primaryVisionUrl}
          onClick={() => onNavigate(AppView.PRINT_PRODUCTS)}
        />

        {/* More Tools */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">More Tools</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onNavigate(AppView.WEEKLY_REVIEWS)}
                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                📊 Weekly Review
              </button>
              <button
                onClick={() => onNavigate(AppView.KNOWLEDGE_BASE)}
                className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                📚 Knowledge Base
              </button>
              <button
                onClick={() => onNavigate(AppView.GALLERY)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                🖼️ Gallery
              </button>
              <button
                onClick={() => onNavigate(AppView.PARTNER)}
                className="px-4 py-2 text-sm font-medium text-pink-700 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
              >
                💑 Partner
              </button>
              <button
                onClick={() => onNavigate(AppView.LIVE_VOICE_COACH)}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
              >
                🎙️ Live Voice
              </button>
              <button
                onClick={() => onNavigate(AppView.SETTINGS)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                ⚙️ Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
