import React, { useState, useEffect } from 'react';
import {
  getAllFeatureFlags,
  updateFeatureFlag,
  createFeatureFlag,
  setRolloutPercentage,
  getRolloutStats,
  clearFlagCache,
  FeatureFlag,
  AGENT_FEATURE_FLAGS
} from '../../lib/feature-flags';

interface FlagWithStats extends FeatureFlag {
  estimated_reach?: number;
  target_count?: number;
  excluded_count?: number;
}

const FeatureFlagAdmin: React.FC = () => {
  const [flags, setFlags] = useState<FlagWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<FeatureFlag>>({});

  // New flag form state
  const [newFlag, setNewFlag] = useState({
    name: '',
    description: '',
    enabled: false,
    rollout_percentage: 0
  });

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);

    try {
      const allFlags = await getAllFeatureFlags();

      // Enrich with stats
      const enriched = await Promise.all(
        allFlags.map(async (flag) => {
          const stats = await getRolloutStats(flag.name);
          return {
            ...flag,
            estimated_reach: stats.estimated_reach,
            target_count: stats.target_count,
            excluded_count: stats.excluded_count
          };
        })
      );

      setFlags(enriched);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (flagName: string, currentEnabled: boolean) => {
    const result = await updateFeatureFlag(flagName, { enabled: !currentEnabled });

    if (result.success) {
      setSuccess(`Flag "${flagName}" ${!currentEnabled ? 'enabled' : 'disabled'}`);
      await fetchFlags();
    } else {
      setError(result.error || 'Failed to update flag');
    }

    setTimeout(() => setSuccess(null), 3000);
  };

  const handleRolloutChange = async (flagName: string, percentage: number) => {
    const result = await setRolloutPercentage(flagName, percentage);

    if (result.success) {
      setSuccess(`Rollout for "${flagName}" set to ${percentage}%`);
      await fetchFlags();
    } else {
      setError(result.error || 'Failed to update rollout');
    }

    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCreateFlag = async () => {
    if (!newFlag.name.trim()) {
      setError('Flag name is required');
      return;
    }

    const result = await createFeatureFlag({
      name: newFlag.name.toLowerCase().replace(/\s+/g, '_'),
      description: newFlag.description,
      enabled: newFlag.enabled,
      rollout_percentage: newFlag.rollout_percentage
    });

    if (result.success) {
      setSuccess(`Flag "${newFlag.name}" created`);
      setShowCreateModal(false);
      setNewFlag({ name: '', description: '', enabled: false, rollout_percentage: 0 });
      await fetchFlags();
    } else {
      setError(result.error || 'Failed to create flag');
    }

    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveEdit = async (flagName: string) => {
    const result = await updateFeatureFlag(flagName, editValues);

    if (result.success) {
      setSuccess(`Flag "${flagName}" updated`);
      setEditingFlag(null);
      setEditValues({});
      await fetchFlags();
    } else {
      setError(result.error || 'Failed to update flag');
    }

    setTimeout(() => setSuccess(null), 3000);
  };

  const startEditing = (flag: FeatureFlag) => {
    setEditingFlag(flag.name);
    setEditValues({
      description: flag.description,
      rollout_percentage: flag.rollout_percentage
    });
  };

  const getRolloutColor = (percentage: number) => {
    if (percentage === 0) return 'bg-slate-600';
    if (percentage < 25) return 'bg-red-500';
    if (percentage < 50) return 'bg-orange-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 100) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const isAgentFlag = (flagName: string) => {
    return Object.values(AGENT_FEATURE_FLAGS).includes(flagName as any);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
            <span>Feature Flags</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage feature rollouts and A/B testing
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              clearFlagCache();
              fetchFlags();
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Flag
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {/* Flags List */}
      <div className="space-y-4">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="bg-slate-800 border border-slate-700 rounded-xl p-5"
          >
            {editingFlag === flag.name ? (
              // Edit Mode
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">
                    {flag.name}
                    {isAgentFlag(flag.name) && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                        Agent
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingFlag(null);
                        setEditValues({});
                      }}
                      className="px-3 py-1.5 text-sm text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(flag.name)}
                      className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={editValues.description || ''}
                    onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Rollout Percentage: {editValues.rollout_percentage}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editValues.rollout_percentage || 0}
                    onChange={(e) => setEditValues({
                      ...editValues,
                      rollout_percentage: parseInt(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              // View Mode
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-white">
                        {flag.name}
                      </h3>
                      {isAgentFlag(flag.name) && (
                        <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                          Agent
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          flag.enabled
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-600/50 text-slate-400'
                        }`}
                      >
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {flag.description || 'No description'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggle(flag.name, flag.enabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        flag.enabled ? 'bg-green-500' : 'bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          flag.enabled ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => startEditing(flag)}
                      className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                      title="Edit flag"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Rollout Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Rollout Progress</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-white">
                        {flag.rollout_percentage}%
                      </span>

                      {/* Quick rollout buttons */}
                      <div className="flex gap-1">
                        {[0, 25, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => handleRolloutChange(flag.name, pct)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              flag.rollout_percentage === pct
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all ${getRolloutColor(flag.rollout_percentage)}`}
                      style={{ width: `${flag.rollout_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 flex gap-6 text-sm">
                  <div>
                    <span className="text-slate-500">Targeted Users:</span>
                    <span className="ml-2 text-white">{flag.target_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Excluded:</span>
                    <span className="ml-2 text-white">{flag.excluded_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Updated:</span>
                    <span className="ml-2 text-slate-300">
                      {new Date(flag.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {flags.length === 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
            <p className="text-slate-400">No feature flags configured</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
            >
              Create Your First Flag
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">
              Create Feature Flag
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Flag Name *
                </label>
                <input
                  type="text"
                  value={newFlag.name}
                  onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                  placeholder="e.g., new_feature_beta"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newFlag.description}
                  onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                  placeholder="What does this flag control?"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Initial Rollout: {newFlag.rollout_percentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newFlag.rollout_percentage}
                  onChange={(e) => setNewFlag({
                    ...newFlag,
                    rollout_percentage: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="newFlagEnabled"
                  checked={newFlag.enabled}
                  onChange={(e) => setNewFlag({ ...newFlag, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500"
                />
                <label htmlFor="newFlagEnabled" className="text-sm text-slate-300">
                  Enable immediately
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFlag({ name: '', description: '', enabled: false, rollout_percentage: 0 });
                }}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFlag}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
              >
                Create Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagAdmin;
