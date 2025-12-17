import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface AICoachSettingsProps {
  teamId: string;
  teamName: string;
  isPlatformAdmin?: boolean;
}

interface AISettings {
  id?: string;
  team_id: string;
  coach_name: string;
  coach_tone: string;
  blocked_topics: string[];
  required_disclaimers: string[];
  custom_instructions: string;
  enable_sentiment_alerts: boolean;
  sentiment_alert_threshold: number;
  enable_crisis_detection: boolean;
  crisis_escalation_email: string;
  crisis_keywords: string[];
  max_session_duration_minutes: number;
  max_sessions_per_day: number;
  cooldown_between_sessions_minutes: number;
  allow_send_email: boolean;
  allow_create_tasks: boolean;
  allow_schedule_reminders: boolean;
  allow_access_user_data: boolean;
  require_confirmation: boolean;
  default_voice: string;
  default_voice_speed: number;
}

const defaultSettings: Omit<AISettings, 'team_id'> = {
  coach_name: 'AMIE',
  coach_tone: 'warm_encouraging',
  blocked_topics: [],
  required_disclaimers: [],
  custom_instructions: '',
  enable_sentiment_alerts: true,
  sentiment_alert_threshold: 0.3,
  enable_crisis_detection: true,
  crisis_escalation_email: '',
  crisis_keywords: ['suicide', 'self-harm', 'hurt myself', 'end it all'],
  max_session_duration_minutes: 30,
  max_sessions_per_day: 5,
  cooldown_between_sessions_minutes: 0,
  allow_send_email: true,
  allow_create_tasks: true,
  allow_schedule_reminders: true,
  allow_access_user_data: true,
  require_confirmation: true,
  default_voice: 'default',
  default_voice_speed: 1.0
};

const toneOptions = [
  { value: 'warm_encouraging', label: 'Warm & Encouraging', description: 'Supportive and nurturing tone' },
  { value: 'professional', label: 'Professional', description: 'Business-like and focused' },
  { value: 'casual', label: 'Casual', description: 'Friendly and relaxed' },
  { value: 'motivational', label: 'Motivational', description: 'High-energy and inspiring' },
  { value: 'direct', label: 'Direct', description: 'Straightforward and concise' }
];

