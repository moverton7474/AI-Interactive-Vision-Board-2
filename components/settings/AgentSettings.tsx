import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserAgentSettings, AgentActionHistory, PendingAgentAction, AgentActionRiskLevel } from '../../types';
import { SaveIcon, SparklesIcon, ClockIcon } from '../Icons';
import { useAgentActions } from '../../hooks/useAgentActions';
import PendingActionCard from './PendingActionCard';
import ActionFeedbackButton from './ActionFeedbackButton';
import CalendarConnection from './CalendarConnection';
import { voiceService, VoiceSettings, VoiceQuota, VoicePersona } from '../../services/voiceService';

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

const defaultSettings: Partial<UserAgentSettings> & {
    confidence_threshold?: number;
    auto_approve_low_risk?: boolean;
    auto_approve_medium_risk?: boolean;
    require_high_confidence?: boolean;
} = {
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
    // New confidence settings
    confidence_threshold: 0.7,
    auto_approve_low_risk: true,
    auto_approve_medium_risk: false,
    require_high_confidence: true,
};

export default function AgentSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [settings, setSettings] = useState<Partial<UserAgentSettings> & {
        confidence_threshold?: number;
        auto_approve_low_risk?: boolean;
        auto_approve_medium_risk?: boolean;
        require_high_confidence?: boolean;
    }>(defaultSettings);
    const [recentActions, setRecentActions] = useState<AgentActionHistory[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [historyFilter, setHistoryFilter] = useState<'all' | 'executed' | 'cancelled' | 'failed'>('all');

    // Voice Settings State (v2.9)
    const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
    const [voiceQuota, setVoiceQuota] = useState<VoiceQuota | null>(null);
    const [voicePersonas, setVoicePersonas] = useState<VoicePersona[]>([]);
    const [userTier, setUserTier] = useState<string>('free');
    const [voiceLoading, setVoiceLoading] = useState(false);

    // Use the agent actions hook for pending actions and realtime updates
    const {
        pendingActions,
        confirmAction,
        cancelAction,
        pendingCount,
        hasHighRiskPending,
        error: agentError,
    } = useAgentActions({ enableRealtime: true });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserId(user.id);

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

            // Fetch voice settings (v2.9)
            try {
                setVoiceLoading(true);
                const voiceData = await voiceService.getSettings();
                setVoiceSettings(voiceData.settings);
                setVoiceQuota(voiceData.quota);
                setVoicePersonas(voiceData.personas);
                setUserTier(voiceData.tier);
            } catch (voiceErr) {
                console.log('Voice settings not available:', voiceErr);
            } finally {
                setVoiceLoading(false);
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

    // Handle voice persona selection (v2.9)
    const handleVoicePersonaChange = async (persona: string) => {
        try {
            const updated = await voiceService.updateSettings({
                preferredPersona: persona as VoiceSettings['preferredPersona'],
            });
            setVoiceSettings(updated);
            setSuccess('Voice persona updated!');
            setTimeout(() => setSuccess(null), 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to update voice settings');
        }
    };

    // Get persona display info
    const getPersonaInfo = (name: string) => {
        const personas: Record<string, { icon: string; color: string; provider: string }> = {
            maya: { icon: '👩‍🏫', color: 'from-pink-500 to-rose-500', provider: 'ElevenLabs' },
            james: { icon: '👨‍💼', color: 'from-blue-500 to-indigo-500', provider: 'ElevenLabs' },
            tonya: { icon: '👩‍⚕️', color: 'from-purple-500 to-violet-500', provider: 'ElevenLabs' },
            system: { icon: '🤖', color: 'from-slate-500 to-slate-600', provider: 'Browser' },
        };
        return personas[name] || personas.system;
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
            {agentError && <div className="bg-red-900/30 text-red-200 p-4 rounded-lg border border-red-800">{agentError}</div>}
            {success && <div className="bg-green-900/30 text-green-200 p-4 rounded-lg border border-green-800">{success}</div>}

            {/* PENDING ACTIONS SECTION */}
            {pendingActions.length > 0 && (
                <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 backdrop-blur-sm border border-orange-700/50 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="p-2 bg-orange-500/20 rounded-full">
                                    <span className="text-2xl">🔔</span>
                                </div>
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                                        {pendingCount}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Pending Actions</h3>
                                <p className="text-orange-200/70 text-sm">
                                    {pendingCount} action{pendingCount !== 1 ? 's' : ''} waiting for your approval
                                </p>
                            </div>
                        </div>
                        {hasHighRiskPending && (
                            <span className="px-3 py-1 bg-red-900/50 text-red-300 text-xs font-medium rounded-full border border-red-700/50">
                                High Risk Pending
                            </span>
                        )}
                    </div>

                    <div className="space-y-3">
                        {pendingActions.map(action => (
                            <PendingActionCard
                                key={action.id}
                                action={action}
                                onConfirm={confirmAction}
                                onCancel={cancelAction}
                            />
                        ))}
                    </div>
                </div>
            )}

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

                {/* VOICE COACH SETTINGS CARD (v2.9) */}
                <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm border border-purple-700/50 rounded-xl p-6 md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/20 rounded-full">
                                <span className="text-3xl">🎙️</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Voice Coach Settings</h3>
                                <p className="text-purple-200/70 text-sm mt-1">
                                    Choose your AI Coach's voice persona for voice sessions.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                userTier === 'elite' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black' :
                                userTier === 'pro' ? 'bg-indigo-600 text-white' :
                                'bg-slate-700 text-slate-300'
                            }`}>
                                {userTier.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {voiceLoading ? (
                        <div className="text-center py-8 text-slate-400">
                            <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-2" />
                            Loading voice settings...
                        </div>
                    ) : (
                        <>
                            {/* Quota Display */}
                            {voiceQuota && userTier !== 'free' && (
                                <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-slate-400">Monthly Voice Quota</span>
                                        <span className="text-sm text-purple-300">
                                            {voiceQuota.remaining.toLocaleString()} / {voiceQuota.limit.toLocaleString()} chars
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all"
                                            style={{ width: `${Math.max(0, Math.min(100, (voiceQuota.remaining / voiceQuota.limit) * 100))}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Voice Persona Selection */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {voicePersonas.map((persona) => {
                                    const info = getPersonaInfo(persona.name);
                                    const isSelected = voiceSettings?.preferredPersona === persona.name;
                                    const isLocked = !persona.available;

                                    return (
                                        <button
                                            key={persona.name}
                                            onClick={() => !isLocked && handleVoicePersonaChange(persona.name)}
                                            disabled={isLocked}
                                            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                                                isSelected
                                                    ? 'border-purple-500 bg-purple-900/30 ring-2 ring-purple-500/50'
                                                    : isLocked
                                                        ? 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'
                                                        : 'border-slate-700 bg-slate-800/50 hover:border-purple-500/50 hover:bg-slate-800/70 cursor-pointer'
                                            }`}
                                        >
                                            {isLocked && (
                                                <div className="absolute top-2 right-2">
                                                    <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full">
                                                        {persona.name === 'system' ? 'FREE' : 'PRO+'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${info.color} flex items-center justify-center text-2xl mb-2`}>
                                                {info.icon}
                                            </div>
                                            <div className="text-sm font-medium text-white">{persona.displayName}</div>
                                            <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                                                {persona.description?.slice(0, 50)}...
                                            </div>
                                            <div className="mt-2 flex items-center gap-1">
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    info.provider === 'ElevenLabs' ? 'bg-purple-900/50 text-purple-300' : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {info.provider}
                                                </span>
                                                {isSelected && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300">
                                                        ✓ Active
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Upgrade CTA for Free Users */}
                            {userTier === 'free' && (
                                <div className="mt-4 p-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/50 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">✨</span>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-medium text-amber-200">Unlock Premium Voices</h4>
                                            <p className="text-xs text-amber-300/70 mt-1">
                                                Upgrade to Pro or Elite to access premium AI voices from ElevenLabs including Coach Maya, James, and Tonya.
                                            </p>
                                        </div>
                                        <button className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors">
                                            Upgrade
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
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

                {/* CONFIDENCE SETTINGS CARD */}
                <div className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:col-span-2 transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <span className="text-xl">🎚️</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">AI Confidence Settings</h3>
                            <p className="text-slate-400 text-sm">
                                Control how confident the AI must be before taking actions automatically.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Confidence Threshold Slider */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-300">
                                Confidence Threshold
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="50"
                                    max="95"
                                    step="5"
                                    value={(settings.confidence_threshold || 0.7) * 100}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        confidence_threshold: parseInt(e.target.value) / 100
                                    }))}
                                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <span className="w-12 text-center text-sm font-mono text-cyan-400 bg-slate-900 px-2 py-1 rounded">
                                    {Math.round((settings.confidence_threshold || 0.7) * 100)}%
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Actions below this threshold will require confirmation.
                            </p>
                        </div>

                        {/* High Confidence Requirement */}
                        <div className="space-y-3">
                            <label className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🎯</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">Require High Confidence</div>
                                        <div className="text-xs text-slate-400">AI must be confident before acting</div>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.require_high_confidence}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        require_high_confidence: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Auto-Approve Settings */}
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-medium text-slate-300 mb-3">
                            Auto-Approve by Risk Level
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-lg cursor-pointer hover:bg-green-900/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🟢</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">Low Risk Actions</div>
                                        <div className="text-xs text-slate-400">Tasks, reminders, data queries</div>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_approve_low_risk}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        auto_approve_low_risk: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg cursor-pointer hover:bg-yellow-900/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🟡</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">Medium Risk Actions</div>
                                        <div className="text-xs text-slate-400">Progress updates, habit completions</div>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_approve_medium_risk}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        auto_approve_medium_risk: e.target.checked
                                    }))}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500"
                                />
                            </label>
                        </div>

                        <div className="mt-3 p-3 bg-orange-900/20 border border-orange-800/50 rounded-lg flex items-start gap-2">
                            <span className="text-lg">⚠️</span>
                            <p className="text-xs text-orange-300">
                                <strong>High-risk actions</strong> (emails, SMS, voice calls) always require confirmation regardless of these settings.
                            </p>
                        </div>
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

                {/* ENHANCED ACTION HISTORY CARD */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📋</span>
                            <h3 className="text-lg font-semibold text-white">Action History</h3>
                            {recentActions.length > 0 && (
                                <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                                    {recentActions.length} actions
                                </span>
                            )}
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-1">
                            {(['all', 'executed', 'cancelled', 'failed'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setHistoryFilter(filter)}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        historyFilter === filter
                                            ? 'bg-amber-600 text-white'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {recentActions.length > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {recentActions
                                .filter(action => historyFilter === 'all' || action.action_status === historyFilter)
                                .map(action => (
                                    <div
                                        key={action.id}
                                        className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{getActionIcon(action.action_type)}</span>
                                            <div>
                                                <div className="text-sm font-medium text-white capitalize">
                                                    {action.action_type.replace(/_/g, ' ')}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span>{new Date(action.created_at).toLocaleString()}</span>
                                                    {action.trigger_context && (
                                                        <>
                                                            <span className="text-slate-600">•</span>
                                                            <span className="text-slate-500 capitalize">
                                                                {action.trigger_context.replace(/_/g, ' ')}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Feedback buttons */}
                                            <ActionFeedbackButton
                                                actionId={action.id}
                                                actionType={action.action_type}
                                                onFeedbackSubmitted={fetchData}
                                            />
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(action.action_status)}`}>
                                                {action.action_status}
                                            </span>
                                            {/* Expand button for details */}
                                            <button
                                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
                                                title="View details"
                                                onClick={() => {
                                                    // Could open a modal with full action details
                                                    console.log('Action details:', action);
                                                }}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                            {recentActions.filter(a => historyFilter === 'all' || a.action_status === historyFilter).length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                    No {historyFilter === 'all' ? '' : historyFilter} actions found
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-2">🤖</div>
                            <p className="text-slate-400">No agent actions yet</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Actions taken by your AI Coach will appear here
                            </p>
                        </div>
                    )}

                    {recentActions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Executed: {recentActions.filter(a => a.action_status === 'executed').length}
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                    Cancelled: {recentActions.filter(a => a.action_status === 'cancelled').length}
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    Failed: {recentActions.filter(a => a.action_status === 'failed').length}
                                </span>
                            </div>
                            <button
                                onClick={fetchData}
                                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                    )}
                </div>

                {/* CALENDAR INTEGRATION CARD */}
                {userId && (
                    <div className={`transition-opacity ${!settings.agent_actions_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <CalendarConnection
                            userId={userId}
                            onConnectionChange={(connected) => {
                                // Could refresh settings or show notification
                                if (connected) {
                                    setSuccess('Calendar connected successfully!');
                                    setTimeout(() => setSuccess(null), 3000);
                                }
                            }}
                        />
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
