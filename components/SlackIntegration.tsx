import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ConnectBank from './ConnectBank';

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

interface TeamsInstallation {
  tenantName: string;
  installedAt: string;
  settings: {
    morning_reminder?: boolean;
    evening_summary?: boolean;
    goal_reminders?: boolean;
    reminder_time?: string;
  };
}

type ActiveTab = 'slack' | 'teams' | 'bank';

/**
 * AppsIntegration - Manage Slack and Microsoft Teams connections
 *
 * Allows users to connect their Slack workspace and/or Microsoft Teams
 * for daily habit reminders, goal updates, and progress tracking.
 */
const SlackIntegration: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('slack');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Slack state
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackInstallation, setSlackInstallation] = useState<SlackInstallation | null>(null);
  const [slackMorningReminder, setSlackMorningReminder] = useState(true);
  const [slackEveningSummary, setSlackEveningSummary] = useState(true);
  const [slackGoalReminders, setSlackGoalReminders] = useState(false);
  const [slackReminderTime, setSlackReminderTime] = useState('08:00');

  // Teams state
  const [teamsConnected, setTeamsConnected] = useState(false);
  const [teamsInstallation, setTeamsInstallation] = useState<TeamsInstallation | null>(null);
  const [teamsMorningReminder, setTeamsMorningReminder] = useState(true);
  const [teamsEveningSummary, setTeamsEveningSummary] = useState(true);
  const [teamsGoalReminders, setTeamsGoalReminders] = useState(false);
  const [teamsReminderTime, setTeamsReminderTime] = useState('08:00');

  // Bank/Plaid state
  const [bankConnected, setBankConnected] = useState(false);
  const [bankAccountData, setBankAccountData] = useState<any>(null);

  useEffect(() => {
    checkAllStatuses();
  }, []);

  const checkAllStatuses = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check both services in parallel
      const [slackResponse, teamsResponse] = await Promise.all([
        supabase.functions.invoke('slack-bot', {
          body: {},
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase.functions.invoke('teams-bot', {
          body: { action: 'status' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      // Process Slack response
      if (slackResponse.data) {
        setSlackConnected(slackResponse.data.connected);
        if (slackResponse.data.installation) {
          setSlackInstallation(slackResponse.data.installation);
          const settings = slackResponse.data.installation.settings || {};
          setSlackMorningReminder(settings.morning_reminder ?? true);
          setSlackEveningSummary(settings.evening_summary ?? true);
          setSlackGoalReminders(settings.goal_reminders ?? false);
          setSlackReminderTime(settings.reminder_time || '08:00');
        }
      }

      // Process Teams response
      if (teamsResponse.data) {
        setTeamsConnected(teamsResponse.data.connected);
        if (teamsResponse.data.installation) {
          setTeamsInstallation(teamsResponse.data.installation);
          const settings = teamsResponse.data.installation.settings || {};
          setTeamsMorningReminder(settings.morning_reminder ?? true);
          setTeamsEveningSummary(settings.evening_summary ?? true);
          setTeamsGoalReminders(settings.goal_reminders ?? false);
          setTeamsReminderTime(settings.reminder_time || '08:00');
        }
      }
    } catch (err: any) {
      console.error('Error checking statuses:', err);
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

      // Use environment variable or fallback to the known client ID
      const slackClientId = import.meta.env.VITE_SLACK_CLIENT_ID || '9313021991553.10018838979383';

      // Redirect to Supabase Edge Function for OAuth handling
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://edaigbnnofyxcfbpcvct.supabase.co';
      const redirectUri = `${supabaseUrl}/functions/v1/slack-bot?endpoint=oauth`;
      const scopes = 'chat:write,commands,users:read,channels:read';
      const state = session.user.id;

      const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scopes}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const popup = window.open(authUrl, 'slack-oauth', 'width=600,height=700');

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          checkAllStatuses();
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const connectTeams = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to connect Microsoft Teams');
        return;
      }

      const teamsClientId = import.meta.env.VITE_TEAMS_CLIENT_ID;
      if (!teamsClientId) {
        setError('Microsoft Teams integration is not configured');
        return;
      }

      const redirectUri = `${window.location.origin}/api/teams/oauth`;
      const scopes = 'https://graph.microsoft.com/.default offline_access';
      const state = session.user.id;

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${teamsClientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

      const popup = window.open(authUrl, 'teams-oauth', 'width=600,height=700');

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          checkAllStatuses();
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
        body: { action: 'disconnect' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setSlackConnected(false);
      setSlackInstallation(null);
      setSuccessMessage('Slack disconnected successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const disconnectTeams = async () => {
    if (!confirm('Are you sure you want to disconnect Microsoft Teams?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('teams-bot', {
        body: { action: 'disconnect' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setTeamsConnected(false);
      setTeamsInstallation(null);
      setSuccessMessage('Microsoft Teams disconnected successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveSlackSettings = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('slack-bot', {
        body: {
          action: 'settings',
          morningReminder: slackMorningReminder,
          eveningSummary: slackEveningSummary,
          goalReminders: slackGoalReminders,
          reminderTime: slackReminderTime
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setSuccessMessage('Slack settings saved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveTeamsSettings = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('teams-bot', {
        body: {
          action: 'settings',
          morningReminder: teamsMorningReminder,
          eveningSummary: teamsEveningSummary,
          goalReminders: teamsGoalReminders,
          reminderTime: teamsReminderTime
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setSuccessMessage('Microsoft Teams settings saved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Slack icon SVG
  const SlackIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path d="M14.5 2C13.1193 2 12 3.11929 12 4.5V7H14.5C15.8807 7 17 5.88071 17 4.5C17 3.11929 15.8807 2 14.5 2Z" fill="#E01E5A"/>
      <path d="M14.5 9H12V14.5C12 15.8807 13.1193 17 14.5 17C15.8807 17 17 15.8807 17 14.5V9H14.5Z" fill="#E01E5A"/>
      <path d="M2 9.5C2 10.8807 3.11929 12 4.5 12H7V9.5C7 8.11929 5.88071 7 4.5 7C3.11929 7 2 8.11929 2 9.5Z" fill="#36C5F0"/>
      <path d="M9 9.5V12H14.5C15.8807 12 17 10.8807 17 9.5C17 8.11929 15.8807 7 14.5 7H9V9.5Z" fill="#36C5F0"/>
      <path d="M9.5 22C10.8807 22 12 20.8807 12 19.5V17H9.5C8.11929 17 7 18.1193 7 19.5C7 20.8807 8.11929 22 9.5 22Z" fill="#2EB67D"/>
      <path d="M9.5 15H12V9.5C12 8.11929 10.8807 7 9.5 7C8.11929 7 7 8.11929 7 9.5V15H9.5Z" fill="#2EB67D"/>
      <path d="M22 14.5C22 13.1193 20.8807 12 19.5 12H17V14.5C17 15.8807 18.1193 17 19.5 17C20.8807 17 22 15.8807 22 14.5Z" fill="#ECB22E"/>
      <path d="M15 14.5V12H9.5C8.11929 12 7 13.1193 7 14.5C7 15.8807 8.11929 17 9.5 17H15V14.5Z" fill="#ECB22E"/>
    </svg>
  );

  // Microsoft Teams icon SVG
  const TeamsIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path d="M20.5 7.5C21.8807 7.5 23 6.38071 23 5C23 3.61929 21.8807 2.5 20.5 2.5C19.1193 2.5 18 3.61929 18 5C18 6.38071 19.1193 7.5 20.5 7.5Z" fill="#5059C9"/>
      <path d="M23 9H18V17.5C18 18.3284 17.3284 19 16.5 19H14.5V20C14.5 21.3807 15.6193 22.5 17 22.5H21C22.3807 22.5 23.5 21.3807 23.5 20V9.5C23.5 9.22386 23.2761 9 23 9Z" fill="#5059C9"/>
      <path d="M15 6.5C17.2091 6.5 19 4.70914 19 2.5C19 2.33333 18.9883 2.16917 18.9657 2.00833C18.7314 3.67917 17.3425 5 15.625 5H14.5V3.5C14.5 2.39543 13.6046 1.5 12.5 1.5H8.5C7.39543 1.5 6.5 2.39543 6.5 3.5V5H5.375C3.65749 5 2.26857 3.67917 2.03433 2.00833C2.01167 2.16917 2 2.33333 2 2.5C2 4.70914 3.79086 6.5 6 6.5H15Z" fill="#7B83EB"/>
      <path d="M15 7.5H6C4.61929 7.5 3.5 8.61929 3.5 10V17.5C3.5 18.8807 4.61929 20 6 20H15C16.3807 20 17.5 18.8807 17.5 17.5V10C17.5 8.61929 16.3807 7.5 15 7.5Z" fill="#7B83EB"/>
      <path d="M12 11H9V17H12V11Z" fill="white"/>
    </svg>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
      </div>
    );
  }

  const renderSlackTab = () => {
    if (!slackConnected) {
      return (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <SlackIcon />
          </div>

          <h2 className="text-2xl font-bold text-navy-900 mb-2">Connect Slack</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Get daily habit reminders, track progress, and complete habits directly in Slack.
          </p>

          <button
            onClick={connectSlack}
            className="inline-flex items-center gap-2 bg-[#4A154B] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#3a0f3b] transition-colors"
          >
            <SlackIcon />
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
      );
    }

    return (
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
                  Workspace: <span className="font-medium">{slackInstallation?.teamName}</span>
                </p>
                {slackInstallation?.installedAt && (
                  <p className="text-xs text-gray-400">
                    Connected {new Date(slackInstallation.installedAt).toLocaleDateString()}
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
                checked={slackMorningReminder}
                onChange={(e) => setSlackMorningReminder(e.target.checked)}
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
                checked={slackEveningSummary}
                onChange={(e) => setSlackEveningSummary(e.target.checked)}
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
                checked={slackGoalReminders}
                onChange={(e) => setSlackGoalReminders(e.target.checked)}
                className="w-5 h-5 text-navy-900 rounded focus:ring-navy-500"
              />
            </label>

            <div className="pt-4 border-t border-gray-200">
              <label className="block">
                <p className="font-medium text-gray-700 mb-2">Reminder Time</p>
                <input
                  type="time"
                  value={slackReminderTime}
                  onChange={(e) => setSlackReminderTime(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                />
              </label>
            </div>
          </div>

          <button
            onClick={saveSlackSettings}
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
    );
  };

  const renderTeamsTab = () => {
    if (!teamsConnected) {
      return (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <TeamsIcon />
          </div>

          <h2 className="text-2xl font-bold text-navy-900 mb-2">Connect Microsoft Teams</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Get daily habit reminders, track progress, and complete habits directly in Microsoft Teams.
          </p>

          <button
            onClick={connectTeams}
            className="inline-flex items-center gap-2 bg-[#5059C9] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#4048b8] transition-colors"
          >
            <TeamsIcon />
            Add to Microsoft Teams
          </button>

          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-4">
              <div className="text-2xl mb-2">⏰</div>
              <h3 className="font-bold text-navy-900 mb-1">Daily Reminders</h3>
              <p className="text-sm text-gray-500">Get morning habit prompts in Teams</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-bold text-navy-900 mb-1">Adaptive Cards</h3>
              <p className="text-sm text-gray-500">Rich interactive messages</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-bold text-navy-900 mb-1">Progress Updates</h3>
              <p className="text-sm text-gray-500">Track your streaks and goals</p>
            </div>
          </div>
        </div>
      );
    }

    return (
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
                <h3 className="font-bold text-navy-900">Connected to Microsoft Teams</h3>
                <p className="text-sm text-gray-500">
                  Tenant: <span className="font-medium">{teamsInstallation?.tenantName}</span>
                </p>
                {teamsInstallation?.installedAt && (
                  <p className="text-xs text-gray-400">
                    Connected {new Date(teamsInstallation.installedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={disconnectTeams}
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
                checked={teamsMorningReminder}
                onChange={(e) => setTeamsMorningReminder(e.target.checked)}
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
                checked={teamsEveningSummary}
                onChange={(e) => setTeamsEveningSummary(e.target.checked)}
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
                checked={teamsGoalReminders}
                onChange={(e) => setTeamsGoalReminders(e.target.checked)}
                className="w-5 h-5 text-navy-900 rounded focus:ring-navy-500"
              />
            </label>

            <div className="pt-4 border-t border-gray-200">
              <label className="block">
                <p className="font-medium text-gray-700 mb-2">Reminder Time</p>
                <input
                  type="time"
                  value={teamsReminderTime}
                  onChange={(e) => setTeamsReminderTime(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                />
              </label>
            </div>
          </div>

          <button
            onClick={saveTeamsSettings}
            disabled={saving}
            className="mt-6 w-full bg-navy-900 text-white py-2.5 rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Bot Commands Reference */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="font-bold text-navy-900 mb-4">Available Commands</h3>
          <p className="text-sm text-gray-500 mb-4">
            Chat with the Visionary bot in Teams to use these commands:
          </p>
          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-start gap-3">
              <code className="bg-white px-2 py-1 rounded border border-gray-200">habits</code>
              <span className="text-gray-600">View today's habits</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-white px-2 py-1 rounded border border-gray-200">goals</code>
              <span className="text-gray-600">View your goals</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-white px-2 py-1 rounded border border-gray-200">progress</code>
              <span className="text-gray-600">Get progress summary</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-white px-2 py-1 rounded border border-gray-200">help</code>
              <span className="text-gray-600">Show all available commands</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Connected Apps</h1>
          <p className="text-gray-500 mt-1">Get habit reminders in your favorite apps</p>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-gray-500 hover:text-navy-900 font-medium">
            ← Back
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 flex justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-400">✕</button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}

      {/* Connection Status Overview */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className={`p-4 rounded-xl border-2 ${slackConnected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <SlackIcon />
            <div>
              <p className="font-medium text-navy-900">Slack</p>
              <p className={`text-sm ${slackConnected ? 'text-green-600' : 'text-gray-500'}`}>
                {slackConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl border-2 ${teamsConnected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <TeamsIcon />
            <div>
              <p className="font-medium text-navy-900">Teams</p>
              <p className={`text-sm ${teamsConnected ? 'text-green-600' : 'text-gray-500'}`}>
                {teamsConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl border-2 ${bankConnected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <p className="font-medium text-navy-900">Bank</p>
              <p className={`text-sm ${bankConnected ? 'text-green-600' : 'text-gray-500'}`}>
                {bankConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('slack')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'slack'
              ? 'text-navy-900 border-b-2 border-navy-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <SlackIcon />
            Slack
          </div>
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'teams'
              ? 'text-navy-900 border-b-2 border-navy-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <TeamsIcon />
            Microsoft Teams
          </div>
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'bank'
              ? 'text-navy-900 border-b-2 border-navy-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🏦</span>
            Bank Account
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'slack' && renderSlackTab()}
      {activeTab === 'teams' && renderTeamsTab()}
      {activeTab === 'bank' && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <ConnectBank
            onConnect={(accountData) => {
              setBankConnected(true);
              setBankAccountData(accountData);
              setSuccessMessage('Bank account connected successfully!');
              setTimeout(() => setSuccessMessage(null), 3000);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default SlackIntegration;