const AICoachSettings: React.FC<AICoachSettingsProps> = ({
  teamId,
  teamName,
  isPlatformAdmin = false
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<AISettings>({ ...defaultSettings, team_id: teamId });

  // Input states for array fields
  const [newBlockedTopic, setNewBlockedTopic] = useState('');
  const [newDisclaimer, setNewDisclaimer] = useState('');
  const [newCrisisKeyword, setNewCrisisKeyword] = useState('');

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    if (!teamId || teamId === 'all') {
      setError('Please select a specific team to configure');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('team_ai_settings')
        .select('*')
        .eq('team_id', teamId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        setSettings(data);
      } else {
        setSettings({ ...defaultSettings, team_id: teamId });
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const settingsToSave = {
        ...settings,
        updated_by: user.id
      };

      // Upsert settings
      const { error: upsertError } = await supabase
        .from('team_ai_settings')
        .upsert(settingsToSave, {
          onConflict: 'team_id'
        });

      if (upsertError) throw upsertError;

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addToArray = (field: 'blocked_topics' | 'required_disclaimers' | 'crisis_keywords', value: string) => {
    if (!value.trim()) return;
    if (settings[field].includes(value.trim())) return;

    setSettings(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }));

    // Clear input
    if (field === 'blocked_topics') setNewBlockedTopic('');
    if (field === 'required_disclaimers') setNewDisclaimer('');
    if (field === 'crisis_keywords') setNewCrisisKeyword('');
  };

  const removeFromArray = (field: 'blocked_topics' | 'required_disclaimers' | 'crisis_keywords', index: number) => {
    setSettings(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading settings...</p>
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
            <span className="text-2xl">🤖</span>
            AI Coach Settings
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            Configure guardrails and behavior for {teamName}'s AI coach
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-200">
          {success}
        </div>
      )}

      {/* Coach Personality */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🎭</span> Coach Personality
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2">Coach Name</label>
            <input
              type="text"
              value={settings.coach_name}
              onChange={(e) => setSettings(prev => ({ ...prev, coach_name: e.target.value }))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="AMIE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2">Communication Tone</label>
            <select
              value={settings.coach_tone}
              onChange={(e) => setSettings(prev => ({ ...prev, coach_tone: e.target.value }))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {toneOptions.map(tone => (
                <option key={tone.value} value={tone.value} className="bg-purple-900">
                  {tone.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-indigo-300 mt-1">
              {toneOptions.find(t => t.value === settings.coach_tone)?.description}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-indigo-200 mb-2">Custom Instructions</label>
          <textarea
            value={settings.custom_instructions}
            onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="Add any custom instructions for the AI coach..."
          />
        </div>
      </div>

      {/* Topic Guardrails */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🚫</span> Topic Guardrails
        </h3>
        <p className="text-indigo-200 text-sm mb-4">
          Define topics the AI coach should avoid discussing with team members.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newBlockedTopic}
            onChange={(e) => setNewBlockedTopic(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addToArray('blocked_topics', newBlockedTopic)}
            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Add a topic to block..."
          />
          <button
            onClick={() => addToArray('blocked_topics', newBlockedTopic)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {settings.blocked_topics.map((topic, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-300 rounded-full"
            >
              {topic}
              <button
                onClick={() => removeFromArray('blocked_topics', i)}
                className="hover:text-red-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {settings.blocked_topics.length === 0 && (
            <span className="text-indigo-300 text-sm">No blocked topics configured</span>
          )}
        </div>
      </div>

      {/* Safety Controls */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🛡️</span> Safety Controls
        </h3>

        <div className="space-y-6">
          {/* Sentiment Alerts */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <p className="font-medium text-white">Low Sentiment Alerts</p>
              <p className="text-sm text-indigo-200">Alert managers when members show signs of struggling</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enable_sentiment_alerts}
                onChange={(e) => setSettings(prev => ({ ...prev, enable_sentiment_alerts: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>

          {settings.enable_sentiment_alerts && (
            <div className="ml-4 p-4 bg-white/5 rounded-lg">
              <label className="block text-sm font-medium text-indigo-200 mb-2">
                Alert Threshold: {Math.round(settings.sentiment_alert_threshold * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={settings.sentiment_alert_threshold}
                onChange={(e) => setSettings(prev => ({ ...prev, sentiment_alert_threshold: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-indigo-300 mt-1">
                Lower threshold = more sensitive (more alerts)
              </p>
            </div>
          )}

          {/* Crisis Detection */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <p className="font-medium text-white">Crisis Detection</p>
              <p className="text-sm text-indigo-200">Detect and escalate potential crisis situations</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enable_crisis_detection}
                onChange={(e) => setSettings(prev => ({ ...prev, enable_crisis_detection: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>

          {settings.enable_crisis_detection && (
            <div className="ml-4 space-y-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <label className="block text-sm font-medium text-indigo-200 mb-2">Escalation Email</label>
                <input
                  type="email"
                  value={settings.crisis_escalation_email}
                  onChange={(e) => setSettings(prev => ({ ...prev, crisis_escalation_email: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="manager@company.com"
                />
              </div>

              <div className="p-4 bg-white/5 rounded-lg">
                <label className="block text-sm font-medium text-indigo-200 mb-2">Crisis Keywords</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCrisisKeyword}
                    onChange={(e) => setNewCrisisKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addToArray('crisis_keywords', newCrisisKeyword)}
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Add keyword..."
                  />
                  <button
                    onClick={() => addToArray('crisis_keywords', newCrisisKeyword)}
                    className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.crisis_keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => removeFromArray('crisis_keywords', i)}
                        className="hover:text-orange-100"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Limits */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>⏱️</span> Session Limits
        </h3>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2">
              Max Duration (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={settings.max_session_duration_minutes}
              onChange={(e) => setSettings(prev => ({ ...prev, max_session_duration_minutes: parseInt(e.target.value) || 30 }))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2">
              Max Sessions Per Day
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.max_sessions_per_day}
              onChange={(e) => setSettings(prev => ({ ...prev, max_sessions_per_day: parseInt(e.target.value) || 5 }))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2">
              Cooldown (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={settings.cooldown_between_sessions_minutes}
              onChange={(e) => setSettings(prev => ({ ...prev, cooldown_between_sessions_minutes: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Agentic Capabilities */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>⚡</span> Agentic Capabilities
        </h3>
        <p className="text-indigo-200 text-sm mb-4">
          Control what actions the AI coach can perform on behalf of team members.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: 'allow_send_email', label: 'Send Emails', icon: '📧', desc: 'Coach can send emails for users' },
            { key: 'allow_create_tasks', label: 'Create Tasks', icon: '✅', desc: 'Coach can create action items' },
            { key: 'allow_schedule_reminders', label: 'Schedule Reminders', icon: '🔔', desc: 'Coach can set reminders' },
            { key: 'allow_access_user_data', label: 'Access User Data', icon: '📊', desc: 'Coach can look up goals/habits' },
          ].map(({ key, label, icon, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="text-xs text-indigo-300">{desc}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key as keyof AISettings] as boolean}
                  onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div>
                <p className="font-medium text-white">Require Confirmation</p>
                <p className="text-sm text-yellow-200">Users must confirm before AI takes action</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_confirmation}
                onChange={(e) => setSettings(prev => ({ ...prev, require_confirmation: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save All Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AICoachSettings;
