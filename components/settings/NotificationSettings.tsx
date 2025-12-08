import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserCommPreferences } from '../../types';
import { ClockIcon, SaveIcon, SparklesIcon } from '../Icons';

export default function NotificationSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [prefs, setPrefs] = useState<UserCommPreferences | null>(null);
    const [peakHour, setPeakHour] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Preferences
            const { data: prefData, error: prefError } = await supabase
                .from('user_comm_preferences')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (prefError && prefError.code !== 'PGRST116') throw prefError;

            if (prefData) {
                setPrefs(prefData);
            } else {
                // Init if empty
                const defaultPrefs = {
                    preferred_channel: 'push',
                    preferred_times: { morning: true, afternoon: false, evening: true },
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    quiet_hours: { start: '22:00', end: '07:00' },
                    smart_optimization_enabled: true
                };
                // @ts-ignore
                setPrefs(defaultPrefs);
            }

            // Fetch Peak Activity Hour (Smart Logic)
            const { data: peakData, error: rpcError } = await supabase
                .rpc('get_user_peak_activity_hour', { p_user_id: user.id });

            if (!rpcError) {
                setPeakHour(peakData);
            }

        } catch (err: any) {
            console.error('Error fetching settings:', err);
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
            if (!user || !prefs) return;

            const updates = {
                user_id: user.id,
                ...prefs,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('user_comm_preferences')
                .upsert(updates);

            if (error) throw error;
            setSuccess('Settings saved successfully');

            // Refresh to ensure sync
            fetchData();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatHour = (hour: number) => {
        const d = new Date();
        d.setHours(hour, 0, 0, 0);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 bg-slate-900 rounded-2xl shadow-xl">

            <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        🔔 Notification Settings
                    </h1>
                    <p className="text-slate-400 mt-1">Manage how and when your AI Coach contacts you.</p>
                </div>
            </div>

            {error && <div className="bg-red-900/30 text-red-200 p-4 rounded-lg border border-red-800">{error}</div>}
            {success && <div className="bg-green-900/30 text-green-200 p-4 rounded-lg border border-green-800">{success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* SMART OPTIMIZATION CARD */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <SparklesIcon className="w-24 h-24 text-amber-400" />
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-amber-400" />
                            Smart Optimization
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={prefs?.smart_optimization_enabled}
                                onChange={(e) => setPrefs(prev => prev ? ({ ...prev, smart_optimization_enabled: e.target.checked }) : null)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                    </div>

                    <p className="text-slate-300 text-sm mb-4">
                        When enabled, valid reminders (without fixed times) will be sent during your <strong>Peak Activity Window</strong> to maximize engagement.
                    </p>

                    {peakHour !== null && (
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 flex items-center gap-3 relative z-10">
                            <ClockIcon className="w-5 h-5 text-indigo-400" />
                            <div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Your Peak Hour</div>
                                <div className="text-lg font-bold text-white">{formatHour(peakHour)}</div>
                            </div>
                        </div>
                    )}

                    {peakHour === null && (
                        <div className="text-xs text-slate-500 mt-2 bg-slate-900/30 p-2 rounded relative z-10">
                            We're still learning your schedule. Complete more habits to unlock Peak Hour insights.
                        </div>
                    )}
                </div>

                {/* QUIET HOURS CARD */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <ClockIcon className="w-5 h-5 text-blue-400" />
                        Quiet Hours
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Your AI Coach will not send notifications during this window (except for critical alerts).
                    </p>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
                            <input
                                type="time"
                                value={prefs?.quiet_hours?.start || '22:00'}
                                onChange={(e) => setPrefs(prev => prev ? ({ ...prev, quiet_hours: { ...prev.quiet_hours, start: e.target.value } }) : null)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
                            <input
                                type="time"
                                value={prefs?.quiet_hours?.end || '07:00'}
                                onChange={(e) => setPrefs(prev => prev ? ({ ...prev, quiet_hours: { ...prev.quiet_hours, end: e.target.value } }) : null)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* CHANNEL PREFERENCES */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 md:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">Communication Channels</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/20 rounded-full text-green-400">
                                    💬
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">SMS / Text</div>
                                    <div className="text-xs text-slate-400">Receive habits and summaries via text</div>
                                </div>
                            </div>
                            <select
                                value={prefs?.preferred_channel === 'sms' ? 'primary' : 'secondary'}
                                onChange={(e) => {
                                    if (e.target.value === 'primary') setPrefs(prev => prev ? ({ ...prev, preferred_channel: 'sms' }) : null)
                                }}
                                className="bg-slate-800 border border-slate-600 rounded text-sm text-white px-2 py-1"
                            >
                                <option value="primary">Primary</option>
                                <option value="secondary">Disabled</option>
                            </select>
                        </div>

                        <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            ℹ️ Updates to phone number must be done in Account Settings.
                        </div>
                    </div>
                </div>

            </div>

            <div className="flex justify-end pt-4 border-t border-slate-700">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                    {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <SaveIcon className="w-4 h-4" />}
                    Save Settings
                </button>
            </div>

        </div>
    );
}
