import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onBack?: () => void;
}

interface SlackInstallation {
  teamName: string;
  installedAt: string;
  settings: {
    morning_reminder?: boolean;
    evening_summary?: boolean;
    goal_reminders?: boolean;
    reminder_time?: string;
  };
}

/**
 * SlackIntegration - Manage Slack workspace connection
 *
 * Allows users to connect their Slack workspace for
 * daily habit reminders, goal updates, and progress tracking.
 */
const SlackIntegration: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [installation, setInstallation] = useState<SlackInstallation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Settings
  const [morningReminder, setMorningReminder] = useState(true);
  const [eveningSummary, setEveningSummary] = useState(true);
  const [goalReminders, setGoalReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('slack-bot', {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.data) {
        setConnected(response.data.connected);
        if (response.data.installation) {
          setInstallation(response.data.installation);
          // Load settings
          const settings = response.data.installation.settings || {};
          setMorningReminder(settings.morning_reminder ?? true);
          setEveningSummary(settings.evening_summary ?? true);
          setGoalReminders(settings.goal_reminders ?? false);
          setReminderTime(settings.reminder_time || '08:00');
        }
      }
    } catch (err: any) {
      console.error('Error checking Slack status:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectSlack = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to connect Slack');
        return;
      }

      // Get the OAuth URL from the Edge Function
      const slackClientId = import.meta.env.VITE_SLACK_CLIENT_ID;
      if (!slackClientId) {
        setError('Slack integration is not configured');
        return;
      }

      const redirectUri = `${window.location.origin}/api/slack/oauth`;
      const scopes = 'chat:write,commands,users:read';
      const state = session.user.id;

      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scopes}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      // Open in popup
      const popup = window.open(authUrl, 'slack-oauth', 'width=600,height=700');

      // Poll for completion
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          checkStatus();
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const disconnectSlack = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('slack-bot', {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setConnected(false);
      setInstallation(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('slack-bot', {
        body: {
          morningReminder,
          eveningSummary,
          goalReminders,
          reminderTime
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Show success briefly
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Slack Integration</h1>
          <p className="text-gray-500 mt-1">Get habit reminders and updates in Slack</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-gray-500 hover:text-navy-900 font-medium">
            ← Back
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}

      {!connected ? (
        /* Not Connected */
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
              <path d="M14.5 2C13.1193 2 12 3.11929 12 4.5V7H14.5C15.8807 7 17 5.88071 17 4.5C17 3.11929 15.8807 2 14.5 2Z" fill="#E01E5A"/>
              <path d="M14.5 9H12V14.5C12 15.8807 13.1193 17 14.5 17C15.8807 17 17 15.8807 17 14.5V9H14.5Z" fill="#E01E5A"/>
              <path d="M2 9.5C2 10.8807 3.11929 12 4.5 12H7V9.5C7 8.11929 5.88071 7 4.5 7C3.11929 7 2 8.11929 2 9.5Z" fill="#36C5F0"/>
              <path d="M9 9.5V12H14.5C15.8807 12 17 10.8807 17 9.5C17 8.11929 15.8807 7 14.5 7H9V9.5Z" fill="#36C5F0"/>
              <path d="M9.5 22C10.8807 22 12 20.8807 12 19.5V17H9.5C8.11929 17 7 18.1193 7 19.5C7 20.8807 8.11929 22 9.5 22Z" fill="#2EB67D"/>
              <path d="M9.5 15H12V9.5C12 8.11929 10.8807 7 9.5 7C8.11929 7 7 8.11929 7 9.5V15H9.5Z" fill="#2EB67D"/>
              <path d="M22 14.5C22 13.1193 20.8807 12 19.5 12H17V14.5C17 15.8807 18.1193 17 19.5 17C20.8807 17 22 15.8807 22 14.5Z" fill="#ECB22E"/>
              <path d="M15 14.5V12H9.5C8.11929 12 7 13.1193 7 14.5C7 15.8807 8.11929 17 9.5 17H15V14.5Z" fill="#ECB22E"/>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-navy-900 mb-2">Connect Slack</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Get daily habit reminders, track progress, and complete habits directly in Slack.
          </p>

          <button
            onClick={connectSlack}
            className="inline-flex items-center gap-2 bg-[#4A154B] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#3a0f3b] transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            Add to Slack
          </button>

          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-4">
              <div className="text-2xl mb-2">⏰</div>
              <h3 className="font-bold text-navy-900 mb-1">Daily Reminders</h3>
              <p className="text-sm text-gray-500">Get morning habit prompts right in Slack</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2">✅</div>
              <h3 className="font-bold text-navy-900 mb-1">Quick Complete</h3>
              <p className="text-sm text-gray-500">Mark habits done with one click</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-bold text-navy-900 mb-1">Progress Updates</h3>
              <p className="text-sm text-gray-500">Track your streaks and goals</p>
            </div>
          </div>
        </div>
      ) : (
        /* Connected */
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-navy-900">Connected to Slack</h3>
                  <p className="text-sm text-gray-500">
                    Workspace: <span className="font-medium">{installation?.teamName}</span>
                  </p>
                  {installation?.installedAt && (
                    <p className="text-xs text-gray-400">
                      Connected {new Date(installation.installedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={disconnectSlack}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-navy-900 mb-4">Notification Settings</h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Morning Habit Reminder</p>
                  <p className="text-sm text-gray-500">Get your daily habits each morning</p>
                </div>
                <input
                  type="checkbox"
                  checked={morningReminder}
                  onChange={(e) => setMorningReminder(e.target.checked)}
                  className="w-5 h-5 text-navy-900 rounded focus:ring-navy-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Evening Summary</p>
                  <p className="text-sm text-gray-500">Daily progress recap at end of day</p>
                </div>
                <input
                  type="checkbox"
                  checked={eveningSummary}
                  onChange={(e) => setEveningSummary(e.target.checked)}
                  className="w-5 h-5 text-navy-900 rounded focus:ring-navy-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Goal Reminders</p>
                  <p className="text-sm text-gray-500">Weekly reminders about your goals</p>
                </div>
                <input
                  type="checkbox"
                  checked={goalReminders}
                  onChange={(e) => setGoalReminders(e.target.checked)}
                  className="w-5 h-5 text-navy-900 rounded focus:ring-navy-500"
                />
              </label>

              <div className="pt-4 border-t border-gray-200">
                <label className="block">
                  <p className="font-medium text-gray-700 mb-2">Reminder Time</p>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="mt-6 w-full bg-navy-900 text-white py-2.5 rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Slash Commands Reference */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-navy-900 mb-4">Available Commands</h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex items-start gap-3">
                <code className="bg-white px-2 py-1 rounded border border-gray-200">/visionary habits</code>
                <span className="text-gray-600">View today's habits</span>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-white px-2 py-1 rounded border border-gray-200">/visionary goals</code>
                <span className="text-gray-600">View your goals</span>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-white px-2 py-1 rounded border border-gray-200">/visionary progress</code>
                <span className="text-gray-600">Get progress summary</span>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-white px-2 py-1 rounded border border-gray-200">/visionary complete [habit]</code>
                <span className="text-gray-600">Mark a habit complete</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlackIntegration;
