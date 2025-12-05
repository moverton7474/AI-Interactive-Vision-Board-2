import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SystemSOPWidget from './SystemSOPWidget';
import IdentityFeedWidget from './IdentityFeedWidget';

interface Props {
  onBack?: () => void;
}

interface Partner {
  id: string;
  name: string;
  tier: string;
  stats: {
    activeHabits: number;
    weeklyCompletions: number;
  };
}

interface PartnerProgress {
  id: string;
  habits: Array<{
    id: string;
    title: string;
    frequency: string;
    current_streak: number;
    completedToday: boolean;
  }>;
  todayProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  latestReview: {
    wins: string[];
    mood_average: number;
    habit_completion_rate: number;
  } | null;
  visionBoardCount: number;
}

interface SharedGoal {
  id: string;
  title: string;
  description?: string;
  category: string;
  target_date?: string;
  target_value?: number;
  current_value: number;
  unit?: string;
  status: string;
  created_at: string;
  created_by: string;
}

interface Invitation {
  id: string;
  invite_code: string;
  invitee_email: string;
  expires_at: string;
  profiles?: { names: string };
}

interface FeedItem {
  type: string;
  userId: string;
  isPartner: boolean;
  title: string;
  timestamp: string;
}

/**
 * PartnerDashboard - Partner collaboration workspace
 *
 * Displays partner status, shared goals, activity feed,
 * and invitation management for couple/partner accounts.
 */
