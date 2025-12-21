/**
 * Feature Flags and Rollout Management
 *
 * Provides feature flag functionality for gradual rollout of AI agent features.
 * Supports percentage-based rollout, user targeting, and A/B testing.
 */

import { supabase } from './supabase';

// Feature flag configuration
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  target_users?: string[];
  excluded_users?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Known feature flags for the agent system
export const AGENT_FEATURE_FLAGS = {
  // Core agent features
  AGENT_ACTIONS_ENABLED: 'agent_actions_enabled',
  AUTO_EXECUTE_LOW_RISK: 'auto_execute_low_risk',
  CALENDAR_INTEGRATION: 'calendar_integration',

  // Execution modes
  PARALLEL_EXECUTION: 'parallel_execution',
  BATCH_ACTIONS: 'batch_actions',

  // Advanced features
  SMART_SCHEDULING: 'smart_scheduling',
  PREDICTIVE_SUGGESTIONS: 'predictive_suggestions',
  TEAM_COLLABORATION: 'team_collaboration',

  // Experimental
  VOICE_COMMANDS: 'voice_commands',
  NATURAL_LANGUAGE_INPUT: 'natural_language_input',
} as const;

// Cache for feature flags
let flagCache: Map<string, { flag: FeatureFlag; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

// User bucket cache for consistent percentage rollouts
let userBucketCache: Map<string, number> = new Map();

/**
 * Generate a consistent bucket (0-99) for a user
 * Uses a simple hash to ensure the same user always gets the same bucket
 */
function getUserBucket(userId: string, flagName: string): number {
  const cached = userBucketCache.get(`${userId}:${flagName}`);
  if (cached !== undefined) return cached;

  // Simple hash function for consistent bucketing
  const str = `${userId}:${flagName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const bucket = Math.abs(hash) % 100;

  userBucketCache.set(`${userId}:${flagName}`, bucket);
  return bucket;
}

/**
 * Fetch a feature flag from the database
 */
async function fetchFlag(flagName: string): Promise<FeatureFlag | null> {
  const cached = flagCache.get(flagName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.flag;
  }

  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('name', flagName)
      .single();

    if (error || !data) {
      return null;
    }

    const flag = data as FeatureFlag;
    flagCache.set(flagName, { flag, timestamp: Date.now() });
    return flag;
  } catch (err) {
    console.error('Error fetching feature flag:', err);
    return null;
  }
}

/**
 * Check if a feature is enabled for a specific user
 */
export async function isFeatureEnabled(
  flagName: string,
  userId?: string,
  defaultValue = false
): Promise<boolean> {
  const flag = await fetchFlag(flagName);

  if (!flag) {
    return defaultValue;
  }

  // If the flag is disabled globally, return false
  if (!flag.enabled) {
    return false;
  }

  // If there's no user, just check if it's enabled
  if (!userId) {
    return flag.enabled && flag.rollout_percentage === 100;
  }

  // Check if user is explicitly excluded
  if (flag.excluded_users?.includes(userId)) {
    return false;
  }

  // Check if user is explicitly targeted
  if (flag.target_users?.includes(userId)) {
    return true;
  }

  // Check percentage-based rollout
  if (flag.rollout_percentage < 100) {
    const bucket = getUserBucket(userId, flagName);
    return bucket < flag.rollout_percentage;
  }

  return true;
}

/**
 * Check multiple features at once
 */
export async function getEnabledFeatures(
  flagNames: string[],
  userId?: string
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  await Promise.all(
    flagNames.map(async (name) => {
      results[name] = await isFeatureEnabled(name, userId);
    })
  );

  return results;
}

/**
 * Get all agent feature flags for a user
 */
export async function getAgentFeatures(userId: string): Promise<Record<string, boolean>> {
  return getEnabledFeatures(Object.values(AGENT_FEATURE_FLAGS), userId);
}

/**
 * Admin: Update a feature flag
 */
export async function updateFeatureFlag(
  flagName: string,
  updates: Partial<Omit<FeatureFlag, 'id' | 'name' | 'created_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('feature_flags')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('name', flagName);

    if (error) throw error;

    // Invalidate cache
    flagCache.delete(flagName);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Create a new feature flag
 */
export async function createFeatureFlag(
  flag: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        ...flag,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Get all feature flags
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name');

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Error fetching all feature flags:', err);
    return [];
  }
}

/**
 * Admin: Set rollout percentage for gradual deployment
 */
export async function setRolloutPercentage(
  flagName: string,
  percentage: number
): Promise<{ success: boolean; error?: string }> {
  if (percentage < 0 || percentage > 100) {
    return { success: false, error: 'Percentage must be between 0 and 100' };
  }

  return updateFeatureFlag(flagName, { rollout_percentage: percentage });
}

/**
 * Admin: Add users to target list
 */
export async function addTargetUsers(
  flagName: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const flag = await fetchFlag(flagName);
  if (!flag) {
    return { success: false, error: 'Feature flag not found' };
  }

  const currentTargets = flag.target_users || [];
  const newTargets = [...new Set([...currentTargets, ...userIds])];

  return updateFeatureFlag(flagName, { target_users: newTargets });
}

/**
 * Admin: Remove users from target list
 */
export async function removeTargetUsers(
  flagName: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const flag = await fetchFlag(flagName);
  if (!flag) {
    return { success: false, error: 'Feature flag not found' };
  }

  const currentTargets = flag.target_users || [];
  const newTargets = currentTargets.filter(id => !userIds.includes(id));

  return updateFeatureFlag(flagName, { target_users: newTargets });
}

/**
 * Clear the flag cache (useful after updates)
 */
export function clearFlagCache() {
  flagCache.clear();
}

/**
 * Clear the user bucket cache (use sparingly, changes rollout assignments)
 */
export function clearBucketCache() {
  userBucketCache.clear();
}

/**
 * Get rollout statistics for a flag
 */
export async function getRolloutStats(
  flagName: string
): Promise<{
  flag: FeatureFlag | null;
  estimated_reach: number;
  target_count: number;
  excluded_count: number;
}> {
  const flag = await fetchFlag(flagName);

  if (!flag) {
    return {
      flag: null,
      estimated_reach: 0,
      target_count: 0,
      excluded_count: 0
    };
  }

  return {
    flag,
    estimated_reach: flag.enabled ? flag.rollout_percentage : 0,
    target_count: flag.target_users?.length || 0,
    excluded_count: flag.excluded_users?.length || 0
  };
}

/**
 * React hook helper for feature flags
 * Note: Use this with React's useState/useEffect
 */
export function createFeatureFlagChecker(userId?: string) {
  return {
    isEnabled: (flagName: string, defaultValue = false) =>
      isFeatureEnabled(flagName, userId, defaultValue),

    getAgentFeatures: () => userId
      ? getAgentFeatures(userId)
      : Promise.resolve({} as Record<string, boolean>),

    clearCache: clearFlagCache
  };
}

export default {
  isFeatureEnabled,
  getEnabledFeatures,
  getAgentFeatures,
  updateFeatureFlag,
  createFeatureFlag,
  getAllFeatureFlags,
  setRolloutPercentage,
  addTargetUsers,
  removeTargetUsers,
  getRolloutStats,
  clearFlagCache,
  clearBucketCache,
  createFeatureFlagChecker,
  AGENT_FEATURE_FLAGS
};
