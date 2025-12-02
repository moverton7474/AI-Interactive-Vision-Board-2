import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrophyIcon,
  FireIcon,
  ChartBarIcon,
  RefreshIcon,
  StarIcon,
  XMarkIcon
} from './Icons';

interface Props {
  onBack?: () => void;
}

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  role: string;
  current_streak: number;
  total_completions: number;
  weekly_completions: number;
  rank: number;
  trend: 'up' | 'down' | 'same';
  badges: string[];
}

interface Team {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  total_habits: number;
  avg_completion_rate: number;
  top_streak: number;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  avatar_url?: string;
  score: number;
  streak: number;
  completions_this_week: number;
  trend: 'up' | 'down' | 'same';
}

/**
 * TeamLeaderboards - Gamified team competition for habit streaks
 *
 * Displays team rankings, individual leaderboards, and achievement badges
 * to encourage healthy competition and accountability.
 */
const TeamLeaderboards: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'teams' | 'achievements'>('leaderboard');
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');

  // Data states
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [timeframe]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view leaderboards');
        setLoading(false);
        return;
      }

      // Fetch leaderboard data
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('team_leaderboards')
        .select('*')
        .eq('period_type', timeframe === 'all' ? 'all_time' : timeframe === 'month' ? 'monthly' : 'weekly')
        .order('rank', { ascending: true })
        .limit(50);

      if (leaderboardError) throw leaderboardError;

      // Transform leaderboard data
      const transformedLeaderboard: LeaderboardEntry[] = (leaderboardData || []).map((entry: any) => ({
        rank: entry.rank,
        user_id: entry.user_id,
        name: entry.user_name || 'Anonymous',
        avatar_url: entry.avatar_url,
        score: entry.total_score || 0,
        streak: entry.longest_streak || 0,
        completions_this_week: entry.completions_count || 0,
        trend: entry.rank_change > 0 ? 'up' : entry.rank_change < 0 ? 'down' : 'same'
      }));

      setLeaderboard(transformedLeaderboard);

      // Find user's rank
      const userEntry = transformedLeaderboard.find(e => e.user_id === user.id);
      setUserRank(userEntry?.rank || null);

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          team_members(count)
        `)
        .eq('is_active', true)
        .limit(20);

      if (teamsError) throw teamsError;

      const transformedTeams: Team[] = (teamsData || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        member_count: team.team_members?.[0]?.count || 0,
        total_habits: 0,
        avg_completion_rate: 0,
        top_streak: 0
      }));

      setTeams(transformedTeams);

      // Check if user is in a team
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single();

      if (memberData) {
        const userTeamData = transformedTeams.find(t => t.id === memberData.team_id);
        setUserTeam(userTeamData || null);
      }

      // Set sample achievements based on user activity
      setAchievements([
        'first_habit',
        'week_streak',
        'early_bird'
      ]);

    } catch (err) {
      console.error('Error loading leaderboard data:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'same') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↑</span>;
      case 'down':
        return <span className="text-red-500">↓</span>;
      default:
        return <span className="text-gray-400">—</span>;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
      case 3:
        return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const achievementsList = [
    { id: 'first_habit', name: 'First Step', description: 'Complete your first habit', icon: '🎯', earned: achievements.includes('first_habit') },
    { id: 'week_streak', name: '7-Day Warrior', description: 'Maintain a 7-day streak', icon: '🔥', earned: achievements.includes('week_streak') },
    { id: 'month_streak', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '💪', earned: achievements.includes('month_streak') },
    { id: 'early_bird', name: 'Early Bird', description: 'Complete habits before 8 AM', icon: '🌅', earned: achievements.includes('early_bird') },
    { id: 'team_player', name: 'Team Player', description: 'Join a team', icon: '🤝', earned: achievements.includes('team_player') },
    { id: 'leader', name: 'Leader of the Pack', description: 'Reach #1 on the leaderboard', icon: '👑', earned: achievements.includes('leader') },
    { id: 'perfect_week', name: 'Perfect Week', description: '100% completion for a week', icon: '⭐', earned: achievements.includes('perfect_week') },
    { id: 'centurion', name: 'Centurion', description: 'Complete 100 habits', icon: '💯', earned: achievements.includes('centurion') },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-200">Loading leaderboards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <TrophyIcon className="w-8 h-8 text-yellow-400" />
                Team Leaderboards
              </h1>
              <p className="text-purple-200 mt-1">Compete, achieve, and celebrate together</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Refresh"
          >
            <RefreshIcon className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        {/* User Stats Card */}
        {userRank && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Your Current Rank</p>
                <p className="text-4xl font-bold text-white">#{userRank}</p>
              </div>
              <div className="text-right">
                <p className="text-purple-200 text-sm">Team</p>
                <p className="text-xl font-semibold text-white">{userTeam?.name || 'No Team'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'leaderboard', label: 'Leaderboard', icon: ChartBarIcon },
            { id: 'teams', label: 'Teams', icon: TrophyIcon },
            { id: 'achievements', label: 'Achievements', icon: StarIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-purple-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeframe Filter (for leaderboard) */}
        {activeTab === 'leaderboard' && (
          <div className="flex gap-2 mb-6">
            {[
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setTimeframe(period.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeframe === period.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20">
            <div className="p-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Top Performers</h2>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-purple-200">
                <TrophyIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No leaderboard data yet. Start completing habits to appear here!</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${
                      entry.rank <= 3 ? 'bg-white/5' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getRankStyle(entry.rank)}`}>
                      {getRankEmoji(entry.rank) || entry.rank}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-lg">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        entry.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <p className="font-semibold text-white">{entry.name}</p>
                      <div className="flex items-center gap-3 text-sm text-purple-200">
                        <span className="flex items-center gap-1">
                          <FireIcon className="w-4 h-4 text-orange-400" />
                          {entry.streak} day streak
                        </span>
                        <span>{entry.completions_this_week} this week</span>
                      </div>
                    </div>

                    {/* Score & Trend */}
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">{entry.score.toLocaleString()}</p>
                      <p className="text-sm text-purple-200 flex items-center justify-end gap-1">
                        {getTrendIcon(entry.trend)} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-4">
            {teams.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                <TrophyIcon className="w-12 h-12 mx-auto mb-4 text-purple-300 opacity-50" />
                <p className="text-purple-200 mb-4">No teams created yet.</p>
                <button className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors">
                  Create a Team
                </button>
              </div>
            ) : (
              teams.map((team, index) => (
                <div
                  key={team.id}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 ${
                    userTeam?.id === team.id ? 'ring-2 ring-purple-400' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${getRankStyle(index + 1)}`}>
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                          {team.name}
                          {userTeam?.id === team.id && (
                            <span className="text-xs bg-purple-500 px-2 py-1 rounded-full">Your Team</span>
                          )}
                        </h3>
                        <p className="text-purple-200 text-sm">{team.description || 'No description'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{team.member_count}</p>
                      <p className="text-sm text-purple-200">Members</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{team.avg_completion_rate}%</p>
                      <p className="text-sm text-purple-200">Completion</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white flex items-center justify-center gap-1">
                        <FireIcon className="w-5 h-5 text-orange-400" />
                        {team.top_streak}
                      </p>
                      <p className="text-sm text-purple-200">Top Streak</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {achievementsList.map((achievement) => (
              <div
                key={achievement.id}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border transition-all ${
                  achievement.earned
                    ? 'border-yellow-400/50 bg-yellow-400/10'
                    : 'border-white/20 opacity-60'
                }`}
              >
                <div className={`text-4xl mb-2 ${achievement.earned ? '' : 'grayscale'}`}>
                  {achievement.icon}
                </div>
                <h4 className="font-semibold text-white text-sm">{achievement.name}</h4>
                <p className="text-xs text-purple-200 mt-1">{achievement.description}</p>
                {achievement.earned && (
                  <div className="mt-2 text-xs text-yellow-400 font-medium">Earned!</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamLeaderboards;
