import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserAchievement, BADGE_DEFINITIONS } from '../../types';

interface Props {
  userId: string;
  compact?: boolean; // For smaller dashboard widget view
}

interface BadgeDisplay {
  key: string;
  name: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  earnedAt?: string;
  value?: number;
}

/**
 * AchievementGallery - Displays user's earned badges and achievements
 *
 * Features:
 * - Grid of all available badges
 * - Unlocked badges shown in full color
 * - Locked badges shown grayed out
 * - Click to see achievement details
 * - Compact mode for dashboard widget
 */
const AchievementGallery: React.FC<Props> = ({ userId, compact = false }) => {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDisplay | null>(null);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', userId)
          .order('earned_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching achievements:', fetchError);
          setError('Could not load achievements');
          return;
        }

        setAchievements(data || []);
      } catch (err) {
        console.error('Achievement fetch error:', err);
        setError('Failed to load achievements');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchAchievements();
    }
  }, [userId]);

  // Build badge display list (all badges with unlock status)
  const badges: BadgeDisplay[] = Object.entries(BADGE_DEFINITIONS).map(([key, def]) => {
    const earned = achievements.find(
      a => a.achievement_key === key || a.achievement_type === key
    );
    return {
      key,
      name: def.name,
      description: def.description,
      icon: def.icon,
      isUnlocked: !!earned,
      earnedAt: earned?.earned_at,
      value: earned?.value
    };
  });

  // Stats
  const unlockedCount = badges.filter(b => b.isUnlocked).length;
  const totalCount = badges.length;
  const recentAchievements = achievements.slice(0, 3);

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">Loading Achievements...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">🏆</span>
          </div>
          <h3 className="font-semibold text-gray-900">Achievements</h3>
        </div>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  // Compact mode - show only recent achievements
  if (compact) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🏆</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Achievements</h3>
                <p className="text-xs text-gray-500">{unlockedCount} of {totalCount} unlocked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Badges */}
        <div className="p-4">
          {recentAchievements.length > 0 ? (
            <div className="space-y-3">
              {recentAchievements.map((achievement) => {
                const badgeDef = BADGE_DEFINITIONS[achievement.achievement_key];
                if (!badgeDef) return null;
                return (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg"
                  >
                    <span className="text-2xl">{badgeDef.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {badgeDef.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(achievement.earned_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-2">No achievements yet</p>
              <p className="text-gray-400 text-xs">
                Complete habits and goals to earn badges
              </p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-medium text-purple-600">
              {Math.round((unlockedCount / totalCount) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
          <p className="text-xs text-center text-gray-500">
            {totalCount - unlockedCount} badges remaining
          </p>
        </div>
      </div>
    );
  }

  // Full mode - show all badges in grid
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Achievement Gallery</h2>
              <p className="text-sm text-gray-500">
                {unlockedCount} of {totalCount} badges unlocked
              </p>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-purple-600">
                {Math.round((unlockedCount / totalCount) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Badge Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <button
              key={badge.key}
              onClick={() => setSelectedBadge(badge)}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                badge.isUnlocked
                  ? 'bg-white border-purple-200 hover:border-purple-400 hover:shadow-md'
                  : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Badge Icon */}
              <div className="text-center">
                <span
                  className={`text-4xl block mb-2 ${
                    badge.isUnlocked ? '' : 'grayscale'
                  }`}
                >
                  {badge.icon}
                </span>
                <p className={`text-sm font-medium ${
                  badge.isUnlocked ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {badge.name}
                </p>
                {badge.isUnlocked && badge.earnedAt && (
                  <p className="text-xs text-purple-600 mt-1">
                    {formatDate(badge.earnedAt)}
                  </p>
                )}
                {!badge.isUnlocked && (
                  <p className="text-xs text-gray-400 mt-1">Locked</p>
                )}
              </div>

              {/* Unlocked indicator */}
              {badge.isUnlocked && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl">
            <div className="p-6 text-center">
              <span className={`text-6xl block mb-4 ${!selectedBadge.isUnlocked ? 'grayscale' : ''}`}>
                {selectedBadge.icon}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {selectedBadge.name}
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedBadge.description}
              </p>

              {selectedBadge.isUnlocked ? (
                <div className="bg-green-50 rounded-lg p-3 mb-4">
                  <p className="text-green-700 text-sm font-medium">
                    🎉 Unlocked on {formatDate(selectedBadge.earnedAt!)}
                  </p>
                  {selectedBadge.value && (
                    <p className="text-green-600 text-xs mt-1">
                      Value: {selectedBadge.value}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-gray-500 text-sm">
                    🔒 Not yet unlocked
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Keep working towards your goals!
                  </p>
                </div>
              )}

              <button
                onClick={() => setSelectedBadge(null)}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementGallery;
