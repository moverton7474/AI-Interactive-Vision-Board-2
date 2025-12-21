/**
 * FeatureFlagManager - Admin component for managing feature flags
 *
 * Features:
 * - View all feature flags with status
 * - Enable/disable flags globally
 * - Manage rollout percentages
 * - View and manage user cohorts
 * - Override flags for specific users
 * - Phased rollout management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { FeatureFlag, UserCohort, FeatureFlagName } from '../../types';

// Icons
const FlagIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Types
interface UserWithCohort {
  userId: string;
  email: string;
  cohorts: UserCohort[];
}

interface UserFeatureFlagOverride {
  userId: string;
  email: string;
  featureName: string;
  isEnabled: boolean;
}

type TabType = 'flags' | 'cohorts' | 'users' | 'rollouts';

const COHORT_INFO: Record<UserCohort, { label: string; description: string; color: string }> = {
  internal: { label: 'Internal', description: 'Team members and developers', color: 'bg-purple-100 text-purple-700' },
  beta_testers: { label: 'Beta Testers', description: 'Users testing new features', color: 'bg-blue-100 text-blue-700' },
  early_adopters: { label: 'Early Adopters', description: 'Engaged users who try new features', color: 'bg-green-100 text-green-700' },
  premium: { label: 'Premium', description: 'Paid subscription users', color: 'bg-gold-100 text-gold-700' },
  all_users: { label: 'All Users', description: 'General availability', color: 'bg-gray-100 text-gray-700' }
};

const FeatureFlagManager: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('flags');
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cohort management
  const [usersWithCohorts, setUsersWithCohorts] = useState<UserWithCohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<UserCohort>('beta_testers');

  // User overrides
  const [userOverrides, setUserOverrides] = useState<UserFeatureFlagOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);

  // New user cohort modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCohort, setNewUserCohort] = useState<UserCohort>('beta_testers');

  useEffect(() => {
    loadFlags();
  }, []);

  useEffect(() => {
    if (activeTab === 'cohorts') {
      loadUsersWithCohorts();
    } else if (activeTab === 'users') {
      loadUserOverrides();
    }
  }, [activeTab]);

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('name');

      if (error) throw error;

      const mappedFlags: FeatureFlag[] = (data || []).map((f: any) => ({
        id: f.id,
        name: f.name as FeatureFlagName,
        displayName: f.display_name,
        description: f.description,
        defaultEnabled: f.default_enabled,
        allowedRoles: f.allowed_roles || [],
        allowedCohorts: f.allowed_cohorts || [],
        isActive: f.is_active,
        rolloutPercentage: f.rollout_percentage,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }));

      setFlags(mappedFlags);
    } catch (err: any) {
      console.error('Error loading flags:', err);
      setError('Failed to load feature flags. Please ensure you have admin permissions.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsersWithCohorts = async () => {
    setLoadingCohorts(true);
    try {
      const { data, error } = await supabase
        .from('user_cohorts')
        .select(`
          user_id,
          cohort,
          profiles:user_id (
            email
          )
        `)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (error) throw error;

      // Group by user
      const userMap = new Map<string, UserWithCohort>();
      (data || []).forEach((uc: any) => {
        const userId = uc.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            email: uc.profiles?.email || 'Unknown',
            cohorts: []
          });
        }
        userMap.get(userId)!.cohorts.push(uc.cohort);
      });

      setUsersWithCohorts(Array.from(userMap.values()));
    } catch (err: any) {
      console.error('Error loading user cohorts:', err);
    } finally {
      setLoadingCohorts(false);
    }
  };

  const loadUserOverrides = async () => {
    setLoadingOverrides(true);
    try {
      const { data, error } = await supabase
        .from('user_feature_flags')
        .select(`
          user_id,
          feature_name,
          is_enabled,
          profiles:user_id (
            email
          )
        `);

      if (error) throw error;

      const overrides: UserFeatureFlagOverride[] = (data || []).map((o: any) => ({
        userId: o.user_id,
        email: o.profiles?.email || 'Unknown',
        featureName: o.feature_name,
        isEnabled: o.is_enabled
      }));

      setUserOverrides(overrides);
    } catch (err: any) {
      console.error('Error loading user overrides:', err);
    } finally {
      setLoadingOverrides(false);
    }
  };

  const updateFlag = async (flagId: string, updates: Partial<FeatureFlag>) => {
    setSaving(true);
    setError(null);
    try {
      const updateData: any = {};
      if (updates.defaultEnabled !== undefined) updateData.default_enabled = updates.defaultEnabled;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.rolloutPercentage !== undefined) updateData.rollout_percentage = updates.rolloutPercentage;
      if (updates.allowedCohorts !== undefined) updateData.allowed_cohorts = updates.allowedCohorts;
      if (updates.allowedRoles !== undefined) updateData.allowed_roles = updates.allowedRoles;

      const { error } = await supabase
        .from('feature_flags')
        .update(updateData)
        .eq('id', flagId);

      if (error) throw error;

      setSuccess('Feature flag updated successfully');
      await loadFlags();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating flag:', err);
      setError('Failed to update feature flag');
    } finally {
      setSaving(false);
    }
  };

  const addUserToCohort = async () => {
    if (!newUserEmail.trim()) return;

    setSaving(true);
    setError(null);
    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newUserEmail.trim())
        .single();

      if (userError || !userData) {
        setError('User not found. Please check the email address.');
        return;
      }

      // Get current user for assigned_by
      const { data: { user } } = await supabase.auth.getUser();

      // Add to cohort
      const { error } = await supabase
        .from('user_cohorts')
        .upsert({
          user_id: userData.id,
          cohort: newUserCohort,
          assigned_by: user?.id
        }, {
          onConflict: 'user_id,cohort'
        });

      if (error) throw error;

      setSuccess(`User added to ${COHORT_INFO[newUserCohort].label} cohort`);
      setShowAddUserModal(false);
      setNewUserEmail('');
      await loadUsersWithCohorts();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error adding user to cohort:', err);
      setError('Failed to add user to cohort');
    } finally {
      setSaving(false);
    }
  };

  const removeUserFromCohort = async (userId: string, cohort: UserCohort) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_cohorts')
        .delete()
        .eq('user_id', userId)
        .eq('cohort', cohort);

      if (error) throw error;

      setSuccess('User removed from cohort');
      await loadUsersWithCohorts();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error removing user from cohort:', err);
      setError('Failed to remove user from cohort');
    } finally {
      setSaving(false);
    }
  };

  // Filter flags by search
  const filteredFlags = flags.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter users by search
  const filteredUsers = usersWithCohorts.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Stats
  const enabledFlags = flags.filter(f => f.defaultEnabled && f.isActive).length;
  const totalCohortUsers = new Set(usersWithCohorts.map(u => u.userId)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900 flex items-center gap-2">
            <FlagIcon />
            Feature Flag Manager
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Control feature rollouts and user access
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
            {enabledFlags} / {flags.length} Enabled
          </div>
          <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
            {totalCohortUsers} Users in Cohorts
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
          <CheckIcon />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { key: 'flags', label: 'Feature Flags', icon: FlagIcon },
            { key: 'cohorts', label: 'User Cohorts', icon: UsersIcon },
            { key: 'users', label: 'User Overrides', icon: UsersIcon },
            { key: 'rollouts', label: 'Rollout Status', icon: ChartIcon },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as TabType)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-navy-900 text-navy-900 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'flags' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search flags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
            />
          </div>

          {/* Flags List */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-navy-900">{flag.displayName}</h3>
                        <span className="text-xs text-gray-400 font-mono">{flag.name}</span>
                        {!flag.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{flag.description}</p>

                      {/* Cohorts */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {flag.allowedCohorts.map((cohort) => (
                          <span
                            key={cohort}
                            className={`px-2 py-1 rounded-full text-xs ${COHORT_INFO[cohort as UserCohort]?.color || 'bg-gray-100 text-gray-700'}`}
                          >
                            {COHORT_INFO[cohort as UserCohort]?.label || cohort}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                      {/* Rollout Percentage */}
                      <div className="text-center">
                        <div className="text-sm font-medium text-navy-900">{flag.rolloutPercentage}%</div>
                        <div className="text-xs text-gray-500">Rollout</div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => updateFlag(flag.id, { defaultEnabled: !flag.defaultEnabled })}
                        disabled={saving}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          flag.defaultEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            flag.defaultEnabled ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => setSelectedFlag(flag)}
                        className="p-2 text-gray-400 hover:text-navy-900 hover:bg-gray-100 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'cohorts' && (
        <div className="space-y-4">
          {/* Cohort Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(Object.entries(COHORT_INFO) as [UserCohort, typeof COHORT_INFO[UserCohort]][]).map(([cohort, info]) => {
              const count = usersWithCohorts.filter(u => u.cohorts.includes(cohort)).length;
              return (
                <div key={cohort} className={`p-4 rounded-xl ${info.color} bg-opacity-50`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm font-medium">{info.label}</div>
                  <div className="text-xs opacity-70">{info.description}</div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
              />
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User to Cohort
            </button>
          </div>

          {/* Users List */}
          {loadingCohorts ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.userId}
                  className="bg-white rounded-lg p-4 border border-gray-100 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-navy-900">{user.email}</div>
                    <div className="text-xs text-gray-400 font-mono">{user.userId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.cohorts.map((cohort) => (
                      <span
                        key={cohort}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${COHORT_INFO[cohort]?.color || 'bg-gray-100'}`}
                      >
                        {COHORT_INFO[cohort]?.label || cohort}
                        <button
                          onClick={() => removeUserFromCohort(user.userId, cohort)}
                          className="ml-1 hover:text-red-500"
                        >
                          <XIcon />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users in cohorts yet. Add users to enable phased rollouts.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <p className="text-gray-600">
            User-specific feature flag overrides. These take precedence over cohort and global settings.
          </p>

          {loadingOverrides ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {userOverrides.map((override, index) => (
                <div
                  key={`${override.userId}-${override.featureName}-${index}`}
                  className="bg-white rounded-lg p-4 border border-gray-100 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-navy-900">{override.email}</div>
                    <div className="text-sm text-gray-600">{override.featureName}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    override.isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {override.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
              {userOverrides.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No user-specific overrides configured.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rollouts' && (
        <div className="space-y-4">
          <p className="text-gray-600">
            Rollout status overview showing feature adoption across cohorts.
          </p>

          <div className="grid gap-4">
            {flags.filter(f => f.isActive).map((flag) => (
              <div key={flag.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-navy-900">{flag.displayName}</h3>
                    <p className="text-xs text-gray-500">{flag.name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    flag.defaultEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {flag.defaultEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {/* Rollout Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rollout Progress</span>
                    <span className="font-medium">{flag.rolloutPercentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${flag.rolloutPercentage}%` }}
                    />
                  </div>

                  {/* Rollout Controls */}
                  <div className="flex gap-2 mt-3">
                    {[10, 25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => updateFlag(flag.id, { rolloutPercentage: pct })}
                        disabled={saving}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          flag.rolloutPercentage === pct
                            ? 'bg-navy-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cohorts */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  {flag.allowedCohorts.map((cohort) => (
                    <span
                      key={cohort}
                      className={`px-2 py-1 rounded-full text-xs ${COHORT_INFO[cohort as UserCohort]?.color || 'bg-gray-100'}`}
                    >
                      {COHORT_INFO[cohort as UserCohort]?.label || cohort}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Flag Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4">Edit {selectedFlag.displayName}</h3>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Active Status</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedFlag({ ...selectedFlag, isActive: true })}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      selectedFlag.isActive
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setSelectedFlag({ ...selectedFlag, isActive: false })}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !selectedFlag.isActive
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {/* Default Enabled */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default State</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedFlag({ ...selectedFlag, defaultEnabled: true })}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      selectedFlag.defaultEnabled
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Enabled
                  </button>
                  <button
                    onClick={() => setSelectedFlag({ ...selectedFlag, defaultEnabled: false })}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !selectedFlag.defaultEnabled
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Disabled
                  </button>
                </div>
              </div>

              {/* Rollout Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rollout Percentage: {selectedFlag.rolloutPercentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedFlag.rolloutPercentage}
                  onChange={(e) => setSelectedFlag({ ...selectedFlag, rolloutPercentage: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Allowed Cohorts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Cohorts</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(COHORT_INFO) as UserCohort[]).map((cohort) => (
                    <button
                      key={cohort}
                      onClick={() => {
                        const currentCohorts = selectedFlag.allowedCohorts || [];
                        const newCohorts = currentCohorts.includes(cohort)
                          ? currentCohorts.filter(c => c !== cohort)
                          : [...currentCohorts, cohort];
                        setSelectedFlag({ ...selectedFlag, allowedCohorts: newCohorts });
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        selectedFlag.allowedCohorts?.includes(cohort)
                          ? COHORT_INFO[cohort].color
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {COHORT_INFO[cohort].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setSelectedFlag(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateFlag(selectedFlag.id, {
                    isActive: selectedFlag.isActive,
                    defaultEnabled: selectedFlag.defaultEnabled,
                    rolloutPercentage: selectedFlag.rolloutPercentage,
                    allowedCohorts: selectedFlag.allowedCohorts
                  });
                  setSelectedFlag(null);
                }}
                disabled={saving}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User to Cohort Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4">Add User to Cohort</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
                <select
                  value={newUserCohort}
                  onChange={(e) => setNewUserCohort(e.target.value as UserCohort)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none"
                >
                  {(Object.entries(COHORT_INFO) as [UserCohort, typeof COHORT_INFO[UserCohort]][]).map(([cohort, info]) => (
                    <option key={cohort} value={cohort}>{info.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {COHORT_INFO[newUserCohort].description}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUserEmail('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addUserToCohort}
                disabled={saving || !newUserEmail.trim()}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add to Cohort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagManager;
