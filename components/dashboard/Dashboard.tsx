import React, { useState, useEffect } from 'react';
import { AppView, ActionTask } from '../../types';
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
}

const Dashboard: React.FC<Props> = ({
  userName,
  themeName,
  motivationStyle,
  themeInsight,
  todayFocus,
  primaryVisionUrl,
  primaryVisionTitle,
  tasks,
  habits,
  financialTarget,
  financialCurrent,
  financialTargetLabel,
  onNavigate,
  onToggleTask,
  onToggleHabit,
  isLoadingFocus,
  onPlayBriefing
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Greeting Card */}
        <DashboardGreetingCard
          userName={userName}
          themeName={themeName}
          motivationStyle={motivationStyle}
          themeInsight={themeInsight}
          onPlayBriefing={onPlayBriefing}
        />

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

        {/* Talk to Coach CTA */}
        <TalkToCoachButton
          themeName={themeName || 'Your Coach'}
          onClick={() => onNavigate(AppView.VOICE_COACH)}
        />

        {/* Print Center */}
        <PrintCenterCard
          hasPrimaryVision={!!primaryVisionUrl}
          onClick={() => onNavigate(AppView.PRINT_PRODUCTS)}
        />

        {/* Quick Actions Footer */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">Quick Actions</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onNavigate(AppView.VISION_BOARD)}
                className="px-4 py-2 text-sm font-medium text-navy-700 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
              >
                ✨ Create Vision
              </button>
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
                onClick={() => onNavigate(AppView.PARTNER)}
                className="px-4 py-2 text-sm font-medium text-pink-700 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
              >
                💑 Partner Workspace
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
