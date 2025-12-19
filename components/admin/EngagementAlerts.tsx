import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface EngagementAlertsProps {
  teamId: string;
  teamName: string;
  isPlatformAdmin?: boolean;
}

interface Alert {
  id: string;
  team_id: string;
  user_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  metadata: any;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  action_taken: string | null;
  created_at: string;
  // Joined data
  user_email?: string;
  user_name?: string;
}

const EngagementAlerts: React.FC<EngagementAlertsProps> = ({
  teamId,
  teamName,
  isPlatformAdmin = false
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [teamId, filter, typeFilter]);

  const loadAlerts = async () => {
    if (!teamId || teamId === 'all') {
      setError('Please select a specific team to view alerts');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('engagement_alerts')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('alert_type', typeFilter);
      }

      const { data, error: fetchError } = await query.limit(100);

      if (fetchError) throw fetchError;

      // Fetch profiles separately to avoid FK ambiguity
      const userIds = (data || []).map((a: any) => a.user_id).filter(Boolean);
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);
        emailMap = (profilesData || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.email || '';
          return acc;
        }, {});
      }

      const alertsWithNames = (data || []).map((alert: any) => ({
        ...alert,
        user_email: emailMap[alert.user_id] || '',
        user_name: emailMap[alert.user_id]?.split('@')[0] || 'User'
      }));

      setAlerts(alertsWithNames);
    } catch (err: any) {
      console.error('Error loading alerts:', err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const updateAlertStatus = async (alertId: string, newStatus: string, note?: string) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: any = {
        status: newStatus
      };

      if (newStatus === 'acknowledged') {
        updates.acknowledged_by = user.id;
        updates.acknowledged_at = new Date().toISOString();
      }

      if (newStatus === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      if (note) {
        updates.action_taken = note;
      }

      const { error: updateError } = await supabase
        .from('engagement_alerts')
        .update(updates)
        .eq('id', alertId);

      if (updateError) throw updateError;

      // Refresh alerts
      await loadAlerts();
      setSelectedAlert(null);
      setActionNote('');
    } catch (err: any) {
      console.error('Error updating alert:', err);
      setError(err.message || 'Failed to update alert');
    } finally {
      setProcessing(false);
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'inactive': return '😴';
      case 'low_sentiment': return '😟';
      case 'broken_streak': return '💔';
      case 'crisis_detected': return '🆘';
      case 'milestone': return '🎉';
      default: return '⚠️';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'inactive': return 'Inactive Member';
      case 'low_sentiment': return 'Low Sentiment';
      case 'broken_streak': return 'Broken Streak';
      case 'crisis_detected': return 'Crisis Detected';
      case 'milestone': return 'Milestone';
      default: return type;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-blue-500/20 text-blue-300',
      medium: 'bg-yellow-500/20 text-yellow-300',
      high: 'bg-orange-500/20 text-orange-300',
      critical: 'bg-red-500/20 text-red-300'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[severity] || colors.medium}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-red-500/20 text-red-300',
      acknowledged: 'bg-yellow-500/20 text-yellow-300',
      resolved: 'bg-green-500/20 text-green-300',
      dismissed: 'bg-gray-500/20 text-gray-300'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status] || colors.active}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const criticalCount = alerts.filter(a => a.status === 'active' && a.severity === 'critical').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading alerts...</p>
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
            <span className="text-2xl">🔔</span>
            Engagement Alerts
            {activeCount > 0 && (
              <span className="px-2 py-1 text-sm bg-red-500/20 text-red-300 rounded-full">
                {activeCount} active
              </span>
            )}
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            Proactive notifications about team member engagement
          </p>
        </div>
        <button
          onClick={loadAlerts}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-red-500/30 rounded-full">
            <span className="text-2xl">🚨</span>
          </div>
          <div>
            <p className="font-semibold text-white">
              {criticalCount} Critical Alert{criticalCount > 1 ? 's' : ''} Require Attention
            </p>
            <p className="text-red-200 text-sm">
              Please review and take action on these alerts immediately.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all" className="bg-purple-900">All Types</option>
          <option value="inactive" className="bg-purple-900">Inactive</option>
          <option value="low_sentiment" className="bg-purple-900">Low Sentiment</option>
          <option value="broken_streak" className="bg-purple-900">Broken Streak</option>
          <option value="crisis_detected" className="bg-purple-900">Crisis Detected</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Alerts List */}
      {alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 border transition-colors cursor-pointer ${
                alert.severity === 'critical'
                  ? 'border-red-500/50 hover:border-red-500'
                  : alert.severity === 'high'
                  ? 'border-orange-500/30 hover:border-orange-500/50'
                  : 'border-white/20 hover:border-white/40'
              }`}
              onClick={() => setSelectedAlert(alert)}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getAlertTypeIcon(alert.alert_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{alert.title}</p>
                    {getSeverityBadge(alert.severity)}
                    {getStatusBadge(alert.status)}
                  </div>
                  <p className="text-indigo-200 text-sm mt-1">
                    {alert.user_name} ({alert.user_email})
                  </p>
                  {alert.description && (
                    <p className="text-indigo-300 text-sm mt-2">{alert.description}</p>
                  )}
                  <p className="text-indigo-400 text-xs mt-2">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {alert.status === 'active' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAlertStatus(alert.id, 'acknowledged');
                        }}
                        className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-sm transition-colors"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAlertStatus(alert.id, 'dismissed');
                        }}
                        className="px-3 py-1 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlert(alert);
                      }}
                      className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 border border-white/20 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Alerts</h3>
          <p className="text-indigo-200 max-w-md mx-auto">
            {filter === 'active'
              ? 'No active alerts! Your team is doing great.'
              : `No ${filter} alerts found for this time period.`}
          </p>
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-purple-900 rounded-xl p-6 max-w-lg w-full border border-white/20 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <span>{getAlertTypeIcon(selectedAlert.alert_type)}</span>
                {getAlertTypeLabel(selectedAlert.alert_type)}
              </h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-indigo-200">Team Member</p>
                <p className="text-white font-medium">{selectedAlert.user_name}</p>
                <p className="text-indigo-300 text-sm">{selectedAlert.user_email}</p>
              </div>

              <div>
                <p className="text-sm text-indigo-200">Alert</p>
                <p className="text-white">{selectedAlert.title}</p>
                {selectedAlert.description && (
                  <p className="text-indigo-300 text-sm mt-1">{selectedAlert.description}</p>
                )}
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-indigo-200">Severity</p>
                  {getSeverityBadge(selectedAlert.severity)}
                </div>
                <div>
                  <p className="text-sm text-indigo-200">Status</p>
                  {getStatusBadge(selectedAlert.status)}
                </div>
              </div>

              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-indigo-200 mb-2">Details</p>
                  <div className="bg-white/5 rounded-lg p-3 space-y-1">
                    {Object.entries(selectedAlert.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-indigo-300">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAlert.action_taken && (
                <div>
                  <p className="text-sm text-indigo-200">Action Taken</p>
                  <p className="text-white">{selectedAlert.action_taken}</p>
                </div>
              )}

              {selectedAlert.status !== 'resolved' && selectedAlert.status !== 'dismissed' && (
                <div>
                  <label className="block text-sm text-indigo-200 mb-2">Add Note (optional)</label>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                    placeholder="Describe the action you're taking..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
                {selectedAlert.status === 'active' && (
                  <button
                    onClick={() => updateAlertStatus(selectedAlert.id, 'acknowledged', actionNote)}
                    disabled={processing}
                    className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {processing ? 'Processing...' : 'Acknowledge'}
                  </button>
                )}
                {(selectedAlert.status === 'active' || selectedAlert.status === 'acknowledged') && (
                  <button
                    onClick={() => updateAlertStatus(selectedAlert.id, 'resolved', actionNote)}
                    disabled={processing}
                    className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {processing ? 'Processing...' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EngagementAlerts;
