/**
 * useFeatureFlags - Feature Flag Management Hook for Visionary AI
 *
 * Provides feature flag checking and management for frontend components.
 * Supports gradual rollouts, role-based access, and user cohorts.
 *
 * @module useFeatureFlags
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { FeatureFlagName, UserCohort, FeatureFlag, UserFeatureFlag } from '../types';

// ============================================
// Types
// ============================================

export interface FeatureFlagStatus {
  name: FeatureFlagName;
  isEnabled: boolean;
  source: 'user_override' | 'cohort_override' | 'role_override' | 'default';
}

export interface UseFeatureFlagsReturn {
  // State
  isLoading: boolean;
  flags: Map<FeatureFlagName, boolean>;
  flagDetails: FeatureFlagStatus[];
  userCohorts: UserCohort[];

  // Flag Helpers
  isFeatureEnabled: (featureName: FeatureFlagName) => boolean;
  hasAnyFeature: (featureNames: FeatureFlagName[]) => boolean;
  hasAllFeatures: (featureNames: FeatureFlagName[]) => boolean;

  // Admin Functions (require platform_admin role)
  setUserFeatureFlag: (userId: string, featureName: FeatureFlagName, isEnabled: boolean) => Promise<boolean>;
  setUserCohort: (userId: string, cohort: UserCohort) => Promise<boolean>;
  removeUserCohort: (userId: string, cohort: UserCohort) => Promise<boolean>;
  updateFeatureFlag: (flagId: string, updates: Partial<FeatureFlag>) => Promise<boolean>;
  getAllFlags: () => Promise<FeatureFlag[]>;
  getUsersInCohort: (cohort: UserCohort) => Promise<{ userId: string; email?: string }[]>;

  // Actions
  refresh: () => Promise<void>;
}

// Cache duration in milliseconds (2 minutes)
const CACHE_DURATION = 2 * 60 * 1000;

// Default feature flags - these are used when database flags can't be fetched
// This ensures core features remain accessible even if the feature flag system fails
const DEFAULT_FLAGS: Record<FeatureFlagName, boolean> = {
  goals_page: true,
  ai_coach: true,
  financial_dashboard: true,
  team_collaboration: true,
  voice_coach: true,
  print_products: true,
  partner_workspace: true,
  integrations: true,
  team_leaderboards: true,
  manager_dashboard: true,
  mdals_lab: false,
  advanced_analytics: false,
  beta_features: false
};

// ============================================
// Hook Implementation
// ============================================

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [isLoading, setIsLoading] = useState(true);
  // Initialize with default flags
  const [flags, setFlags] = useState<Map<FeatureFlagName, boolean>>(() => {
    const map = new Map<FeatureFlagName, boolean>();
    Object.entries(DEFAULT_FLAGS).forEach(([key, value]) => {
      map.set(key as FeatureFlagName, value);
    });
    return map;
  });
  const [flagDetails, setFlagDetails] = useState<FeatureFlagStatus[]>([]);
  const [userCohorts, setUserCohorts] = useState<UserCohort[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchFeatureFlags = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      // Keep default flags for non-authenticated users
      setUserCohorts(['all_users']);
      setIsLoading(false);
      return;
    }

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    // Check cache
    if (Date.now() - lastFetchTime < CACHE_DURATION && flags.size > 0) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch user's feature flags using the RPC function
      const { data: userFeatures, error: featuresError } = await supabase
        .rpc('get_user_features', { p_user_id: currentUserId });

      if (featuresError) {
        console.error('Error fetching user features:', featuresError);
        // Fall back to fetching all flags with default values
        const { data: allFlags } = await supabase
          .from('feature_flags')
          .select('name, default_enabled')
          .eq('is_active', true);

        const flagMap = new Map<FeatureFlagName, boolean>();
        const details: FeatureFlagStatus[] = [];

        (allFlags || []).forEach((flag: any) => {
          flagMap.set(flag.name as FeatureFlagName, flag.default_enabled);
          details.push({
            name: flag.name as FeatureFlagName,
            isEnabled: flag.default_enabled,
            source: 'default'
          });
        });

        setFlags(flagMap);
        setFlagDetails(details);
      } else {
        const flagMap = new Map<FeatureFlagName, boolean>();
        const details: FeatureFlagStatus[] = [];

        (userFeatures || []).forEach((feature: any) => {
          flagMap.set(feature.feature_name as FeatureFlagName, feature.is_enabled);
          details.push({
            name: feature.feature_name as FeatureFlagName,
            isEnabled: feature.is_enabled,
            source: feature.source
          });
        });

        setFlags(flagMap);
        setFlagDetails(details);
      }

      // Fetch user's cohorts
      const { data: cohortData } = await supabase
        .from('user_cohorts')
        .select('cohort')
        .eq('user_id', currentUserId)
        .or('expires_at.is.null,expires_at.gt.now()');

      const cohorts = (cohortData || []).map((c: any) => c.cohort as UserCohort);
      if (cohorts.length === 0) {
        cohorts.push('all_users');
      }
      setUserCohorts(cohorts);

      setLastFetchTime(Date.now());
    } catch (error) {
      console.error('Error in fetchFeatureFlags:', error);
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchTime, flags.size]);

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    // Initial fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchFeatureFlags(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setLastFetchTime(0); // Reset cache on auth change
        fetchFeatureFlags(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchFeatureFlags]);

  // ============================================
  // Flag Helpers
  // ============================================

  const isFeatureEnabled = useCallback((featureName: FeatureFlagName): boolean => {
    // First check the loaded flags, then fall back to defaults
    return flags.get(featureName) ?? DEFAULT_FLAGS[featureName] ?? false;
  }, [flags]);

  const hasAnyFeature = useCallback((featureNames: FeatureFlagName[]): boolean => {
    return featureNames.some(name => flags.get(name) === true);
  }, [flags]);

  const hasAllFeatures = useCallback((featureNames: FeatureFlagName[]): boolean => {
    return featureNames.every(name => flags.get(name) === true);
  }, [flags]);

  // ============================================
  // Admin Functions
  // ============================================

  const setUserFeatureFlag = useCallback(async (
    targetUserId: string,
    featureName: FeatureFlagName,
    isEnabled: boolean
  ): Promise<boolean> => {
    try {
      // Get the feature flag ID
      const { data: flagData, error: flagError } = await supabase
        .from('feature_flags')
        .select('id')
        .eq('name', featureName)
        .single();

      if (flagError || !flagData) {
        console.error('Feature flag not found:', featureName);
        return false;
      }

      // Upsert the user feature flag
      const { error } = await supabase
        .from('user_feature_flags')
        .upsert({
          user_id: targetUserId,
          feature_flag_id: flagData.id,
          feature_name: featureName,
          is_enabled: isEnabled,
          enabled_at: isEnabled ? new Date().toISOString() : null,
          disabled_at: !isEnabled ? new Date().toISOString() : null
        }, {
          onConflict: 'user_id,feature_flag_id'
        });

      if (error) {
        console.error('Error setting user feature flag:', error);
        return false;
      }

      // Refresh if setting for current user
      if (targetUserId === userId) {
        setLastFetchTime(0);
        const { data: { session } } = await supabase.auth.getSession();
        await fetchFeatureFlags(session);
      }

      return true;
    } catch (error) {
      console.error('Error in setUserFeatureFlag:', error);
      return false;
    }
  }, [userId, fetchFeatureFlags]);

  const setUserCohort = useCallback(async (
    targetUserId: string,
    cohort: UserCohort
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('user_cohorts')
        .upsert({
          user_id: targetUserId,
          cohort: cohort,
          assigned_by: user?.id
        }, {
          onConflict: 'user_id,cohort'
        });

      if (error) {
        console.error('Error setting user cohort:', error);
        return false;
      }

      // Refresh if setting for current user
      if (targetUserId === userId) {
        setLastFetchTime(0);
        const { data: { session } } = await supabase.auth.getSession();
        await fetchFeatureFlags(session);
      }

      return true;
    } catch (error) {
      console.error('Error in setUserCohort:', error);
      return false;
    }
  }, [userId, fetchFeatureFlags]);

  const removeUserCohort = useCallback(async (
    targetUserId: string,
    cohort: UserCohort
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('user_cohorts')
        .delete()
        .eq('user_id', targetUserId)
        .eq('cohort', cohort);

      if (error) {
        console.error('Error removing user cohort:', error);
        return false;
      }

      // Refresh if setting for current user
      if (targetUserId === userId) {
        setLastFetchTime(0);
        const { data: { session } } = await supabase.auth.getSession();
        await fetchFeatureFlags(session);
      }

      return true;
    } catch (error) {
      console.error('Error in removeUserCohort:', error);
      return false;
    }
  }, [userId, fetchFeatureFlags]);

  const updateFeatureFlag = useCallback(async (
    flagId: string,
    updates: Partial<FeatureFlag>
  ): Promise<boolean> => {
    try {
      const updateData: any = {};
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.defaultEnabled !== undefined) updateData.default_enabled = updates.defaultEnabled;
      if (updates.allowedRoles !== undefined) updateData.allowed_roles = updates.allowedRoles;
      if (updates.allowedCohorts !== undefined) updateData.allowed_cohorts = updates.allowedCohorts;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.rolloutPercentage !== undefined) updateData.rollout_percentage = updates.rolloutPercentage;

      const { error } = await supabase
        .from('feature_flags')
        .update(updateData)
        .eq('id', flagId);

      if (error) {
        console.error('Error updating feature flag:', error);
        return false;
      }

      // Refresh flags
      setLastFetchTime(0);
      const { data: { session } } = await supabase.auth.getSession();
      await fetchFeatureFlags(session);

      return true;
    } catch (error) {
      console.error('Error in updateFeatureFlag:', error);
      return false;
    }
  }, [fetchFeatureFlags]);

  const getAllFlags = useCallback(async (): Promise<FeatureFlag[]> => {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching all flags:', error);
        return [];
      }

      return (data || []).map((flag: any) => ({
        id: flag.id,
        name: flag.name,
        displayName: flag.display_name,
        description: flag.description,
        defaultEnabled: flag.default_enabled,
        allowedRoles: flag.allowed_roles,
        allowedCohorts: flag.allowed_cohorts,
        isActive: flag.is_active,
        rolloutPercentage: flag.rollout_percentage,
        createdAt: flag.created_at,
        updatedAt: flag.updated_at
      }));
    } catch (error) {
      console.error('Error in getAllFlags:', error);
      return [];
    }
  }, []);

  const getUsersInCohort = useCallback(async (
    cohort: UserCohort
  ): Promise<{ userId: string; email?: string }[]> => {
    try {
      const { data, error } = await supabase
        .from('user_cohorts')
        .select(`
          user_id,
          profiles:user_id (
            email
          )
        `)
        .eq('cohort', cohort)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (error) {
        console.error('Error fetching users in cohort:', error);
        return [];
      }

      return (data || []).map((uc: any) => ({
        userId: uc.user_id,
        email: uc.profiles?.email
      }));
    } catch (error) {
      console.error('Error in getUsersInCohort:', error);
      return [];
    }
  }, []);

  // ============================================
  // Refresh Function
  // ============================================

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLastFetchTime(0);
    const { data: { session } } = await supabase.auth.getSession();
    await fetchFeatureFlags(session);
  }, [fetchFeatureFlags]);

  // ============================================
  // Return Value
  // ============================================

  return useMemo(() => ({
    // State
    isLoading,
    flags,
    flagDetails,
    userCohorts,

    // Flag Helpers
    isFeatureEnabled,
    hasAnyFeature,
    hasAllFeatures,

    // Admin Functions
    setUserFeatureFlag,
    setUserCohort,
    removeUserCohort,
    updateFeatureFlag,
    getAllFlags,
    getUsersInCohort,

    // Actions
    refresh
  }), [
    isLoading,
    flags,
    flagDetails,
    userCohorts,
    isFeatureEnabled,
    hasAnyFeature,
    hasAllFeatures,
    setUserFeatureFlag,
    setUserCohort,
    removeUserCohort,
    updateFeatureFlag,
    getAllFlags,
    getUsersInCohort,
    refresh
  ]);
}

// ============================================
// Utility Components
// ============================================

export interface FeatureGateProps {
  feature: FeatureFlagName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component wrapper that conditionally renders based on feature flag
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps): JSX.Element | null {
  const { isLoading, isFeatureEnabled } = useFeatureFlags();

  if (isLoading) {
    return null;
  }

  if (!isFeatureEnabled(feature)) {
    return fallback as JSX.Element | null;
  }

  return <>{children}</>;
}

export interface MultiFeatureGateProps {
  features: FeatureFlagName[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component wrapper that conditionally renders based on multiple feature flags
 */
export function MultiFeatureGate({
  features,
  requireAll = true,
  children,
  fallback = null
}: MultiFeatureGateProps): JSX.Element | null {
  const { isLoading, hasAllFeatures, hasAnyFeature } = useFeatureFlags();

  if (isLoading) {
    return null;
  }

  const hasAccess = requireAll ? hasAllFeatures(features) : hasAnyFeature(features);

  if (!hasAccess) {
    return fallback as JSX.Element | null;
  }

  return <>{children}</>;
}

export default useFeatureFlags;
