import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface AgentActivityDashboardProps {
  teamId: string;
  teamName: string;
}

interface TraceSummary {
  total_traces: number;
  llm_calls: number;
  tool_calls: number;
  errors: number;
  confirmations_requested: number;
  confirmations_approved: number;
  confirmations_rejected: number;
  avg_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface ActionStats {
  action_type: string;
  total: number;
  executed: number;
  cancelled: number;
  expired: number;
  failed: number;
  avg_confidence: number;
}

interface RecentTrace {
  id: string;
  trace_type: string;
  function_name: string;
  user_id: string;
  latency_ms: number;
  duration_ms: number;
  error: string | null;
  created_at: string;
  confidence_score: number | null;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface FeedbackSummary {
  feedback_type: string;
  count: number;
  avg_rating: number | null;
  rejection_reasons: Record<string, number>;
}

type TimeRange = '24h' | '7d' | '30d' | '90d';

const AgentActivityDashboard: React.FC<AgentActivityDashboardProps> = ({
  teamId,
  teamName
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [traceSummary, setTraceSummary] = useState<TraceSummary | null>(null);
  const [actionStats, setActionStats] = useState<ActionStats[]>([]);
  const [recentTraces, setRecentTraces] = useState<RecentTrace[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'traces' | 'feedback'>('overview');

  const getTimeRangeDate = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
  };

  const loadData = useCallback(async () => {
    if (!teamId || teamId === 'all') {
      setError('Please select a specific team');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDate = getTimeRangeDate(timeRange).toISOString();

      // Load trace summary
      const { data: traces, error: traceError } = await supabase
        .from('agent_execution_traces')
        .select('*')
        .eq('team_id', teamId)
        .gte('created_at', startDate);

      if (traceError) throw traceError;

      // Calculate summary from traces
      const summary: TraceSummary = {
        total_traces: traces?.length || 0,
        llm_calls: traces?.filter(t => t.trace_type === 'llm_call').length || 0,
        tool_calls: traces?.filter(t => t.trace_type === 'tool_call').length || 0,
        errors: traces?.filter(t => t.trace_type === 'error' || t.error).length || 0,
        confirmations_requested: traces?.filter(t => t.trace_type === 'confirmation_request').length || 0,
        confirmations_approved: traces?.filter(t => t.trace_type === 'user_response' && t.output_data?.response === 'confirmed').length || 0,
        confirmations_rejected: traces?.filter(t => t.trace_type === 'user_response' && t.output_data?.response === 'cancelled').length || 0,
        avg_latency_ms: traces?.length ? Math.round(traces.reduce((sum, t) => sum + (t.latency_ms || 0), 0) / traces.length) : 0,
        total_input_tokens: traces?.reduce((sum, t) => sum + (t.input_tokens || 0), 0) || 0,
        total_output_tokens: traces?.reduce((sum, t) => sum + (t.output_tokens || 0), 0) || 0,
      };
      setTraceSummary(summary);

      // Load action history stats
      const { data: actions, error: actionError } = await supabase
        .from('agent_action_history')
        .select('action_type, action_status, confidence_score')
        .eq('team_id', teamId)
        .gte('created_at', startDate);

      if (actionError) throw actionError;

      // Group by action type
      const actionMap = new Map<string, ActionStats>();
      actions?.forEach(action => {
        const existing = actionMap.get(action.action_type) || {
          action_type: action.action_type,
          total: 0,
          executed: 0,
          cancelled: 0,
          expired: 0,
          failed: 0,
          avg_confidence: 0,
          confidenceSum: 0,
          confidenceCount: 0
        };

        existing.total++;
        if (action.action_status === 'executed') existing.executed++;
        if (action.action_status === 'cancelled') existing.cancelled++;
        if (action.action_status === 'expired') existing.expired++;
        if (action.action_status === 'failed') existing.failed++;
        if (action.confidence_score) {
          (existing as any).confidenceSum += action.confidence_score;
          (existing as any).confidenceCount++;
        }

        actionMap.set(action.action_type, existing);
      });

      const stats = Array.from(actionMap.values()).map(s => ({
        ...s,
        avg_confidence: (s as any).confidenceCount > 0
          ? (s as any).confidenceSum / (s as any).confidenceCount
          : 0
      }));
      setActionStats(stats);

      // Load recent traces (without profile join due to FK constraints)
      const { data: recent, error: recentError } = await supabase
        .from('agent_execution_traces')
        .select(`
          id, trace_type, function_name, user_id, latency_ms, duration_ms,
          error, created_at, confidence_score
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentError) throw recentError;

      // Fetch user profiles separately if we have traces
      let tracesWithProfiles = recent || [];
      if (recent && recent.length > 0) {
        const userIds = [...new Set(recent.map(t => t.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        // Map profiles to traces
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        tracesWithProfiles = recent.map(trace => ({
          ...trace,
          profiles: profileMap.get(trace.user_id) || null
        }));
      }
      setRecentTraces(tracesWithProfiles);

      // Load feedback summary
      const { data: feedback, error: feedbackError } = await supabase
        .from('agent_action_feedback')
        .select('*')
        .eq('team_id', teamId)
        .gte('created_at', startDate);

      if (feedbackError) throw feedbackError;

      // Group feedback by type
      const feedbackMap = new Map<string, FeedbackSummary>();
      feedback?.forEach(f => {
        const existing = feedbackMap.get(f.feedback_type) || {
          feedback_type: f.feedback_type,
          count: 0,
          avg_rating: null,
          rejection_reasons: {},
          ratingSum: 0,
          ratingCount: 0
        };

        existing.count++;
        if (f.rating) {
          (existing as any).ratingSum += f.rating;
          (existing as any).ratingCount++;
        }
        if (f.rejection_reason) {
          existing.rejection_reasons[f.rejection_reason] =
            (existing.rejection_reasons[f.rejection_reason] || 0) + 1;
        }

        feedbackMap.set(f.feedback_type, existing);
      });

      const feedbackStats = Array.from(feedbackMap.values()).map(f => ({
        ...f,
        avg_rating: (f as any).ratingCount > 0
          ? (f as any).ratingSum / (f as any).ratingCount
          : null
      }));
      setFeedbackSummary(feedbackStats);

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [teamId, timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const getTraceTypeIcon = (type: string): string => {
    switch (type) {
      case 'llm_call': return '🧠';
      case 'tool_call': return '🔧';
      case 'tool_result': return '✅';
      case 'confirmation_request': return '❓';
      case 'user_response': return '👤';
      case 'action_executed': return '⚡';
      case 'action_cancelled': return '❌';
      case 'error': return '🚨';
      default: return '📊';
    }
  };

  const getTraceTypeColor = (type: string): string => {
    switch (type) {
      case 'llm_call': return 'text-purple-300 bg-purple-500/20';
      case 'tool_call': return 'text-blue-300 bg-blue-500/20';
      case 'tool_result': return 'text-green-300 bg-green-500/20';
      case 'confirmation_request': return 'text-yellow-300 bg-yellow-500/20';
      case 'user_response': return 'text-cyan-300 bg-cyan-500/20';
      case 'action_executed': return 'text-emerald-300 bg-emerald-500/20';
      case 'action_cancelled': return 'text-orange-300 bg-orange-500/20';
      case 'error': return 'text-red-300 bg-red-500/20';
      default: return 'text-gray-300 bg-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading dashboard...</p>
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
            <span className="text-2xl">📊</span>
            Agent Activity Dashboard
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            Observability and analytics for {teamName}'s AI agent actions
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
          {(['24h', '7d', '30d', '90d'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-indigo-500 text-white'
                  : 'text-indigo-200 hover:bg-white/10'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: '📈' },
          { id: 'traces', label: 'Execution Traces', icon: '🔍' },
          { id: 'feedback', label: 'Feedback Analytics', icon: '💬' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white/10 text-white border-b-2 border-indigo-400'
                : 'text-indigo-200 hover:bg-white/5'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && traceSummary && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xl">🧠</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{formatNumber(traceSummary.llm_calls)}</p>
                  <p className="text-xs text-indigo-200">LLM Calls</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xl">🔧</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{formatNumber(traceSummary.tool_calls)}</p>
                  <p className="text-xs text-indigo-200">Tool Calls</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{formatDuration(traceSummary.avg_latency_ms)}</p>
                  <p className="text-xs text-indigo-200">Avg Latency</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <span className="text-xl">🚨</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{traceSummary.errors}</p>
                  <p className="text-xs text-indigo-200">Errors</p>
                </div>
              </div>
            </div>
          </div>

          {/* Confirmation Flow Stats */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🔄</span> Confirmation Flow
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-3xl font-bold text-yellow-400">{traceSummary.confirmations_requested}</p>
                <p className="text-sm text-indigo-200">Requested</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-3xl font-bold text-green-400">{traceSummary.confirmations_approved}</p>
                <p className="text-sm text-indigo-200">Approved</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-3xl font-bold text-red-400">{traceSummary.confirmations_rejected}</p>
                <p className="text-sm text-indigo-200">Rejected</p>
              </div>
            </div>
            {traceSummary.confirmations_requested > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-indigo-200 mb-1">
                  <span>Approval Rate</span>
                  <span>
                    {Math.round((traceSummary.confirmations_approved / traceSummary.confirmations_requested) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400"
                    style={{
                      width: `${(traceSummary.confirmations_approved / traceSummary.confirmations_requested) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Token Usage */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🎯</span> Token Usage
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-200">Input Tokens</span>
                  <span className="text-xl font-bold text-cyan-400">{formatNumber(traceSummary.total_input_tokens)}</span>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-200">Output Tokens</span>
                  <span className="text-xl font-bold text-purple-400">{formatNumber(traceSummary.total_output_tokens)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Type Stats */}
          {actionStats.length > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⚡</span> Actions by Type
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-indigo-200 text-sm border-b border-white/10">
                      <th className="pb-3 font-medium">Action Type</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                      <th className="pb-3 font-medium text-right">Executed</th>
                      <th className="pb-3 font-medium text-right">Cancelled</th>
                      <th className="pb-3 font-medium text-right">Failed</th>
                      <th className="pb-3 font-medium text-right">Avg Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionStats.map(stat => (
                      <tr key={stat.action_type} className="border-b border-white/5">
                        <td className="py-3 text-white font-medium">
                          {stat.action_type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 text-right text-indigo-200">{stat.total}</td>
                        <td className="py-3 text-right text-green-400">{stat.executed}</td>
                        <td className="py-3 text-right text-orange-400">{stat.cancelled}</td>
                        <td className="py-3 text-right text-red-400">{stat.failed}</td>
                        <td className="py-3 text-right">
                          <span className={`font-mono ${
                            stat.avg_confidence >= 0.8 ? 'text-green-400' :
                            stat.avg_confidence >= 0.6 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {stat.avg_confidence ? `${Math.round(stat.avg_confidence * 100)}%` : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Traces Tab */}
      {activeTab === 'traces' && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>🔍</span> Recent Execution Traces
          </h3>

          {recentTraces.length === 0 ? (
            <div className="text-center py-8 text-indigo-200">
              No traces found for this time period
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {recentTraces.map(trace => (
                <div
                  key={trace.id}
                  className={`p-3 rounded-lg border ${
                    trace.error
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTraceTypeColor(trace.trace_type)}`}>
                        {getTraceTypeIcon(trace.trace_type)} {trace.trace_type.replace(/_/g, ' ')}
                      </span>
                      {trace.function_name && (
                        <span className="text-sm text-indigo-200 font-mono">
                          {trace.function_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {trace.confidence_score && (
                        <span className={`font-mono ${
                          trace.confidence_score >= 0.8 ? 'text-green-400' :
                          trace.confidence_score >= 0.6 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {Math.round(trace.confidence_score * 100)}%
                        </span>
                      )}
                      {(trace.latency_ms || trace.duration_ms) && (
                        <span className="text-indigo-300">
                          {formatDuration(trace.latency_ms || trace.duration_ms || 0)}
                        </span>
                      )}
                      <span className="text-indigo-400">
                        {new Date(trace.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  {trace.error && (
                    <div className="mt-2 text-sm text-red-300 font-mono bg-red-500/10 p-2 rounded">
                      {trace.error}
                    </div>
                  )}
                  {trace.profiles && (
                    <div className="mt-1 text-xs text-indigo-300">
                      User: {trace.profiles.full_name || trace.profiles.email}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          {/* Feedback Summary */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>💬</span> Feedback Summary
            </h3>

            {feedbackSummary.length === 0 ? (
              <div className="text-center py-8 text-indigo-200">
                No feedback collected for this time period
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {feedbackSummary.map(fb => (
                  <div key={fb.feedback_type} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium capitalize">
                        {fb.feedback_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-2xl font-bold text-indigo-300">{fb.count}</span>
                    </div>
                    {fb.avg_rating && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-indigo-200">Avg Rating:</span>
                        <div className="flex items-center">
                          {[1,2,3,4,5].map(star => (
                            <span
                              key={star}
                              className={star <= Math.round(fb.avg_rating!) ? 'text-yellow-400' : 'text-gray-500'}
                            >
                              ★
                            </span>
                          ))}
                          <span className="ml-2 text-sm text-indigo-300">
                            ({fb.avg_rating.toFixed(1)})
                          </span>
                        </div>
                      </div>
                    )}
                    {Object.keys(fb.rejection_reasons).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-indigo-200 mb-2">Rejection Reasons:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(fb.rejection_reasons).map(([reason, count]) => (
                            <span
                              key={reason}
                              className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-300 rounded-full"
                            >
                              {reason}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rejection Analysis */}
          {feedbackSummary.some(f => Object.keys(f.rejection_reasons).length > 0) && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📉</span> Rejection Analysis
              </h3>
              <p className="text-sm text-indigo-200 mb-4">
                Understanding why users reject agent actions helps improve AI suggestions.
              </p>

              <div className="space-y-3">
                {feedbackSummary
                  .flatMap(f => Object.entries(f.rejection_reasons))
                  .reduce((acc, [reason, count]) => {
                    const existing = acc.find(a => a.reason === reason);
                    if (existing) existing.count += count;
                    else acc.push({ reason, count });
                    return acc;
                  }, [] as { reason: string; count: number }[])
                  .sort((a, b) => b.count - a.count)
                  .map(({ reason, count }) => {
                    const total = feedbackSummary.reduce((sum, f) =>
                      sum + Object.values(f.rejection_reasons).reduce((s, c) => s + c, 0), 0);
                    const percentage = (count / total) * 100;

                    return (
                      <div key={reason}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white capitalize">{reason.replace(/_/g, ' ')}</span>
                          <span className="text-indigo-300">{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={loadData}
          disabled={loading}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-indigo-200 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default AgentActivityDashboard;
