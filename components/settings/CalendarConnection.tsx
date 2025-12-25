import React, { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL } from '../../lib/supabase';

interface CalendarConnectionProps {
  userId: string;
  onConnectionChange?: (connected: boolean) => void;
}

interface CalendarStatus {
  connected: boolean;
  connection: {
    calendar_name: string;
    connected_at: string;
    last_synced_at: string;
    token_expires_soon: boolean;
  } | null;
}

const CalendarConnection: React.FC<CalendarConnectionProps> = ({
  userId,
  onConnectionChange
}) => {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check connection status on mount and after URL changes (OAuth callback)
  useEffect(() => {
    checkStatus();

    // Check for OAuth callback code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleOAuthCallback(code, state);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [userId]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-connect?action=status`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setStatus(data);
        onConnectionChange?.(data.connected);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      console.error('Status check error:', err);
      setError('Failed to check calendar status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-connect?action=auth_url`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success && data.auth_url) {
        // Redirect to Google OAuth
        window.location.href = data.auth_url;
      } else {
        setError(data.error || 'Failed to get authorization URL');
      }
    } catch (err: any) {
      console.error('Connect error:', err);
      setError('Failed to start connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setConnecting(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'exchange_code', code })
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess(`Connected to ${data.calendar_name || 'Google Calendar'}`);
        setTimeout(() => setSuccess(null), 3000);
        await checkStatus();
      } else {
        setError(data.error || 'Failed to complete connection');
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError('Failed to complete connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'disconnect' })
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess('Google Calendar disconnected');
        setTimeout(() => setSuccess(null), 3000);
        setStatus({ connected: false, connection: null });
        onConnectionChange?.(false);
      } else {
        setError(data.error || 'Failed to disconnect');
      }
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/google-calendar-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'refresh' })
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccess('Token refreshed successfully');
        setTimeout(() => setSuccess(null), 3000);
        await checkStatus();
      } else {
        setError(data.error || 'Failed to refresh token');
      }
    } catch (err: any) {
      console.error('Refresh error:', err);
      setError('Failed to refresh token');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !status) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-indigo-200">Checking calendar connection...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">📅</span>
          Google Calendar
        </h3>
        {status?.connected && (
          <span className="flex items-center gap-1 text-sm text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Connected
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
          {success}
        </div>
      )}

      {status?.connected && status.connection ? (
        <div className="space-y-4">
          {/* Connection Info */}
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm-9 15H6v-4.5h4.5V18zm0-6H6v-4.5h4.5V12zm6 6h-4.5v-4.5H18V18zm0-6h-4.5v-4.5H18V12z"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">{status.connection.calendar_name}</p>
                <p className="text-xs text-indigo-300">
                  Connected {formatDate(status.connection.connected_at)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-indigo-300">Last Synced</p>
                <p className="text-white">
                  {status.connection.last_synced_at
                    ? formatDate(status.connection.last_synced_at)
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-indigo-300">Token Status</p>
                <p className={status.connection.token_expires_soon ? 'text-yellow-400' : 'text-green-400'}>
                  {status.connection.token_expires_soon ? 'Expires Soon' : 'Valid'}
                </p>
              </div>
            </div>
          </div>

          {/* Token Warning */}
          {status.connection.token_expires_soon && (
            <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-200">
                Your calendar token expires soon.
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="ml-2 text-yellow-400 hover:text-yellow-300 underline"
                >
                  Refresh now
                </button>
              </p>
            </div>
          )}

          {/* Capabilities */}
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="text-sm font-medium text-indigo-200 mb-2">AMIE can now:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-green-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Check your availability
              </li>
              <li className="flex items-center gap-2 text-green-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create calendar events (with confirmation)
              </li>
              <li className="flex items-center gap-2 text-green-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Schedule goal-related reminders
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={checkStatus}
              disabled={loading}
              className="px-4 py-2 text-sm text-indigo-200 hover:text-white transition-colors"
            >
              Refresh Status
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors flex items-center gap-2"
            >
              {disconnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Disconnect
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Not Connected State */}
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="text-white font-medium mb-2">Connect Your Calendar</h4>
            <p className="text-indigo-200 text-sm mb-4 max-w-sm mx-auto">
              Allow AMIE to help you schedule events, check your availability, and manage your time more effectively.
            </p>
          </div>

          {/* Benefits */}
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="text-sm font-medium text-indigo-200 mb-3">What you'll unlock:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2 text-indigo-100">
                <span className="text-lg">📆</span>
                <span>AI-scheduled goal and habit sessions at optimal times</span>
              </li>
              <li className="flex items-start gap-2 text-indigo-100">
                <span className="text-lg">🔍</span>
                <span>Smart availability detection for planning</span>
              </li>
              <li className="flex items-start gap-2 text-indigo-100">
                <span className="text-lg">🔔</span>
                <span>Calendar reminders for important milestones</span>
              </li>
            </ul>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-200">
              <span className="font-medium">Privacy:</span> We only read event times, not content.
              AMIE creates events with your confirmation. You can disconnect anytime.
            </p>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Calendar
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CalendarConnection;