const PartnerDashboard: React.FC<Props> = ({ onBack }) => {
  const [view, setView] = useState<'dashboard' | 'invite' | 'goals'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Partnership state
  const [hasPartner, setHasPartner] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerProgress, setPartnerProgress] = useState<PartnerProgress | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);

  // Shared goals
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);

  // Activity feed
  const [feed, setFeed] = useState<FeedItem[]>([]);

  // Invitations
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);

  // New goal form
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'financial',
    targetDate: '',
    targetValue: '',
    unit: ''
  });

  useEffect(() => {
    loadPartnerStatus();
  }, []);

  const loadPartnerStatus = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get partnership status
      const statusResponse = await supabase.functions.invoke('partner-collaboration', {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (statusResponse.data) {
        setHasPartner(statusResponse.data.hasPartner);
        setPartner(statusResponse.data.partner);
        setConnectedAt(statusResponse.data.connectedAt);

        if (statusResponse.data.hasPartner) {
          // Load additional data for connected partners
          await Promise.all([
            loadPartnerProgress(session.access_token),
            loadSharedGoals(session.access_token),
            loadActivityFeed(session.access_token)
          ]);
        } else {
          // Load pending invitations
          await loadInvitations(session.access_token);
        }
      }
    } catch (err: any) {
      console.error('Error loading partner status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPartnerProgress = async (token: string) => {
    const response = await supabase.functions.invoke('partner-collaboration', {
      body: {},
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data?.partner) {
      setPartnerProgress(response.data.partner);
    }
  };

  const loadSharedGoals = async (token: string) => {
    const response = await supabase.functions.invoke('partner-collaboration', {
      body: {},
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data?.goals) {
      setSharedGoals(response.data.goals);
    }
  };

  const loadActivityFeed = async (token: string) => {
    const response = await supabase.functions.invoke('partner-collaboration', {
      body: {},
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data?.feed) {
      setFeed(response.data.feed);
    }
  };

  const loadInvitations = async (token: string) => {
    const response = await supabase.functions.invoke('partner-collaboration', {
      body: {},
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data) {
      setSentInvitations(response.data.sent || []);
      setReceivedInvitations(response.data.received || []);
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('partner-collaboration', {
        body: {
          partnerEmail: inviteEmail.trim(),
          message: inviteMessage.trim() || undefined
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      setInviteEmail('');
      setInviteMessage('');
      await loadInvitations(session.access_token);
      setView('dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const acceptInvitation = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('partner-collaboration', {
        body: { inviteCode: code },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      await loadPartnerStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const declineInvitation = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      await supabase.functions.invoke('partner-collaboration', {
        body: { inviteCode: code },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      await loadInvitations(session.access_token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const unlinkPartner = async () => {
    if (!confirm('Are you sure you want to end this partner connection?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      await supabase.functions.invoke('partner-collaboration', {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      await loadPartnerStatus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createSharedGoal = async () => {
    if (!newGoal.title.trim()) {
      setError('Please enter a goal title');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('partner-collaboration', {
        body: {
          title: newGoal.title,
          description: newGoal.description,
          category: newGoal.category,
          targetDate: newGoal.targetDate || undefined,
          targetValue: newGoal.targetValue ? parseFloat(newGoal.targetValue) : undefined,
          unit: newGoal.unit || undefined
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);

      setShowNewGoalModal(false);
      setNewGoal({ title: '', description: '', category: 'financial', targetDate: '', targetValue: '', unit: '' });
      await loadSharedGoals(session.access_token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
      </div>
    );
  }

  // No Partner Connected View
  if (!hasPartner) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-navy-900">Partner Workspace</h1>
            <p className="text-gray-500 mt-1">Connect with your partner for shared accountability</p>
          </div>
          {onBack && (
            <button onClick={onBack} className="text-gray-500 hover:text-navy-900 font-medium">
              ← Back
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-400">✕</button>
          </div>
        )}

        {/* Received Invitations */}
        {receivedInvitations.length > 0 && (
          <div className="bg-gold-50 border border-gold-200 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-navy-900 mb-4">Pending Invitations</h3>
            {receivedInvitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg p-4 mb-2">
                <div>
                  <p className="font-medium text-navy-900">
                    {inv.profiles?.names || 'Someone'} wants to connect!
                  </p>
                  <p className="text-sm text-gray-500">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptInvitation(inv.invite_code)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineInvitation(inv.invite_code)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invite Partner Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">💑</span>
            </div>
            <h2 className="text-2xl font-bold text-navy-900 mb-2">Connect with Your Partner</h2>
            <p className="text-gray-500">
              Share goals, track progress together, and stay accountable as a team
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner's Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="partner@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal Message (optional)</label>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Let's achieve our goals together!"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                rows={2}
              />
            </div>
            <button
              onClick={sendInvitation}
              disabled={sending || !inviteEmail.trim()}
              className="w-full bg-navy-900 text-white py-3 rounded-lg font-bold hover:bg-navy-800 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>

          {/* Or enter code */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-center text-gray-500 mb-4">Have an invitation code?</p>
            <div className="max-w-xs mx-auto flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg uppercase font-mono"
                maxLength={8}
              />
              <button
                onClick={() => acceptInvitation(inviteCode)}
                disabled={inviteCode.length !== 8}
                className="bg-gold-500 text-navy-900 px-4 py-2 rounded-lg font-bold hover:bg-gold-600 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Sent Invitations */}
        {sentInvitations.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-navy-900 mb-4">Sent Invitations</h3>
            {sentInvitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                <div>
                  <p className="font-medium text-gray-700">{inv.invitee_email}</p>
                  <p className="text-sm text-gray-500">
                    Code: <span className="font-mono">{inv.invite_code}</span> •
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Pending</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Connected Partner Dashboard
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Partner Workspace</h1>
          <p className="text-gray-500 mt-1">
            Connected with {partner?.name || 'Partner'} since {connectedAt ? new Date(connectedAt).toLocaleDateString() : 'recently'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="text-gray-500 hover:text-navy-900 font-medium">
              ← Back
            </button>
          )}
          <button
            onClick={unlinkPartner}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Disconnect
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner Progress Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div>
              <h3 className="font-bold text-navy-900">{partner?.name || 'Partner'}</h3>
              <p className="text-sm text-gray-500">{partner?.tier} member</p>
            </div>
          </div>

          {partnerProgress && (
            <>
              {/* Today's Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Today's Habits</span>
                  <span className="font-medium text-navy-900">
                    {partnerProgress.todayProgress.completed}/{partnerProgress.todayProgress.total}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${partnerProgress.todayProgress.percentage}%` }}
                  />
                </div>
              </div>

              {/* Habit List */}
              <div className="space-y-2">
                {partnerProgress.habits.slice(0, 5).map(habit => (
                  <div key={habit.id} className="flex items-center gap-2 text-sm">
                    <span className={habit.completedToday ? 'text-green-500' : 'text-gray-300'}>
                      {habit.completedToday ? '✓' : '○'}
                    </span>
                    <span className={habit.completedToday ? 'text-gray-700' : 'text-gray-500'}>
                      {habit.title}
                    </span>
                    {habit.current_streak > 0 && (
                      <span className="text-xs text-orange-500">🔥{habit.current_streak}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Shared Goals Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900">Shared Goals</h3>
            <button
              onClick={() => setShowNewGoalModal(true)}
              className="text-sm text-navy-900 font-medium hover:text-gold-600"
            >
              + Add Goal
            </button>
          </div>

          {sharedGoals.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl mb-2 block">🎯</span>
              <p className="text-gray-500 text-sm">No shared goals yet</p>
              <button
                onClick={() => setShowNewGoalModal(true)}
                className="mt-3 text-navy-900 font-medium text-sm hover:text-gold-600"
              >
                Create your first goal
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedGoals.slice(0, 4).map(goal => (
                <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-navy-900 text-sm">{goal.title}</h4>
                      <p className="text-xs text-gray-500">{goal.category}</p>
                    </div>
                    {goal.target_value && (
                      <span className="text-xs font-medium text-navy-900">
                        {goal.current_value}/{goal.target_value} {goal.unit}
                      </span>
                    )}
                  </div>
                  {goal.target_value && (
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500 rounded-full"
                        style={{ width: `${Math.min((goal.current_value / goal.target_value) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-navy-900 mb-4">Activity Feed</h3>

          {feed.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl mb-2 block">📊</span>
              <p className="text-gray-500 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.isPartner ? 'bg-pink-100' : 'bg-navy-100'
                    }`}>
                    <span className="text-sm">
                      {item.type === 'habit_completion' ? '✓' : '🌟'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">
                        {item.isPartner ? partner?.name : 'You'}
                      </span>
                      {' '}
                      {item.type === 'habit_completion' ? 'completed' : 'created'}
                      {' '}
                      <span className="text-navy-900">{item.title}</span>
                    </p>
                    <p className="text-xs text-gray-400">{formatTimeAgo(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Systems & Identity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <SystemSOPWidget />
        <IdentityFeedWidget />
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-navy-900">{sharedGoals.length}</p>
          <p className="text-sm text-gray-500">Shared Goals</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-navy-900">{partner?.stats.activeHabits || 0}</p>
          <p className="text-sm text-gray-500">Partner's Habits</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-navy-900">{partner?.stats.weeklyCompletions || 0}</p>
          <p className="text-sm text-gray-500">Partner's Week</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-navy-900">{partnerProgress?.visionBoardCount || 0}</p>
          <p className="text-sm text-gray-500">Vision Boards</p>
        </div>
      </div>

      {/* New Goal Modal */}
      {showNewGoalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-navy-900 mb-4">Create Shared Goal</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title *</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="e.g., Save for vacation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="What's this goal about?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                >
                  <option value="financial">Financial</option>
                  <option value="health">Health & Fitness</option>
                  <option value="travel">Travel</option>
                  <option value="home">Home</option>
                  <option value="career">Career</option>
                  <option value="relationship">Relationship</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                  <input
                    type="number"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                    placeholder="e.g., 5000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                    placeholder="e.g., $, miles, lbs"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewGoalModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={createSharedGoal}
                disabled={!newGoal.title.trim()}
                className="flex-1 bg-navy-900 text-white py-2 rounded-lg font-bold hover:bg-navy-800 disabled:opacity-50"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDashboard;
