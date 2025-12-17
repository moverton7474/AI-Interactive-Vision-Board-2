import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface VoiceCoachAnalyticsProps {
  teamId: string;
  teamName: string;
  isPlatformAdmin?: boolean;
}

interface VoiceStats {
  total_sessions: number;
  unique_users: number;
  avg_duration_minutes: number;
  avg_sentiment: number;
  sessions_this_week: number;
  total_minutes: number;
}

interface MemberStats {
  user_id: string;
  email: string;
  display_name: string;
  session_count: number;
  total_minutes: number;
  avg_sentiment: number;
  last_session: string | null;
  favorite_session_type: string | null;
}

interface SessionTypeData {
  session_type: string;
  count: number;
  percentage: number;
}

interface TrendData {
  date: string;
  sessions: number;
  avg_sentiment: number;
  unique_users: number;
}

const VoiceCoachAnalytics: React.FC<VoiceCoachAnalyticsProps> = ({
  teamId,
  teamName,
  isPlatformAdmin = false
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Stats
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionTypeData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [teamId, dateRange]);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const loadAnalytics = async () => {
    if (!teamId || teamId === 'all') {
      setError('Please select a specific team to view analytics');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Please sign in to view analytics');
        return;
      }

      // Call the analytics function
      const response = await supabase.functions.invoke('admin-get-voice-coach-stats', {
        body: {
          team_id: teamId,
          start_date: start,
          end_date: end
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load analytics');
      }

      const data = response.data;
      setStats(data.summary);
      setMemberStats(data.by_member || []);
      setSessionTypes(data.by_session_type || []);
      setTrendData(data.trend_data || []);

    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.7) return 'text-green-400';
    if (sentiment >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment >= 0.7) return 'Positive';
    if (sentiment >= 0.4) return 'Neutral';
    return 'Needs Attention';
  };

  const formatSessionType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'morning_routine': return '🌅';
      case 'check_in': return '💬';
      case 'goal_setting': return '🎯';
      case 'reflection': return '🪞';
      case 'celebration': return '🎉';
      case 'accountability': return '✅';
      case 'crisis_support': return '🆘';
      default: return '🎙️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
        <p className="text-red-200">{error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🎙️</span>
            Voice Coach Analytics
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            Team engagement with AI coaching sessions
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.total_sessions || 0}</p>
          <p className="text-indigo-200 text-sm">Total Sessions</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.unique_users || 0}</p>
          <p className="text-indigo-200 text-sm">Active Users</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">
            {Math.round(stats?.avg_duration_minutes || 0)}
            <span className="text-lg font-normal text-indigo-300">min</span>
          </p>
          <p className="text-indigo-200 text-sm">Avg Duration</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${
              (stats?.avg_sentiment || 0.5) >= 0.7 ? 'bg-green-500/20' :
              (stats?.avg_sentiment || 0.5) >= 0.4 ? 'bg-yellow-500/20' : 'bg-red-500/20'
            }`}>
              <svg className={`w-6 h-6 ${getSentimentColor(stats?.avg_sentiment || 0.5)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className={`text-3xl font-bold ${getSentimentColor(stats?.avg_sentiment || 0.5)}`}>
            {Math.round((stats?.avg_sentiment || 0.5) * 100)}%
          </p>
          <p className="text-indigo-200 text-sm">
            {getSentimentLabel(stats?.avg_sentiment || 0.5)}
          </p>
        </div>
      </div>

      {/* Sessions This Week Badge */}
      {stats && stats.sessions_this_week > 0 && (
        <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/30 rounded-full">
            <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              {stats.sessions_this_week} sessions this week
            </p>
            <p className="text-indigo-200 text-sm">
              {Math.round(stats.total_minutes)} total minutes of coaching
            </p>
          </div>
        </div>
      )}

      {/* Session Type Distribution */}
      {sessionTypes.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Session Types</h3>
          <div className="space-y-3">
            {sessionTypes.map((type) => (
              <div key={type.session_type} className="flex items-center gap-4">
                <span className="text-2xl">{getSessionTypeIcon(type.session_type)}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">
                      {formatSessionType(type.session_type)}
                    </span>
                    <span className="text-indigo-200 text-sm">
                      {type.count} ({type.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${type.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member Stats Table */}
      {memberStats.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Member Engagement</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-indigo-200 font-medium">Member</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Sessions</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Total Time</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Sentiment</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Favorite Type</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Last Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {memberStats.map((member) => (
                  <tr key={member.user_id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {member.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{member.display_name}</p>
                          <p className="text-sm text-indigo-200">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium text-white">{member.session_count}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-white">{Math.round(member.total_minutes)} min</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-medium ${getSentimentColor(member.avg_sentiment)}`}>
                        {Math.round(member.avg_sentiment * 100)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {member.favorite_session_type ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-sm text-white">
                          {getSessionTypeIcon(member.favorite_session_type)}
                          {formatSessionType(member.favorite_session_type)}
                        </span>
                      ) : (
                        <span className="text-indigo-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {member.last_session ? (
                        <span className="text-indigo-200 text-sm">
                          {new Date(member.last_session).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-indigo-300">Never</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {memberStats.length === 0 && !loading && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 border border-white/20 text-center">
          <div className="text-6xl mb-4">🎙️</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Voice Coach Sessions Yet</h3>
          <p className="text-indigo-200 max-w-md mx-auto">
            Team members haven't used the Voice Coach feature during this time period.
            Encourage them to try it for personalized AI coaching!
          </p>
        </div>
      )}

      {/* Trend Chart Placeholder */}
      {trendData.length > 5 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Session Trend</h3>
          <div className="h-48 flex items-end gap-1">
            {trendData.slice(-30).map((day, i) => (
              <div
                key={day.date}
                className="flex-1 bg-indigo-500/50 hover:bg-indigo-500 rounded-t transition-colors"
                style={{
                  height: `${Math.max((day.sessions / Math.max(...trendData.map(d => d.sessions))) * 100, 5)}%`,
                  minHeight: day.sessions > 0 ? '10%' : '2%'
                }}
                title={`${day.date}: ${day.sessions} sessions`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-indigo-300">
            <span>{trendData[0]?.date}</span>
            <span>{trendData[trendData.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceCoachAnalytics;
