import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface FeedbackSummary {
  total_feedback: number;
  thumbs_up: number;
  thumbs_down: number;
  edited: number;
  average_rating: number;
  feedback_by_action_type: Record<string, {
    count: number;
    avg_rating: number;
    thumbs_up: number;
    thumbs_down: number;
  }>;
  recent_feedback: FeedbackItem[];
  daily_trends: DailyTrend[];
}

interface FeedbackItem {
  id: string;
  created_at: string;
  feedback_type: string;
  rating: number;
  comment?: string;
  action_type?: string;
  user_email?: string;
}

interface DailyTrend {
  date: string;
  count: number;
  avg_rating: number;
  thumbs_up: number;
  thumbs_down: number;
}

interface AgentFeedbackAnalyticsProps {
  dateRange?: {
    start: Date;
    end: Date;
  };
}

const AgentFeedbackAnalytics: React.FC<AgentFeedbackAnalyticsProps> = ({
  dateRange
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [selectedActionType, setSelectedActionType] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    fetchFeedbackData();
  }, [dateRange, timeFilter]);

  const getDateFilter = () => {
    const now = new Date();
    switch (timeFilter) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case 'all':
        return null;
    }
  };

  const fetchFeedbackData = async () => {
    setLoading(true);
    setError(null);

    try {
      const dateFilter = getDateFilter();

      // Fetch all feedback with action details
      let query = supabase
        .from('agent_action_feedback')
        .select(`
          id,
          created_at,
          feedback_type,
          rating,
          comment,
          action_id
        `)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: feedbackData, error: feedbackError } = await query;

      if (feedbackError) throw feedbackError;

      // Get action types from pending_agent_actions for context
      const actionIds = [...new Set(feedbackData?.map(f => f.action_id) || [])];

      let actionsMap: Record<string, string> = {};
      if (actionIds.length > 0) {
        const { data: actionsData } = await supabase
          .from('pending_agent_actions')
          .select('id, action_type')
          .in('id', actionIds);

        actionsMap = (actionsData || []).reduce((acc, a) => {
          acc[a.id] = a.action_type;
          return acc;
        }, {} as Record<string, string>);
      }

      // Process feedback data
      const enrichedFeedback = (feedbackData || []).map(f => ({
        ...f,
        action_type: actionsMap[f.action_id] || 'unknown'
      }));

      // Calculate summary statistics
      const thumbsUp = enrichedFeedback.filter(f => f.feedback_type === 'thumbs_up').length;
      const thumbsDown = enrichedFeedback.filter(f => f.feedback_type === 'thumbs_down').length;
      const edited = enrichedFeedback.filter(f => f.feedback_type === 'edited').length;

      const ratings = enrichedFeedback.filter(f => f.rating).map(f => f.rating);
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

      // Group by action type
      const byActionType: Record<string, { count: number; total_rating: number; thumbs_up: number; thumbs_down: number }> = {};
      enrichedFeedback.forEach(f => {
        const type = f.action_type || 'unknown';
        if (!byActionType[type]) {
          byActionType[type] = { count: 0, total_rating: 0, thumbs_up: 0, thumbs_down: 0 };
        }
        byActionType[type].count++;
        if (f.rating) byActionType[type].total_rating += f.rating;
        if (f.feedback_type === 'thumbs_up') byActionType[type].thumbs_up++;
        if (f.feedback_type === 'thumbs_down') byActionType[type].thumbs_down++;
      });

      const feedbackByActionType = Object.entries(byActionType).reduce((acc, [type, data]) => {
        acc[type] = {
          count: data.count,
          avg_rating: data.count > 0 ? data.total_rating / data.count : 0,
          thumbs_up: data.thumbs_up,
          thumbs_down: data.thumbs_down
        };
        return acc;
      }, {} as Record<string, { count: number; avg_rating: number; thumbs_up: number; thumbs_down: number }>);

      // Calculate daily trends
      const dailyMap: Record<string, { count: number; total_rating: number; thumbs_up: number; thumbs_down: number }> = {};
      enrichedFeedback.forEach(f => {
        const date = f.created_at.split('T')[0];
        if (!dailyMap[date]) {
          dailyMap[date] = { count: 0, total_rating: 0, thumbs_up: 0, thumbs_down: 0 };
        }
        dailyMap[date].count++;
        if (f.rating) dailyMap[date].total_rating += f.rating;
        if (f.feedback_type === 'thumbs_up') dailyMap[date].thumbs_up++;
        if (f.feedback_type === 'thumbs_down') dailyMap[date].thumbs_down++;
      });

      const dailyTrends = Object.entries(dailyMap)
        .map(([date, data]) => ({
          date,
          count: data.count,
          avg_rating: data.count > 0 ? data.total_rating / data.count : 0,
          thumbs_up: data.thumbs_up,
          thumbs_down: data.thumbs_down
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setSummary({
        total_feedback: enrichedFeedback.length,
        thumbs_up: thumbsUp,
        thumbs_down: thumbsDown,
        edited,
        average_rating: avgRating,
        feedback_by_action_type: feedbackByActionType,
        recent_feedback: enrichedFeedback.slice(0, 20),
        daily_trends: dailyTrends.slice(-30)
      });

    } catch (err: any) {
      console.error('Error fetching feedback:', err);
      setError(err.message || 'Failed to load feedback data');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (rating: number) => {
    if (rating >= 4) return 'text-green-400';
    if (rating >= 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getApprovalRate = () => {
    if (!summary || summary.total_feedback === 0) return 0;
    return Math.round((summary.thumbs_up / summary.total_feedback) * 100);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 border border-red-500/50 rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-400">
          <span className="text-2xl">!</span>
          <div>
            <p className="font-medium">Error Loading Analytics</p>
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span>Agent Feedback Analytics</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            User feedback on AI agent actions
          </p>
        </div>

        {/* Time Filter */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimeFilter(period)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                timeFilter === period
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {period === 'all' ? 'All Time' : period.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Total Feedback</p>
          <p className="text-2xl font-bold text-white mt-1">
            {summary?.total_feedback || 0}
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Approval Rate</p>
          <p className={`text-2xl font-bold mt-1 ${
            getApprovalRate() >= 70 ? 'text-green-400' :
            getApprovalRate() >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {getApprovalRate()}%
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {summary?.thumbs_up || 0} positive / {summary?.thumbs_down || 0} negative
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Average Rating</p>
          <p className={`text-2xl font-bold mt-1 ${getSentimentColor(summary?.average_rating || 0)}`}>
            {(summary?.average_rating || 0).toFixed(1)}/5
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">User Edits</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {summary?.edited || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Actions modified by users
          </p>
        </div>
      </div>

      {/* Feedback by Action Type */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-medium text-white mb-4">Feedback by Action Type</h3>

        <div className="space-y-3">
          {Object.entries(summary?.feedback_by_action_type || {})
            .sort((a, b) => b[1].count - a[1].count)
            .map(([actionType, data]) => {
              const approvalRate = data.count > 0
                ? Math.round((data.thumbs_up / data.count) * 100)
                : 0;

              return (
                <div
                  key={actionType}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedActionType === actionType
                      ? 'bg-slate-700 border-amber-500/50'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedActionType(
                    selectedActionType === actionType ? null : actionType
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium capitalize">
                        {actionType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-slate-400">
                        {data.count} feedback{data.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-medium ${
                          approvalRate >= 70 ? 'text-green-400' :
                          approvalRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {approvalRate}% approval
                        </p>
                        <p className="text-sm text-slate-500">
                          {data.thumbs_up} / {data.thumbs_down}
                        </p>
                      </div>
                      <div className="w-16 bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-full rounded-full ${
                            approvalRate >= 70 ? 'bg-green-500' :
                            approvalRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${approvalRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-medium text-white mb-4">Daily Feedback Trends</h3>

        {(summary?.daily_trends?.length || 0) > 0 ? (
          <div className="h-48 flex items-end gap-1">
            {summary?.daily_trends.map((day, idx) => {
              const maxCount = Math.max(...(summary?.daily_trends.map(d => d.count) || [1]));
              const height = (day.count / maxCount) * 100;
              const approvalRate = day.count > 0
                ? (day.thumbs_up / day.count) * 100
                : 50;

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center group"
                  title={`${day.date}: ${day.count} feedback(s), ${Math.round(approvalRate)}% positive`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      approvalRate >= 70 ? 'bg-green-500/70 hover:bg-green-500' :
                      approvalRate >= 50 ? 'bg-yellow-500/70 hover:bg-yellow-500' :
                      'bg-red-500/70 hover:bg-red-500'
                    }`}
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  {idx % 5 === 0 && (
                    <p className="text-xs text-slate-500 mt-1 transform -rotate-45 origin-top-left">
                      {day.date.split('-').slice(1).join('/')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500">
            No trend data available
          </div>
        )}
      </div>

      {/* Recent Feedback */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-medium text-white mb-4">Recent Feedback</h3>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {(summary?.recent_feedback || []).map((feedback) => (
            <div
              key={feedback.id}
              className="p-3 bg-slate-900 rounded-lg border border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {feedback.feedback_type === 'thumbs_up' && (
                    <span className="text-green-400" title="Positive">+</span>
                  )}
                  {feedback.feedback_type === 'thumbs_down' && (
                    <span className="text-red-400" title="Negative">-</span>
                  )}
                  {feedback.feedback_type === 'edited' && (
                    <span className="text-amber-400" title="Edited">~</span>
                  )}
                  <span className="text-white font-medium capitalize">
                    {(feedback.action_type || 'unknown').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {feedback.rating && (
                    <span className={`text-sm ${getSentimentColor(feedback.rating)}`}>
                      {feedback.rating}/5
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {new Date(feedback.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {feedback.comment && (
                <p className="text-sm text-slate-400 mt-2 italic">
                  "{feedback.comment}"
                </p>
              )}
            </div>
          ))}

          {(summary?.recent_feedback?.length || 0) === 0 && (
            <p className="text-slate-500 text-center py-8">
              No feedback yet
            </p>
          )}
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const data = JSON.stringify(summary, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `feedback-analytics-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Data
        </button>
      </div>
    </div>
  );
};

export default AgentFeedbackAnalytics;
