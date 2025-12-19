import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserAgentSettings, AgentActionHistory } from '../../types';
import { SaveIcon, SparklesIcon, ClockIcon } from '../Icons';

const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

const CHANNEL_OPTIONS = [
    { value: 'push', label: 'Push Notification', icon: '🔔' },
    { value: 'sms', label: 'SMS Text', icon: '💬' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'voice', label: 'Voice Call', icon: '📞' },
];

const defaultSettings: Partial<UserAgentSettings> = {
    agent_actions_enabled: false,
    allow_send_email: true,
    allow_send_sms: false,
    allow_voice_calls: false,
    allow_create_tasks: true,
    allow_schedule_reminders: true,
    habit_reminders_enabled: true,
    habit_reminder_channel: 'push',
    habit_reminder_timing: 'before',
    habit_reminder_minutes_before: 30,
    goal_checkins_enabled: true,
    goal_checkin_frequency: 'weekly',
    goal_checkin_channel: 'email',
    goal_checkin_day_of_week: 1,
    goal_checkin_time: '09:00',
    allow_proactive_outreach: false,
    proactive_outreach_frequency: 'weekly',
    proactive_topics: ['habits', 'goals', 'motivation'],
    require_confirmation_email: true,
    require_confirmation_sms: true,
    require_confirmation_voice: true,
};

