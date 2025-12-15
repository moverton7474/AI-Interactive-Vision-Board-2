import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  ChartBarIcon,
  TrophyIcon,
  FireIcon,
  CheckCircleIcon,
  XMarkIcon,
  RefreshIcon,
  PlusIcon
} from './Icons';
import SiteSettingsManager from './admin/SiteSettingsManager';
import TeamMemberAdmin from './admin/TeamMemberAdmin';

interface Props {
  onBack?: () => void;
}

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: 'admin' | 'manager' | 'member';
  joined_at: string;
  current_streak: number;
  habits_completed_this_week: number;
  total_habits: number;
  completion_rate: number;
  last_active?: string;
  status: 'active' | 'at_risk' | 'inactive';
}

interface TeamStats {
  total_members: number;
  active_members: number;
  total_habits: number;
  completions_this_week: number;
  avg_completion_rate: number;
  top_streak: number;
  at_risk_count: number;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

/**
 * ManagerDashboard - Enterprise admin view for team progress
 *
 * Provides team overview, member management, progress tracking,
 * and engagement metrics for team managers and administrators.
 */
const ManagerDashboard: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'members' | 'reports' | 'site_settings' | 'team_admin'>('overview');

  // Data states
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [isManager, setIsManager] = useState(false);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Platform admin state
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to access the manager dashboard');
        setLoading(false);
        return;
      }

      // Check if user is a platform admin (bypasses team requirement)
      const { data: platformRole } = await supabase
        .from('platform_roles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const isAdmin = platformRole?.role === 'platform_admin';
      setIsPlatformAdmin(isAdmin);

      // Check if user is a team member/manager
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select(`
          *,
          teams (*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if ((memberError || !memberData) && !isAdmin) {
        setError('You are not part of any team. Create or join a team to access this dashboard.');
        setLoading(false);
        return;
      }

      // Platform admins are always managers
      setIsManager(isAdmin || memberData?.role === 'admin' || memberData?.role === 'manager' || memberData?.role === 'owner');

      // Set team - platform admins without a team see "All Teams"
      if (memberData?.teams) {
        setTeam(memberData.teams);
      } else if (isAdmin) {
        setTeam({ id: 'all', name: 'All Teams (Platform Admin)', description: 'Platform-wide view', created_at: new Date().toISOString() });
      }

      // Load team members - platform admins can see all, others see their team only
      let teamMembers: any[] = [];

      // Only query team members if user has a team OR is platform admin viewing all
      if (memberData?.team_id || isAdmin) {
        let teamMembersQuery = supabase
          .from('team_members')
          .select(`
            *,
            profiles:user_id (
              email
            ),
            teams (name)
          `);

        // If not platform admin, filter to their team
        if (!isAdmin && memberData?.team_id) {
          teamMembersQuery = teamMembersQuery.eq('team_id', memberData.team_id);
        }

        // For platform admins, limit the query to avoid overwhelming results
        if (isAdmin && !memberData?.team_id) {
          teamMembersQuery = teamMembersQuery.limit(100);
        }

        // Only show active members
        teamMembersQuery = teamMembersQuery.eq('is_active', true);

        const { data, error: membersError } = await teamMembersQuery;

        // Don't throw on error for platform admins - they can still access site settings
        if (membersError) {
          console.warn('Could not load team members:', membersError);
          if (!isAdmin) throw membersError;
        } else {
          teamMembers = data || [];
        }
      }

      // Transform member data
      const transformedMembers: TeamMember[] = (teamMembers || []).map((member: any) => {
        // Calculate member status based on activity
        const lastActive = member.last_active_at ? new Date(member.last_active_at) : null;
        const daysSinceActive = lastActive
          ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        let status: 'active' | 'at_risk' | 'inactive' = 'active';
        if (daysSinceActive > 7) status = 'inactive';
        else if (daysSinceActive > 3) status = 'at_risk';

        // Extract name from email (before @) as display name
        const email = member.profiles?.email || '';
        const displayName = email ? email.split('@')[0] : 'Team Member';

        return {
          id: member.id,
          user_id: member.user_id,
          name: displayName,
          email: email,
          avatar_url: null,
          role: member.role,
          joined_at: member.created_at,
          current_streak: member.current_streak || 0,
          habits_completed_this_week: member.weekly_completions || 0,
          total_habits: member.total_habits || 0,
          completion_rate: member.completion_rate || 0,
          last_active: member.last_active_at,
          status
        };
      });

      setMembers(transformedMembers);

      // Calculate team stats
      const activeCount = transformedMembers.filter(m => m.status === 'active').length;
      const atRiskCount = transformedMembers.filter(m => m.status === 'at_risk').length;
      const totalCompletions = transformedMembers.reduce((sum, m) => sum + m.habits_completed_this_week, 0);
      const avgCompletion = transformedMembers.length > 0
        ? Math.round(transformedMembers.reduce((sum, m) => sum + m.completion_rate, 0) / transformedMembers.length)
        : 0;
      const topStreak = Math.max(...transformedMembers.map(m => m.current_streak), 0);

      setStats({
        total_members: transformedMembers.length,
        active_members: activeCount,
        total_habits: transformedMembers.reduce((sum, m) => sum + m.total_habits, 0),
        completions_this_week: totalCompletions,
        avg_completion_rate: avgCompletion,
        top_streak: topStreak,
        at_risk_count: atRiskCount
      });

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !team) return;

    setInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create invitation
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: inviteError } = await supabase
        .from('partner_invitations')
        .insert({
          inviter_id: user.id,
          invitee_email: inviteEmail.trim(),
          invite_code: inviteCode,
          message: `You've been invited to join ${team.name} on Visionary AI`,
          expires_at: expiresAt.toISOString()
        });

      if (inviteError) throw inviteError;

      setInviteEmail('');
      setShowInviteModal(false);
      // In production, send email with invite link
      alert(`Invitation sent! Share code: ${inviteCode}`);
    } catch (err) {
      console.error('Error sending invite:', err);
      alert('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const getStatusBadge = (status: 'active' | 'at_risk' | 'inactive') => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>;
      case 'at_risk':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">At Risk</span>;
      case 'inactive':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Inactive</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400">Admin</span>;
      case 'manager':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Manager</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Member</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-purple-800 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-purple-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <ChartBarIcon className="w-8 h-8 text-indigo-400" />
                Manager Dashboard
                {isPlatformAdmin && (
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/50">
                    Platform Admin
                  </span>
                )}
              </h1>
              <p className="text-indigo-200 mt-1">
                {team?.name || 'Team Overview'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Refresh"
            >
              <RefreshIcon className="w-5 h-5" />
            </button>
            {isManager && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Invite Member
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        {/* View Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id: 'overview', label: 'Overview', adminOnly: false },
            { id: 'members', label: 'Team Members', adminOnly: false },
            { id: 'reports', label: 'Reports', adminOnly: false },
            { id: 'team_admin', label: 'Manage Members', adminOnly: true },
            { id: 'site_settings', label: 'Site Settings', adminOnly: true },
          ]
            .filter(view => !view.adminOnly || isPlatformAdmin)
            .map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeView === view.id
                  ? 'bg-white text-purple-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              } ${view.adminOnly ? 'flex items-center gap-2' : ''}`}
            >
              {view.label}
              {view.adminOnly && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Overview View */}
        {activeView === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <ChartBarIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.total_members}</p>
                <p className="text-indigo-200 text-sm">Total Members</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircleIcon className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.active_members}</p>
                <p className="text-indigo-200 text-sm">Active This Week</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <TrophyIcon className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.avg_completion_rate}%</p>
                <p className="text-indigo-200 text-sm">Avg Completion</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <FireIcon className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.top_streak}</p>
                <p className="text-indigo-200 text-sm">Top Streak</p>
              </div>
            </div>

            {/* Alerts Section */}
            {stats.at_risk_count > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-yellow-300 mb-2">Attention Needed</h3>
                <p className="text-yellow-200">
                  {stats.at_risk_count} team member{stats.at_risk_count > 1 ? 's are' : ' is'} at risk of falling behind.
                  Consider reaching out to encourage them.
                </p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">This Week's Activity</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-4xl font-bold text-white">{stats.completions_this_week}</p>
                  <p className="text-indigo-200">Habits Completed</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">{stats.total_habits}</p>
                  <p className="text-indigo-200">Total Tracked Habits</p>
                </div>
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Top Performers This Week</h3>
              <div className="space-y-3">
                {members
                  .sort((a, b) => b.habits_completed_this_week - a.habits_completed_this_week)
                  .slice(0, 5)
                  .map((member, index) => (
                    <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        index === 2 ? 'bg-amber-600 text-amber-100' :
                        'bg-white/10 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-sm text-indigo-200">{member.habits_completed_this_week} completions</p>
                      </div>
                      <div className="flex items-center gap-1 text-orange-400">
                        <FireIcon className="w-4 h-4" />
                        <span className="font-medium">{member.current_streak}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Members View */}
        {activeView === 'members' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20">
            <div className="p-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Team Members ({members.length})</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-4 text-indigo-200 font-medium">Member</th>
                    <th className="text-left p-4 text-indigo-200 font-medium">Role</th>
                    <th className="text-left p-4 text-indigo-200 font-medium">Status</th>
                    <th className="text-center p-4 text-indigo-200 font-medium">Streak</th>
                    <th className="text-center p-4 text-indigo-200 font-medium">This Week</th>
                    <th className="text-center p-4 text-indigo-200 font-medium">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              member.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white">{member.name}</p>
                            <p className="text-sm text-indigo-200">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getRoleBadge(member.role)}</td>
                      <td className="p-4">{getStatusBadge(member.status)}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-orange-400">
                          <FireIcon className="w-4 h-4" />
                          <span className="font-medium text-white">{member.current_streak}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-medium text-white">{member.habits_completed_this_week}</span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${member.completion_rate}%` }}
                            />
                          </div>
                          <span className="text-sm text-white">{member.completion_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports View */}
        {activeView === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Weekly Report</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-white">{stats?.completions_this_week || 0}</p>
                  <p className="text-sm text-indigo-200">Total Completions</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-white">{stats?.avg_completion_rate || 0}%</p>
                  <p className="text-sm text-indigo-200">Avg Completion Rate</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-white">{stats?.active_members || 0}</p>
                  <p className="text-sm text-indigo-200">Active Members</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-white">{stats?.top_streak || 0}</p>
                  <p className="text-sm text-indigo-200">Longest Streak</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors">
                  Export CSV
                </button>
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors">
                  Send Report
                </button>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Engagement Trends</h3>
              <div className="h-48 flex items-center justify-center text-indigo-200">
                <p>Chart visualization coming soon...</p>
              </div>
            </div>
          </div>
        )}

        {/* Team Admin View - Platform Admin Only */}
        {activeView === 'team_admin' && isPlatformAdmin && (
          <TeamMemberAdmin />
        )}

        {/* Site Settings View - Platform Admin Only */}
        {activeView === 'site_settings' && isPlatformAdmin && (
          <SiteSettingsManager />
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-purple-900 rounded-xl p-6 max-w-md w-full border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Invite Team Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
