/**
 * useAuthz - Authorization Hook for Visionary AI
 *
 * Provides role-based access control helpers for frontend components.
 * Fetches and caches user's platform roles and team memberships.
 *
 * @module useAuthz
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

export type PlatformRole = 'platform_admin' | 'support_agent';
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMembership {
  teamId: string;
  teamName: string;
  teamSlug?: string;
  role: TeamRole;
  isActive: boolean;
  joinedAt: string;
}

export interface Goal {
  id: string;
  teamId?: string;
  createdBy: string;
  assignedTo?: string[];
}

export interface UseAuthzReturn {
  // State
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  platformRole: PlatformRole | null;
  teamMemberships: TeamMembership[];

  // Platform Role Helpers
  isPlatformAdmin: () => boolean;
  isSupportAgent: () => boolean;
  hasPlatformRole: (roles: PlatformRole[]) => boolean;

  // Team Role Helpers
  getTeamRole: (teamId: string) => TeamRole | null;
  hasTeamRole: (teamId: string, roles: TeamRole[]) => boolean;
  isTeamMember: (teamId: string) => boolean;
  canManageTeam: (teamId: string) => boolean;
  canInviteMembers: (teamId: string) => boolean;
  canEditTeamContent: (teamId: string) => boolean;

  // Resource Helpers
  canEditGoal: (goal: Goal) => boolean;
  canDeleteGoal: (goal: Goal) => boolean;
  isResourceOwner: (resourceUserId: string) => boolean;

  // Actions
  refresh: () => Promise<void>;
}

// ============================================
// Constants
// ============================================

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// ============================================
// Hook Implementation
// ============================================

export function useAuthz(): UseAuthzReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformRole | null>(null);
  const [teamMemberships, setTeamMemberships] = useState<TeamMembership[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchAuthzData = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUserId(null);
      setPlatformRole(null);
      setTeamMemberships([]);
      setIsLoading(false);
      return;
    }

    const currentUserId = session.user.id;
    setUserId(currentUserId);

    try {
      // Fetch platform role
      const { data: platformRoleData } = await supabase
        .from('platform_roles')
        .select('role')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .single();

      setPlatformRole(platformRoleData?.role as PlatformRole | null);

      // Fetch team memberships
      const { data: teamData } = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          is_active,
          joined_at,
          teams (
            name,
            slug
          )
        `)
        .eq('user_id', currentUserId)
        .eq('is_active', true);

      const memberships: TeamMembership[] = (teamData || []).map((tm: any) => ({
        teamId: tm.team_id,
        teamName: tm.teams?.name || 'Unknown',
        teamSlug: tm.teams?.slug,
        role: tm.role as TeamRole,
        isActive: tm.is_active,
        joinedAt: tm.joined_at
      }));

      setTeamMemberships(memberships);
      setLastFetchTime(Date.now());

    } catch (error) {
      console.error('Error fetching authorization data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    // Initial fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchAuthzData(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        fetchAuthzData(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchAuthzData]);

  // ============================================
  // Refresh Function
  // ============================================

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetchAuthzData(session);
  }, [fetchAuthzData]);

  // ============================================
  // Platform Role Helpers
  // ============================================

  const isPlatformAdmin = useCallback((): boolean => {
    return platformRole === 'platform_admin';
  }, [platformRole]);

  const isSupportAgent = useCallback((): boolean => {
    return platformRole === 'support_agent';
  }, [platformRole]);

  const hasPlatformRole = useCallback((roles: PlatformRole[]): boolean => {
    return platformRole !== null && roles.includes(platformRole);
  }, [platformRole]);

  // ============================================
  // Team Role Helpers
  // ============================================

  const getTeamRole = useCallback((teamId: string): TeamRole | null => {
    const membership = teamMemberships.find(tm => tm.teamId === teamId);
    return membership?.role || null;
  }, [teamMemberships]);

  const hasTeamRole = useCallback((teamId: string, roles: TeamRole[]): boolean => {
    // Platform admins bypass team role checks
    if (platformRole === 'platform_admin') {
      return true;
    }

    const membership = teamMemberships.find(tm => tm.teamId === teamId);
    return membership !== undefined && roles.includes(membership.role);
  }, [teamMemberships, platformRole]);

  const isTeamMember = useCallback((teamId: string): boolean => {
    // Platform admins are members of all teams
    if (platformRole === 'platform_admin') {
      return true;
    }

    return teamMemberships.some(tm => tm.teamId === teamId);
  }, [teamMemberships, platformRole]);

  const canManageTeam = useCallback((teamId: string): boolean => {
    return hasTeamRole(teamId, ['owner', 'admin']);
  }, [hasTeamRole]);

  const canInviteMembers = useCallback((teamId: string): boolean => {
    return hasTeamRole(teamId, ['owner', 'admin']);
  }, [hasTeamRole]);

  const canEditTeamContent = useCallback((teamId: string): boolean => {
    return hasTeamRole(teamId, ['owner', 'admin', 'member']);
  }, [hasTeamRole]);

  // ============================================
  // Resource Helpers
  // ============================================

  const isResourceOwner = useCallback((resourceUserId: string): boolean => {
    if (platformRole === 'platform_admin') {
      return true;
    }
    return userId === resourceUserId;
  }, [userId, platformRole]);

  const canEditGoal = useCallback((goal: Goal): boolean => {
    // Platform admins can edit any goal
    if (platformRole === 'platform_admin') {
      return true;
    }

    // Creator can always edit
    if (goal.createdBy === userId) {
      return true;
    }

    // Team goals: check team role
    if (goal.teamId) {
      // Owners and admins can edit any team goal
      if (hasTeamRole(goal.teamId, ['owner', 'admin'])) {
        return true;
      }

      // Assigned members can edit
      if (goal.assignedTo?.includes(userId || '')) {
        return true;
      }
    }

    return false;
  }, [userId, platformRole, hasTeamRole]);

  const canDeleteGoal = useCallback((goal: Goal): boolean => {
    // Platform admins can delete any goal
    if (platformRole === 'platform_admin') {
      return true;
    }

    // Creator can delete their own goals
    if (goal.createdBy === userId) {
      return true;
    }

    // Team goals: only owners/admins can delete
    if (goal.teamId) {
      return hasTeamRole(goal.teamId, ['owner', 'admin']);
    }

    return false;
  }, [userId, platformRole, hasTeamRole]);

  // ============================================
  // Return Value
  // ============================================

  return useMemo(() => ({
    // State
    isLoading,
    isAuthenticated: userId !== null,
    userId,
    platformRole,
    teamMemberships,

    // Platform Role Helpers
    isPlatformAdmin,
    isSupportAgent,
    hasPlatformRole,

    // Team Role Helpers
    getTeamRole,
    hasTeamRole,
    isTeamMember,
    canManageTeam,
    canInviteMembers,
    canEditTeamContent,

    // Resource Helpers
    canEditGoal,
    canDeleteGoal,
    isResourceOwner,

    // Actions
    refresh
  }), [
    isLoading,
    userId,
    platformRole,
    teamMemberships,
    isPlatformAdmin,
    isSupportAgent,
    hasPlatformRole,
    getTeamRole,
    hasTeamRole,
    isTeamMember,
    canManageTeam,
    canInviteMembers,
    canEditTeamContent,
    canEditGoal,
    canDeleteGoal,
    isResourceOwner,
    refresh
  ]);
}

// ============================================
// Utility Components
// ============================================

/**
 * Props for the NoAccess component
 */