export default function AgentSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<Partial<UserAgentSettings>>(defaultSettings);
    const [recentActions, setRecentActions] = useState<AgentActionHistory[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch agent settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('user_agent_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
                console.error('Settings fetch error:', settingsError);
            }

            if (settingsData) {
                setSettings(settingsData);
            }

            // Fetch recent agent actions
            const { data: actionsData, error: actionsError } = await supabase
                .from('agent_action_history')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!actionsError && actionsData) {
                setRecentActions(actionsData);
            }

        } catch (err: any) {
            console.error('Error fetching agent settings:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const updates = {
                user_id: user.id,
                ...settings,
                updated_at: new Date().toISOString()
            };

            const { error: saveError } = await supabase
                .from('user_agent_settings')
                .upsert(updates, { onConflict: 'user_id' });

            if (saveError) throw saveError;

            setSuccess('Agent settings saved successfully');
            fetchData();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'send_email': return '📧';
            case 'send_sms': return '💬';
            case 'voice_call': return '📞';
            case 'create_task': return '📝';
            case 'schedule_reminder': return '⏰';
            case 'mark_habit_complete': return '✅';
            case 'update_goal_progress': return '🎯';
            default: return '🤖';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'executed': return 'text-green-400 bg-green-900/30';
            case 'pending': return 'text-yellow-400 bg-yellow-900/30';
            case 'confirmed': return 'text-blue-400 bg-blue-900/30';
            case 'failed': return 'text-red-400 bg-red-900/30';
            case 'cancelled': return 'text-slate-400 bg-slate-900/30';
            default: return 'text-slate-400 bg-slate-900/30';
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading agent settings...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 bg-slate-900 rounded-2xl shadow-xl">

            <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-amber-400" />
                        AI Agent Settings
                    </h1>
                    <p className="text-slate-400 mt-1">Control what actions your AI Coach can take on your behalf.</p>
                </div>
            </div>

            {error && <div className="bg-red-900/30 text-red-200 p-4 rounded-lg border border-red-800">{error}</div>}
            {success && <div className="bg-green-900/30 text-green-200 p-4 rounded-lg border border-green-800">{success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* MASTER TOGGLE CARD */}
                <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 backdrop-blur-sm border border-amber-700/50 rounded-xl p-6 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-500/20 rounded-full">
                                <SparklesIcon className="w-8 h-8 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Enable AI Agent Actions</h3>
                                <p className="text-amber-200/70 text-sm mt-1">
                                    When enabled, your AI Coach can take actions on your behalf during conversations.
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.agent_actions_enabled}
                                onChange={(e) => setSettings(prev => ({ ...prev, agent_actions_enabled: e.target.checked }))}
                            />
                            <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>
                </div>

                {/* ACTION PERMISSIONS CARD */}
                <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="text-lg font-semibold text-white mb-4">Action Permissions</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Choose which types of actions your AI Coach can perform.
                    </p>

                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📧</span>
                                <div>
                                    <div className="text-sm font-medium text-white">Send Emails</div>
                                    <div className="text-xs text-slate-400">Compose and send emails on your behalf</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allow_send_email}
                                onChange={(e) => setSettings(prev => ({ ...prev, allow_send_email: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">💬</span>
                                <div>
                                    <div className="text-sm font-medium text-white">Send SMS</div>
                                    <div className="text-xs text-slate-400">Send text messages to your phone</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allow_send_sms}
                                onChange={(e) => setSettings(prev => ({ ...prev, allow_send_sms: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📞</span>
                                <div>
                                    <div className="text-sm font-medium text-white">Voice Calls</div>
                                    <div className="text-xs text-slate-400">Make reminder calls to your phone</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allow_voice_calls}
                                onChange={(e) => setSettings(prev => ({ ...prev, allow_voice_calls: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📝</span>
                                <div>
                                    <div className="text-sm font-medium text-white">Create Tasks</div>
                                    <div className="text-xs text-slate-400">Add action items to your task list</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allow_create_tasks}
                                onChange={(e) => setSettings(prev => ({ ...prev, allow_create_tasks: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">⏰</span>
                                <div>
                                    <div className="text-sm font-medium text-white">Schedule Reminders</div>
                                    <div className="text-xs text-slate-400">Set up future reminders and check-ins</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allow_schedule_reminders}
                                onChange={(e) => setSettings(prev => ({ ...prev, allow_schedule_reminders: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>
                    </div>
                </div>

                {/* CONFIRMATION REQUIREMENTS CARD */}
                <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="text-lg font-semibold text-white mb-4">Confirmation Requirements</h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Require your approval before the AI executes these actions.
                    </p>

                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📧</span>
                                <span className="text-sm font-medium text-white">Confirm before sending emails</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.require_confirmation_email}
                                onChange={(e) => setSettings(prev => ({ ...prev, require_confirmation_email: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">💬</span>
                                <span className="text-sm font-medium text-white">Confirm before sending SMS</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.require_confirmation_sms}
                                onChange={(e) => setSettings(prev => ({ ...prev, require_confirmation_sms: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📞</span>
                                <span className="text-sm font-medium text-white">Confirm before voice calls</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.require_confirmation_voice}
                                onChange={(e) => setSettings(prev => ({ ...prev, require_confirmation_voice: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                            />
                        </label>
                    </div>

                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                        <p className="text-xs text-blue-300">
                            When confirmation is required, the AI will ask for your approval during the conversation before executing the action.
                        </p>
                    </div>
                </div>

                {/* HABIT REMINDERS CARD */}
                <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <ClockIcon className="w-5 h-5 text-green-400" />
                            Habit Reminders
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.habit_reminders_enabled}
                                onChange={(e) => setSettings(prev => ({ ...prev, habit_reminders_enabled: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>

                    <p className="text-slate-400 text-sm mb-4">
                        Let your AI Coach remind you about your daily habits.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-2">Reminder Channel</label>
                            <select
                                value={settings.habit_reminder_channel}
                                onChange={(e) => setSettings(prev => ({ ...prev, habit_reminder_channel: e.target.value as any }))}
                                disabled={!settings.habit_reminders_enabled}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50"
                            >
                                {CHANNEL_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-2">Reminder Timing</label>
                            <select
                                value={settings.habit_reminder_timing}
                                onChange={(e) => setSettings(prev => ({ ...prev, habit_reminder_timing: e.target.value as any }))}
                                disabled={!settings.habit_reminders_enabled}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50"
                            >
                                <option value="before">Before scheduled time</option>
                                <option value="at_time">At scheduled time</option>
                                <option value="after">After scheduled time (catch-up)</option>
                            </select>
                        </div>

                        {settings.habit_reminder_timing === 'before' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-2">Minutes Before</label>
                                <select
                                    value={settings.habit_reminder_minutes_before}
                                    onChange={(e) => setSettings(prev => ({ ...prev, habit_reminder_minutes_before: parseInt(e.target.value) }))}
                                    disabled={!settings.habit_reminders_enabled}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50"
                                >
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={60}>1 hour</option>
                                    <option value={120}>2 hours</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* GOAL CHECK-INS CARD */}
                <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            🎯 Goal Check-ins
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.goal_checkins_enabled}
                                onChange={(e) => setSettings(prev => ({ ...prev, goal_checkins_enabled: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                    </div>

                    <p className="text-slate-400 text-sm mb-4">
                        Schedule regular check-ins to review your goal progress.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-2">Check-in Frequency</label>
                            <select
                                value={settings.goal_checkin_frequency}
                                onChange={(e) => setSettings(prev => ({ ...prev, goal_checkin_frequency: e.target.value as any }))}
                                disabled={!settings.goal_checkins_enabled}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="biweekly">Every 2 weeks</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-2">Check-in Channel</label>
                            <select
                                value={settings.goal_checkin_channel}
                                onChange={(e) => setSettings(prev => ({ ...prev, goal_checkin_channel: e.target.value as any }))}
                                disabled={!settings.goal_checkins_enabled}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                            >
                                {CHANNEL_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {settings.goal_checkin_frequency !== 'daily' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-2">Day of Week</label>
                                <select
                                    value={settings.goal_checkin_day_of_week}
                                    onChange={(e) => setSettings(prev => ({ ...prev, goal_checkin_day_of_week: parseInt(e.target.value) }))}
                                    disabled={!settings.goal_checkins_enabled}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                >
                                    {DAYS_OF_WEEK.map(day => (
                                        <option key={day.value} value={day.value}>{day.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-2">Preferred Time</label>
                            <input
                                type="time"
                                value={settings.goal_checkin_time}
                                onChange={(e) => setSettings(prev => ({ ...prev, goal_checkin_time: e.target.value }))}
                                disabled={!settings.goal_checkins_enabled}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* PROACTIVE OUTREACH CARD */}
                <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:col-span-2 transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-purple-400" />
                                Proactive AI Outreach
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Allow your AI Coach to reach out with motivation and insights even when you haven't started a conversation.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.allow_proactive_outreach}
                                onChange={(e) => setSettings(prev => ({ ...prev, allow_proactive_outreach: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                        </label>
                    </div>

                    {settings.allow_proactive_outreach && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-2">Outreach Frequency</label>
                                <select
                                    value={settings.proactive_outreach_frequency}
                                    onChange={(e) => setSettings(prev => ({ ...prev, proactive_outreach_frequency: e.target.value as any }))}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Every 2 weeks</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-2">Topics</label>
                                <div className="flex flex-wrap gap-2">
                                    {['habits', 'goals', 'motivation', 'progress'].map(topic => (
                                        <label key={topic} className="flex items-center gap-2 px-3 py-1 bg-slate-900/50 rounded-full cursor-pointer hover:bg-slate-900/70 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={settings.proactive_topics?.includes(topic)}
                                                onChange={(e) => {
                                                    const newTopics = e.target.checked
                                                        ? [...(settings.proactive_topics || []), topic]
                                                        : (settings.proactive_topics || []).filter(t => t !== topic);
                                                    setSettings(prev => ({ ...prev, proactive_topics: newTopics }));
                                                }}
                                                className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                                            />
                                            <span className="text-xs text-white capitalize">{topic}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RECENT ACTIONS CARD */}
                {recentActions.length > 0 && (
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:col-span-2">
                        <h3 className="text-lg font-semibold text-white mb-4">Recent Agent Actions</h3>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {recentActions.map(action => (
                                <div key={action.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">{getActionIcon(action.action_type)}</span>
                                        <div>
                                            <div className="text-sm font-medium text-white capitalize">
                                                {action.action_type.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {new Date(action.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(action.action_status)}`}>
                                        {action.action_status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            <div className="flex justify-end pt-4 border-t border-slate-700">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                    {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <SaveIcon className="w-4 h-4" />}
                    Save Agent Settings
                </button>
            </div>

        </div>
    );
}
