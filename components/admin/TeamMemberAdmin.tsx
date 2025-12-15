import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  email?: string;
  team_name?: string;
}

interface Team {
  id: string;
  name: string;
}

interface Props {
  onClose?: () => void;
}

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

/**
 * TeamMemberAdmin - Admin panel for managing team members
 *
 * Allows platform admins to:
 * - View all team members across teams
 * - Add members to teams
 * - Remove members from teams
 * - Change member roles
 * - Reactivate deactivated members
 */
const TeamMemberAdmin: React.FC<Props> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Add member modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addTeamId, setAddTeamId] = useState('');
  const [addRole, setAddRole] = useState('member');

  // Filter state
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // Load all team members with profiles
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          team_id,
          role,
          is_active,
          joined_at,
          profiles:user_id (email),
          teams (name)
        `)
        .order('joined_at', { ascending: false });

      if (membersError) throw membersError;

      const transformed = (membersData || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        team_id: m.team_id,
        role: m.role,
        is_active: m.is_active,
        joined_at: m.joined_at,
        email: m.profiles?.email || 'Unknown',
        team_name: m.teams?.name || 'Unknown Team'
      }));

      setMembers(transformed);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const callAdminFunction = async (action: string, params: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-team-membership`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, ...params })
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || result.message || 'Operation failed');
    }
    return result;
  };

  const handleAddMember = async () => {
    if (!addEmail.trim() || !addTeamId || !addRole) {
      setError('Please fill in all fields');
      return;
    }

    setProcessing('add');
    setError(null);
    setSuccess(null);

    try {
      // First, find the user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', addEmail.trim().toLowerCase())
        .single();

      if (profileError || !profile) {
        throw new Error('User not found. They must have an account first.');
      }

      await callAdminFunction('add', {
        team_id: addTeamId,
        user_id: profile.id,
        role: addRole
      });

      setSuccess(`Added ${addEmail} to team as ${addRole}`);
      setShowAddModal(false);
      setAddEmail('');
      setAddTeamId('');
      setAddRole('member');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.email} from ${member.team_name}?`)) return;

    setProcessing(member.id);
    setError(null);
    setSuccess(null);

    try {
      await callAdminFunction('remove', {
        team_id: member.team_id,
        user_id: member.user_id
      });

      setSuccess(`Removed ${member.email} from ${member.team_name}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setProcessing(null);
    }
  };

  const handleReactivate = async (member: TeamMember) => {
    setProcessing(member.id);
    setError(null);
    setSuccess(null);

    try {
      await callAdminFunction('add', {
        team_id: member.team_id,
        user_id: member.user_id,
        role: member.role
      });

      setSuccess(`Reactivated ${member.email} in ${member.team_name}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reactivate member');
    } finally {
      setProcessing(null);
    }
  };

  const handleChangeRole = async (member: TeamMember, newRole: string) => {
    if (newRole === member.role) return;

    setProcessing(member.id);
    setError(null);
    setSuccess(null);

    try {
      await callAdminFunction('change_role', {
        team_id: member.team_id,
        user_id: member.user_id,
        role: newRole
      });

      setSuccess(`Changed ${member.email}'s role to ${newRole}`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to change role');
    } finally {
      setProcessing(null);
    }
  };

  // Filter members
  const filteredMembers = members.filter(m => {
    if (filterTeam !== 'all' && m.team_id !== filterTeam) return false;
    if (!showInactive && !m.is_active) return false;
    return true;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500/20 text-yellow-400';
      case 'admin': return 'bg-purple-500/20 text-purple-400';
      case 'manager': return 'bg-blue-500/20 text-blue-400';
      case 'member': return 'bg-gray-500/20 text-gray-400';
      case 'viewer': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Team Member Management</h2>
            <p className="text-indigo-200 text-sm mt-1">
              Add, remove, and manage team members across all teams
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        </div>
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

      {/* Filters */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-indigo-200 text-sm">Team:</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
            >
              <option value="all">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-indigo-200 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-white/20"
            />
            Show inactive members
          </label>
          <div className="ml-auto text-indigo-200 text-sm">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-4 text-indigo-200 font-medium">Member</th>
              <th className="text-left p-4 text-indigo-200 font-medium">Team</th>
              <th className="text-left p-4 text-indigo-200 font-medium">Role</th>
              <th className="text-left p-4 text-indigo-200 font-medium">Status</th>
              <th className="text-left p-4 text-indigo-200 font-medium">Joined</th>
              <th className="text-right p-4 text-indigo-200 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredMembers.map((member) => (
              <tr key={member.id} className={`hover:bg-white/5 transition-colors ${!member.is_active ? 'opacity-60' : ''}`}>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {member.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.email?.split('@')[0]}</p>
                      <p className="text-sm text-indigo-300">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-white">{member.team_name}</td>
                <td className="p-4">
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member, e.target.value)}
                    disabled={processing === member.id || !member.is_active}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)} bg-opacity-100 border-0 cursor-pointer disabled:cursor-not-allowed`}
                  >
                    {VALID_ROLES.map(role => (
                      <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  {member.is_active ? (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Inactive</span>
                  )}
                </td>
                <td className="p-4 text-indigo-200 text-sm">
                  {new Date(member.joined_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  {processing === member.id ? (
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  ) : member.is_active ? (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivate(member)}
                      className="px-3 py-1 text-sm bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-indigo-200">
                  No team members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-purple-900 rounded-xl p-6 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Add Team Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  User Email
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-indigo-300 mt-1">User must already have an account</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Team
                </label>
                <select
                  value={addTeamId}
                  onChange={(e) => setAddTeamId(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {VALID_ROLES.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={processing === 'add' || !addEmail || !addTeamId}
                  className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {processing === 'add' ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMemberAdmin;