export interface NoAccessProps {
  message?: string;
  showContactAdmin?: boolean;
}

/**
 * Default no-access message component
 */
export function NoAccessMessage({
  message = "You don't have permission to access this content.",
  showContactAdmin = true
}: NoAccessProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-red-500 mb-4">
        <svg
          className="w-16 h-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
      <p className="text-gray-500 mb-4">{message}</p>
      {showContactAdmin && (
        <p className="text-sm text-gray-400">
          Contact your team admin to request access.
        </p>
      )}
    </div>
  );
}

/**
 * Higher-order component for role-gated content
 */
export interface RequireRoleProps {
  children: React.ReactNode;
  teamId?: string;
  requiredTeamRoles?: TeamRole[];
  requiredPlatformRoles?: PlatformRole[];
  fallback?: React.ReactNode;
}

export function RequireRole({
  children,
  teamId,
  requiredTeamRoles,
  requiredPlatformRoles,
  fallback = <NoAccessMessage />
}: RequireRoleProps): JSX.Element {
  const { isLoading, hasTeamRole, hasPlatformRole } = useAuthz();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Check platform role if required
  if (requiredPlatformRoles && !hasPlatformRole(requiredPlatformRoles)) {
    return <>{fallback}</>;
  }

  // Check team role if required
  if (teamId && requiredTeamRoles && !hasTeamRole(teamId, requiredTeamRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default useAuthz;
